import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
export const TOTP_REAUTH_INTERVAL_MS = 12 * 60 * 60 * 1_000;

export function requiresTotpVerification(lastLoginAt?: number, now = Date.now()) {
  if (lastLoginAt === undefined || !Number.isFinite(lastLoginAt) || lastLoginAt > now) return true;
  return now - lastLoginAt >= TOTP_REAUTH_INTERVAL_MS;
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.includes("replace-with")) {
    throw new Error("AUTH_SECRET must contain at least 32 unpredictable characters");
  }
  return secret;
}

function encryptionKey() {
  return Buffer.from(hkdfSync("sha256", authSecret(), "police-mali-totp-v1", "totp-secret-encryption", 32));
}

export function generateTotpSecret() {
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let encoded = "";
  for (let index = 0; index < bits.length; index += 5) {
    encoded += BASE32_ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return encoded;
}

function decodeBase32(secret: string) {
  const normalized = secret.replace(/=+$/, "").toUpperCase();
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) throw new Error("Invalid TOTP secret");
  let bits = "";
  for (const character of normalized) bits += BASE32_ALPHABET.indexOf(character).toString(2).padStart(5, "0");
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(bits.slice(index * 8, index * 8 + 8), 2);
  }
  return Buffer.from(bytes);
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptTotpSecret(encrypted: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = encrypted.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error("Invalid encrypted TOTP secret");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function totpAtStep(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now(), lastUsedStep = -1) {
  if (!/^\d{6}$/.test(code)) return null;
  const currentStep = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    if (step > lastUsedStep && constantTimeEqual(totpAtStep(secret, step), code)) return step;
  }
  return null;
}

export function totpProvisioningUri(secret: string, account: string) {
  const issuer = "Police Mali";
  const label = `${issuer}:${account}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(12).toString("hex").toUpperCase();
    return `${raw.slice(0, 8)}-${raw.slice(8, 16)}-${raw.slice(16)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.replace(/-/g, "").trim().toUpperCase();
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(normalizeRecoveryCode(code)).digest("hex");
}
