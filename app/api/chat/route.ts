import { NextRequest, NextResponse } from "next/server";
import { chatWithSQL, clearSessionMemory, answerFromHistory } from "@/lib/sql-agent";
import { inferChartType, buildChartSpec, generateInsights } from "@/lib/sql-chatbot";
import { query } from "@/lib/db";
import { DASHBOARD_KPI_DEFINITIONS, matchDashboardKpiId } from "@/lib/dashboard-knowledge";

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

function looksLikeAnalyticsQuestion(q: string): boolean {
  const analyticsKeywords =
    /\b(video|videos|channel|channels|publish|published|views|view|watch|impressions?|clicks?|ctr|conversion|conversions|funnel|platforms?|client|clients|table|tables|schema|database|db|data|analytics|performance|trend|trends|growth|velocity|kpi|kpis|uploaded|upload|processed|created|duration|volume|count|factors?)\b|\bhow\s+many\b|\bhow\s+much\b|\bnumber\s+of\b/i;
  return analyticsKeywords.test(q);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, sessionId = "default" } = body as {
      question: string;
      sessionId?: string;
      clearMemory?: boolean;
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

    // Fast-path: "explain KPI <x>" should return definition + current computed value.
    // This avoids the history-only fallback which happens when the question isn't
    // detected as an analytics query.
    const kpiId = matchDashboardKpiId(trimmed);
    const wantsDefinition =
      /\b(explain|definition|what is|what's|meaning|describe)\b/i.test(trimmed) || /\btotal uploaded volume\b/i.test(trimmed);
    const wantsKpiValue = /\b(current|latest|now|today|value|number|count|hours)\b/i.test(trimmed);

    if (kpiId && wantsDefinition) {
      const kpi = DASHBOARD_KPI_DEFINITIONS[kpiId];

      // For now, implement deterministic SQL for "Total Uploaded Volume"
      // (alias-driven, extendable with more KPI definitions later).
      const totalUploadedCountRes = await query<{ total_uploaded: number }>(
        `SELECT COALESCE(SUM(total_uploaded), 0)::int AS total_uploaded
         FROM monthly_processing_summary`
      );

      const totalUploadedDurationSecRes = await query<{ total_seconds: number }>(
        `SELECT COALESCE(SUM(
            CASE
              WHEN total_uploaded_duration IS NOT NULL
               AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval))
              ELSE NULL
            END
          ), 0)::numeric AS total_seconds
         FROM monthly_duration_summary`
      );

      const totalUploadedCount = Number(totalUploadedCountRes.rows[0]?.total_uploaded ?? 0);
      const totalUploadedSeconds = Number(totalUploadedDurationSecRes.rows[0]?.total_seconds ?? 0);
      const totalUploadedDurationFormatted = formatDuration(totalUploadedSeconds);

      const valueLine = `Current value: ${totalUploadedCount.toLocaleString()} videos (${totalUploadedDurationFormatted} uploaded).`;

      return NextResponse.json({
        sql_query: "",
        table_data: [],
        chart_spec: { type: "table" },
        insights: wantsKpiValue
          ? [kpi.definition, valueLine]
          : [
              kpi.definition,
              // Still include computed value by default for option (2).
              valueLine,
            ],
      });
    }

    // If it doesn't look like a database/analytics question, answer purely from chat history
    if (!looksLikeAnalyticsQuestion(trimmed)) {
      const historyAnswer = await answerFromHistory(trimmed, sessionId, apiKey);
      return NextResponse.json({
        sql_query: "",
        table_data: [],
        chart_spec: { type: "table" },
        insights: historyAnswer ? [historyAnswer] : [],
      });
    }

    const fullSchema = await fetchSchema();

    // Exclude the `clients` table from the schema we expose to the chatbot
    const schema: Record<string, { column: string; type: string }[]> = {};
    for (const [tableName, cols] of Object.entries(fullSchema)) {
      if (tableName.toLowerCase() === "clients") continue;
      schema[tableName] = cols;
    }

    const result = await chatWithSQL(trimmed, schema, sessionId, apiKey, {
      inferChartType,
      buildChartSpec,
      generateInsights,
    });

    if (result.error && result.rows.length === 0) {
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
