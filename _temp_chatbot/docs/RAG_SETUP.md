# RAG (Retrieval-Augmented Generation) Setup

The chatbot uses a RAG system to augment answers with relevant dashboard context stored in a local JSON file (no PostgreSQL required).

## Architecture

```
Dashboard Data (DB) → RAG Sync → Embeddings (Gemini) → data/rag-store.json
                                                              ↓
User Question → Embed Query → Similarity Search → Top Chunks → Chat Prompt
```

## Prerequisites

1. **GOOGLE_API_KEY** – Same key used for Gemini (also used for embeddings)

## Setup Steps

### 1. Sync dashboard data into RAG store

With the app running:

```bash
npm run dev
# In another terminal:
curl -X POST http://localhost:3000/api/rag/sync
```

Or use the npm script:
```bash
npm run dev
# In another terminal:
npm run rag:sync
```

Response:
```json
{
  "success": true,
  "chunksCreated": 8,
  "errors": []
}
```

Chunks are stored in `data/rag-store.json` (created automatically).

### 2. Use the chatbot

The chatbot automatically retrieves relevant RAG chunks when you ask analytics questions. No extra configuration needed.

## What Gets Indexed

- **Schema** – Table and column descriptions
- **KPI definitions** – e.g. Total Uploaded Volume
- **Monthly aggregates** – Uploaded, processed, published by month
- **Client breakdown** – Top clients by published count
- **Channel leaders** – Top channels
- **Platform distribution** – Published hours by platform
- **Output types** – Created/published by output type

## When to Re-sync

Re-run the sync when:
- You load new data into the database
- Dashboard structure or KPIs change significantly

## Files

| File | Purpose |
|------|---------|
| `lib/rag-embeddings.ts` | Google Gemini embedding API |
| `lib/rag-store.ts` | JSON file store with in-memory similarity search |
| `lib/rag-sync.ts` | Build chunks from DB, embed, store |
| `app/api/rag/sync/route.ts` | POST endpoint to trigger sync |
| `app/api/chat/route.ts` | Integrates RAG retrieval before SQL generation |
| `data/rag-store.json` | Stored chunks (auto-created on sync) |

## Fallback

If RAG is unavailable (empty store or API error), the chatbot falls back to schema-only mode and continues to work.
