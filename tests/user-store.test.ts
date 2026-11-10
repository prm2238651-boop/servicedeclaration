import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("les comptes JSON ne sont chargés qu'avec DEMO_MODE=true", async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  const previousDataDirectory = process.env.POLICE_DATA_DIR;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "police-user-store-"));
  const users = [{
    userId: "demo-test",
    matricule: "TEST-001",
    name: "Compte test",
    role: "AGENT",
    service: "Test",
    permissions: [],
    passwordHash: "bcrypt-hash",
    status: "ACTIVE" as const,
  }];

  try {
    process.env.POLICE_DATA_DIR = dataDirectory;
    process.env.DEMO_MODE = "false";
    process.env.DATABASE_URL = "";
    await writeFile(path.join(dataDirectory, "demo-users.json"), JSON.stringify(users), "utf8");
    const { listStoredUsers } = await import("../lib/user-store");

    await assert.rejects(listStoredUsers(), /DATABASE_URL is required/);
    process.env.DEMO_MODE = "true";
    assert.deepEqual(await listStoredUsers(), users);

    const {
      consumeStoredRecoveryCode,
      enableStoredUserTotp,
      recordStoredTotpStep,
      recordStoredUserLogin,
      updateStoredUserTotp,
    } = await import("../lib/user-store");
    const pendingSecret = "encrypted-test-secret";
    await updateStoredUserTotp("TEST-001", { totpPendingSecretEncrypted: pendingSecret });
    const enabled = await enableStoredUserTotp("TEST-001", pendingSecret, 100, ["a".repeat(64)]);
    assert.equal(enabled?.totpEnabled, true);
    assert.equal(typeof enabled?.totpLastVerifiedAt, "number");
    assert.equal(typeof enabled?.lastLoginAt, "number");
    assert.equal(await enableStoredUserTotp("TEST-001", pendingSecret, 100, []), null);
    assert.equal(await recordStoredTotpStep("TEST-001", 100), false);
    assert.equal(await recordStoredTotpStep("TEST-001", 101), true);
    assert.equal(await consumeStoredRecoveryCode("TEST-001", "a".repeat(64)), true);
    assert.equal(await consumeStoredRecoveryCode("TEST-001", "a".repeat(64)), false);
    assert.ok((await listStoredUsers())[0].totpLastVerifiedAt);
    await recordStoredUserLogin("TEST-001");
    assert.ok((await listStoredUsers())[0].lastLoginAt);
  } finally {
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
    if (previousDataDirectory === undefined) delete process.env.POLICE_DATA_DIR;
    else process.env.POLICE_DATA_DIR = previousDataDirectory;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
