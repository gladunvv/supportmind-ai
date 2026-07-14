# SupportMind AI

SupportMind AI is a multi-tenant SaaS backend for support teams. It combines organization-level knowledge bases, document ingestion, semantic search, AI-assisted answers, support reply drafting, usage tracking, audit logs, API keys, knowledge-gap detection, and webhooks.

The project is built as a production-oriented NestJS backend with PostgreSQL, Prisma, Redis, BullMQ, and pgvector.

## Features

### Authentication

* User registration and login
* Password hashing with Argon2
* JWT access and refresh tokens
* Refresh-token rotation
* Logout and current-user endpoint

### Multi-tenancy

* Organizations as isolated workspaces
* Organization memberships
* Tenant-scoped queries
* Archived organizations
* Protection against cross-organization data access

### RBAC

Supported roles:

* `owner`
* `admin`
* `support_agent`
* `viewer`

Permissions control access to:

* Organization management
* Member management
* Document uploads
* AI questions
* Support reply generation
* Usage and billing data
* Audit logs
* API keys and integrations

### Knowledge base

* Document upload
* Local storage abstraction
* TXT and Markdown ingestion
* PDF metadata support
* Background processing with BullMQ
* Text extraction and chunking
* Document processing statuses
* PostgreSQL vector storage with pgvector
* Organization-scoped semantic search

### AI and support workflows

* Knowledge-base question answering
* Grounded answers with source chunks
* Human-review signals
* Support reply drafts
* Configurable response tone
* Risk flags for billing, escalation, and sensitive cases
* Saved AI-question and support-draft history

### SaaS infrastructure

* Monthly usage tracking
* Organization audit logs
* Hashed API keys
* External API access
* Knowledge-gap detection
* Webhook endpoints and delivery history
* Signed webhook payloads
* Request IDs
* Global rate limiting
* Pagination
* Swagger/OpenAPI documentation
* Demo database seed

## Technology stack

* Node.js
* TypeScript
* NestJS
* Prisma
* PostgreSQL
* pgvector
* Redis
* BullMQ
* Docker Compose
* Argon2
* JWT
* Swagger

## Architecture overview

```text
Client / External Integration
            |
            v
       NestJS API
            |
    +-------+--------+
    |                |
    v                v
PostgreSQL         Redis
Prisma + pgvector  BullMQ
    |                |
    |                v
    |          Ingestion Worker
    |                |
    +--------<-------+
            |
            v
 Documents -> Extraction -> Chunking -> Embeddings -> Vector Search
                                              |
                                              v
                                  AI Ask / Support Draft
```

SupportMind keeps two major concepts separate:

1. Organization knowledge is stored in documents and document chunks.
2. AI requests retrieve relevant chunks only from the current organization.

Every organization-scoped endpoint verifies membership before accessing tenant data.

## Project structure

```text
src/
  common/
    dto/
    middleware/
    types/
    utils/

  generated/
    prisma/

  modules/
    ai/
    api-keys/
    audit/
    auth/
    document-ingestion/
    documents/
    embeddings/
    external-api/
    health/
    knowledge-gaps/
    members/
    organizations/
    prisma/
    search/
    support/
    usage/
    users/
    webhooks/
```

## Requirements

* Node.js 20 or newer
* pnpm
* Docker and Docker Compose

## Environment variables

Create `.env` from `.env.example`.

```env
PORT=3000

DATABASE_URL=postgresql://supportmind:supportmind@localhost:5432/supportmind
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_ACCESS_SECRET=replace_with_a_secure_access_secret
JWT_REFRESH_SECRET=replace_with_a_secure_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

UPLOAD_DIR=storage/uploads
MAX_DOCUMENT_SIZE_MB=10

CORS_ORIGIN=http://localhost:3001
```

Do not use development secrets in production.

## Local setup

Install dependencies:

```bash
pnpm install
```

Start PostgreSQL and Redis:

```bash
docker compose up -d
```

Generate the Prisma client:

```bash
pnpm prisma generate
```

Apply migrations:

```bash
pnpm prisma migrate dev
```

Seed demo data:

```bash
pnpm prisma db seed
```

Start the API:

```bash
pnpm start:dev
```

The API is available at:

```text
http://localhost:3000/api
```

Swagger documentation:

```text
http://localhost:3000/api/docs
```

Health endpoint:

```text
http://localhost:3000/api/health
```

## Demo credentials

The seed script creates a demo owner:

```text
Email: owner@supportmind.dev
Password: StrongPassword123!
```

The password is intended only for local development.

## Quality checks

```bash
pnpm lint
pnpm build
pnpm prisma migrate status
```

## Main API flow

