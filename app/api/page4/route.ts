import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const client = await pool.connect();
  try {
    const [
      kpiDurationRes,
      kpiCountsRes,
      dataQualityRes,
      featurePenetrationRes,
      monthlyContribRes,
      clientShareRes,
      featureByClientRes,
      amplificationRes,
      platformHoursRes,
      languageByClientRes,
      riskTableRes,
      videosRes,
    ] = await Promise.all([
      // 1. KPI — total durations
      client.query<{
        total_created_hours: number;
        total_published_hours: number;
        total_uploaded_hours: number;
      }>(`
        SELECT
          ROUND(SUM(CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS total_created_hours,
          ROUND(SUM(CASE WHEN total_published_duration IS NOT NULL AND TRIM(COALESCE(total_published_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_published_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS total_published_hours,
          ROUND(SUM(CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS total_uploaded_hours
        FROM monthly_duration_summary
      `),

      // 2. KPI — counts (from channel_processing_summary)
      client.query<{
        total_videos: number;
        total_published: number;
        total_created: number;
        total_clients: number;
      }>(`
        SELECT
          COALESCE(SUM(uploaded_count), 0)::int AS total_videos,
          COALESCE(SUM(published_count), 0)::int AS total_published,
          COALESCE(SUM(created_count), 0)::int AS total_created,
          (SELECT COUNT(DISTINCT client_id) FROM clients)::int AS total_clients
        FROM channel_processing_summary
      `),

      // 3. Data quality
      client.query<{
        total: number;
        missing_input_type: number;
        missing_language: number;
        published_no_platform: number;
        published_no_url: number;
      }>(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE input_type_name IS NULL OR input_type_name = 'Unknown')::int AS missing_input_type,
          COUNT(*) FILTER (WHERE language_name IS NULL OR language_name = 'Unknown')::int AS missing_language,
          COUNT(*) FILTER (WHERE published_flag AND published_platform IS NULL)::int AS published_no_platform,
          COUNT(*) FILTER (WHERE published_flag AND (published_url IS NULL OR published_url = ''))::int AS published_no_url
        FROM videos
      `),

      // 4. Feature penetration
      client.query<{ avg_types: number; max_possible: number }>(`
        WITH client_types AS (
          SELECT client_id, COUNT(DISTINCT output_type)::int AS types_used
          FROM output_type_processing_summary WHERE published_count > 0
          GROUP BY client_id
        )
        SELECT
          ROUND(AVG(types_used)::numeric, 1) AS avg_types,
          (SELECT COUNT(DISTINCT output_type) FROM output_type_processing_summary)::int AS max_possible
        FROM client_types
      `),

      // 5. Monthly client contribution (stacked area)
      client.query<{
        client_id: string;
        month: string;
        created_hours: number;
      }>(`
        SELECT client_id, month,
          ROUND(CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval)) ELSE 0 END / 3600, 1)::numeric AS created_hours
        FROM monthly_duration_summary
        ORDER BY month, client_id
      `),

      // 6. Client share of billing hours
      client.query<{
        client_id: string;
        created_hours: number;
        published_hours: number;
        uploaded_hours: number;
      }>(`
        SELECT client_id,
          ROUND(SUM(CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS created_hours,
          ROUND(SUM(CASE WHEN total_published_duration IS NOT NULL AND TRIM(COALESCE(total_published_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_published_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS published_hours,
          ROUND(SUM(CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval)) ELSE 0 END) / 3600, 1)::numeric AS uploaded_hours
        FROM monthly_duration_summary
        GROUP BY client_id ORDER BY created_hours DESC
      `),

      // 7. Feature adoption by client (output type × client)
      client.query<{
        client_id: string;
        output_type: string;
        created_count: number;
        published_count: number;
      }>(`
        SELECT client_id, output_type, created_count::int, published_count::int
        FROM output_type_processing_summary
        ORDER BY client_id, output_type
      `),

      // 8. Content Amplification Factor per client (from channel_processing_summary)
      client.query<{
        client_id: string;
        uploaded: number;
        created: number;
        published: number;
        amplification: number;
      }>(`
        SELECT client_id,
          SUM(uploaded_count)::int AS uploaded,
          SUM(created_count)::int AS created,
          SUM(published_count)::int AS published,
          ROUND(SUM(created_count)::numeric / NULLIF(SUM(uploaded_count), 0), 1) AS amplification
        FROM channel_processing_summary
        GROUP BY client_id ORDER BY amplification DESC
      `),

      // 9. Publishing hours by platform (from channel_wise_publishing_duration)
      client.query<{ platform: string; hours: number }>(`
        WITH safe AS (
          SELECT
            SUM(CASE WHEN youtube_duration IS NOT NULL AND TRIM(COALESCE(youtube_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (youtube_duration::text::interval)) ELSE 0 END)/3600 AS yt,
            SUM(CASE WHEN instagram_duration IS NOT NULL AND TRIM(COALESCE(instagram_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (instagram_duration::text::interval)) ELSE 0 END)/3600 AS ig,
            SUM(CASE WHEN facebook_duration IS NOT NULL AND TRIM(COALESCE(facebook_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (facebook_duration::text::interval)) ELSE 0 END)/3600 AS fb,
            SUM(CASE WHEN linkedin_duration IS NOT NULL AND TRIM(COALESCE(linkedin_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (linkedin_duration::text::interval)) ELSE 0 END)/3600 AS li,
            SUM(CASE WHEN reels_duration IS NOT NULL AND TRIM(COALESCE(reels_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (reels_duration::text::interval)) ELSE 0 END)/3600 AS re,
            SUM(CASE WHEN shorts_duration IS NOT NULL AND TRIM(COALESCE(shorts_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (shorts_duration::text::interval)) ELSE 0 END)/3600 AS sh,
            SUM(CASE WHEN x_duration IS NOT NULL AND TRIM(COALESCE(x_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (x_duration::text::interval)) ELSE 0 END)/3600 AS xd,
            SUM(CASE WHEN threads_duration IS NOT NULL AND TRIM(COALESCE(threads_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (threads_duration::text::interval)) ELSE 0 END)/3600 AS th
          FROM channel_wise_publishing_duration
        )
        SELECT platform, ROUND(hours::numeric, 1)::numeric(10,1) AS hours
        FROM (VALUES
          ('YouTube', (SELECT yt FROM safe)),
          ('Instagram', (SELECT ig FROM safe)),
          ('Facebook', (SELECT fb FROM safe)),
          ('LinkedIn', (SELECT li FROM safe)),
          ('Reels', (SELECT re FROM safe)),
          ('Shorts', (SELECT sh FROM safe)),
          ('X', (SELECT xd FROM safe)),
          ('Threads', (SELECT th FROM safe))
        ) AS t(platform, hours)
      `),

      // 10. Language × Client processing hours
      client.query<{
        client_id: string;
        language: string;
        uploaded_hours: number;
        created_hours: number;
        published_hours: number;
        uploaded_count: number;
        created_count: number;
        published_count: number;
      }>(`
        SELECT client_id, language,
          ROUND(SUM(CASE WHEN uploaded_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(uploaded_duration_hh_mm_ss::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (uploaded_duration_hh_mm_ss::text::interval)) ELSE 0 END)/3600, 1)::numeric AS uploaded_hours,
          ROUND(SUM(CASE WHEN created_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(created_duration_hh_mm_ss::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (created_duration_hh_mm_ss::text::interval)) ELSE 0 END)/3600, 1)::numeric AS created_hours,
          ROUND(SUM(CASE WHEN published_duration_hh_mm_ss IS NOT NULL AND TRIM(COALESCE(published_duration_hh_mm_ss::text, '')) != ''
            THEN EXTRACT(EPOCH FROM (published_duration_hh_mm_ss::text::interval)) ELSE 0 END)/3600, 1)::numeric AS published_hours,
          SUM(uploaded_count)::int AS uploaded_count,
          SUM(created_count)::int AS created_count,
          SUM(published_count)::int AS published_count
        FROM language_processing_summary
        GROUP BY client_id, language ORDER BY client_id, created_hours DESC
      `),

      // 11. Risk table (counts from channel_processing_summary; video-level quality from videos)
      client.query<{
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

      // 12. Video explorer (no channels table — use channel_processing_summary or channel_id)
      client.query<{
        video_id: number; client_id: string; channel_name: string; user_name: string;
        output_type_name: string; published_platform: string; published_url: string;
      }>(`
        SELECT v.video_id, v.client_id,
          COALESCE(cps.channel_name, v.channel_id, '—') AS channel_name,
          COALESCE(u.user_name, v.user_id, '—') AS user_name,
          COALESCE(v.output_type_name, '—') AS output_type_name,
          COALESCE(v.published_platform, '—') AS published_platform,
          COALESCE(v.published_url, '') AS published_url
        FROM videos v
        LEFT JOIN channel_processing_summary cps ON v.client_id = cps.client_id AND v.channel_id = cps.channel_id
        LEFT JOIN users u ON v.client_id = u.client_id AND v.user_id = u.user_id
        WHERE v.published_flag = true
        ORDER BY v.published_at DESC NULLS LAST LIMIT 100
      `),
    ]);

    const dur = kpiDurationRes.rows[0];
    const cnt = kpiCountsRes.rows[0];
    const dq = dataQualityRes.rows[0];
    const fp = featurePenetrationRes.rows[0];

    const totalIssues = Number(dq.missing_input_type) + Number(dq.missing_language) +
      Number(dq.published_no_platform) + Number(dq.published_no_url);
    const dataQualityPct = Number(dq.total) === 0 ? 100
      : Math.round(((Number(dq.total) - totalIssues) / Number(dq.total)) * 1000) / 10;
    const publishEfficiencyHrs = Number(dur.total_created_hours) === 0 ? 0
      : Math.round((Number(dur.total_published_hours) / Number(dur.total_created_hours)) * 1000) / 10;
    const atRiskCount = riskTableRes.rows.filter((r) => Number(r.total_published) < 100).length;

    const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const formatMonth = (ym: string) => {
      const [y, m] = String(ym).split("-");
      const idx = parseInt(m || "1", 10) - 1;
      return `${MONTH_NAMES[idx] ?? m}, ${y ?? ""}`;
    };
    const monthMap = new Map<string, Record<string, number>>();
    const clientIds = new Set<string>();
    for (const r of monthlyContribRes.rows) {
      clientIds.add(r.client_id);
      if (!monthMap.has(r.month)) monthMap.set(r.month, {});
      monthMap.get(r.month)![r.client_id] = Number(r.created_hours);
    }
    const sortedMonths = [...monthMap.keys()].sort();
    const monthlyContribution = sortedMonths.map((ym) => ({ month: formatMonth(ym), ...monthMap.get(ym)! }));

    const outputTypes = new Set<string>();
    const featureMatrix: Record<string, Record<string, { created: number; published: number }>> = {};
    for (const r of featureByClientRes.rows) {
      outputTypes.add(r.output_type);
      if (!featureMatrix[r.client_id]) featureMatrix[r.client_id] = {};
      featureMatrix[r.client_id][r.output_type] = { created: Number(r.created_count), published: Number(r.published_count) };
    }

    // Language matrix
    const languages = new Set<string>();
    const langMatrix: Record<
      string,
      Record<
        string,
        {
          uploadedHours: number;
          processingHours: number;
          publishedHours: number;
          uploadedCount: number;
          processingCount: number;
          publishedCount: number;
          // Legacy compatibility keys for older UI payload readers
          hours: number;
          published: number;
        }
      >
    > = {};
    for (const r of languageByClientRes.rows) {
      languages.add(r.language);
      if (!langMatrix[r.client_id]) langMatrix[r.client_id] = {};
      langMatrix[r.client_id][r.language] = {
        uploadedHours: Number(r.uploaded_hours),
        processingHours: Number(r.created_hours),
        publishedHours: Number(r.published_hours),
        uploadedCount: Number(r.uploaded_count),
        processingCount: Number(r.created_count),
        publishedCount: Number(r.published_count),
        hours: Number(r.created_hours),
        published: Number(r.published_count),
      };
    }

    const responsePayload = {
      kpis: {
        totalCreatedHours: Number(dur.total_created_hours),
        totalPublishedHours: Number(dur.total_published_hours),
        totalUploadedHours: Number(dur.total_uploaded_hours),
        totalVideos: Number(cnt.total_videos),
        totalPublished: Number(cnt.total_published),
        totalClients: Number(cnt.total_clients),
        dataQualityPct,
        avgFeatureTypes: Number(fp.avg_types),
        maxFeatureTypes: Number(fp.max_possible),
        publishEfficiencyHrs,
        atRiskCount,
      },
      dataQuality: {
        total: Number(dq.total),
        missingInputType: Number(dq.missing_input_type),
        missingLanguage: Number(dq.missing_language),
        publishedNoPlatform: Number(dq.published_no_platform),
        publishedNoUrl: Number(dq.published_no_url),
      },
      monthlyContribution,
      clientIds: Array.from(clientIds).sort(),
      clientShare: clientShareRes.rows.map((r) => ({
        client_id: r.client_id,
        createdHours: Number(r.created_hours),
        publishedHours: Number(r.published_hours),
        uploadedHours: Number(r.uploaded_hours),
      })),
      featureMatrix: {
        clients: Object.keys(featureMatrix).sort(),
        outputTypes: Array.from(outputTypes).sort(),
        data: featureMatrix,
      },
      amplification: amplificationRes.rows.map((r) => ({
        client_id: r.client_id,
        uploaded: Number(r.uploaded),
        created: Number(r.created),
        published: Number(r.published),
        amplification: Number(r.amplification),
      })),
      platformHours: platformHoursRes.rows
        .map((r) => ({ platform: r.platform, hours: Number(r.hours) }))
        .filter((r) => r.hours > 0)
        .sort((a, b) => b.hours - a.hours),
      languageMatrix: {
        clients: Object.keys(langMatrix).sort(),
        languages: Array.from(languages).sort(),
        data: langMatrix,
      },
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
      videoExplorer: videosRes.rows.map((r) => ({
        video_id: Number(r.video_id),
        client_id: r.client_id,
        channel_name: r.channel_name,
        user_name: r.user_name,
        output_type_name: r.output_type_name,
        published_platform: r.published_platform,
        published_url: r.published_url,
      })),
    };

    return Response.json(responsePayload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    console.error("Page4 API failed", err);
    return Response.json({ error: "Page4 API failed", details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
