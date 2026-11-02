import http from "k6/http";
import { check } from "k6";
const base = __ENV.BASE_URL || "http://127.0.0.1:3000";
export const options = { vus: 1, iterations: 1, thresholds: { checks: ["rate==1"] } };
export default function () {
  let limited = false;
  for (let i = 0; i < 7; i++) {
    const r = http.post(`${base}/api/auth/login`, JSON.stringify({ matricule: "INVALID", password: "invalid-password" }), { headers: { "Content-Type": "application/json" } });
    if (r.status === 429 && r.headers["Retry-After"]) limited = true;
  }
  check(limited, { "login attempts are rate limited": v => v });
}
