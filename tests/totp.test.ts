import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  requiresTotpVerification,
  TOTP_REAUTH_INTERVAL_MS,
  verifyTotp,
} from "../lib/totp";

test("redemande le TOTP après 12 heures sans connexion", () => {
  const now = 2_000_000_000;
  assert.equal(requiresTotpVerification(undefined, now), true);
  assert.equal(requiresTotpVerification(now, now), false);
  assert.equal(requiresTotpVerification(now - TOTP_REAUTH_INTERVAL_MS + 1, now), false);
  assert.equal(requiresTotpVerification(now - TOTP_REAUTH_INTERVAL_MS, now), true);
  assert.equal(requiresTotpVerification(now + 1, now), true);
});

test("vérifie un vecteur TOTP RFC 6238 et refuse de réutiliser le même intervalle", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(verifyTotp(secret, "287082", 59_000), 1);
  assert.equal(verifyTotp(secret, "287082", 59_000, 1), null);
  assert.equal(verifyTotp(secret, "invalid", 59_000), null);
});

test("chiffre la graine TOTP et génère des codes de récupération à usage unique", () => {
  const previousSecret = process.env.AUTH_SECRET;
  const testSecret = "totp-unit-test-secret-with-enough-entropy-123";
  process.env.AUTH_SECRET = testSecret;
  try {
    const secret = generateTotpSecret();
    assert.match(secret, /^[A-Z2-7]{32}$/);
    const encrypted = encryptTotpSecret(secret);
    assert.notEqual(encrypted, secret);
    assert.equal(decryptTotpSecret(encrypted), secret);

    const codes = generateRecoveryCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, codes.length);
    assert.equal(normalizeRecoveryCode(codes[0]), codes[0].replace(/-/g, ""));
    assert.equal(hashRecoveryCode(codes[0]), hashRecoveryCode(normalizeRecoveryCode(codes[0])));
    assert.notEqual(hashRecoveryCode(codes[0]), codes[0]);
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});

test("rejette une graine TOTP chiffrée altérée", () => {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "totp-unit-test-secret-with-enough-entropy-123";
  try {
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const corrupted = `${version}.${iv}.${tag.startsWith("A") ? "B" : "A"}${tag.slice(1)}.${ciphertext}`;
    assert.throws(() => decryptTotpSecret(corrupted));
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousSecret;
  }
});
