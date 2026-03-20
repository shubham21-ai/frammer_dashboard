import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await query<{
      month: string;
      uploaded: string;
      processed: string;
      published: string;
    }>(`
      SELECT month,
        SUM(total_uploaded)::int  AS uploaded,
        SUM(total_created)::int   AS processed,
        SUM(total_published)::int AS published
      FROM monthly_processing_summary
      GROUP BY month
      ORDER BY month
    `);

    return NextResponse.json({
      months: rows.map((r) => ({
        month: r.month,
        uploaded: Number(r.uploaded),
        processed: Number(r.processed),
        published: Number(r.published),
      })),
    });
  } catch (err) {
    console.error("period-compare error:", err);
    return NextResponse.json({ months: [] }, { status: 500 });
  }
}
