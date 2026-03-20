import { NextRequest, NextResponse } from "next/server";
import { chatWithSQL, clearSessionMemory, answerFromHistory, classifyAsAnalytics } from "@/lib/sql-agent";
import { inferChartType, buildChartSpec, generateInsights } from "@/lib/sql-chatbot";
import { query } from "@/lib/db";
import { retrieve } from "@/lib/rag-store";

async function fetchSchema() {
  const { rows } = await query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
  }>(`
    SELECT t.table_name, c.column_name, c.data_type, c.udt_name
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name, c.ordinal_position
  `);
  const schema: Record<string, { column: string; type: string }[]> = {};
  for (const r of rows) {
    if (!schema[r.table_name]) schema[r.table_name] = [];
    schema[r.table_name].push({
      column: r.column_name,
      type: r.data_type === "USER-DEFINED" ? r.udt_name : r.data_type,
    });
  }
  return schema;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, sessionId = "default", pageContext } = body as {
      question: string;
      sessionId?: string;
      clearMemory?: boolean;
      pageContext?: string;
    };

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "question is required" },
        { status: 400 }
      );
    }
    const trimmed = question.trim();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY not configured" },
        { status: 500 }
      );
    }

    if (body.clearMemory) {
      clearSessionMemory(sessionId);
    }

    // ─── Gate: LLM classifies analytics vs general conversation ────────────
    const isDashboardOrAnalytics = await classifyAsAnalytics(trimmed, apiKey, sessionId);

    if (!isDashboardOrAnalytics) {
      const historyAnswer = await answerFromHistory(trimmed, sessionId, apiKey);
      // Non-analytics: return as single paragraph (one insight)
      const insights = historyAnswer
        ? [historyAnswer.replace(/\n+/g, " ").trim()]
        : [];
      return NextResponse.json({
        sql_query: "",
        table_data: [],
        chart_spec: { type: "table" },
        insights,
      });
    }

    // ─── Analytics path: RAG + SQL agent ───────────────────────────────────

    const fullSchema = await fetchSchema();

    // Exclude the `clients` table from the schema we expose to the chatbot
    const schema: Record<string, { column: string; type: string }[]> = {};
    for (const [tableName, cols] of Object.entries(fullSchema)) {
      if (tableName.toLowerCase() === "clients") continue;
      schema[tableName] = cols;
    }

    // RAG: retrieve relevant dashboard context (optional; falls back if RAG unavailable)
    let ragContext: string | undefined;
    try {
      const chunks = await retrieve(trimmed, apiKey, 5);
      if (chunks.length > 0) {
        ragContext = chunks.map((c) => c.content).join("\n---\n");
      }
    } catch {
      /* RAG optional; continue without context */
    }

    const result = await chatWithSQL(
      trimmed,
      schema,
      sessionId,
      apiKey,
      { inferChartType, buildChartSpec, generateInsights },
      ragContext,
      pageContext
    );

    if (result.error && result.rows.length === 0) {
      // Fallback: interpretation questions ("actionable insight", "summarize above") may be misrouted
      // to analytics path; when SQL can't help, answer from history instead
      const isInterpretationQuestion = /\b(actionable\s+insight|insight\s+from|summarize|above\s+information|what\s+does\s+this\s+mean)\b/i.test(trimmed);
      if (isInterpretationQuestion && result.error?.includes("Data not available")) {
        const historyAnswer = await answerFromHistory(trimmed, sessionId, apiKey);
        const insights = historyAnswer
          ? [historyAnswer.replace(/\n+/g, " ").trim()]
          : [];
        return NextResponse.json({
          sql_query: "",
          table_data: [],
          chart_spec: { type: "table" },
          insights,
        });
      }
      return NextResponse.json({
        sql_query: result.sql,
        table_data: [],
        chart_spec: result.chart_spec,
        insights: [],
        error: result.error,
      });
    }

    return NextResponse.json({
      sql_query: result.sql,
      table_data: result.table_data,
      chart_spec: result.chart_spec,
      insights: result.insights,
    });
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
