import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { normalizeIdentifier } from "@/lib/normalization";

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.includes("replace-with")) {
    throw new Error("AUTH_SECRET must contain at least 32 unpredictable characters");
  }
  return secret;
}

function deriveKey(purpose: string) {
  return Buffer.from(hkdfSync("sha256", authSecret(), "police-mali-data-v1", purpose, 32));
}

export function encryptSensitiveValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("report-fields"), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitiveValue(value: string) {
  const [version, encodedIv, encodedTag, encodedData, extra] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedData || extra) {
    throw new Error("Invalid encrypted report field");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("report-fields"), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function reportLookupHash(value: string) {
  return createHmac("sha256", deriveKey("report-lookups"))
    .update(normalizeIdentifier(value))
    .digest("hex");
}
