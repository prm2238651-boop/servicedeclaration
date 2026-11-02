import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { normalizeIdentifier } from "@/lib/normalization";
import { listReports, type StoredReport } from "@/lib/report-store";
import { rateLimit } from "@/lib/security";
const publicMatch=(r:StoredReport)=>({
  dossier:r.dossier,
  pv:r.pv,
  status:r.status,
  date:r.date,
  region:r.region,
  quartier:r.quartier,
  nom:r.nom,
  prenom:r.prenom,
  telephone:r.telephone,
  categorie:r.categorie,
  marque:r.marque,
  modele:r.modele,
  couleur:r.couleur,
  identifiant:r.identifiant,
  identifiantType:r.identifiantType,
  service:r.service,
  createdBy:r.createdBy,
  createdAt:r.createdAt,
  recoveredAt:r.recoveredAt,
  recoveredBy:r.recoveredBy,
  recoveredByService:r.recoveredByService,
  returnedAt:r.returnedAt,
  returnedByAgent:r.returnedByAgent,
});
export async function GET(request: Request) {
  const session = await readSession();
  if (!hasPermission(session, "SEARCH")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const limited = rateLimit(request, "search", 60, 60_000, session!.matricule);
  if (limited) return limited;

  const raw = new URL(request.url).searchParams.get("q") || "";
  const query = normalizeIdentifier(raw);
  if (query.length < 4 || query.length > 64) {
    return NextResponse.json({ error: "INVALID_IDENTIFIER" }, { status: 400 });
  }

  const report = (await listReports()).find(
    (item) =>
      normalizeIdentifier(item.identifiant) === query ||
      normalizeIdentifier(item.dossier) === query ||
      normalizeIdentifier(item.pv) === query,
  );
  if (report) {
    return NextResponse.json(
      { found: true, match: publicMatch(report), searchedAt: new Date().toISOString(), identifier: query },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      found: false,
      match: null,
      searchedAt: new Date().toISOString(),
      identifier: query,
      notice: "Aucun dossier correspondant dans la base nationale.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
