/**
 * Ask AI diagnostics: structured logs for empty or partial UI.
 *
 * Server: set ASK_AI_LOG=1 to force on, ASK_AI_LOG=0 to force off.
 * Default: enabled when NODE_ENV=development.
 * Include raw SQL in server logs: ASK_AI_LOG_SQL=1
 */

export function askAiLogEnabled(): boolean {
  if (process.env.ASK_AI_LOG === "0") return false;
  if (process.env.ASK_AI_LOG === "1") return true;
  return process.env.NODE_ENV === "development";
}

/** Whether the chart area will show nothing useful (matches common empty API payloads). */
export function chartSpecIsVisuallyEmpty(
  chartSpec: Record<string, unknown> | null | undefined,
  tableDataLen: number
): boolean {
  if (tableDataLen > 0) return false;
  if (!chartSpec || typeof chartSpec !== "object") return true;
  const t = chartSpec.type;
  if (t === "table") {
    const rows = chartSpec.rows as unknown;
    const cols = chartSpec.columns as unknown;
    const r = Array.isArray(rows) ? rows.length : 0;
    const c = Array.isArray(cols) ? cols.length : 0;
    return r === 0 && c === 0;
  }
  if (t === "line" || t === "bar") {
    const labels = chartSpec.labels as unknown;
    return !Array.isArray(labels) || labels.length === 0;
  }
  if (t === "pie") {
    const values = chartSpec.values as unknown;
    return !Array.isArray(values) || values.length === 0;
  }
  return Object.keys(chartSpec).length === 0;
}

export function summarizeAskAiResponse(body: Record<string, unknown>): Record<string, unknown> {
  const insights = body.insights;
  const insightArr = Array.isArray(insights) ? insights : [];
  const chart = (body.chart_spec && typeof body.chart_spec === "object"
    ? body.chart_spec
    : {}) as Record<string, unknown>;
  const td = body.table_data;
  const tableDataLen = Array.isArray(td) ? td.length : 0;
  const chartEmpty = chartSpecIsVisuallyEmpty(chart, tableDataLen);

  const base: Record<string, unknown> = {
    error: body.error ?? null,
    insightCount: insightArr.length,
    firstInsightPreview:
      insightArr[0] != null ? String(insightArr[0]).slice(0, 200) : null,
    chartType: chart.type ?? null,
    chartSpecKeys: Object.keys(chart),
    tableDataLen: tableDataLen,
    chartVisuallyEmpty: chartEmpty,
    sqlCharCount: typeof body.sql_query === "string" ? body.sql_query.length : 0,
  };

  if (process.env.ASK_AI_LOG_SQL === "1" && typeof body.sql_query === "string") {
    base.sql_query = body.sql_query;
  }

  return base;
}

export function logAskAi(tag: string, data: Record<string, unknown>): void {
  if (!askAiLogEnabled()) return;
  const line = { tag, ts: new Date().toISOString(), ...data };
  try {
    console.info("[ask-ai]", JSON.stringify(line));
  } catch {
    console.info("[ask-ai]", tag, line);
  }
}

/** Client-side: explain why the assistant bubble might look blank. */
export function diagnoseAskAiClientView(data: {
  error?: unknown;
  insights?: unknown;
  chart_spec?: unknown;
  table_data?: unknown;
}): {
  showsError: boolean;
  insightCount: number;
  schedulesChartPatch: boolean;
  chartVisuallyEmpty: boolean;
  userSeesLikelyEmpty: boolean;
  reasons: string[];
} {
  const err = data.error;
  const showsError = err != null && String(err).length > 0;
  const insights = Array.isArray(data.insights) ? data.insights : [];
  const chartSpec =
    data.chart_spec && typeof data.chart_spec === "object"
      ? (data.chart_spec as Record<string, unknown>)
      : {};
  const td = data.table_data;
  const tableDataLen = Array.isArray(td) ? td.length : 0;
  const schedulesChartPatch =
    Object.keys(chartSpec).length > 0 || tableDataLen > 0;
  const chartVisuallyEmpty = chartSpecIsVisuallyEmpty(chartSpec, tableDataLen);
  const userSeesLikelyEmpty =
    !showsError && insights.length === 0 && (!schedulesChartPatch || chartVisuallyEmpty);

  const reasons: string[] = [];
  if (showsError) reasons.push("error_message_shown");
  if (insights.length === 0) reasons.push("no_insights");
  if (!schedulesChartPatch) reasons.push("chart_patch_not_scheduled");
  else if (chartVisuallyEmpty) reasons.push("chart_scheduled_but_empty_table_or_chart");

  return {
    showsError,
    insightCount: insights.length,
    schedulesChartPatch,
    chartVisuallyEmpty,
    userSeesLikelyEmpty,
    reasons,
  };
}
