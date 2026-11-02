import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, LOCAL_COOKIE_NAME, createSession } from "@/lib/auth";
import { listStoredUsers } from "@/lib/user-store";
import bcrypt from "bcryptjs";
import { DEFAULT_PERMISSIONS, landingPageForSession } from "@/lib/permissions";
import { jsonBodyErrorResponse, rateLimit, safeJson } from "@/lib/security";

const schema = z.object({ matricule: z.string().min(3), password: z.string().min(8) });

export async function POST(request: Request) {
  const formPost = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded") || request.headers.get("content-type")?.includes("multipart/form-data");
  let body: unknown;
  try { body = formPost ? Object.fromEntries(await request.formData()) : await safeJson(request, 4_096); } catch (error) { return jsonBodyErrorResponse(error); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { matricule, password } = parsed.data;
  const normalized=matricule.trim().toUpperCase();
  const globalLimit = rateLimit(request, "login-global", 100, 60_000);
  if (globalLimit) return globalLimit;
  const accountLimit = rateLimit(request, "login-account", 5, 60_000, normalized);
  if (accountLimit) return accountLimit;
  const stored=(await listStoredUsers()).find(user=>user.matricule===normalized);
  const valid=stored?await bcrypt.compare(password,stored.passwordHash):false;
  if (!valid || stored?.status==="SUSPENDED") {
    await new Promise(resolve => setTimeout(resolve, 450));
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  const identity=stored!;
  const permissions=(identity as {permissions?:string[]}).permissions??DEFAULT_PERMISSIONS[identity.role];
  const redirectTo=landingPageForSession({role:identity.role,permissions});
  const token = await createSession({ userId: identity.userId, matricule: normalized, name: identity.name, role: identity.role, service: identity.service, permissions });
  const response = formPost ? NextResponse.redirect(new URL(redirectTo, request.url), 303) : NextResponse.json({ ok: true, redirectTo });
  const hostname = new URL(request.url).hostname;
  const localPreview = process.env.ALLOW_INSECURE_LOCALHOST === "true" && ["127.0.0.1", "localhost"].includes(hostname);
  response.cookies.set(localPreview ? LOCAL_COOKIE_NAME : COOKIE_NAME, token, { httpOnly: true, sameSite: "strict", secure: !localPreview, path: "/", maxAge: 60 * 30 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
