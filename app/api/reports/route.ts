import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { normalizeIdentifier } from "@/lib/normalization";
import { hasPermission } from "@/lib/permissions";
import { listReports, markReportFound, markReportReturned, saveReport, updateReport, type StoredReport } from "@/lib/report-store";
import { jsonBodyErrorResponse, requireSameOrigin, safeJson } from "@/lib/security";

async function body(request: Request) {
  try { return await safeJson(request) as Record<string, string>; }
  catch (error) { return jsonBodyErrorResponse(error); }
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request); if (csrf) return csrf;
  const session = await readSession();
  if (!hasPermission(session, "DECLARE")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = await body(request); if (parsed instanceof NextResponse) return parsed; const data = parsed;
  try {
    const normalized = normalizeIdentifier(String(data.identifiant || ""));
    const duplicate = (await listReports()).find((report) => normalizeIdentifier(report.identifiant) === normalized);
    if (duplicate) return NextResponse.json({ error: "DUPLICATE_IDENTIFIER", dossier: duplicate.dossier }, { status: 409 });
    const dossier = `ML-${String(data.region).slice(0, 3).toUpperCase()}-2026-${`${Date.now()}`.slice(-6)}`;
    const report = { ...data, identifiant: String(data.identifiant).trim(), dossier, service: session!.service, createdBy: session!.matricule, createdAt: new Date().toISOString() } as StoredReport;
    await saveReport(report);
    return NextResponse.json({ report });
  } catch (error) {
    console.error("Failed to save report", error);
    return NextResponse.json({ error: "REPORT_SAVE_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const csrf = requireSameOrigin(request); if (csrf) return csrf;
  const session = await readSession();
  if (!hasPermission(session, "UPDATE_STATUS")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = await body(request); if (parsed instanceof NextResponse) return parsed; const data = parsed;
  const report = (await listReports()).find((item) => item.dossier === data.dossier);
  if (!report) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (session!.role !== "SUPER_ADMIN" && report.service !== session!.service) return NextResponse.json({ error: "WRONG_SERVICE" }, { status: 403 });
  if (data.action === "RETURN") {
    if (report.status !== "FOUND") return NextResponse.json({ error: "INVALID_STATUS" }, { status: 409 });
    return NextResponse.json({ report: await markReportReturned(data.dossier, { returnedAt: data.returnedAt, returnIdentity: data.returnIdentity, returnNote: data.returnNote, returnedByAgent: session!.matricule }) });
  }
  const recoveredBy = (["POLICE_STATION", "OWNER", "OTHER"] as const).find(value => value === data.recoveredBy);
  if (!recoveredBy) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  return NextResponse.json({ report: await markReportFound(data.dossier, { recoveredAt: data.recoveredAt, recoveredBy, recoveredByService: recoveredBy === "OWNER" ? undefined : data.recoveredByService, recoveryNote: data.recoveryNote }) });
}

export async function PUT(request: Request) {
  const csrf = requireSameOrigin(request); if (csrf) return csrf;
  const session = await readSession();
  if (session?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = await body(request); if (parsed instanceof NextResponse) return parsed; const data = parsed;
  const { dossier, ...changes } = data as { dossier: string } & Partial<StoredReport>;
  if (changes.identifiant) {
    const normalized = normalizeIdentifier(String(changes.identifiant));
    const duplicate = (await listReports()).find((report) => report.dossier !== dossier && normalizeIdentifier(report.identifiant) === normalized);
    if (duplicate) return NextResponse.json({ error: "DUPLICATE_IDENTIFIER", dossier: duplicate.dossier }, { status: 409 });
    changes.identifiant = String(changes.identifiant).trim();
  }
  const updated = await updateReport(dossier, changes);
  return updated ? NextResponse.json({ report: updated }) : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
}
