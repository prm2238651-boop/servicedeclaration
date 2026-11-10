import { NextResponse } from "next/server";
import { COOKIE_NAME, LOCAL_COOKIE_NAME, LOCAL_TWO_FACTOR_COOKIE_NAME, TWO_FACTOR_COOKIE_NAME } from "@/lib/auth";
import { requireSameOrigin } from "@/lib/security";
export async function POST(request: Request) {
  const csrf = requireSameOrigin(request); if (csrf) return csrf;
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set(LOCAL_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  response.cookies.set(TWO_FACTOR_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 0 });
  response.cookies.set(LOCAL_TWO_FACTOR_COOKIE_NAME, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
