import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const client_id = sp.get("client_id");
  const channel_name = sp.get("channel_name");
  const month = sp.get("month"); // YYYY-MM
  const language = sp.get("language");
  const output_type = sp.get("output_type");
  const input_type = sp.get("input_type");
  const platform = sp.get("platform");
  const limit = Math.min(parseInt(sp.get("limit") ?? "100"), 200);

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (client_id) {
      conditions.push(`v.client_id = $${idx++}`);
      params.push(client_id);
    }
    if (channel_name) {
      conditions.push(`v.channel_id = $${idx++}`);
      params.push(channel_name);
    }
    if (month) {
      conditions.push(`TO_CHAR(COALESCE(v.uploaded_at, v.published_at, v.processed_at), 'YYYY-MM') = $${idx++}`);
      params.push(month);
    }
    if (language) {
      conditions.push(`v.language_name = $${idx++}`);
      params.push(language);
    }
    if (output_type) {
      conditions.push(`v.output_type_name = $${idx++}`);
      params.push(output_type);
    }
    if (input_type) {
      conditions.push(`v.input_type_name = $${idx++}`);
      params.push(input_type);
    }
    if (platform) {
      conditions.push(`v.published_platform = $${idx++}`);
      params.push(platform);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [videosRes, summaryRes, totalRes] = await Promise.all([
      query(
        `SELECT v.video_id, v.client_id,
                v.channel_id AS channel_name,
                COALESCE(u.user_name, v.user_id) AS user_name,
                v.input_type_name, v.output_type_name, v.language_name,
                v.published_platform, v.published_flag,
                v.uploaded_at, v.duration
         FROM videos v
         LEFT JOIN users u ON u.client_id = v.client_id AND u.user_id = v.user_id
         ${where}
         ORDER BY v.video_id DESC
         LIMIT ${limit}`,
        params
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded,
           COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS processed,
           COUNT(*) FILTER (WHERE v.published_flag = true)::int AS published
         FROM videos v
         ${where}`,
        params
      ),
      query(`SELECT COUNT(*)::int AS total FROM videos v ${where}`, params),
    ]);

    const sum = (summaryRes.rows[0] as { uploaded: number; processed: number; published: number } | undefined);

    return NextResponse.json({
      videos: videosRes.rows,
      total: Number((totalRes.rows[0] as { total: number } | undefined)?.total ?? 0),
      summary: {
        uploaded: Number(sum?.uploaded ?? 0),
        processed: Number(sum?.processed ?? 0),
        published: Number(sum?.published ?? 0),
      },
    });
  } catch (error) {
    console.error("Drilldown API error:", error);
    return NextResponse.json({ error: "Failed to fetch drilldown data" }, { status: 500 });
  }
}
