# CloudMind

[EN](./README.md) | [ZH-CN](./README.zh-CN.md)

CloudMind is an open source, Cloudflare-native, serverless-first
private AI memory layer for the AI era.

It is designed as a BYOC (Bring Your Own Cloud) project:

- deploy to your own Cloudflare account
- keep raw assets, derived content, and indexes under your control
- stay private by default instead of depending on a hosted SaaS operator
- benefit from Cloudflare-native deployment, availability, and low ops overhead
- use Cloudflare-native infrastructure by default
- preserve abstraction boundaries for future migration

## Use Cases

CloudMind is not limited to a traditional personal knowledge base.
It is intended for scenarios such as:

- building a personal AI memory layer that can be searched, cited, and reused
- turning saved URLs, notes, PDFs, and AI conversations into structured context
- grounding LLM applications with user-owned knowledge instead of SaaS-locked data
- exposing a private memory and context system through Web UI, REST APIs,
  browser extensions, MCP tools, and future interfaces
- serving as a portable foundation for retrieval, agent memory, and context engineering workflows

## Overview

CloudMind ingests URLs, notes, PDFs, browser-captured data, and
AI-originated content into a unified memory layer, then runs a processing
pipeline to produce:

- normalized content
- summaries
- chunks
- embeddings
- searchable and answerable memory assets

The current implementation is a single HonoX full-stack app with:

- Web UI
- REST API
- remote MCP server
- queue-driven ingest workflows

## Tech Stack

| Layer | Choice |
| --- | --- |
| Full-stack framework | HonoX + Hono |
| Language | TypeScript |
| Validation | Zod |
| Database | Cloudflare D1 |
| ORM | Drizzle ORM |
| Blob storage | Cloudflare R2 |
| Vector index | Cloudflare Vectorize |
| Async processing | Cloudflare Queues |
| AI provider | Cloudflare Workers AI |
| Testing | Vitest |
| Lint / format | Biome |

## Architecture

CloudMind keeps business logic separated from infrastructure details. The core service layer is written against ports so the default Cloudflare implementation can be replaced later.

Key boundaries:

- `AssetRepository`
- `BlobStore`
- `VectorStore`
- `JobQueue`
- `AIProvider`
- `WorkflowRepository`

Current infrastructure mapping:

| Port | Default implementation |
| --- | --- |
| `AssetRepository` | D1 + Drizzle |
| `WorkflowRepository` | D1 + Drizzle |
| `BlobStore` | R2 |
| `VectorStore` | Vectorize |
| `JobQueue` | Cloudflare Queues |
| `AIProvider` | Workers AI |

This keeps the application aligned with a fast Cloudflare-native MVP while leaving room for migration to PostgreSQL, pgvector, S3-compatible storage, or other model providers later.

## Processing Pipeline

The ingest system is workflow-driven. Assets are processed through type-specific workflows:

- `note_ingest_v1`
- `url_ingest_v1`
- `pdf_ingest_v1`

Typical flow:

1. create asset metadata
2. persist raw input
3. create workflow run
4. normalize and persist clean content
5. generate summary
6. split into chunks
7. create embeddings
8. write vectors and chunk metadata
9. finalize asset state

The queue consumer is wired through [`app/server.ts`](/G:/my_project/CloudMind/app/server.ts), and workflow dispatch is resolved through [`src/features/workflows/server/registry.ts`](/G:/my_project/CloudMind/src/features/workflows/server/registry.ts).

## Retrieval Model

Search and chat are built on a hybrid retrieval strategy:

- chunk-level semantic recall from Vectorize
- summary-level fallback matches from D1
- source-aware answer generation for chat responses

This allows:

- retrieval of precise local passages when chunk vectors are available
- graceful fallback to summary-only assets
- grounded responses with source references

## Web Surface

| Route | Purpose |
| --- | --- |
| `/` | home |
| `/capture` | ingest entry page |
| `/assets` | asset list |
| `/assets/:id` | asset detail |
| `/search` | semantic retrieval UI |
| `/ask` | memory-grounded Q&A |

