import { promises as fs } from "node:fs";
import path from "node:path";
import { Prisma, type ReportRecord } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSensitiveValue, encryptSensitiveValue, reportLookupHash } from "@/lib/data-crypto";

export type StoredReport = {
  dossier: string;
  pv: string;
  status: "STOLEN" | "FOUND" | "RETURNED";
  date: string;
  region: string;
  quartier: string;
  nom: string;
  prenom: string;
  telephone: string;
  piece?: string;
  categorie: string;
  marque: string;
  modele: string;
  couleur: string;
  identifiantType: string;
  identifiant: string;
  service: string;
  createdBy: string;
  createdAt: string;
  circonstances?: string;
  recoveredAt?: string;
  recoveredBy?: "POLICE_STATION" | "OWNER" | "OTHER";
  recoveredByService?: string;
  recoveryNote?: string;
  returnedAt?: string;
  returnIdentity?: string;
  returnNote?: string;
  returnedByAgent?: string;
};

type ReportFilter = Partial<Pick<StoredReport, "status" | "service" | "createdBy">>;
export type ReportStatistics = {
  total: number;
  stolen: number;
  found: number;
  returned: number;
  stations: { service: string; total: number; stolen: number; found: number; returned: number; rate: number }[];
};

const legacyFile = path.join(process.cwd(), "data", "demo-reports.json");
const dataDirectory = process.env.POLICE_DATA_DIR
  || (process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "PoliceMali") : path.join(process.cwd(), "data"));
const file = path.join(dataDirectory, "demo-reports.json");

function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

function reportStatus(value: string): StoredReport["status"] {
  if (value === "STOLEN" || value === "FOUND" || value === "RETURNED") return value;
  throw new Error(`Invalid report status: ${value}`);
}

function recoveryMethod(value: string): NonNullable<StoredReport["recoveredBy"]> {
  if (value === "POLICE_STATION" || value === "OWNER" || value === "OTHER") return value;
  throw new Error(`Invalid recovery method: ${value}`);
}

function requireDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DEMO_MODE is not true");
  }
}

function mapReport(record: ReportRecord): StoredReport {
  return {
    dossier: record.dossier,
    pv: record.pv,
    status: reportStatus(record.status),
    date: record.date,
    region: record.region,
    quartier: record.quartier,
    nom: decryptSensitiveValue(record.nomEncrypted),
    prenom: decryptSensitiveValue(record.prenomEncrypted),
    telephone: decryptSensitiveValue(record.telephoneEncrypted),
    ...(record.pieceEncrypted === null ? {} : { piece: decryptSensitiveValue(record.pieceEncrypted) }),
    categorie: record.categorie,
    marque: record.marque,
    modele: record.modele,
    couleur: record.couleur,
    identifiantType: record.identifiantType,
    identifiant: decryptSensitiveValue(record.identifiantEncrypted),
    service: record.service,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
    ...(record.circonstancesEncrypted === null ? {} : { circonstances: decryptSensitiveValue(record.circonstancesEncrypted) }),
    ...(record.recoveredAt === null ? {} : { recoveredAt: record.recoveredAt }),
    ...(record.recoveredBy === null ? {} : { recoveredBy: recoveryMethod(record.recoveredBy) }),
    ...(record.recoveredByService === null ? {} : { recoveredByService: record.recoveredByService }),
    ...(record.recoveryNoteEncrypted === null ? {} : { recoveryNote: decryptSensitiveValue(record.recoveryNoteEncrypted) }),
    ...(record.returnedAt === null ? {} : { returnedAt: record.returnedAt }),
    ...(record.returnIdentityEncrypted === null ? {} : { returnIdentity: decryptSensitiveValue(record.returnIdentityEncrypted) }),
    ...(record.returnNoteEncrypted === null ? {} : { returnNote: decryptSensitiveValue(record.returnNoteEncrypted) }),
    ...(record.returnedByAgent === null ? {} : { returnedByAgent: record.returnedByAgent }),
  };
}

async function listDemoReports(): Promise<StoredReport[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as StoredReport[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || file === legacyFile) throw error;
    try {
      return JSON.parse(await fs.readFile(legacyFile, "utf8")) as StoredReport[];
    } catch (legacyError) {
      if ((legacyError as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw legacyError;
    }
  }
}

async function saveDemoReports(reports: StoredReport[]) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(reports, null, 2), "utf8");
  await fs.rename(temporaryFile, file);
}

function isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function toDatabaseCreate(report: StoredReport): Prisma.ReportRecordUncheckedCreateInput {
  return {
    dossier: report.dossier,
    dossierLookupHash: reportLookupHash(report.dossier),
    pv: report.pv,
    pvLookupHash: reportLookupHash(report.pv),
    status: report.status,
    date: report.date,
    region: report.region,
    quartier: report.quartier,
    nomEncrypted: encryptSensitiveValue(report.nom),
    prenomEncrypted: encryptSensitiveValue(report.prenom),
    telephoneEncrypted: encryptSensitiveValue(report.telephone),
    pieceEncrypted: report.piece ? encryptSensitiveValue(report.piece) : null,
    categorie: report.categorie,
    marque: report.marque,
    modele: report.modele,
    couleur: report.couleur,
    identifiantType: report.identifiantType,
    identifiantEncrypted: encryptSensitiveValue(report.identifiant),
    identifiantLookupHash: reportLookupHash(report.identifiant),
    service: report.service,
    createdBy: report.createdBy,
    createdAt: new Date(report.createdAt),
    circonstancesEncrypted: report.circonstances ? encryptSensitiveValue(report.circonstances) : null,
    recoveredAt: report.recoveredAt ?? null,
    recoveredBy: report.recoveredBy ?? null,
    recoveredByService: report.recoveredByService ?? null,
    recoveryNoteEncrypted: report.recoveryNote ? encryptSensitiveValue(report.recoveryNote) : null,
    returnedAt: report.returnedAt ?? null,
    returnIdentityEncrypted: report.returnIdentity ? encryptSensitiveValue(report.returnIdentity) : null,
    returnNoteEncrypted: report.returnNote ? encryptSensitiveValue(report.returnNote) : null,
    returnedByAgent: report.returnedByAgent ?? null,
  };
}

async function createDatabaseReport(report: StoredReport) {
  requireDatabaseUrl();
  return prisma.reportRecord.create({ data: toDatabaseCreate(report) }).then(mapReport).catch(error => {
    if (isUniqueConstraintError(error)) throw new Error("REPORT_IDENTIFIER_EXISTS");
    throw error;
  });
}

export async function listReports(filter: ReportFilter = {}): Promise<StoredReport[]> {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    return reports.filter(report => (!filter.status || report.status === filter.status)
      && (!filter.service || report.service === filter.service)
      && (!filter.createdBy || report.createdBy === filter.createdBy));
  }
  requireDatabaseUrl();
  const records = await prisma.reportRecord.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.service ? { service: filter.service } : {}),
      ...(filter.createdBy ? { createdBy: filter.createdBy } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return records.map(mapReport);
}

function statisticsFromReports(reports: Pick<StoredReport, "status" | "service">[]): ReportStatistics {
  const summarize = (items: Pick<StoredReport, "status" | "service">[]) => {
    const stolen = items.filter(report => report.status === "STOLEN").length;
    const found = items.filter(report => report.status === "FOUND").length;
    const returned = items.filter(report => report.status === "RETURNED").length;
    const total = items.length;
    return { total, stolen, found, returned, rate: total ? Math.round(((found + returned) / total) * 100) : 0 };
  };
  const summary = summarize(reports);
  const byService = new Map<string, Pick<StoredReport, "status" | "service">[]>();
  for (const report of reports) {
    byService.set(report.service, [...(byService.get(report.service) ?? []), report]);
  }
  return {
    total: summary.total,
    stolen: summary.stolen,
    found: summary.found,
    returned: summary.returned,
    stations: Array.from(byService, ([service, items]) => ({ service, ...summarize(items) }))
      .sort((left, right) => right.total - left.total),
  };
}

export async function getReportStatistics(createdBy?: string): Promise<ReportStatistics> {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    return statisticsFromReports(createdBy ? reports.filter(report => report.createdBy === createdBy) : reports);
  }
  requireDatabaseUrl();
  const where = createdBy ? { createdBy } : undefined;
  const reports = await prisma.reportRecord.findMany({
    where,
    select: { status: true, service: true },
  });
  return statisticsFromReports(reports.map(report => ({
    status: reportStatus(report.status),
    service: report.service,
  })));
}

