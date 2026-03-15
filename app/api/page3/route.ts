import { pool } from "@/lib/db";

export async function GET() {
  const client = await pool.connect();
  try {

    const [
      efficiencyRes,
      sankeyRes,
      clientsRes,
      usersRes,
      stackedRes,
      velocityRes,
    ] = await Promise.all([
      // 1. Efficiency Matrix – channel_processing_summary (include client_id for filtering)
      client.query<{
        client_id: string;
        channel_name: string;
        created_count: number;
        published_count: number;
        publish_rate: number;
      }>(`
        SELECT
          client_id,
          channel_name,
          COALESCE(created_count, 0)::int AS created_count,
          COALESCE(published_count, 0)::int AS published_count,
          CASE WHEN COALESCE(created_count, 0) = 0 THEN 0
               ELSE ROUND(COALESCE(published_count, 0)::numeric / created_count * 100, 1)
          END AS publish_rate
        FROM channel_processing_summary
        WHERE channel_name IS NOT NULL
        ORDER BY created_count DESC
      `),

      // 2. Sankey Flow – videos joined with channels for channel_name
      client.query<{
        client_id: string;
        source: string;
        target: string;
        value: number;
      }>(`
        SELECT v.client_id,
               v.input_type_name AS source,
               c.channel_name AS target,
               COUNT(*)::int AS value
        FROM videos v
        JOIN channels c ON c.client_id = v.client_id AND c.channel_id = v.channel_id
        WHERE v.input_type_name IS NOT NULL
          AND c.channel_name IS NOT NULL
        GROUP BY v.client_id, v.input_type_name, c.channel_name
        HAVING COUNT(*) > 0

        UNION ALL

        SELECT v.client_id,
               c.channel_name AS source,
               v.output_type_name AS target,
               COUNT(*)::int AS value
        FROM videos v
        JOIN channels c ON c.client_id = v.client_id AND c.channel_id = v.channel_id
        WHERE c.channel_name IS NOT NULL
          AND v.output_type_name IS NOT NULL
        GROUP BY v.client_id, c.channel_name, v.output_type_name
        HAVING COUNT(*) > 0

        ORDER BY value DESC
      `),

      // 3a. Clients ranked by published count
      client.query<{
        client_id: string;
        published_count: number;
        created_count: number;
        publish_rate: number;
      }>(`
        SELECT
          client_id,
          COALESCE(SUM(published_count), 0)::int AS published_count,
          COALESCE(SUM(created_count), 0)::int AS created_count,
          CASE WHEN COALESCE(SUM(created_count), 0) = 0 THEN 0
               ELSE ROUND(COALESCE(SUM(published_count), 0)::numeric / SUM(created_count) * 100, 1)
          END AS publish_rate
        FROM user_processing_summary
        WHERE client_id IS NOT NULL
        GROUP BY client_id
        ORDER BY published_count DESC
      `),

      // 3b. All users with their client_id, ranked by published count
      client.query<{
        client_id: string;
        user_name: string;
        published_count: number;
        created_count: number;
        publish_rate: number;
      }>(`
        SELECT
          client_id,
          user_name,
          COALESCE(published_count, 0)::int AS published_count,
          COALESCE(created_count, 0)::int AS created_count,
          CASE WHEN COALESCE(created_count, 0) = 0 THEN 0
               ELSE ROUND(COALESCE(published_count, 0)::numeric / created_count * 100, 1)
          END AS publish_rate
        FROM user_processing_summary
        WHERE user_name IS NOT NULL AND client_id IS NOT NULL
        ORDER BY published_count DESC
      `),

      // 4. Platform × Output Type Stacked – all output types across all platforms
      client.query<{
        platform: string;
        output_type: string;
        cnt: number;
      }>(`
        WITH all_output_types AS (
          SELECT DISTINCT output_type_name FROM videos WHERE output_type_name IS NOT NULL
        ),
        all_platforms AS (
          SELECT DISTINCT published_platform FROM videos WHERE published_flag AND published_platform IS NOT NULL
        ),
        combos AS (
          SELECT p.published_platform AS platform, o.output_type_name AS output_type
          FROM all_platforms p CROSS JOIN all_output_types o
        )
        SELECT
          c.platform,
          c.output_type,
          COALESCE(counts.cnt, 0)::int AS cnt
        FROM combos c
        LEFT JOIN (
          SELECT published_platform AS platform, output_type_name AS output_type, COUNT(*)::int AS cnt
          FROM videos
          WHERE published_flag AND published_platform IS NOT NULL AND output_type_name IS NOT NULL
          GROUP BY published_platform, output_type_name
        ) counts ON c.platform = counts.platform AND c.output_type = counts.output_type
        ORDER BY c.platform, c.output_type
      `),

      // 5. Production Velocity – avg turnaround by platform
      client.query<{
        group_name: string;
        avg_hours: number;
        min_hours: number;
        max_hours: number;
        median_hours: number;
        q1_hours: number;
        q3_hours: number;
      }>(`
        SELECT
          published_platform AS group_name,
          ROUND(AVG(EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600)::numeric, 1) AS avg_hours,
          ROUND(MIN(EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600)::numeric, 1) AS min_hours,
          ROUND(MAX(EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600)::numeric, 1) AS max_hours,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600
          )::numeric, 1) AS median_hours,
          ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600
          )::numeric, 1) AS q1_hours,
          ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600
          )::numeric, 1) AS q3_hours
        FROM videos
        WHERE published_flag
          AND published_at IS NOT NULL
          AND uploaded_at IS NOT NULL
          AND published_platform IS NOT NULL
        GROUP BY published_platform
        ORDER BY avg_hours DESC
      `),
    ]);

    // Build Sankey nodes + links
    const sankeyLinks = sankeyRes.rows;
    const nodeSet = new Set<string>();
    for (const link of sankeyLinks) {
      nodeSet.add(link.source);
      nodeSet.add(link.target);
    }
    const sankeyNodes = Array.from(nodeSet).map((name) => ({ name }));

    // Build stacked data: { platform, OutputType1: count, OutputType2: count, ... }
    const platformMap = new Map<string, Record<string, number>>();
    const outputTypes = new Set<string>();
    for (const row of stackedRes.rows) {
      outputTypes.add(row.output_type);
      if (!platformMap.has(row.platform)) platformMap.set(row.platform, {});
      platformMap.get(row.platform)![row.output_type] = Number(row.cnt);
    }
    const stackedData = Array.from(platformMap.entries()).map(([platform, types]) => ({
      platform,
      ...types,
    }));

    return Response.json({
      efficiency: efficiencyRes.rows.map((r) => ({
        client_id: r.client_id,
        channel_name: r.channel_name,
        created_count: Number(r.created_count),
        published_count: Number(r.published_count),
        publish_rate: Number(r.publish_rate),
      })),
      sankey: {
        nodes: sankeyNodes,
        links: sankeyLinks.map((l) => ({
          client_id: l.client_id,
          source: l.source,
          target: l.target,
          value: Number(l.value),
        })),
        clientIds: Array.from(new Set(sankeyLinks.map((l) => l.client_id).filter(Boolean))).sort(),
      },
      clientRanking: clientsRes.rows.map((r) => ({
        client_id: r.client_id,
        published_count: Number(r.published_count),
        created_count: Number(r.created_count),
        publish_rate: Number(r.publish_rate),
      })),
      usersByClient: usersRes.rows.map((r) => ({
        client_id: r.client_id,
        user_name: r.user_name,
        published_count: Number(r.published_count),
        created_count: Number(r.created_count),
        publish_rate: Number(r.publish_rate),
      })),
      stacked: {
        data: stackedData,
        outputTypes: Array.from(outputTypes),
      },
      velocity: velocityRes.rows.map((r) => ({
        group_name: r.group_name,
        avg_hours: Number(r.avg_hours),
        min_hours: Number(r.min_hours),
        max_hours: Number(r.max_hours),
        median_hours: Number(r.median_hours),
        q1_hours: Number(r.q1_hours),
        q3_hours: Number(r.q3_hours),
      })),
    });
  } catch (err) {
    console.error("Page3 API failed", err);
    return Response.json(
      { error: "Page3 API failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
