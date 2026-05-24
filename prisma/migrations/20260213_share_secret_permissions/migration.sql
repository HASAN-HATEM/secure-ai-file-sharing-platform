-- Recreate file_object_permissions for shared-secret based access
DROP TABLE IF EXISTS "file_object_permissions";

CREATE TABLE "file_object_permissions" (
  "id" TEXT NOT NULL,
  "file_object_id" TEXT NOT NULL,
  "recipient_user_id" INTEGER NOT NULL,
  "secret_hash" TEXT NOT NULL,
  "can_download" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "file_object_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_object_permissions_unique" ON "file_object_permissions"("file_object_id", "recipient_user_id");
CREATE INDEX "file_object_permissions_user_idx" ON "file_object_permissions"("recipient_user_id");

ALTER TABLE "file_object_permissions"
  ADD CONSTRAINT "file_object_permissions_file_object_id_fkey"
  FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_object_permissions"
  ADD CONSTRAINT "file_object_permissions_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
