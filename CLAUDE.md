# CLAUDE.md — Secure AI File Sharing Platform

## UI Enhancement Rules

When doing any frontend work in `app/` or `components/`:

- **Preserve all existing colors and theme variables exactly as-is.** Do not change any color values, CSS custom properties, or Tailwind color classes that already exist.
- **Enhance only:** spacing, layout, shadows, border-radius, hover states, transitions, and animations.
- **Do not introduce new color tokens** or override existing ones.
- **Do not change fonts or type scale.** Font families, sizes, weights, and line-heights must remain untouched.
- **Do not touch:** `app/api/`, `lib/`, `ai/`, or any Docker/env files.

---

## STRICTLY OFF-LIMITS — NEVER MODIFY

The following files must **never** be read, edited, created, or deleted by Claude:

| Category | Files / Patterns |
|---|---|
| **Docker files** | `Dockerfile`, `Dockerfile.trainer-gpu`, `docker-compose.yml`, `docker-compose.gpu.yml`, `.dockerignore`, `ai/Dockerfile`, `ai/Dockerfile.cuda`, `ai/.dockerignore` |
| **AI/ML model files** | `models/**` (all files), `ai/models/**`, `ai/modules/cnn_model.h5` |
| **Environment files** | `.env`, `.env.example` |

---

## Tech Stack

### Frontend / Backend (Next.js monolith)
- **Next.js 14** — App Router, API routes, server components
- **React 18** + **TypeScript 5.3**
- **NextAuth.js v4** — JWT session strategy, credentials provider
- **Prisma 7** + **PostgreSQL** — ORM for the `FileObject` pipeline; raw `pg` pool for legacy tables
- **AWS SDK v3 (S3-compatible)** — Cloudflare R2 for object storage
- **bcryptjs** — password hashing and share-secret hashing
- **Zod** — runtime validation
- **Vitest** — unit tests

### AI Microservice (Python)
- **FastAPI** — HTTP API, runs on port 8000 (internal hostname `ai`)
- **PyTorch** + **torchvision** — ResNet50 for image categorisation and custom filetype classification
- **TensorFlow/Keras** — MalConv for binary malware detection (PE/OLE)
- **HuggingFace Transformers** — BERT for text classification; URL threat model
- **Pillow (PIL)** — image decoding

---

## Folder Structure

```
/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # login, register, reset-password pages
│   ├── api/
│   │   ├── auth/                 # NextAuth catch-all + custom login/logout/me/register/reset
│   │   ├── files/                # Legacy file CRUD (v1 pipeline)
│   │   ├── uploads/              # v2 pipeline: create (ticket), finalize, transfer
│   │   ├── admin/                # Admin-only: users list, logs
│   │   ├── analytics/            # Aggregated stats
│   │   └── logs/                 # Per-user audit log
│   ├── admin/                    # Admin dashboard page
│   ├── analytics/                # Analytics page
│   ├── dashboard/                # Main dashboard
│   ├── files/                    # File browser
│   ├── logs/                     # Audit log viewer
│   ├── security/                 # Security scan results
│   ├── settings/                 # User settings
│   ├── shared/                   # Files shared with user
│   ├── system/                   # System / model health status
│   └── upload/                   # Upload page
├── components/                   # AppShell, NavBar, SideNav, TopBar
├── lib/
│   ├── scan-service.ts           # Typed HTTP client to AI service (v2, canonical)
│   ├── aiClient.ts               # HTTP client to AI service (v1/legacy)
│   ├── file-objects.ts           # v2 upload pipeline: ticket creation, finalize, share, download
│   ├── pipeline.ts               # v1 upload pipeline (legacy)
│   ├── storage-crypto.ts         # Server-side AES-256-GCM envelope encryption
│   ├── client-crypto.ts          # Browser Web Crypto: PBKDF2 key derivation, AES-GCM
│   ├── r2.ts                     # Cloudflare R2 / S3 client (presigned URLs, get, put, delete)
│   ├── auth.ts                   # Password hashing, getUserFromRequest
│   ├── auth-options.ts           # NextAuth options (JWT callbacks, keySalt forwarding)
│   ├── rbac.ts                   # assertRole() helper
│   ├── audit.ts                  # logAudit() — writes to audit_logs
│   ├── db.ts                     # Raw pg Pool (legacy queries)
│   ├── prisma.ts                 # Prisma client singleton
│   ├── files.ts                  # Legacy raw-SQL file CRUD
│   ├── users.ts                  # User management (find, create, ensureAdminUser)
│   ├── upload-config.ts          # MAX_UPLOAD_BYTES, ALLOWED_MIME, RESCAN_ON_DOWNLOAD
│   └── request-user.ts           # resolveOwnerId() — resolves session user from request
├── ai/
│   ├── main.py                   # FastAPI app entry point
│   ├── model_registry.py         # ModelRegistry singleton + all inference logic
│   └── train_image_classifier.py # ML training script (do not modify)
├── prisma/
│   ├── schema.prisma             # Canonical DB schema (Prisma models)
│   └── migrations/               # Migration history
├── scripts/                      # Python ML training & evaluation utilities
├── training-data/                # ML dataset (raw, processed, eval splits)
├── tests/                        # Vitest unit tests
├── middleware.ts                 # Next.js edge auth guard (NextAuth JWT)
├── next.config.js                # Minimal Next.js config
└── package.json
```

---

## Main Features

### 1. Two Upload Pipelines (v1 legacy + v2 current)

**v2 (current — use this for new work):** `app/api/uploads/`
1. `POST /api/uploads/create` — validates MIME + size, creates a `FileObject` (status=`PENDING`) in Prisma, returns a presigned R2 PUT URL.
2. Client uploads directly to R2 via the presigned URL.
3. `POST /api/uploads/finalize` — pulls plaintext from R2, runs malware scan, classifies, encrypts, writes final object to R2, updates `FileObject` status to `READY` or `QUARANTINED`.

