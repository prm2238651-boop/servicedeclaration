import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  if (process.env.DEMO_MODE === "true") {
    throw new Error("Set DEMO_MODE to false or unset it before importing reports into PostgreSQL");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set");

  const { importLegacyReports, readLegacyReports } = await import("../lib/report-store");
  const source = process.argv[2];
  const reports = await readLegacyReports(source);
  const imported = await importLegacyReports(reports);
  console.log(`Imported ${imported} report(s); ${reports.length - imported} already existed.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Failed to import reports");
  process.exitCode = 1;
});
