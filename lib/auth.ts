import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { listStoredUsers } from "@/lib/user-store";

export const COOKIE_NAME = "__Host-police_session";
export const LOCAL_COOKIE_NAME = "police_session_local";
export const TWO_FACTOR_COOKIE_NAME = "__Host-police_2fa";
export const LOCAL_TWO_FACTOR_COOKIE_NAME = "police_2fa_local";
function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32 || value.includes("replace-with")) throw new Error("AUTH_SECRET must contain at least 32 unpredictable characters");
  return new TextEncoder().encode(value);
}

export type Session = { userId: string; matricule: string; name: string; role: string; service: string; permissions?: string[] };

export async function createSession(payload: Session) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer("police-mali").setAudience("police-mali-web").setIssuedAt().setJti(crypto.randomUUID()).setExpirationTime("30m").sign(authSecret());
}

export type TwoFactorChallenge = { userId: string; matricule: string; purpose: "verify" | "enroll" };

export async function createTwoFactorChallenge(payload: TwoFactorChallenge) {
  return new SignJWT({ ...payload, tokenUse: "two-factor-challenge" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("police-mali")
    .setAudience("police-mali-web")
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime("5m")
    .sign(authSecret());
}

export async function readTwoFactorChallenge(request: Request): Promise<TwoFactorChallenge | null> {
  const cookie = request.headers.get("cookie")?.split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${TWO_FACTOR_COOKIE_NAME}=`) || value.startsWith(`${LOCAL_TWO_FACTOR_COOKIE_NAME}=`));
  const token = cookie?.slice(cookie.indexOf("=") + 1);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), {
      issuer: "police-mali",
      audience: "police-mali-web",
      algorithms: ["HS256"],
    });
    if (payload.tokenUse !== "two-factor-challenge"
      || typeof payload.userId !== "string"
      || typeof payload.matricule !== "string"
      || (payload.purpose !== "verify" && payload.purpose !== "enroll")) return null;
    return { userId: payload.userId, matricule: payload.matricule, purpose: payload.purpose };
  } catch {
    return null;
  }
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value || jar.get(LOCAL_COOKIE_NAME)?.value;
  if (!token) return null;
  let session: Session;
  try {
    session = (await jwtVerify(token, authSecret(), {
      issuer: "police-mali",
      audience: "police-mali-web",
      algorithms: ["HS256"],
    })).payload as unknown as Session;
  }
  catch { return null; }
  const stored = (await listStoredUsers()).find(user => user.matricule === session.matricule);
  if (!stored || stored.status !== "ACTIVE") return null;
  if (stored.totpEnabled !== true) return null;
  return {
    ...session,
    userId: stored.userId,
    name: stored.name,
    role: stored.role,
    service: stored.service,
    permissions: stored.permissions,
  };
}
