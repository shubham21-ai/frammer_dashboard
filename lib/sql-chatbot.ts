/**
 * SQL Chatbot helpers: chart inference, chart spec, insights generation
 * Main agent logic is in lib/sql-agent.ts (LangChain + system prompt + memory)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export function inferChartType(
  columns: string[],
  rows: Record<string, unknown>[],
  firstCol: string,
  question?: string
): "line" | "bar" | "pie" | "funnel" | "table" {
  if (rows.length === 0) return "table";
  // Single-row results (scalars, single values) are not chart-worthy — show as table
  if (rows.length === 1) return "table";
  const asksPie = /\b(pie|donut|doughnut)\b/i.test(question ?? "");
  const hasDate = /date|time|month|year|day/i.test(firstCol) || columns.some((c) => /month|date|time|year/i.test(c));
  const numCols = columns.filter((c) => {
    const v = rows[0]?.[c];
    return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
  });
  // Honor explicit user intent for pie when shape is label + value.
  if (asksPie && columns.length >= 2 && numCols.length === 1) return "pie";
  if (hasDate && numCols.length >= 1) return "line";
  if (rows.length <= 12 && columns.length === 2 && numCols.length === 1) return "pie";
  if (rows.length <= 10 && numCols.length >= 1) return "bar";
  return "table";
}

/** Serialize cell for JSON/chart; prevents [object Object] for pg interval etc. */
function serializeCell(v: unknown): string | number {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof (o as { toPostgres?: unknown }).toPostgres === "function") {
      return String((o as { toPostgres: () => unknown }).toPostgres());
    }
    if (
      typeof o.hours === "number" ||
      typeof o.minutes === "number" ||
      typeof o.milliseconds === "number" ||
      typeof o.seconds === "number" ||
      typeof o.days === "number"
    ) {
      const h = Number(o.hours ?? 0) + Number(o.days ?? 0) * 24;
      const m = Number(o.minutes ?? 0);
      const s =
        o.seconds != null
          ? Math.floor(Number(o.seconds))
          : Math.floor(Number(o.milliseconds ?? 0) / 1000);
      return [h, m, s].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
    }
    return JSON.stringify(v);
  }
  return typeof v === "number" ? v : String(v);
}

function isNumericLike(v: unknown): boolean {
  return typeof v === "number" || (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)));
}

function isNumericColumn(col: string, rows: Record<string, unknown>[]): boolean {
  for (const row of rows) {
    const v = row[col];
    if (v == null || v === "") continue;
    return isNumericLike(v);
  }
  return false;
}

function monthNumber(label: string): number | null {
  const normalized = label.trim().toLowerCase().replace(/\./g, "");
  const map: Record<string, number> = {
    january: 1, jan: 1,
    february: 2, feb: 2,
    march: 3, mar: 3,
    april: 4, apr: 4,
    may: 5,
    june: 6, jun: 6,
    july: 7, jul: 7,
    august: 8, aug: 8,
    september: 9, sep: 9, sept: 9,
    october: 10, oct: 10,
    november: 11, nov: 11,
    december: 12, dec: 12,
  };
  return map[normalized] ?? null;
}

function isTemporalColumnName(col: string): boolean {
  return /date|time|month|year|day|week|quarter/i.test(col);
}

function sortLabelsChronologicallyIfMonths(labels: string[]): string[] {
  const monthPairs = labels.map((label) => ({ label, month: monthNumber(label) }));
  if (monthPairs.every((p) => p.month != null)) {
    return [...monthPairs]
      .sort((a, b) => (a.month as number) - (b.month as number))
      .map((p) => p.label);
  }
  return labels;
}

export function buildChartSpec(
  columns: string[],
  rows: Record<string, unknown>[],
  chartType: "line" | "bar" | "pie" | "funnel" | "table"
): Record<string, unknown> {
  const labelCol = columns[0];
  const labels = labelCol
    ? rows.map((r) => String(serializeCell(r[labelCol])))
    : [];
  const dataCols = columns.slice(1).filter((c) => isNumericColumn(c, rows));

  // Long format pivot support: [x, series, value] -> labels + datasets per series.
  // Also handles reversed order (e.g. [series, x, value]) by inferring x/series columns.
  if ((chartType === "line" || chartType === "bar") && columns.length >= 3 && dataCols.length === 1) {
    const valueCol = dataCols[0];
    const nonNumericCols = columns.filter((c) => c !== valueCol && !isNumericColumn(c, rows));
    const inferredXCol =
      nonNumericCols.find((c) => isTemporalColumnName(c))
      ?? (labelCol && nonNumericCols.includes(labelCol) ? labelCol : nonNumericCols[0]);
    const seriesCol = nonNumericCols.find((c) => c !== inferredXCol);

    if (inferredXCol && seriesCol) {
      const xSeen = new Set<string>();
      const seriesSeen = new Set<string>();
      const pivot = new Map<string, Map<string, number>>();

      for (const row of rows) {
        const x = String(serializeCell(row[inferredXCol]));
        const series = String(serializeCell(row[seriesCol]));
        const raw = row[valueCol];
        const value = typeof raw === "number" ? raw : Number(raw) || 0;

        xSeen.add(x);
        seriesSeen.add(series);
        if (!pivot.has(series)) pivot.set(series, new Map<string, number>());
        const xMap = pivot.get(series) as Map<string, number>;
        xMap.set(x, (xMap.get(x) ?? 0) + value);
      }

      const pivotLabels = sortLabelsChronologicallyIfMonths(Array.from(xSeen));
      const datasets = Array.from(seriesSeen).sort().map((series) => {
        const xMap = pivot.get(series) ?? new Map<string, number>();
        return {
          name: series,
          data: pivotLabels.map((x) => xMap.get(x) ?? 0),
        };
      });

      return {
        type: chartType,
        labels: pivotLabels,
        datasets,
      };
    }
  }

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
    rows: rows.map((r) => columns.map((c) => serializeCell(r[c]))),
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
      return parsed.map((x) => cleanInsightText(typeof x === "string" ? x : String(x)));
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
        return parsed.map((x) => cleanInsightText(typeof x === "string" ? x : String(x)));
      }
    } catch {
      /* continue */
    }
  }
  // Fallback: split by newlines/bullets, treat each line as an insight
  const lines = cleaned.split(/\n+/).map((s) => s.replace(/^[-*•]\s*/, "").replace(/^`+|\s*`+$/g, "").trim()).filter(Boolean);
  const result = lines.length > 0 ? lines : (cleaned ? [cleaned] : []);
  return result.map(cleanInsightText);
}

/** Strip markdown only; do not truncate LLM output */
function cleanInsightText(s: string): string {
  return String(s)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

export async function generateInsights(
  question: string,
  sql: string,
  rows: Record<string, unknown>[],
  apiKey: string
): Promise<string[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
  const sample = rows.slice(0, 10).map((r) => JSON.stringify(r));
  const prompt = `You are a data analyst. Explain what this query result MEANS for the user.

Question: "${question}"
SQL: ${sql}

Result rows (sample of ${rows.length} total):
${sample.join("\n")}

Write 3-4 bullet-point insights. Each insight should be 2-3 sentences explaining what the data means and what to do next.
- Plain text only: NO markdown (**bold**), NO backticks, NO code.
- Be substantive: explain context, implications, and recommendations.
Return ONLY a JSON array of strings. No other text.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = parseInsightsJson(text);
  const insights = parsed.length > 0 ? parsed : [cleanInsightText(text)];
  return insights.slice(0, 4); // cap at 4 to avoid walls of text
}

/** @deprecated Use chatWithSQL from lib/sql-agent.ts with LangChain memory */
