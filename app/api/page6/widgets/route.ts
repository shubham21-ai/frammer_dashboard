import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS custom_widgets (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      sql_query TEXT NOT NULL,
      widget_type TEXT NOT NULL,
      config JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  await ensureTable();
  const { rows } = await query(
    `SELECT id, title, prompt, sql_query, widget_type, config, created_at
     FROM custom_widgets
     ORDER BY created_at DESC`
  );
  return NextResponse.json({ widgets: rows });
}

export async function POST(req: NextRequest) {
  await ensureTable();
  const body = await req.json() as {
    title?: string;
    prompt?: string;
    sql_query?: string;
    widget_type?: string;
    config?: Record<string, unknown>;
  };

  const { title, prompt, sql_query, widget_type, config } = body;

  if (!title || !prompt || !sql_query || !widget_type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { rows } = await query(
    `INSERT INTO custom_widgets (title, prompt, sql_query, widget_type, config)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, prompt, sql_query, widget_type, config, created_at`,
    [title, prompt, sql_query, widget_type, JSON.stringify(config ?? {})]
  );

  return NextResponse.json({ widget: rows[0] });
}