## API Surface

### Ingest

- `POST /api/ingest/text`
- `POST /api/ingest/url`
- `POST /api/ingest/file`
- `POST /api/assets/:id/process`
- `POST /api/assets/backfill/chunks`

### Assets

- `GET /api/assets`
- `GET /api/assets/:id`
- `PATCH /api/assets/:id`
- `DELETE /api/assets/:id`
- `GET /api/assets/:id/jobs`
- `GET /api/assets/:id/workflows`

### Workflows

- `GET /api/workflows/:id`

### Search / Chat / Health

- `POST /api/search`
- `POST /api/chat`
- `GET /api/health`

## MCP Server

CloudMind exposes a remote MCP server over stateless HTTP at:

- `POST /mcp`

Available tools:

- `save_asset`
- `search_assets`
- `get_asset`
- `ask_library`

Tool semantics:

- `save_asset`: ingest a text note or URL into the memory layer
- `search_assets`: run semantic retrieval and return matched chunks or summary hits
- `get_asset`: fetch asset detail by ID
- `ask_library`: answer a question with grounded memory evidence

`GET /mcp` and `DELETE /mcp` are intentionally rejected with `405 Method not allowed`.

Example MCP-oriented capabilities are implemented in [`src/features/mcp/server/service.ts`](/G:/my_project/CloudMind/src/features/mcp/server/service.ts) and routed in [`src/features/mcp/server/routes.ts`](/G:/my_project/CloudMind/src/features/mcp/server/routes.ts).

## Example Requests

Create a text asset:

```bash
curl -X POST http://localhost:5173/api/ingest/text \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cloudflare Queues notes",
    "content": "Queues drive async workflow execution in CloudMind."
  }'
```

Run semantic search:

```bash
curl -X POST http://localhost:5173/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "queue-driven ingestion",
    "page": 1,
    "pageSize": 10
  }'
```

Ask the memory layer:

```bash
curl -X POST http://localhost:5173/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "How does CloudMind process ingested content?",
    "topK": 5
  }'
```

## Project Structure

```text
app/
  routes/                         HonoX page routes
  server.ts                       app entry and queue consumer entry
src/
  core/                           domain ports and core contracts
  env.ts                          Cloudflare binding types
  features/
    assets/                       asset query and management
    chat/                         memory-grounded Q&A
    ingest/                       ingest entrypoints and orchestration
    mcp/                          remote MCP server
    search/                       semantic retrieval
    workflows/                    workflow runtime and definitions
  platform/
    ai/                           Workers AI adapter
    blob/                         R2 adapter
    db/                           D1 repositories and schema
    queue/                        Queue adapter
    vector/                       Vectorize adapter
drizzle/                          D1 migrations
tests/unit/                       Vitest unit tests
```

## Local Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Useful scripts:

```bash
npm run build
npm run worker:dev
npm run worker:deploy
npm run typecheck
npm run lint
npm run format
npm run test
```

## Cloudflare Bindings

The app expects these bindings, defined in [`wrangler.jsonc`](/G:/my_project/CloudMind/wrangler.jsonc):

- `DB`
- `ASSET_FILES`
- `ASSET_VECTORS`
- `WORKFLOW_QUEUE`
- `AI`

Binding types are declared in [`src/env.ts`](/G:/my_project/CloudMind/src/env.ts).

## Testing

The repository includes unit coverage for:

- ingest services and routes
- asset services and routes
- search services and routes
- chat services and routes
- MCP routes
- workflow services
- Workers AI adapter

Run the baseline verification suite with:

```bash
npm run typecheck
npm run lint
npm run test
```

## Design Notes

Important implementation constraints:

- raw assets are retained; AI-derived outputs are recomputable
- infrastructure details should not leak across business logic
- queue-driven workflows are preferred over tightly coupled synchronous pipelines
- AI outputs are advisory, replaceable, and retryable
- retrieval and chat should degrade gracefully when some derived artifacts are missing

For product direction and architectural constraints, see [`AGENTS.md`](./AGENTS.md).
