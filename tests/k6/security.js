import http from "k6/http";
import { check } from "k6";

const base = __ENV.BASE_URL || "http://127.0.0.1:3000";
export const options = { vus: 2, iterations: 12, thresholds: { checks: ["rate>0.95"] } };

export default function () {
  const anonymous = http.get(`${base}/api/objects/search?q=351234567890123`);
  check(anonymous, { "anonymous search forbidden": r => r.status === 403 });

  const forged = http.get(`${base}/admin`, { redirects: 0, headers: { Cookie: "__Host-police_session=forged" } });
  check(forged, { "forged session rejected by page": r => r.status === 307 || r.status === 308 || r.status === 401 });

  const hostile = http.post(`${base}/api/reports`, "{}", { headers: { "Content-Type": "application/json", Origin: "https://evil.example" } });
  check(hostile, { "cross-origin mutation blocked": r => r.status === 403 });

  const page = http.get(`${base}/login`);
  check(page, {
    "nosniff enabled": r => r.headers["X-Content-Type-Options"] === "nosniff",
    "framing denied": r => r.headers["X-Frame-Options"] === "DENY",
    "CSP present": r => Boolean(r.headers["Content-Security-Policy"]),
  });
}