export async function findReportByIdentifier(value: string) {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    const normalized = value.toUpperCase().replace(/[\s-]/g, "").trim();
    return reports.find(report => [report.identifiant, report.dossier, report.pv]
      .some(candidate => candidate.toUpperCase().replace(/[\s-]/g, "").trim() === normalized));
  }
  requireDatabaseUrl();
  const lookupHash = reportLookupHash(value);
  const record = await prisma.reportRecord.findFirst({
    where: {
      OR: [
        { identifiantLookupHash: lookupHash },
        { dossierLookupHash: lookupHash },
        { pvLookupHash: lookupHash },
      ],
    },
  });
  return record ? mapReport(record) : undefined;
}

export async function findReportByObjectIdentifier(value: string) {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    const normalized = value.toUpperCase().replace(/[\s-]/g, "").trim();
    return reports.find(report => report.identifiant.toUpperCase().replace(/[\s-]/g, "").trim() === normalized);
  }
  requireDatabaseUrl();
  const record = await prisma.reportRecord.findUnique({
    where: { identifiantLookupHash: reportLookupHash(value) },
  });
  return record ? mapReport(record) : undefined;
}

export async function saveReport(report: StoredReport) {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    const normalized = report.identifiant.toUpperCase().replace(/[\s-]/g, "").trim();
    if (reports.some(existing => existing.identifiant.toUpperCase().replace(/[\s-]/g, "").trim() === normalized)) {
      throw new Error("REPORT_IDENTIFIER_EXISTS");
    }
    await saveDemoReports([report, ...reports]);
    return report;
  }
  return createDatabaseReport(report);
}

export async function markReportFound(
  dossier: string,
  recovery: Pick<StoredReport, "recoveredAt" | "recoveredBy" | "recoveredByService" | "recoveryNote">,
  service?: string,
) {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    const target = reports.find(report => report.dossier === dossier && report.status === "STOLEN"
      && (!service || report.service === service));
    if (!target) return undefined;
    const updated = { ...target, ...recovery, status: "FOUND" as const };
    await saveDemoReports(reports.map(report => report.dossier === dossier ? updated : report));
    return updated;
  }
  requireDatabaseUrl();
  const result = await prisma.reportRecord.updateMany({
    where: { dossier, status: "STOLEN", ...(service ? { service } : {}) },
    data: {
      status: "FOUND",
      recoveredAt: recovery.recoveredAt ?? null,
      recoveredBy: recovery.recoveredBy ?? null,
      recoveredByService: recovery.recoveredByService ?? null,
      recoveryNoteEncrypted: recovery.recoveryNote ? encryptSensitiveValue(recovery.recoveryNote) : null,
    },
  });
  if (result.count !== 1) return undefined;
  const updated = await prisma.reportRecord.findUnique({ where: { dossier } });
  return updated ? mapReport(updated) : undefined;
}

export async function markReportReturned(
  dossier: string,
  details: Pick<StoredReport, "returnedAt" | "returnIdentity" | "returnNote" | "returnedByAgent">,
  service?: string,
) {
  if (isDemoMode()) {
    const reports = await listDemoReports();
    const target = reports.find(report => report.dossier === dossier && report.status === "FOUND"
      && (!service || report.service === service));
    if (!target) return undefined;
    const updated = { ...target, ...details, status: "RETURNED" as const };
    await saveDemoReports(reports.map(report => report.dossier === dossier ? updated : report));
    return updated;
  }
  requireDatabaseUrl();
  const result = await prisma.reportRecord.updateMany({
    where: { dossier, status: "FOUND", ...(service ? { service } : {}) },
    data: {
      status: "RETURNED",
      returnedAt: details.returnedAt ?? null,
      returnIdentityEncrypted: details.returnIdentity ? encryptSensitiveValue(details.returnIdentity) : null,
      returnNoteEncrypted: details.returnNote ? encryptSensitiveValue(details.returnNote) : null,
      returnedByAgent: details.returnedByAgent ?? null,
    },
  });
  if (result.count !== 1) return undefined;
  const updated = await prisma.reportRecord.findUnique({ where: { dossier } });
  return updated ? mapReport(updated) : undefined;
}

