CREATE TABLE "auth_accounts" (
    "user_id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totp_secret_encrypted" TEXT,
    "totp_pending_secret_encrypted" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_last_used_step" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "auth_accounts_matricule_key" ON "auth_accounts"("matricule");

CREATE TABLE "auth_recovery_codes" (
    "code_hash" TEXT NOT NULL,
    "account_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_recovery_codes_pkey" PRIMARY KEY ("code_hash")
);

CREATE INDEX "auth_recovery_codes_account_user_id_idx" ON "auth_recovery_codes"("account_user_id");

ALTER TABLE "auth_recovery_codes"
ADD CONSTRAINT "auth_recovery_codes_account_user_id_fkey"
FOREIGN KEY ("account_user_id") REFERENCES "auth_accounts"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;
