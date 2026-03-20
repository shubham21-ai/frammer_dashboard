import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await query(
      "SELECT DISTINCT client_id FROM channel_processing_summary WHERE client_id IS NOT NULL ORDER BY client_id"
    );
    const clients = (result.rows as { client_id: string }[]).map((r) => r.client_id);
    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Filters API error:", error);
    return NextResponse.json({ clients: [] }, { status: 500 });
  }
}
