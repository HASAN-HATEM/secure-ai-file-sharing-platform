# Secure AI File Sharing Platform

End-to-end encrypted file sharing for students with AI malware scanning, classification, and RBAC.

## Overview
Students and university staff often swap assignments, notes, and research files over channels that offer no encryption and no protection against malicious attachments. This platform encrypts every file in the browser before it leaves the device and runs each upload through an AI service that scans for malware and classifies the content, so files can be shared safely with role-based access control. I built it as my university Final Year Project (FYP).

**Author:** Hasan Dhafer · [LinkedIn](https://www.linkedin.com/in/hasanxrr/) · [GitHub](https://github.com/HASAN-HATEM)

## Demo
[![Watch the demo](https://img.youtube.com/vi/n0tcdZguZD4/hqdefault.jpg)](https://youtu.be/n0tcdZguZD4)

*Click the thumbnail to watch the full walkthrough on YouTube.*

## Key Features
- **End-to-end client-side encryption:** AES-256-GCM in the browser, with per-file keys wrapped by a PBKDF2-derived user master key
- **AI malware scanning and file classification:** a FastAPI microservice scans every upload and classifies text and image files
- **Role-based access control (RBAC):** separate user and admin roles, with server-side permission checks on every file operation
- **Presigned Cloudflare R2 uploads with a quarantine pipeline:** the browser uploads straight to a temporary key, and malicious files are quarantined and never written to final storage
- **Unit-tested:** Vitest suites cover auth/RBAC, the upload pipeline, and download permissions

## Stack
- Next.js (App Router) for frontend + API routes
- PostgreSQL for metadata storage (no file bytes in DB)
- Cloudflare R2 (S3-compatible) for object storage
- FastAPI microservice for malware scan + text/image classification
- Docker Compose to run web + db + ai

## Repo Structure
- `app/` Next.js app pages + API routes
- `lib/` server utilities (auth, db, pipeline, AI client)
- `components/` shared UI
- `db/schema.sql` database schema
- `ai/` FastAPI service (Dockerfile, main.py, requirements.txt)
- `docker-compose.yml` orchestration
- `tests/` vitest unit tests

## Setup (VS Code terminal)
1. `npm install`
2. Copy env: `cp .env.example .env` and adjust secrets.
3. Start Postgres+AI+web via Docker: `docker compose up --build`
   - Web on http://localhost:3000 by default
   - If port 3000 is already in use, set `WEB_PORT` first. PowerShell: `$env:WEB_PORT=3001`
   - AI service on http://localhost:8000
4. If running locally without Docker DB, create database and apply schema:
   ```bash
   createdb securefiles
   psql securefiles < db/schema.sql
   ```

## Running
- Dev: `npm run dev`
- Prod build: `npm run build && npm run start`
- Tests: `npm run test`

## Required environment variables
- `DATABASE_URL`
- `JWT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `SCANNER_SERVICE_URL`
- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `MAX_UPLOAD_BYTES`
- `ALLOWED_MIME`
- `RESCAN_ON_DOWNLOAD`
- `FILE_MASTER_KEY_BASE64`
- `FILE_MASTER_KEY_ID`

## Creating an admin user
- Insert via SQL: `INSERT INTO users (name,email,password_hash,role,key_salt) VALUES ('Admin','admin@example.com','<bcrypt hash>','ADMIN', decode('aabb', 'hex'));`
  - Generate hash: `node -e "console.log(require('bcryptjs').hashSync('YourPass', 10))"`
- Or register normally then update: `UPDATE users SET role='ADMIN' WHERE email='you@example.com';`

## Encryption & key handling
- Client-side AES-256-GCM before upload. A per-file key is generated in-browser and encrypts the file bytes.
- A per-user master key is derived with PBKDF2 from the user password + server-provided salt (`keySalt`, stored locally after login).
- The file key is wrapped (encrypted) with the master key; server stores only the wrapped key, IVs, and encrypted blob.
- Download: server returns encrypted blob + IVs + wrapped key; client derives master key again from password, unwraps the file key, and decrypts locally.
- Sharing (demo): owner re-wraps the file key using a shared secret + recipient email as salt; recipient must know that secret to unwrap. File keys are cached in `localStorage` (`filekey-<id>`) after upload for re-wrapping.

## Upload pipeline (Option B)
1. UI calls `POST /api/uploads/create` with `filename`, `mimeType`, `sizeBytes`.
2. Server validates size/MIME, inserts `file_objects` row (`PENDING`), returns `fileId`, `tempKey`, and presigned PUT URL.
3. Browser uploads raw bytes to R2 temp key using PUT.
4. UI calls `POST /api/uploads/finalize` with `fileId` and `tempKey`.
5. Server downloads temp object, scans malware (`/scan/malware`), classifies (`/classify/image` or `/classify/text`), encrypts at rest (AES-256-GCM + wrapped DEK), writes encrypted object to final R2 key, deletes temp object, and marks DB row `READY`.
6. If malicious, server marks row `QUARANTINED`, deletes temp object, and does not write final object.

## Download pipeline
1. UI hits `GET /api/files/[id]/download`.
2. Server verifies ownership, fetches ciphertext from R2, decrypts server-side, optionally rescans when `RESCAN_ON_DOWNLOAD=true`, and streams plaintext response with download headers.

## Manual test steps
1. Run `docker compose up --build`.
2. Open `http://localhost:3000`, or `http://localhost:$env:WEB_PORT` if you changed `WEB_PORT`.
3. Upload an allowed file type and verify status reaches Completed.
4. Go to Files page and download the file; verify file opens correctly.
5. Test disallowed MIME or oversized file to confirm `create` rejects it.
6. Test malware-stub positive case in AI service (if configured) to confirm `finalize` returns `QUARANTINED`.

## Tests included
- `tests/auth-rbac.test.ts`: password hashing + RBAC guard
- `tests/pipeline.test.ts`: upload pipeline blocks malicious, stores clean + classification (mocks AI/DB)
- `tests/permissions.test.ts`: download permission rules

## Notes / limits
- Reset password is demo token-based (`demo-reset`).
- AI models are lightweight heuristics; endpoints are stable for swapping real models later.
- Sharing uses a shared-secret demo approach; for production replace with public-key per-user key wrapping.
