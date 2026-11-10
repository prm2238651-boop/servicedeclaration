import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("les déclarations persistent en mode démo avec filtres et transitions d’état", async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  const previousDataDirectory = process.env.POLICE_DATA_DIR;
  const previousAuthSecret = process.env.AUTH_SECRET;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "police-report-store-"));
  process.env.DEMO_MODE = "true";
  process.env.POLICE_DATA_DIR = dataDirectory;
  process.env.AUTH_SECRET = "report-store-test-secret-with-enough-entropy";
  delete process.env.DATABASE_URL;

  try {
    const {
      findReportByIdentifier,
      findReportByObjectIdentifier,
      listReports,
      markReportFound,
      markReportReturned,
      saveReport,
      updateReport,
    } = await import("../lib/report-store");
    const { decryptSensitiveValue, encryptSensitiveValue, reportLookupHash } = await import("../lib/data-crypto");
    const encryptedValue = encryptSensitiveValue("donnée confidentielle");
    assert.notEqual(encryptedValue, "donnée confidentielle");
    assert.equal(decryptSensitiveValue(encryptedValue), "donnée confidentielle");
    assert.equal(reportLookupHash("351 234-567 890123"), reportLookupHash("351234567890123"));

    const report = {
      dossier: "ML-BKO-2026-TEST0001",
      pv: "PV-2026-TEST-1",
      status: "STOLEN" as const,
      date: "2026-11-03",
      region: "Bamako",
      quartier: "Commune V",
      nom: "Test",
      prenom: "Agent",
      telephone: "+22370000000",
      piece: "",
      categorie: "Téléphone",
      marque: "Test",
      modele: "Device",
      couleur: "Noir",
      identifiantType: "IMEI",
      identifiant: "351 234-567 890123",
      service: "Commissariat test",
      createdBy: "AGT-001",
      createdAt: new Date().toISOString(),
    };

    await saveReport(report);
    await assert.rejects(saveReport(report), /REPORT_IDENTIFIER_EXISTS/);
    assert.equal((await findReportByObjectIdentifier("351234567890123"))?.dossier, report.dossier);
    assert.equal((await findReportByIdentifier("ML BKO 2026 TEST0001"))?.dossier, report.dossier);
    assert.equal((await listReports({ status: "STOLEN", service: report.service })).length, 1);
    assert.equal((await listReports({ service: "other" })).length, 0);

    const found = await markReportFound(report.dossier, {
      recoveredAt: "2026-11-03",
      recoveredBy: "POLICE_STATION",
      recoveredByService: "Commissariat test",
      recoveryNote: "Note de test",
    }, report.service);
    assert.equal(found?.status, "FOUND");
    assert.equal(await markReportFound(report.dossier, { recoveredAt: "2026-11-03", recoveredBy: "OWNER" }), undefined);
    const returned = await markReportReturned(report.dossier, {
      returnedAt: "2026-11-03",
      returnIdentity: "Carte test",
      returnedByAgent: "AGT-001",
    });
    assert.equal(returned?.status, "RETURNED");

    const updated = await updateReport(report.dossier, { nom: "Nouveau nom", service: "forbidden edit" });
    assert.equal(updated?.nom, "Nouveau nom");
    assert.equal(updated?.service, report.service);
    assert.equal((await listReports({ status: "RETURNED" })).length, 1);
  } finally {
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
    if (previousDataDirectory === undefined) delete process.env.POLICE_DATA_DIR;
    else process.env.POLICE_DATA_DIR = previousDataDirectory;
    if (previousAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previousAuthSecret;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await rm(dataDirectory, { recursive: true, force: true });
  }
});

test("la recherche métier refuse de retomber sur le JSON hors mode démo", async () => {
  const previousDemoMode = process.env.DEMO_MODE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousDataDirectory = process.env.POLICE_DATA_DIR;
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "police-report-store-prod-"));
  delete process.env.DEMO_MODE;
  delete process.env.DATABASE_URL;
  process.env.POLICE_DATA_DIR = dataDirectory;

  try {
    const { listReports } = await import("../lib/report-store");
    await assert.rejects(listReports(), /DATABASE_URL is required/);
  } finally {
    if (previousDemoMode === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = previousDemoMode;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousDataDirectory === undefined) delete process.env.POLICE_DATA_DIR;
    else process.env.POLICE_DATA_DIR = previousDataDirectory;
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
