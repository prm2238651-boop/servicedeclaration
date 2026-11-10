import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession } from "@/lib/auth";
import { normalizeIdentifier } from "@/lib/normalization";
import { hasPermission } from "@/lib/permissions";
import {
  findReportByIdentifier,
  findReportByObjectIdentifier,
  markReportFound,
  markReportReturned,
  saveReport,
  updateReport,
  type StoredReport,
} from "@/lib/report-store";
import { jsonBodyErrorResponse, requireSameOrigin, safeJson } from "@/lib/security";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const createSchema = z.object({
  status: z.enum(["STOLEN", "FOUND"]),
  pv: z.string().trim().min(3).max(64),
  date: dateSchema,
  region: z.string().trim().min(2).max(100),
  quartier: z.string().trim().min(2).max(150),
  nom: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  telephone: z.string().trim().min(5).max(40),
  piece: z.string().trim().max(150).optional().default(""),
  categorie: z.string().trim().min(2).max(100),
  marque: z.string().trim().min(1).max(100),
  modele: z.string().trim().max(100).optional().default(""),
  couleur: z.string().trim().max(100).optional().default(""),
  identifiantType: z.string().trim().min(2).max(50),
  identifiant: z.string().trim().min(4).max(100),
  circonstances: z.string().trim().max(2_000).optional().default(""),
});
const foundSchema = z.object({
  dossier: z.string().trim().min(5).max(80),
  action: z.literal("FOUND"),
  recoveredAt: dateSchema,
  recoveredBy: z.enum(["POLICE_STATION", "OWNER", "OTHER"]),
  recoveredByService: z.string().trim().max(150).optional().default(""),
  recoveryNote: z.string().trim().max(2_000).optional().default(""),
});
const returnedSchema = z.object({
  dossier: z.string().trim().min(5).max(80),
  action: z.literal("RETURN"),
  returnedAt: dateSchema,
  returnIdentity: z.string().trim().min(3).max(150),
  returnNote: z.string().trim().max(2_000).optional().default(""),
});
const patchSchema = z.discriminatedUnion("action", [foundSchema, returnedSchema]);
const adminUpdateSchema = z.object({
  dossier: z.string().trim().min(5).max(80),
  pv: z.string().trim().min(3).max(64).optional(),
  date: dateSchema.optional(),
  region: z.string().trim().min(2).max(100).optional(),
  quartier: z.string().trim().min(2).max(150).optional(),
  nom: z.string().trim().min(1).max(100).optional(),
  prenom: z.string().trim().min(1).max(100).optional(),
  telephone: z.string().trim().min(5).max(40).optional(),
  piece: z.string().trim().max(150).optional(),
  categorie: z.string().trim().min(2).max(100).optional(),
  marque: z.string().trim().min(1).max(100).optional(),
  modele: z.string().trim().max(100).optional(),
  couleur: z.string().trim().max(100).optional(),
  identifiantType: z.string().trim().min(2).max(50).optional(),
  identifiant: z.string().trim().min(4).max(100).optional(),
  circonstances: z.string().trim().max(2_000).optional(),
});

async function body(request: Request) {
  try {
    return await safeJson(request);
  } catch (error) {
    return jsonBodyErrorResponse(error);
  }
}

function isResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}

function generatedDossier(region: string) {
  const regionCode = region.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "MLI";
  const year = new Date().getFullYear();
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `ML-${regionCode}-${year}-${suffix}`;
}

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const session = await readSession();
  if (!hasPermission(session, "DECLARE")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsedBody = await body(request);
  if (isResponse(parsedBody)) return parsedBody;
  const parsed = createSchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const data = parsed.data;
  const normalized = normalizeIdentifier(data.identifiant);
  const report: StoredReport = {
    ...data,
    identifiant: data.identifiant,
    dossier: generatedDossier(data.region),
    service: session!.service,
    createdBy: session!.matricule,
    createdAt: new Date().toISOString(),
  };
  try {
    const duplicate = await findReportByObjectIdentifier(normalized);
    if (duplicate) return NextResponse.json({ error: "DUPLICATE_IDENTIFIER", dossier: duplicate.dossier }, { status: 409 });
    return NextResponse.json({ report: await saveReport(report) });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_IDENTIFIER_EXISTS") {
      return NextResponse.json({ error: "DUPLICATE_IDENTIFIER" }, { status: 409 });
    }
    console.error("Failed to save report", error);
    return NextResponse.json({ error: "REPORT_SAVE_FAILED" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const session = await readSession();
  if (!hasPermission(session, "UPDATE_STATUS")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsedBody = await body(request);
  if (isResponse(parsedBody)) return parsedBody;
  const parsed = patchSchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const data = parsed.data;
  try {
    const report = await findReportByIdentifier(data.dossier);
    if (!report) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    const service = session!.role === "SUPER_ADMIN" ? undefined : session!.service;
    if (service && report.service !== service) return NextResponse.json({ error: "WRONG_SERVICE" }, { status: 403 });

    const updated = data.action === "RETURN"
      ? report.status !== "FOUND"
        ? undefined
        : await markReportReturned(data.dossier, {
          returnedAt: data.returnedAt,
          returnIdentity: data.returnIdentity,
          returnNote: data.returnNote,
          returnedByAgent: session!.matricule,
        }, service)
      : report.status !== "STOLEN"
        ? undefined
        : await markReportFound(data.dossier, {
          recoveredAt: data.recoveredAt,
          recoveredBy: data.recoveredBy,
          recoveredByService: data.recoveredBy === "OWNER" ? undefined : data.recoveredByService,
          recoveryNote: data.recoveryNote,
        }, service);

    return updated
      ? NextResponse.json({ report: updated })
      : NextResponse.json({ error: "INVALID_STATUS" }, { status: 409 });
  } catch (error) {
    console.error("Failed to update report status", error);
    return NextResponse.json({ error: "REPORT_STATUS_UPDATE_FAILED" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const session = await readSession();
  if (session?.role !== "SUPER_ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsedBody = await body(request);
  if (isResponse(parsedBody)) return parsedBody;
  const parsed = adminUpdateSchema.safeParse(parsedBody);
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { dossier, ...changes } = parsed.data;
  try {
    if (changes.identifiant) {
      const duplicate = await findReportByObjectIdentifier(changes.identifiant);
      if (duplicate && duplicate.dossier !== dossier) {
        return NextResponse.json({ error: "DUPLICATE_IDENTIFIER", dossier: duplicate.dossier }, { status: 409 });
      }
    }
    const updated = await updateReport(dossier, changes);
    return updated
      ? NextResponse.json({ report: updated })
      : NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === "REPORT_IDENTIFIER_EXISTS") {
      const duplicate = changes.identifiant ? await findReportByObjectIdentifier(changes.identifiant) : undefined;
      return NextResponse.json({ error: "DUPLICATE_IDENTIFIER", dossier: duplicate?.dossier }, { status: 409 });
    }
    console.error("Failed to update report", error);
    return NextResponse.json({ error: "REPORT_UPDATE_FAILED" }, { status: 500 });
  }
}
