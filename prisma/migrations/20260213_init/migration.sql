-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "file_object_status" AS ENUM ('PENDING', 'READY', 'QUARANTINED', 'FAILED');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_user_id" INTEGER,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER,
    "timestamp" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_results" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER,
    "classifier_type" TEXT NOT NULL,
    "label" TEXT,
    "confidence" REAL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_permissions" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER,
    "user_id" INTEGER,
    "can_download" BOOLEAN DEFAULT true,
    "wrapped_key_for_user" TEXT,
    "wrap_iv_for_user" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "encrypted_blob" BYTEA NOT NULL,
    "iv" TEXT NOT NULL,
    "wrap_iv" TEXT NOT NULL,
    "wrapped_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" SERIAL NOT NULL,
    "file_id" INTEGER,
    "is_malicious" BOOLEAN NOT NULL,
    "score" REAL,
    "model_version" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "key_salt" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "temp_key" TEXT,
    "storage_key" TEXT,
    "status" "file_object_status" NOT NULL DEFAULT 'PENDING',
    "scan_score" DOUBLE PRECISION,
    "scan_is_malicious" BOOLEAN,
    "scan_model_version" TEXT,
    "category_label" TEXT,
    "category_confidence" DOUBLE PRECISION,
    "enc_algo" TEXT,
    "enc_iv_base64" TEXT,
    "enc_tag_base64" TEXT,
    "enc_key_id" TEXT,
    "enc_dek_base64" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results_v2" (
    "id" TEXT NOT NULL,
    "file_object_id" TEXT NOT NULL,
    "is_malicious" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION,
    "model_version" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_results_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_results_v2" (
    "id" TEXT NOT NULL,
    "file_object_id" TEXT NOT NULL,
    "classifier" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classification_results_v2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_object_permissions" (
    "id" TEXT NOT NULL,
    "file_object_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "can_download" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_object_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_permissions_file_id_user_id_key" ON "file_permissions"("file_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "file_objects_storage_key_key" ON "file_objects"("storage_key");

-- CreateIndex
CREATE INDEX "file_objects_owner_status_idx" ON "file_objects"("owner_id", "status");

-- CreateIndex
CREATE INDEX "scan_results_v2_file_object_idx" ON "scan_results_v2"("file_object_id");

-- CreateIndex
CREATE INDEX "classification_results_v2_file_object_idx" ON "classification_results_v2"("file_object_id");

-- CreateIndex
CREATE INDEX "file_object_permissions_user_idx" ON "file_object_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_object_permissions_unique" ON "file_object_permissions"("file_object_id", "user_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "classification_results" ADD CONSTRAINT "classification_results_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "file_permissions" ADD CONSTRAINT "file_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scan_results_v2" ADD CONSTRAINT "scan_results_v2_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_results_v2" ADD CONSTRAINT "classification_results_v2_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_object_permissions" ADD CONSTRAINT "file_object_permissions_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