const editableFields = [
  "pv", "date", "region", "quartier", "nom", "prenom", "telephone", "piece",
  "categorie", "marque", "modele", "couleur", "identifiantType", "identifiant", "circonstances",
] as const;

export async function updateReport(dossier: string, changes: Partial<StoredReport>) {
  const safeChanges = Object.fromEntries(editableFields
    .filter(field => changes[field] !== undefined)
    .map(field => [field, changes[field]])) as Partial<StoredReport>;

  if (isDemoMode()) {
    const reports = await listDemoReports();
    const target = reports.find(report => report.dossier === dossier);
    if (!target) return undefined;
    const updated = { ...target, ...safeChanges, dossier: target.dossier };
    if (safeChanges.identifiant) {
      const normalized = safeChanges.identifiant.toUpperCase().replace(/[\s-]/g, "").trim();
      if (reports.some(report => report.dossier !== dossier
        && report.identifiant.toUpperCase().replace(/[\s-]/g, "").trim() === normalized)) {
        throw new Error("REPORT_IDENTIFIER_EXISTS");
      }
    }
    await saveDemoReports(reports.map(report => report.dossier === dossier ? updated : report));
    return updated;
  }

  requireDatabaseUrl();
  const data: Prisma.ReportRecordUpdateInput = {};
  if (safeChanges.pv !== undefined) {
    data.pv = safeChanges.pv;
    data.pvLookupHash = reportLookupHash(safeChanges.pv);
  }
  if (safeChanges.status !== undefined) data.status = safeChanges.status;
  if (safeChanges.date !== undefined) data.date = safeChanges.date;
  if (safeChanges.region !== undefined) data.region = safeChanges.region;
  if (safeChanges.quartier !== undefined) data.quartier = safeChanges.quartier;
  if (safeChanges.nom !== undefined) data.nomEncrypted = encryptSensitiveValue(safeChanges.nom);
  if (safeChanges.prenom !== undefined) data.prenomEncrypted = encryptSensitiveValue(safeChanges.prenom);
  if (safeChanges.telephone !== undefined) data.telephoneEncrypted = encryptSensitiveValue(safeChanges.telephone);
  if (safeChanges.piece !== undefined) data.pieceEncrypted = safeChanges.piece ? encryptSensitiveValue(safeChanges.piece) : null;
  if (safeChanges.categorie !== undefined) data.categorie = safeChanges.categorie;
  if (safeChanges.marque !== undefined) data.marque = safeChanges.marque;
  if (safeChanges.modele !== undefined) data.modele = safeChanges.modele;
  if (safeChanges.couleur !== undefined) data.couleur = safeChanges.couleur;
  if (safeChanges.identifiantType !== undefined) data.identifiantType = safeChanges.identifiantType;
  if (safeChanges.identifiant !== undefined) {
    data.identifiantEncrypted = encryptSensitiveValue(safeChanges.identifiant);
    data.identifiantLookupHash = reportLookupHash(safeChanges.identifiant);
  }
  if (safeChanges.circonstances !== undefined) {
    data.circonstancesEncrypted = safeChanges.circonstances ? encryptSensitiveValue(safeChanges.circonstances) : null;
  }
  try {
    return mapReport(await prisma.reportRecord.update({ where: { dossier }, data }));
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("REPORT_IDENTIFIER_EXISTS");
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return undefined;
    throw error;
  }
}

export async function importLegacyReports(reports: StoredReport[]) {
  requireDatabaseUrl();
  let imported = 0;
  for (const report of reports) {
    const existing = await prisma.reportRecord.findFirst({
      where: {
        OR: [
          { dossier: report.dossier },
          { identifiantLookupHash: reportLookupHash(report.identifiant) },
        ],
      },
      select: { dossier: true },
    });
    if (existing) {
      if (existing.dossier !== report.dossier) throw new Error(`REPORT_IDENTIFIER_CONFLICT:${existing.dossier}`);
      continue;
    }
    await createDatabaseReport(report);
    imported += 1;
  }
  return imported;
}

export async function readLegacyReports(source = file): Promise<StoredReport[]> {
  try {
    return JSON.parse(await fs.readFile(source, "utf8")) as StoredReport[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && source === file && file !== legacyFile) {
      return readLegacyReports(legacyFile);
    }
    throw error;
  }
}
