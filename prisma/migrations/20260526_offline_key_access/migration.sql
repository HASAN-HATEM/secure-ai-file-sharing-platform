-- Make secret_hash nullable so shares no longer require an out-of-band secret.
-- Authenticated session + permission record is sufficient authorization.
ALTER TABLE "file_object_permissions" ALTER COLUMN "secret_hash" DROP NOT NULL;
