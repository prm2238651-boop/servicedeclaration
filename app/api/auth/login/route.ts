import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, LOCAL_COOKIE_NAME, LOCAL_TWO_FACTOR_COOKIE_NAME, TWO_FACTOR_COOKIE_NAME, createSession, createTwoFactorChallenge, readTwoFactorChallenge } from "@/lib/auth";
import { consumeStoredRecoveryCode, listStoredUsers, recordStoredTotpStep, recordStoredUserLogin, type StoredUser } from "@/lib/user-store";
import { decryptTotpSecret, hashRecoveryCode, requiresTotpVerification, verifyTotp } from "@/lib/totp";
import bcrypt from "bcryptjs";
import { DEFAULT_PERMISSIONS, landingPageForSession } from "@/lib/permissions";
import { jsonBodyErrorResponse, rateLimit, safeJson } from "@/lib/security";

const credentialsSchema = z.object({ matricule: z.string().min(3), password: z.string().min(8) });
const factorSchema = z.object({ code: z.string().min(6).max(64), recoveryCode: z.boolean().optional() });

function isLocalPreview(request: Request) {
  const hostname = new URL(request.url).hostname;
  return process.env.ALLOW_INSECURE_LOCALHOST === "true" && ["127.0.0.1", "localhost"].includes(hostname);
}

function setChallengeCookie(response: NextResponse, request: Request, token: string) {
  const localPreview = isLocalPreview(request);
  response.cookies.set(localPreview ? LOCAL_TWO_FACTOR_COOKIE_NAME : TWO_FACTOR_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: !localPreview,
    path: "/",
    maxAge: 60 * 5,
  });
  response.headers.set("Cache-Control", "no-store");
}

function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(TWO_FACTOR_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 0 });
  response.cookies.set(LOCAL_TWO_FACTOR_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
}

async function createSessionResponse(request: Request, user: StoredUser, formPost: boolean, clearChallenge = false) {
  await recordStoredUserLogin(user.matricule);
  const permissions = user.permissions ?? DEFAULT_PERMISSIONS[user.role];
  const redirectTo = landingPageForSession({ role: user.role, permissions });
  const token = await createSession({
    userId: user.userId,
    matricule: user.matricule,
    name: user.name,
    role: user.role,
    service: user.service,
    permissions,
  });
  const localPreview = isLocalPreview(request);
  const response = formPost
    ? NextResponse.redirect(new URL(redirectTo, request.url), 303)
    : NextResponse.json({ ok: true, redirectTo });
  response.cookies.set(localPreview ? LOCAL_COOKIE_NAME : COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: !localPreview,
    path: "/",
    maxAge: 60 * 30,
  });
  if (clearChallenge) clearChallengeCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function verifySecondFactor(request: Request, body: unknown, formPost: boolean) {
  const parsed = factorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const challenge = await readTwoFactorChallenge(request);
  if (!challenge || challenge.purpose !== "verify") return NextResponse.json({ error: "INVALID_TWO_FACTOR_CHALLENGE" }, { status: 401 });
  const globalLimit = rateLimit(request, "login-global", 100, 60_000);
  if (globalLimit) return globalLimit;
  const accountLimit = rateLimit(request, "login-account", 5, 60_000, challenge.matricule);
  if (accountLimit) return accountLimit;
  const user = (await listStoredUsers()).find(candidate => candidate.userId === challenge.userId
    && candidate.matricule === challenge.matricule
    && candidate.status === "ACTIVE"
    && candidate.totpEnabled === true);
  if (!user) return NextResponse.json({ error: "INVALID_TWO_FACTOR_CHALLENGE" }, { status: 401 });

  if (parsed.data.recoveryCode) {
    if (!await consumeStoredRecoveryCode(user.matricule, hashRecoveryCode(parsed.data.code))) {
      await new Promise(resolve => setTimeout(resolve, 450));
      return NextResponse.json({ error: "INVALID_TWO_FACTOR_CODE" }, { status: 401 });
    }
    return createSessionResponse(request, user, formPost, true);
  }

  if (!user.totpSecretEncrypted) return NextResponse.json({ error: "TWO_FACTOR_UNAVAILABLE" }, { status: 401 });
  let secret: string;
  try {
    secret = decryptTotpSecret(user.totpSecretEncrypted);
  } catch (error) {
    console.error("Failed to decrypt TOTP secret", error);
    return NextResponse.json({ error: "TWO_FACTOR_UNAVAILABLE" }, { status: 500 });
  }
  const step = verifyTotp(secret, parsed.data.code, Date.now(), user.totpLastUsedStep);
  if (step === null) {
    await new Promise(resolve => setTimeout(resolve, 450));
    return NextResponse.json({ error: "INVALID_TWO_FACTOR_CODE" }, { status: 401 });
  }
  if (!await recordStoredTotpStep(user.matricule, step)) {
    return NextResponse.json({ error: "INVALID_TWO_FACTOR_CODE" }, { status: 401 });
  }
  return createSessionResponse(request, user, formPost, true);
}

export async function POST(request: Request) {
  const formPost = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")
    || request.headers.get("content-type")?.includes("multipart/form-data");
  let body: unknown;
  try {
    body = formPost ? Object.fromEntries(await request.formData()) : await safeJson(request, 4_096);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }

  const challenge = await readTwoFactorChallenge(request);
  if (challenge?.purpose === "verify") return verifySecondFactor(request, body, Boolean(formPost));

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const normalized = parsed.data.matricule.trim().toUpperCase();
  const globalLimit = rateLimit(request, "login-global", 100, 60_000);
  if (globalLimit) return globalLimit;
  const accountLimit = rateLimit(request, "login-account", 5, 60_000, normalized);
  if (accountLimit) return accountLimit;
  const stored = (await listStoredUsers()).find(user => user.matricule === normalized);
  const valid = stored ? await bcrypt.compare(parsed.data.password, stored.passwordHash) : false;
  if (!valid || stored?.status === "SUSPENDED") {
    await new Promise(resolve => setTimeout(resolve, 450));
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }

  const identity = stored!;
  const purpose = !identity.totpEnabled
    ? "enroll"
    : requiresTotpVerification(identity.lastLoginAt)
      ? "verify"
      : null;
  if (purpose) {
    const token = await createTwoFactorChallenge({
      userId: identity.userId,
      matricule: identity.matricule,
      purpose,
    });
    const response = NextResponse.json(
      purpose === "enroll" ? { requiresTwoFactorSetup: true } : { requiresTwoFactor: true },
      { status: 202 },
    );
    setChallengeCookie(response, request, token);
    return response;
  }

  return createSessionResponse(request, identity, Boolean(formPost));
}
