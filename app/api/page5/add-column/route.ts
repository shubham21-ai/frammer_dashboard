import { NextRequest, NextResponse } from "next/server";
import { query, execDDL } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = [
  "videos",
  "channel_processing_summary",
  "channel_user_processing_summary",
  "channel_wise_publishing_counts",
  "channel_wise_publishing_duration",
  "input_type_processing_summary",
  "language_processing_summary",
  "monthly_duration_summary",
  "monthly_processing_summary",
  "output_type_processing_summary",
  "user_processing_summary",
  "clients",
  "users",
  "channels",
] as const;

const ALLOWED_DATA_TYPES = [
  { value: "TEXT", label: "Text" },
  { value: "VARCHAR(255)", label: "Varchar(255)" },
  { value: "VARCHAR(100)", label: "Varchar(100)" },
  { value: "VARCHAR(50)", label: "Varchar(50)" },
  { value: "INTEGER", label: "Integer" },
  { value: "BIGINT", label: "Bigint" },
  { value: "BOOLEAN", label: "Boolean" },
  { value: "TIMESTAMP", label: "Timestamp" },
  { value: "TIMESTAMPTZ", label: "Timestamp with timezone" },
  { value: "NUMERIC(12,2)", label: "Numeric" },
  { value: "JSONB", label: "JSON" },
] as const;

const VALID_DATA_TYPES = new Set<string>(ALLOWED_DATA_TYPES.map((d) => d.value));

function isValidIdentifier(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/i.test(name) && name.length <= 63;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { table, column, dataType } = body as {
      table?: string;
      column?: string;
      dataType?: string;
    };

    if (!table || !column || !dataType) {
      return NextResponse.json(
        { error: "Missing required fields: table, column, dataType" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TABLES.includes(table as (typeof ALLOWED_TABLES)[number])) {
      return NextResponse.json(
        { error: `Table "${table}" is not allowed for schema changes` },
        { status: 400 }
      );
    }

    if (!isValidIdentifier(column)) {
      return NextResponse.json(
        {
          error:
            "Column name must start with a letter, contain only letters, numbers, underscores, and be ≤63 chars",
        },
        { status: 400 }
      );
    }

    if (!VALID_DATA_TYPES.has(dataType)) {
      return NextResponse.json(
        {
          error: `Invalid data type. Allowed: ${[...VALID_DATA_TYPES].join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Check if column already exists
    const checkRes = await query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = $1 AND column_name = $2`,
      [table, column]
    );
    if (checkRes.rows.length > 0) {
      return NextResponse.json(
        { error: `Column "${column}" already exists in table "${table}"` },
        { status: 400 }
      );
    }

    // ALTER TABLE must go through execDDL (not query/exec_sql — DDL can't be a subquery)
    const sql = `ALTER TABLE "${table}" ADD COLUMN "${column}" ${dataType}`;
    await execDDL(sql);

    return NextResponse.json({
      success: true,
      message: `Column "${column}" added to table "${table}"`,
    });
  } catch (err) {
    console.error("Add column error:", err);
    return NextResponse.json(
      {
        error: "Failed to add column",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    allowedTables: [...ALLOWED_TABLES],
    dataTypes: ALLOWED_DATA_TYPES,
  });
}
