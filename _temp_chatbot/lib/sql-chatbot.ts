/**
 * SQL Chatbot helpers: chart inference, chart spec, insights generation
 * Main agent logic is in lib/sql-agent.ts (LangChain + system prompt + memory)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export function inferChartType(
  columns: string[],
  rows: Record<string, unknown>[],
  firstCol: string
): "line" | "bar" | "pie" | "funnel" | "table" {
  if (rows.length === 0) return "table";
  const hasDate = /date|time|month|year|day/i.test(firstCol) || columns.some((c) => /month|date|time|year/i.test(c));
  const numCols = columns.filter((c) => {
    const v = rows[0]?.[c];
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
  });
  if (hasDate && numCols.length >= 1) return "line";
  if (rows.length <= 10 && numCols.length >= 1) return "bar";
  if (rows.length <= 10 && columns.length === 2 && numCols.length === 1) return "pie";
  return "table";
}

export function buildChartSpec(
  columns: string[],
  rows: Record<string, unknown>[],
  chartType: "line" | "bar" | "pie" | "funnel" | "table"
): Record<string, unknown> {
  const labels = columns[0] ? rows.map((r) => String(r[columns[0]] ?? "")) : [];
  const dataCols = columns.slice(1).filter((c) => {
    const v = rows[0]?.[c];
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
  });
  const datasets = dataCols.map((col) => ({
    name: col,
    data: rows.map((r) => {
      const v = r[col];
      return typeof v === "number" ? v : Number(v) || 0;
    }),
  }));

  if (chartType === "pie" && datasets[0]) {
    return {
      type: "pie",
      labels,
      values: datasets[0].data,
    };
  }
  if (chartType === "line") {
    return {
      type: "line",
      labels,
      datasets,
    };
  }
  if (chartType === "bar") {
    return {
      type: "bar",
      labels,
      datasets,
    };
  }
  return {
    type: "table",
    columns,
    rows: rows.map((r) => columns.map((c) => r[c])),
  };
}

/** Extract JSON array from LLM response, handling markdown code blocks and stray text */
function parseInsightsJson(text: string): string[] {
  let cleaned = text.trim();
  // Strip markdown code blocks: ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  // Strip any remaining backticks
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/g, "").trim();
  // Try parsing directly
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((x) => (typeof x === "string" ? x : String(x)));
    }
  } catch {
    /* continue */
  }
  // Try to find a JSON array anywhere in the string
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map((x) => (typeof x === "string" ? x : String(x)));
      }
    } catch {
      /* continue */
    }
  }
  // Fallback: split by newlines/bullets, treat each line as an insight
  const lines = cleaned.split(/\n+/).map((s) => s.replace(/^[-*•]\s*/, "").replace(/^`+|\s*`+$/g, "").trim()).filter(Boolean);
  return lines.length > 0 ? lines : (cleaned ? [cleaned] : []);
}

export async function generateInsights(
  question: string,
  sql: string,
  rows: Record<string, unknown>[],
  apiKey: string
): Promise<string[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const sample = rows.slice(0, 10).map((r) => JSON.stringify(r));
  const prompt = `You are a data analyst. Explain what this query result MEANS for the user.

Question: "${question}"
SQL: ${sql}

Result rows (sample of ${rows.length} total):
${sample.join("\n")}

Write 3-4 short bullet-point insights that EXPLAIN THE TABLE DATA:
- What do the numbers/values mean?
- What patterns or trends do you see?
- What should the user take away from this data?

Do NOT explain the SQL query itself. Focus on interpreting the results.
Return ONLY a JSON array of strings, e.g. ["Insight 1", "Insight 2"]. No markdown, no code blocks, no other text.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = parseInsightsJson(text);
  return parsed.length > 0 ? parsed : [text];
}

/** @deprecated Use chatWithSQL from lib/sql-agent.ts with LangChain memory */
