/**
 * Google Gemini text embedding for RAG
 * Uses gemini-embedding-001 (768 dims) via REST API
 */

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMS = 3072; // gemini-embedding-001 default

async function callEmbedApi(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: text.slice(0, 2000) }],
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error: ${res.status} ${err}`);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || !Array.isArray(values)) {
    throw new Error("Invalid embedding response");
  }
  return values;
}

export async function embedText(text: string, apiKey: string): Promise<number[]> {
  return callEmbedApi(text, apiKey);
}

export async function embedQuery(text: string, apiKey: string): Promise<number[]> {
  return callEmbedApi(text, apiKey);
}

export { EMBEDDING_DIMS };