### 1. Login

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@supportmind.dev",
    "password": "StrongPassword123!"
  }' | jq -r '.accessToken')
```

### 2. Get organizations

```bash
curl -s http://localhost:3000/api/organizations \
  -H "Authorization: Bearer $TOKEN" | jq
```

Save the organization ID:

```bash
ORG_ID=$(curl -s http://localhost:3000/api/organizations \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.[0].id')
```

### 3. Upload a document

Create a sample file:

```bash
cat > sample.md <<'EOF'
Refund policy

Annual plans may be reviewed by billing support.
Customers should provide an invoice ID and account email.
EOF
```

Upload it:

```bash
DOC_ID=$(curl -s -X POST \
  http://localhost:3000/api/organizations/$ORG_ID/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@sample.md;type=text/markdown" \
  | jq -r '.id')
```

Check its status:

```bash
curl -s \
  http://localhost:3000/api/organizations/$ORG_ID/documents/$DOC_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

A successfully processed document reaches:

```json
{
  "status": "indexed"
}
```

### 4. Search the knowledge base

```bash
curl -s -X POST \
  http://localhost:3000/api/organizations/$ORG_ID/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do annual refunds work?"
  }' | jq
```

### 5. Ask AI

```bash
curl -s -X POST \
  http://localhost:3000/api/organizations/$ORG_ID/ai/ask \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do annual refunds work?"
  }' | jq
```

The response contains:

* Generated answer
* Retrieved sources
* Human-review flag

### 6. Generate a support reply

```bash
curl -s -X POST \
  http://localhost:3000/api/organizations/$ORG_ID/support/draft-reply \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerMessage": "Can I get a refund for my annual plan?",
    "tone": "friendly"
  }' | jq
```

### 7. View usage

```bash
curl -s \
  http://localhost:3000/api/organizations/$ORG_ID/usage \
  -H "Authorization: Bearer $TOKEN" | jq
```

### 8. View audit logs

```bash
curl -s \
  "http://localhost:3000/api/organizations/$ORG_ID/audit-logs?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## API keys

Create an API key:

```bash
API_KEY=$(curl -s -X POST \
  http://localhost:3000/api/organizations/$ORG_ID/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local integration"
  }' | jq -r '.key')
```

The raw key is returned only once. Only its hash is stored in the database.

Use the key with the external API:

```bash
curl -s -X POST http://localhost:3000/api/v1/ask \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How do annual refunds work?"
  }' | jq
```

## Knowledge gaps

Questions with no sources or low retrieval confidence are stored as knowledge gaps.

List open gaps:

```bash
curl -s \
  http://localhost:3000/api/organizations/$ORG_ID/knowledge-gaps \
  -H "Authorization: Bearer $TOKEN" | jq
```

Repeated normalized questions increase the gap frequency instead of creating duplicates.

## Webhooks

Supported events include:

* `document_indexed`
* `document_failed`
* `ai_question_needs_review`
* `support_draft_needs_review`
* `knowledge_gap_created`

Webhook requests include:

```text
x-supportmind-event
x-supportmind-timestamp
x-supportmind-signature
```

The signature is an HMAC SHA-256 hash of:

```text
timestamp.body
```

using the webhook endpoint secret.

## Security decisions

* Passwords are hashed with Argon2.
* Refresh tokens are stored as hashes.
* API keys are stored as SHA-256 hashes.
* Raw API keys are shown only once.
* Organization data is scoped through membership checks.
* Role permissions are verified before sensitive actions.
* Revoked API keys cannot authenticate.
* Webhook payloads are signed.
* Uploaded files are validated by MIME type and size.
* Request validation rejects unknown DTO fields.
* Helmet adds common HTTP security headers.

## Current limitations

* AI answers currently use a mock AI provider.
* Embeddings currently use a deterministic mock provider.
* Mock embeddings validate the vector pipeline but do not provide production-quality semantic relevance.
* PDF text extraction is not implemented yet.
* File storage is local; object storage such as S3 can be added through the storage-provider abstraction.
* Webhook delivery currently happens in the request or worker flow and does not yet use a dedicated retry queue.
* Seeded chunks do not include vector embeddings; upload a document through the API to test the complete ingestion and search flow.
* Automated test coverage is still being added.

## Planned improvements

* Real OpenAI-compatible AI provider
* Real embedding provider
* PDF text extraction
* S3-compatible document storage
* Dedicated webhook delivery queue and retries
* Structured application logging
* Metrics and monitoring
* Integration and end-to-end tests
* GitHub Actions CI
* Next.js web application
* Optional per-customer conversation memory

## License

This project is intended as a portfolio and learning project. Add an explicit license before redistributing or using it in production.
