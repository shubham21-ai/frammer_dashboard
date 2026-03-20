/**
 * RAG vector store using in-memory JSON file (no PostgreSQL)
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { embedText, embedQuery } from "./rag-embeddings";

const STORE_PATH = join(process.cwd(), "data", "rag-store.json");

export type RagChunk = {
  id: number;
  source: string;
  chunk_type: string;
  content: string;
  metadata: Record<string, unknown>;
};

type StoredChunk = RagChunk & { embedding: number[] };

let inMemoryStore: StoredChunk[] | null = null;

async function loadStore(): Promise<StoredChunk[]> {
  if (inMemoryStore !== null) return inMemoryStore;
  try {
    const raw = await readFile(STORE_PATH, "utf-8");
    const data = JSON.parse(raw) as StoredChunk[];
    inMemoryStore = Array.isArray(data) ? data : [];
  } catch {
    inMemoryStore = [];
  }
  return inMemoryStore;
}

async function saveStore(): Promise<void> {
  if (inMemoryStore === null) return;
  const dir = join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(inMemoryStore, null, 0), "utf-8");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

export async function ensureRagTable(): Promise<void> {
  await loadStore();
}

export async function insertChunk(
  source: string,
  chunkType: string,
  content: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const store = await loadStore();
  const id = store.length > 0 ? Math.max(...store.map((c) => c.id)) + 1 : 1;
  store.push({
    id,
    source,
    chunk_type: chunkType,
    content,
    metadata,
    embedding,
  });
  await saveStore();
}

export async function searchSimilar(
  queryEmbedding: number[],
  limit = 5,
  minScore = 0.5
): Promise<RagChunk[]> {
  const store = await loadStore();
  const scored = store
    .filter((c) => c.embedding && c.embedding.length > 0)
    .map((c) => ({
      chunk: c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((s) => ({
    id: s.chunk.id,
    source: s.chunk.source,
    chunk_type: s.chunk.chunk_type,
    content: s.chunk.content,
    metadata: s.chunk.metadata,
  }));
}

export async function clearAllChunks(): Promise<number> {
  const store = await loadStore();
  const count = store.length;
  inMemoryStore = [];
  await saveStore();
  return count;
}

export async function retrieve(
  question: string,
  apiKey: string,
  limit = 5
): Promise<RagChunk[]> {
  const embedding = await embedQuery(question, apiKey);
  return searchSimilar(embedding, limit);
}

export { embedText, embedQuery };