**v1 (legacy — do not extend):** `app/api/files/upload`, uses `lib/pipeline.ts` and raw SQL `files` table.

### 2. Server-Side Envelope Encryption (`lib/storage-crypto.ts`)
- Random 256-bit DEK generated per file.
- File encrypted with AES-256-GCM (DEK as key).
- DEK wrapped (encrypted) with master key read from `FILE_MASTER_KEY_BASE64` env var.
- On download: unwrap DEK with master key → decrypt ciphertext.

### 3. AI Malware Scanning (`lib/scan-service.ts` → AI service)
Every upload is scanned on finalize via `POST /scan/malware`. The scan is composite:
- **MalConv** (TF/Keras) — byte-level CNN for PE/OLE executables
- **URL threat** (HuggingFace) — extracts and scores URLs found in the payload
- **Document threat** (heuristic) — pattern matching for PDF JavaScript, DOCX macros, embedded executables
- **Image threat** (heuristic) — malformed image detection, embedded PE headers, script markers

Files with `is_malicious: true` → status set to `QUARANTINED`, deleted from R2.

### 4. AI File Classification (`lib/scan-service.ts` → AI service)
- **Images** → `POST /classify/image`: returns ImageNet ResNet50 label + custom filetype classifier label (diagram / document_scan / logo / photo / screenshot). Filetype label takes precedence in the UI.
- **Text/PDF/DOCX** → `POST /classify/text`: BERT AG News classifier (world / sports / business / science_technology).
- **Other** → fallback BERT call with a stub string, stored as "document".

### 5. Authentication & Sessions
- NextAuth JWT strategy. The JWT token carries `id`, `role`, and `keySalt`.
- `keySalt` is the user's per-account PBKDF2 salt (used by client-side crypto).
- Middleware (`middleware.ts`) protects all non-API, non-auth routes.
- Roles: `USER` (default) and `ADMIN`. Admin is seeded on first login via `ensureAdminUser()`.

### 6. File Sharing
Owner calls `POST /api/uploads/transfer` to share a file with a recipient user. A `sharedSecret` is provided; its bcrypt hash is stored in `file_object_permissions`. The recipient must provide the correct secret to download.

### 7. Audit Logging
`lib/audit.ts` → `logAudit(actorId, action, targetType, targetId, details)` writes rows to the `audit_logs` table. Called throughout the upload and access paths.

### 8. RBAC
`lib/rbac.ts` exposes `assertRole(role, allowedRoles)` — throws `'Forbidden'` if the role is not in the allowed list. Admin routes call this before processing.

---

## Database Models

Two coexisting schemas — **do not mix** without purpose:

| Model | Table | Purpose |
|---|---|---|
| `FileObject` | `file_objects` | v2 pipeline files (Prisma, CUID IDs) |
| `ScanResult` | `scan_results_v2` | v2 scan results |
| `ClassificationResult` | `classification_results_v2` | v2 classification results |
| `FileObjectPermission` | `file_object_permissions` | v2 sharing permissions |
| `files` | `files` | v1 legacy files (raw SQL, integer IDs) |
| `scan_results` | `scan_results` | v1 legacy scan results |
| `classification_results` | `classification_results` | v1 legacy classifications |
| `file_permissions` | `file_permissions` | v1 legacy sharing |
| `users` | `users` | Shared by both pipelines |
| `audit_logs` | `audit_logs` | Shared audit trail |

`FileObject.status` enum: `PENDING → READY | QUARANTINED | FAILED`

---

## Key Conventions

- **AI service URL**: resolved from `SCANNER_SERVICE_URL` → `AI_SERVICE_URL` → `http://ai:8000` (the Docker Compose internal hostname is `ai`).
- **Runtime**: API routes that use Node.js built-ins declare `export const runtime = 'nodejs'`.
- **Prisma vs raw SQL**: New code uses Prisma (`lib/prisma.ts`). Raw `pg` pool (`lib/db.ts`) is only for legacy v1 tables.
- **MIME validation**: checked in `createUploadTicket()` against `ALLOWED_MIME` env var (defaults in `upload-config.ts`). Default max size is 25 MB.
- **No comments**: avoid adding comments unless the reason is genuinely non-obvious.
- **Tests**: Vitest with `vi.mock()` / `vi.spyOn()`. Run with `npm test`.
- **Linting**: `npm run lint` (ESLint + eslint-config-next).
- **Dev server**: `npm run dev`.

---

## Environment Variables (key ones)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` / `JWT_SECRET` | JWT signing secret |
| `FILE_MASTER_KEY_BASE64` | 32-byte base64 key for DEK wrapping |
| `FILE_MASTER_KEY_ID` | Key version label (default: `master-key-v1`) |
| `S3_ENDPOINT` | R2/S3 endpoint URL |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 credentials |
| `S3_BUCKET` | R2 bucket name |
| `SCANNER_SERVICE_URL` / `AI_SERVICE_URL` | Override AI service URL |
| `MAX_UPLOAD_BYTES` | Upload size limit (default 26,214,400) |
| `ALLOWED_MIME` | Comma-separated allowed MIME types |
| `RESCAN_ON_DOWNLOAD` | `true` to rescan on download (4 s timeout) |
| `MALWARE_MODEL_ID` | HuggingFace model ID for MalConv |
| `TEXT_MODEL_ID` | HuggingFace model ID for BERT |
| `FILETYPE_MODEL_PATH` | Path to custom ResNet50 `.pt` checkpoint |
| `FILETYPE_CLASS_MAPPING_PATH` | Path to `class_mapping.json` |

> **Never commit or modify `.env` or `.env.example`.**
