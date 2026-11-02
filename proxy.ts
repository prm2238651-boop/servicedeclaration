import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const isDev = process.env.NODE_ENV === "development";
  const csp = `default-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const session = request.cookies.get("__Host-police_session") || request.cookies.get("police_session_local");
  const protectedPath = ["/dashboard", "/verification", "/declarations", "/objets", "/statistiques", "/admin", "/supervision", "/acces-refuse"].some(path => request.nextUrl.pathname.startsWith(path));
  const response = protectedPath && !session
    ? NextResponse.redirect(new URL("/login", request.url))
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(self), geolocation=(), microphone=()");
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = { matcher: ["/login", "/dashboard/:path*", "/verification/:path*", "/declarations/:path*", "/objets/:path*", "/statistiques/:path*", "/admin/:path*", "/supervision/:path*", "/acces-refuse/:path*", "/api/:path*"] };
