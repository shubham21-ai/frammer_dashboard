import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function durationToMinutes(dur: string | null): number {
  if (!dur) return 0;
  const parts = dur.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  return Number(dur) || 0;
}

interface SummaryRow {
  name: string;
  uploaded_count: string | number;
  created_count: string | number;
  published_count: string | number;
  uploaded_dur?: string;
  created_dur?: string;
  published_dur?: string;
}

function toBreakdown(rows: SummaryRow[]) {
  return rows.map((r, i) => {
    const up = Number(r.uploaded_count);
    const pr = Number(r.created_count);
    const pb = Number(r.published_count);
    return {
      id: `${r.name}-${i}`,
      name: r.name,
      up,
      pr,
      pb,
      rate: pr > 0 ? Math.round((pb / pr) * 100) : 0,
      durationUploaded: durationToMinutes(r.uploaded_dur ?? null),
      durationCreated: durationToMinutes(r.created_dur ?? null),
      durationPublished: durationToMinutes(r.published_dur ?? null),
    };
  });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const clientFilter = sp.get("client") || "all";
  const fromMonth = sp.get("from") || "";
  const toMonth   = sp.get("to")   || "";

  try {
    const clientWhere =
      clientFilter !== "all" ? ` WHERE client_id = $1` : "";
    const clientWhereAnd =
      clientFilter !== "all" ? ` AND v.client_id = $1` : "";
    const clientWhereAndCps =
      clientFilter !== "all" ? ` AND client_id = $1` : "";
    const params = clientFilter !== "all" ? [clientFilter] : [];

    // Build month-filtered params for monthly_processing_summary queries
    const monthParams: unknown[] = clientFilter !== "all" ? [clientFilter] : [];
    let monthIdx = monthParams.length + 1;
    const monthConditions: string[] = [];
    if (clientFilter !== "all") monthConditions.push(`client_id = $1`);
    if (fromMonth) { monthConditions.push(`month >= $${monthIdx++}`); monthParams.push(fromMonth); }
    if (toMonth)   { monthConditions.push(`month <= $${monthIdx++}`); monthParams.push(toMonth); }
    const monthWhere = monthConditions.length > 0 ? `WHERE ${monthConditions.join(" AND ")}` : "";

    // Build month-filtered params for monthlyByClient query (no client filter, but date range)
    const monthByClientParams: unknown[] = [];
    let monthByClientIdx = 1;
    const monthByClientConditions: string[] = [];
    if (fromMonth) { monthByClientConditions.push(`month >= $${monthByClientIdx++}`); monthByClientParams.push(fromMonth); }
    if (toMonth)   { monthByClientConditions.push(`month <= $${monthByClientIdx++}`); monthByClientParams.push(toMonth); }
    const monthByClientWhere = monthByClientConditions.length > 0 ? `WHERE ${monthByClientConditions.join(" AND ")}` : "";

    const [
      clientsRes,
      channelRes,
      userRes,
      inputTypeRes,
      outputTypeRes,
      languageRes,
      monthlyRes,
      monthlyByClientRes,
      overallRes,
      riskTableRes,
    ] = await Promise.all([
      query("SELECT DISTINCT client_id FROM channel_processing_summary WHERE client_id IS NOT NULL ORDER BY client_id"),

      query(
        `SELECT channel_name AS name,
                SUM(uploaded_count) AS uploaded_count,
                SUM(created_count) AS created_count,
                SUM(published_count) AS published_count,
                (SUM(CASE WHEN uploaded_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(uploaded_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (uploaded_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS uploaded_dur,
                (SUM(CASE WHEN created_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(created_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (created_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS created_dur,
                (SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS published_dur
         FROM channel_processing_summary
         ${clientWhere}
         GROUP BY channel_name
         ORDER BY SUM(uploaded_count) DESC`,
        params
      ),

      query(
        `SELECT user_name AS name,
                SUM(uploaded_count) AS uploaded_count,
                SUM(created_count) AS created_count,
                SUM(published_count) AS published_count,
                (SUM(CASE WHEN uploaded_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(uploaded_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (uploaded_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS uploaded_dur,
                (SUM(CASE WHEN created_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(created_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (created_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS created_dur,
                (SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS published_dur
         FROM user_processing_summary
         ${clientWhere}
         GROUP BY user_name
         ORDER BY SUM(uploaded_count) DESC`,
        params
      ),

      query(
        `SELECT input_type AS name,
                SUM(uploaded_count) AS uploaded_count,
                SUM(created_count) AS created_count,
                SUM(published_count) AS published_count,
                (SUM(CASE WHEN uploaded_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(uploaded_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (uploaded_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS uploaded_dur,
                (SUM(CASE WHEN created_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(created_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (created_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS created_dur,
                (SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS published_dur
         FROM input_type_processing_summary
         ${clientWhere}
         GROUP BY input_type
         ORDER BY SUM(uploaded_count) DESC`,
        params
      ),

      query(
        `SELECT output_type AS name,
                SUM(uploaded_count) AS uploaded_count,
                SUM(created_count) AS created_count,
                SUM(published_count) AS published_count,
                (SUM(CASE WHEN uploaded_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(uploaded_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (uploaded_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS uploaded_dur,
                (SUM(CASE WHEN created_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(created_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (created_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS created_dur,
                (SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS published_dur
         FROM output_type_processing_summary
         ${clientWhere}
         GROUP BY output_type
         ORDER BY SUM(uploaded_count) DESC`,
        params
      ),

      query(
        `SELECT language AS name,
                SUM(uploaded_count) AS uploaded_count,
                SUM(created_count) AS created_count,
                SUM(published_count) AS published_count,
                (SUM(CASE WHEN uploaded_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(uploaded_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (uploaded_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS uploaded_dur,
                (SUM(CASE WHEN created_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(created_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (created_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS created_dur,
                (SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
                     THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END) || ' seconds')::interval::text AS published_dur
         FROM language_processing_summary
         ${clientWhere}
         GROUP BY language
         ORDER BY SUM(uploaded_count) DESC`,
        params
      ),

      query(
        `SELECT month,
                SUM(total_uploaded) AS total_uploaded,
                SUM(total_created) AS total_created,
                SUM(total_published) AS total_published
         FROM monthly_processing_summary
         ${monthWhere}
         GROUP BY month
         ORDER BY month`,
        monthParams
      ),

      // Monthly by client (for trend drill-down; filtered by date range if provided)
      query(
        `SELECT client_id, month,
                total_uploaded, total_created, total_published
         FROM monthly_processing_summary
         ${monthByClientWhere}
         ORDER BY month, client_id`,
        monthByClientParams
      ),

      query(
        `SELECT
           COALESCE(SUM(uploaded_count), 0)::int AS total_uploaded,
           COALESCE(SUM(created_count), 0)::int AS total_processed,
           COALESCE(SUM(published_count), 0)::int AS total_published,
           CASE WHEN SUM(published_count) > 0
           THEN SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
             THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END) / 60.0 / NULLIF(SUM(published_count), 0)
           ELSE NULL END AS avg_dur
         FROM channel_processing_summary
         WHERE 1=1 ${clientWhereAndCps}`,
        params
      ),

      query<{
        client_id: string;
        total_videos: number;
        unknown_input: number;
        pub_no_platform: number;
        pub_no_url: number;
        total_created: number;
        total_published: number;
        output_types_used: number;
        total_output_types: number;
        created_hours: number;
      }>(`
        WITH vq AS (
          SELECT client_id, COUNT(*)::int AS total_videos,
            COUNT(*) FILTER (WHERE input_type_name IS NULL OR input_type_name = 'Unknown')::int AS unknown_input,
            COUNT(*) FILTER (WHERE published_flag AND published_platform IS NULL)::int AS pub_no_platform,
            COUNT(*) FILTER (WHERE published_flag AND (published_url IS NULL OR published_url = ''))::int AS pub_no_url
          FROM videos GROUP BY client_id
        ),
        cps AS (
          SELECT client_id,
            SUM(uploaded_count)::int AS total_videos,
            SUM(created_count)::int AS total_created,
            SUM(published_count)::int AS total_published
          FROM channel_processing_summary GROUP BY client_id
        ),
        pc AS (
          SELECT client_id, total_videos, total_created, total_published FROM cps
        ),
        ot AS (
          SELECT client_id, COUNT(DISTINCT output_type)::int AS output_types_used
          FROM output_type_processing_summary WHERE published_count > 0 GROUP BY client_id
        ),
        tt AS (SELECT COUNT(DISTINCT output_type)::int AS cnt FROM output_type_processing_summary),
        dh AS (
          SELECT client_id,
            ROUND(SUM(CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS created_hours
          FROM monthly_duration_summary GROUP BY client_id
        )
        SELECT c.client_id, COALESCE(pc.total_videos,0) AS total_videos,
          COALESCE(vq.unknown_input,0) AS unknown_input, COALESCE(vq.pub_no_platform,0) AS pub_no_platform,
          COALESCE(vq.pub_no_url,0) AS pub_no_url, COALESCE(pc.total_created,0) AS total_created,
          COALESCE(pc.total_published,0) AS total_published, COALESCE(ot.output_types_used,0) AS output_types_used,
          tt.cnt AS total_output_types, COALESCE(dh.created_hours,0) AS created_hours
        FROM clients c CROSS JOIN tt
        LEFT JOIN vq ON c.client_id = vq.client_id LEFT JOIN pc ON c.client_id = pc.client_id
        LEFT JOIN ot ON c.client_id = ot.client_id LEFT JOIN dh ON c.client_id = dh.client_id
        ORDER BY COALESCE(pc.total_published,0) DESC
      `),
    ]);

    const overall = (overallRes.rows[0] as Record<string, string>) || {};
    const totalUploaded = Number(overall.total_uploaded) || 0;
    const totalProcessed = Number(overall.total_processed) || 0;
    const totalPublished = Number(overall.total_published) || 0;

    const trendData = (
      monthlyRes.rows as {
        month: string;
        total_uploaded: string;
        total_created: string;
        total_published: string;
      }[]
    ).map((r) => ({
      month: r.month,
      uploaded: Number(r.total_uploaded),
      processed: Number(r.total_created),
      published: Number(r.total_published),
    }));

    const clientAggRes = await query(
      `SELECT client_id AS name,
              SUM(uploaded_count) AS uploaded_count,
              SUM(created_count) AS created_count,
              SUM(published_count) AS published_count
       FROM channel_processing_summary
       GROUP BY client_id
       ORDER BY SUM(published_count) DESC`
    );
    const clientBreakdown = toBreakdown(clientAggRes.rows as SummaryRow[]);

    const response = {
      filters: {
        clients: (clientsRes.rows as { client_id: string }[]).map(
          (r) => r.client_id
        ),
      },
      kpis: {
        totalUploaded,
        totalProcessed,
        totalPublished,
        publishRate:
          totalProcessed > 0
            ? Math.round((totalPublished / totalProcessed) * 1000) / 10
            : 0,
        processRate:
          totalUploaded > 0
            ? Math.round((totalProcessed / totalUploaded) * 1000) / 10
            : 0,
        avgDuration:
          Math.round((Number(overall.avg_dur) || 0) * 10) / 10,
        dropGap: totalProcessed - totalPublished,
      },
      breakdowns: {
        channel: toBreakdown(channelRes.rows as SummaryRow[]),
        client: clientBreakdown,
        user: toBreakdown(userRes.rows as SummaryRow[]),
        inputType: toBreakdown(inputTypeRes.rows as SummaryRow[]),
        outputType: toBreakdown(outputTypeRes.rows as SummaryRow[]),
        language: toBreakdown(languageRes.rows as SummaryRow[]),
      },
      trend: trendData,
      monthlyByClient: (monthlyByClientRes.rows as { client_id: string; month: string; total_uploaded: string | number; total_created: string | number; total_published: string | number }[]).map((r) => ({
        client_id: r.client_id,
        month: r.month,
        uploaded: Number(r.total_uploaded),
        processed: Number(r.total_created),
        published: Number(r.total_published),
      })),
      riskTable: riskTableRes.rows.map((r) => ({
        client_id: r.client_id,
        totalVideos: Number(r.total_videos),
        unknownInput: Number(r.unknown_input),
        pubNoPlatform: Number(r.pub_no_platform),
        pubNoUrl: Number(r.pub_no_url),
        totalCreated: Number(r.total_created),
        totalPublished: Number(r.total_published),
        outputTypesUsed: Number(r.output_types_used),
        totalOutputTypes: Number(r.total_output_types),
        createdHours: Number(r.created_hours),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Page2 API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
