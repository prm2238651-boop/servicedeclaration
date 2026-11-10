import assert from "node:assert/strict";
import test from "node:test";
import { clientAddress } from "../lib/security";

test("les en-têtes d'adresse client ne sont acceptés que du proxy de confiance", () => {
  const previousSecret = process.env.TRUSTED_PROXY_SECRET;

  try {
    process.env.TRUSTED_PROXY_SECRET = "test-proxy-secret";
    const spoofedRequest = new Request("https://example.test", {
      headers: { "x-forwarded-for": "203.0.113.10", "x-real-ip": "203.0.113.10" },
    });
    assert.equal(clientAddress(spoofedRequest), "direct");

    const proxiedRequest = new Request("https://example.test", {
      headers: {
        "x-trusted-proxy-secret": "test-proxy-secret",
        "x-forwarded-for": "203.0.113.11, 10.0.0.1",
        "x-real-ip": "203.0.0.1",
      },
    });
    assert.equal(clientAddress(proxiedRequest), "203.0.113.11");
  } finally {
    if (previousSecret === undefined) delete process.env.TRUSTED_PROXY_SECRET;
    else process.env.TRUSTED_PROXY_SECRET = previousSecret;
  }
});

test("sans secret proxy configuré, les requêtes partagent le bucket direct", () => {
  const previousSecret = process.env.TRUSTED_PROXY_SECRET;

  try {
    delete process.env.TRUSTED_PROXY_SECRET;
    const request = new Request("https://example.test", {
      headers: {
        "x-trusted-proxy-secret": "forged",
        "x-forwarded-for": "203.0.113.12",
      },
    });
    assert.equal(clientAddress(request), "direct");
  } finally {
    if (previousSecret === undefined) delete process.env.TRUSTED_PROXY_SECRET;
    else process.env.TRUSTED_PROXY_SECRET = previousSecret;
  }
});
