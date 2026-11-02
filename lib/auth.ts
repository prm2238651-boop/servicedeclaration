import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { listStoredUsers } from "@/lib/user-store";

export const COOKIE_NAME = "__Host-police_session";
export const LOCAL_COOKIE_NAME = "police_session_local";
function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32 || value.includes("replace-with")) throw new Error("AUTH_SECRET must contain at least 32 unpredictable characters");
  return new TextEncoder().encode(value);
}

export type Session = { userId: string; matricule: string; name: string; role: string; service: string; permissions?: string[] };

export async function createSession(payload: Session) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer("police-mali").setAudience("police-mali-web").setIssuedAt().setJti(crypto.randomUUID()).setExpirationTime("30m").sign(authSecret());
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value || jar.get(LOCAL_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const session=(await jwtVerify(token, authSecret(), { issuer: "police-mali", audience: "police-mali-web", algorithms: ["HS256"] })).payload as unknown as Session;
    const stored=(await listStoredUsers()).find(user=>user.matricule===session.matricule);
    if(!stored||stored.status!=="ACTIVE")return null;
    return{...session,userId:stored.userId,name:stored.name,role:stored.role,service:stored.service,permissions:stored.permissions};
  }
  catch { return null; }
}
