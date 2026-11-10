CREATE TABLE "report_records" (
    "id" TEXT NOT NULL,
    "dossier" TEXT NOT NULL,
    "dossierLookupHash" TEXT NOT NULL,
    "pv" TEXT NOT NULL,
    "pvLookupHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "quartier" TEXT NOT NULL,
    "nomEncrypted" TEXT NOT NULL,
    "prenomEncrypted" TEXT NOT NULL,
    "telephoneEncrypted" TEXT NOT NULL,
    "pieceEncrypted" TEXT,
    "categorie" TEXT NOT NULL,
    "marque" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "couleur" TEXT NOT NULL,
    "identifiantType" TEXT NOT NULL,
    "identifiantEncrypted" TEXT NOT NULL,
    "identifiantLookupHash" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TEXT,
    "recoveredBy" TEXT,
    "recoveredByService" TEXT,
    "recoveryNoteEncrypted" TEXT,
    "returnedAt" TEXT,
    "returnIdentityEncrypted" TEXT,
    "returnNoteEncrypted" TEXT,
    "returnedByAgent" TEXT,
    "circonstancesEncrypted" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_records_dossier_key" ON "report_records"("dossier");
CREATE UNIQUE INDEX "report_records_identifiantLookupHash_key" ON "report_records"("identifiantLookupHash");
CREATE INDEX "report_records_dossierLookupHash_idx" ON "report_records"("dossierLookupHash");
CREATE INDEX "report_records_pvLookupHash_idx" ON "report_records"("pvLookupHash");
CREATE INDEX "report_records_status_service_idx" ON "report_records"("status", "service");
CREATE INDEX "report_records_createdBy_idx" ON "report_records"("createdBy");
