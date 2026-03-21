import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { inferChartType, buildChartSpec } from "@/lib/sql-chatbot";

export const dynamic = "force-dynamic";

const FORBIDDEN = /\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE|GRANT|REVOKE)\b/i;

async function fetchSchema(): Promise<string> {
  const { rows } = await query<{
    table_name: string;
    column_name: string;
    data_type: string;
  }>(
    `SELECT t.table_name, c.column_name, c.data_type
     FROM information_schema.tables t
     JOIN information_schema.columns c
       ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE t.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND t.table_name NOT IN ('clients', 'custom_widgets')
     ORDER BY t.table_name, c.ordinal_position`
  );
  const schema: Record<string, string[]> = {};
  for (const r of rows) {
    if (!schema[r.table_name]) schema[r.table_name] = [];
    schema[r.table_name].push(`${r.column_name}(${r.data_type})`);
  }
  return Object.entries(schema)
    .map(([t, cols]) => `${t}(${cols.join(", ")})`)
    .join("\n");
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "GOOGLE_API_KEY not configured" }, { status: 500 });

  const body = await req.json() as { prompt?: string };
  const prompt = body.prompt?.trim();
  if (!prompt)
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });

  const schemaText = await fetchSchema();

  const systemPrompt = `You are an SQL analytics widget builder for a PostgreSQL database.

Database schema:
${schemaText}

Given a user prompt, respond with ONLY a valid JSON object (no markdown, no extra text) in this exact format:
{
  "title": "Short descriptive widget title",
  "widget_type": "kpi|bar|line|pie|table",
  "sql": "SELECT ..."
}

Widget type rules:
- "kpi" → ONLY when the user explicitly asks for a single number/metric/count with NO chart. One row, one numeric column.
- "line" → data with a time/month dimension + numeric columns (good for trends). Use when user says "trend", "over time", "monthly".
- "bar" → category vs metric comparisons (up to 20 rows). Use when user says "chart", "compare", "top N", "by client/channel/language".
- "pie" → small category breakdown (2–8 rows, exactly 2 columns: label + value). Use when user says "share", "distribution", "breakdown".
- "table" → detailed multi-column data. Use when user says "list", "table", "show all".

IMPORTANT: If the user says "chart", "graph", or "visualize", NEVER use "kpi". Use bar, line, or pie instead.

SQL rules:
- SELECT only. Never: DROP, DELETE, UPDATE, INSERT, ALTER, TRUNCATE, CREATE, GRANT, REVOKE.
- Limit to 100 rows.
- For month grouping use TO_CHAR(date_col, 'YYYY-MM') or COALESCE(uploaded_at, published_at, processed_at).
- Use the exact table and column names from the schema above.`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

  let text: string;
  try {
    const result = await model.generateContent(
      `${systemPrompt}\n\nUser prompt: ${prompt}`
    );
    text = result.response.text().trim();
  } catch (err) {
    return NextResponse.json(
      { error: `AI generation failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  let parsed: { title: string; widget_type: string; sql: string };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch?.[0] ?? text) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 422 });
  }

  if (!parsed.sql || !parsed.title || !parsed.widget_type) {
    return NextResponse.json({ error: "Incomplete AI response", raw: text }, { status: 422 });
  }

  if (FORBIDDEN.test(parsed.sql)) {
    return NextResponse.json(
      { error: "Generated SQL contains forbidden operations" },
      { status: 400 }
    );
  }

  // Strip trailing semicolons — exec_sql wraps the query so a trailing `;` breaks it
  parsed.sql = parsed.sql.replace(/;\s*$/, "");

  // Hard override: if user asked for a chart/graph but LLM returned kpi, force bar
  const wantsChart = /\b(chart|graph|visuali[sz]e|plot)\b/i.test(prompt);
  if (wantsChart && parsed.widget_type === "kpi") {
    parsed.widget_type = "bar";
    // Rewrite SQL to return all clients instead of just LIMIT 1
    parsed.sql = parsed.sql.replace(/\bLIMIT\s+1\b/i, "LIMIT 20");
  }

  async function executeAndBuild(sql: string) {
    const { rows } = await query(sql);
    const typedRows = rows as Record<string, unknown>[];
    const columns = typedRows.length > 0 ? Object.keys(typedRows[0]) : [];

    let chartSpec: Record<string, unknown>;

    if (parsed.widget_type === "kpi") {
      const firstRow = typedRows[0] ?? {};
      // Find the numeric column (for the value) and a text column (for the label)
      const numericKey = columns.find((k) => {
        const v = firstRow[k];
        return typeof v === "number" || (v !== null && v !== "" && !isNaN(Number(v)));
      });
      const labelKey = columns.find((k) => k !== numericKey);
      const valueKey = numericKey ?? columns[0] ?? "value";
      const rawVal = firstRow[valueKey];
      const numericValue = typeof rawVal === "number" ? rawVal : Number(rawVal) || 0;
      // If there's a companion text column (e.g. client_id), use its value as the label
      const labelValue = labelKey ? String(firstRow[labelKey] ?? labelKey) : valueKey;
      chartSpec = {
        type: "kpi",
        value: numericValue,
        label: labelValue,
      };
    } else {
      const validType = (["bar", "line", "pie", "table"] as const).includes(
        parsed.widget_type as "bar" | "line" | "pie" | "table"
      )
        ? (parsed.widget_type as "bar" | "line" | "pie" | "table")
        : inferChartType(columns, typedRows, columns[0] ?? "", prompt);

      chartSpec = buildChartSpec(columns, typedRows, validType);
      chartSpec.type = parsed.widget_type;
    }

    return { columns, typedRows, chartSpec };
  }

  // First attempt
  let result: Awaited<ReturnType<typeof executeAndBuild>> | null = null;
  let firstError: string | null = null;

  try {
    result = await executeAndBuild(parsed.sql);
  } catch (err) {
    firstError = err instanceof Error ? err.message : String(err);
  }

  // If it failed, ask the LLM to self-correct once
  if (firstError !== null) {
    const retryPrompt = `${systemPrompt}

User prompt: ${prompt}

Your previous attempt produced this SQL:
\`\`\`sql
${parsed.sql}
\`\`\`

It failed with this PostgreSQL error:
${firstError}

Fix the SQL so it runs correctly. If the requested data genuinely does not exist in the schema, respond with widget_type "table" and a SQL that returns a single row explaining this, e.g.:
SELECT 'No data available for this query' AS message

Respond with ONLY the corrected JSON object.`;

    try {
      const retryResult = await model.generateContent(retryPrompt);
      const retryText = retryResult.response.text().trim();
      const retryMatch = retryText.match(/\{[\s\S]*\}/);
      const retryParsed = JSON.parse(retryMatch?.[0] ?? retryText) as typeof parsed;
      if (retryParsed.sql) {
        retryParsed.sql = retryParsed.sql.replace(/;\s*$/, "");
        parsed.sql = retryParsed.sql;
        parsed.title = retryParsed.title || parsed.title;
        parsed.widget_type = retryParsed.widget_type || parsed.widget_type;
        result = await executeAndBuild(retryParsed.sql);
      }
    } catch {
      // Retry also failed — fall through to return the original error
    }
  }

  if (!result) {
    return NextResponse.json(
      {
        error: `SQL execution failed: ${firstError}`,
        sql: parsed.sql,
      },
      { status: 400 }
    );
  }

  const { columns, typedRows, chartSpec } = result;
  return NextResponse.json({
    title: parsed.title,
    widget_type: parsed.widget_type,
    sql: parsed.sql,
    columns,
    rows: typedRows,
    chart_spec: chartSpec,
  });
}
