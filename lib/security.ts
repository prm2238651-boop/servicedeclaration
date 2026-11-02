import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientAddress(request: Request) {
  const proxySecret = process.env.TRUSTED_PROXY_SECRET;
  const trusted = proxySecret && request.headers.get("x-trusted-proxy-secret") === proxySecret;
  if (!trusted) return "direct";
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "proxy-unknown";
}

export function rateLimit(request: Request, scope: string, limit: number, windowMs: number, subject = "anonymous") {
  const now = Date.now();
  const key = `${scope}:${clientAddress(request)}:${subject.toUpperCase()}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count <= limit) return null;
  return NextResponse.json(
    { error: "TOO_MANY_REQUESTS" },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))) } },
  );
}

export class JsonBodyError extends Error {
  constructor(public readonly status: 400 | 413, public readonly code: "INVALID_JSON" | "PAYLOAD_TOO_LARGE") { super(code); }
}

export function jsonBodyErrorResponse(error: unknown) {
  if (error instanceof JsonBodyError) return NextResponse.json({ error: error.code }, { status: error.status });
  return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const expectedHost = request.headers.get("host");
  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
  if (!expectedHost) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  if (originUrl.host === expectedHost) return null;

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  let expectedUrl: URL;
  try { expectedUrl = new URL(`${originUrl.protocol}//${expectedHost}`); } catch { return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 }); }
  const localPreview = process.env.ALLOW_INSECURE_LOCALHOST === "true"
    && localHosts.has(originUrl.hostname)
    && localHosts.has(expectedUrl.hostname)
    && originUrl.port === expectedUrl.port;
  if (!localPreview) return NextResponse.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  return null;
}

export async function safeJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new JsonBodyError(413, "PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new JsonBodyError(413, "PAYLOAD_TOO_LARGE");
  try { return JSON.parse(text); } catch { throw new JsonBodyError(400, "INVALID_JSON"); }
}
