import { GoogleGenerativeAI } from "@google/generative-ai";

type InsightContext = {
  page: string;
  widget: string;
  filters: Record<string, string>;
  data: Record<string, unknown>;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-pro";

function compact(value: unknown, depth = 0): unknown {
  if (depth > 3) return value;
  if (typeof value === "string") return value.length > 400 ? value.slice(0, 400) + "..." : value;
  if (Array.isArray(value)) return value.slice(0, 10).map((v) => compact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = compact(v, depth + 1);
    return out;
  }
  return value;
}

export async function generateInsight(ctx: InsightContext): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return "Gemini API key missing. Add GEMINI_API_KEY in .env.local.";

  const prompt = `You are a dashboard analyst.
Page: ${ctx.page}
Widget: ${ctx.widget}
Filters: ${JSON.stringify(ctx.filters)}
Data: ${JSON.stringify(compact(ctx.data), null, 2)}

Return one concise actionable insight (2-4 sentences), with a concrete next step.`;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim();
    return text || "Unable to generate insight right now.";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Insight generation failed: ${msg}`;
  }
}
