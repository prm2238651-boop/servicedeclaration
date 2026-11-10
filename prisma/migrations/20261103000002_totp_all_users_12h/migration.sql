ALTER TABLE "auth_accounts"
ADD COLUMN "totp_last_verified_at" TIMESTAMP(3);
