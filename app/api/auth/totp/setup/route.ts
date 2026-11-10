import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, LOCAL_COOKIE_NAME, LOCAL_TWO_FACTOR_COOKIE_NAME, TWO_FACTOR_COOKIE_NAME, createSession, readTwoFactorChallenge } from "@/lib/auth";
import { enableStoredUserTotp, listStoredUsers, updateStoredUserTotp } from "@/lib/user-store";
import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpProvisioningUri, verifyTotp } from "@/lib/totp";
import { DEFAULT_PERMISSIONS, landingPageForSession } from "@/lib/permissions";
import { jsonBodyErrorResponse, rateLimit, requireSameOrigin, safeJson } from "@/lib/security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("verify"), code: z.string().regex(/^\d{6}$/) }),
]);

function isLocalPreview(request: Request) {
  const hostname = new URL(request.url).hostname;
  return process.env.ALLOW_INSECURE_LOCALHOST === "true" && ["127.0.0.1", "localhost"].includes(hostname);
}

function clearChallengeCookie(response: NextResponse) {
  response.cookies.set(TWO_FACTOR_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 0 });
  response.cookies.set(LOCAL_TWO_FACTOR_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  let body: unknown;
  try {
    body = await safeJson(request, 4_096);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const challenge = await readTwoFactorChallenge(request);
  if (!challenge || challenge.purpose !== "enroll") {
    return NextResponse.json({ error: "INVALID_TWO_FACTOR_CHALLENGE" }, { status: 401 });
  }
  const attemptLimit = rateLimit(request, "totp-enroll", 5, 60_000, challenge.matricule);
  if (attemptLimit) return attemptLimit;
  const user = (await listStoredUsers()).find(candidate => candidate.userId === challenge.userId
    && candidate.matricule === challenge.matricule
    && candidate.status === "ACTIVE"
    && candidate.totpEnabled !== true);
  if (!user) return NextResponse.json({ error: "INVALID_TWO_FACTOR_CHALLENGE" }, { status: 401 });

  if (parsed.data.action === "start") {
    const secret = generateTotpSecret();
    await updateStoredUserTotp(user.matricule, { totpPendingSecretEncrypted: encryptTotpSecret(secret) });
    const response = NextResponse.json({
      secret,
      provisioningUri: totpProvisioningUri(secret, user.matricule),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  if (!user.totpPendingSecretEncrypted) {
    return NextResponse.json({ error: "TWO_FACTOR_SETUP_REQUIRED" }, { status: 409 });
  }
  let secret: string;
  try {
    secret = decryptTotpSecret(user.totpPendingSecretEncrypted);
  } catch (error) {
    console.error("Failed to decrypt pending TOTP secret", error);
    return NextResponse.json({ error: "TWO_FACTOR_UNAVAILABLE" }, { status: 500 });
  }
  const step = verifyTotp(secret, parsed.data.code);
  if (step === null) {
    await new Promise(resolve => setTimeout(resolve, 450));
    return NextResponse.json({ error: "INVALID_TWO_FACTOR_CODE" }, { status: 401 });
  }

  const recoveryCodes = generateRecoveryCodes();
  const updated = await enableStoredUserTotp(
    user.matricule,
    user.totpPendingSecretEncrypted,
    step,
    recoveryCodes.map(hashRecoveryCode),
  );
  if (!updated) return NextResponse.json({ error: "TWO_FACTOR_SETUP_EXPIRED" }, { status: 409 });
  const permissions = updated.permissions ?? DEFAULT_PERMISSIONS[updated.role];
  const redirectTo = landingPageForSession({ role: updated.role, permissions });
  const token = await createSession({
    userId: updated.userId,
    matricule: updated.matricule,
    name: updated.name,
    role: updated.role,
    service: updated.service,
    permissions,
  });
  const localPreview = isLocalPreview(request);
  const response = NextResponse.json({ ok: true, redirectTo, recoveryCodes });
  response.cookies.set(localPreview ? LOCAL_COOKIE_NAME : COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: !localPreview,
    path: "/",
    maxAge: 60 * 30,
  });
  clearChallengeCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
