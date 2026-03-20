import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export async function GET() {
  try {
    const [
      humanHoursRes,
      timeToMarketRes,
      contentWasteRes,
      clientConcentrationRes,
      totalUploadedCountRes,
      totalUploadedDurRes,
      totalCreatedRes,
      totalCreatedDurRes,
      topOutputRes,
      monthlyProcRes,
      monthlyDurRes,
      monthlyCreatedDurRes,
      lifecycleCountRes,
      lifecycleDurRes,
      efficiencyRes,
      topFormatsRes,
      featureAdoptionRes,
      dataHealthRes,
      timeToMarketMonthlyRes,
      contentWasteMonthlyRes,
      clientConcentrationMonthlyRes,
      topOutputByMonthRes,
      lastUploadRes,
    ] = await Promise.all([
      // 1. Human Hours Saved: SUM(total_uploaded_duration) * 3
      query(`
        SELECT COALESCE(SUM(
          CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
               THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval))
               ELSE NULL
          END
        ), 0)::numeric AS total_seconds
        FROM monthly_duration_summary
      `),

      // 2. Time-to-Market: AVG(published_at - uploaded_at)
      query(`
        SELECT ROUND(AVG(EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600)::numeric, 2) AS avg_hours
        FROM videos
        WHERE published_flag = true
          AND published_at IS NOT NULL
          AND uploaded_at IS NOT NULL
      `),

      // 3. Content Waste: total_created - total_published duration
      query(`
        WITH agg AS (
          SELECT
            COALESCE(SUM(
              CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
                   THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval))
                   ELSE NULL
              END
            ), 0)::numeric AS created_sec,
            COALESCE(SUM(
              CASE WHEN total_published_duration IS NOT NULL AND TRIM(COALESCE(total_published_duration::text, '')) != ''
                   THEN EXTRACT(EPOCH FROM (total_published_duration::text::interval))
                   ELSE NULL
              END
            ), 0)::numeric AS published_sec
          FROM monthly_duration_summary
        )
        SELECT GREATEST(created_sec - published_sec, 0) AS waste_seconds FROM agg
      `),

      // 4. Client Concentration Risk: top client duration / total — from monthly_duration_summary
      query(`
        WITH by_client AS (
          SELECT
            client_id,
            COALESCE(SUM(
              CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
                   THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval))
                   ELSE NULL
              END
            ), 0)::numeric AS client_sec
          FROM monthly_duration_summary
          GROUP BY client_id
        ),
        totals AS (
          SELECT SUM(client_sec) AS total_sec FROM by_client
        )
        SELECT
          (SELECT client_id FROM by_client ORDER BY client_sec DESC LIMIT 1) AS top_client,
          (SELECT client_sec FROM by_client ORDER BY client_sec DESC LIMIT 1) AS top_sec,
          (SELECT total_sec FROM totals) AS total_sec
      `),

      // 5. Total Uploaded (count + duration) — from monthly_processing_summary + monthly_duration_summary
      query(`
        SELECT COALESCE(SUM(total_uploaded), 0)::int AS total_uploaded
        FROM monthly_processing_summary
      `),
      query(`
        SELECT COALESCE(SUM(
          CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
               THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval))
               ELSE NULL
          END
        ), 0)::numeric AS total_seconds
        FROM monthly_duration_summary
      `),

      // 6. Total AI-Generated Output — uses PROCESSED (total_created = processed_at), NOT uploaded
      query(`
        SELECT COALESCE(SUM(total_created), 0)::int AS total_created
        FROM monthly_processing_summary
      `),
      query(`
        SELECT COALESCE(SUM(
          CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
               THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval))
               ELSE NULL
          END
        ), 0)::numeric AS total_seconds
        FROM monthly_duration_summary
      `),

      // 7 & 9. Top output type (from output_type_processing_summary)
      query(`
        SELECT output_type AS output_type_name, SUM(published_count)::int AS cnt
        FROM output_type_processing_summary
        WHERE published_count > 0
        GROUP BY output_type
        ORDER BY cnt DESC
        LIMIT 1
      `),

      // 8. Monthly processing for PoP and pipeline
      query(`
        SELECT month,
          SUM(total_uploaded)::int AS total_uploaded,
          SUM(total_created)::int AS total_created,
          SUM(total_published)::int AS total_published
        FROM monthly_processing_summary
        GROUP BY month
        ORDER BY month
      `),

      // Monthly duration for trend (human hours by month) — uploaded hours summed per month across clients
      query(`
        SELECT month, client_id,
          CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
               THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval))::numeric
               ELSE 0
          END AS total_seconds
        FROM monthly_duration_summary
        ORDER BY month, client_id
      `),

      // Monthly created duration — processed hours summed per month across clients
      query(`
        SELECT month,
          COALESCE(SUM(
            CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
                 THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval))
                 ELSE 0
            END
          ), 0)::numeric AS created_seconds
        FROM monthly_duration_summary
        GROUP BY month
        ORDER BY month
      `),

      // Lifecycle by client (count)
      query(`
        SELECT client_id, month, SUM(total_uploaded)::int AS total_uploaded
        FROM monthly_processing_summary
        GROUP BY client_id, month
        ORDER BY month, client_id
      `),

      // Lifecycle by client (duration)
      query(`
        SELECT client_id, month,
          CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
               THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval))::numeric
               ELSE 0
          END AS total_seconds
        FROM monthly_duration_summary
        ORDER BY month, client_id
      `),

      // Efficiency Matrix
      query(`
        SELECT client_id, channel_name, created_count, published_count
        FROM channel_processing_summary
        WHERE channel_name IS NOT NULL
        ORDER BY created_count DESC
      `),

      // Top formats over time
      query(`
        SELECT
          TO_CHAR(published_at, 'YYYY-MM') AS month,
          output_type_name AS output_type,
          COUNT(*)::int AS cnt
        FROM videos
        WHERE published_flag = true
          AND published_at IS NOT NULL
          AND output_type_name IS NOT NULL
        GROUP BY TO_CHAR(published_at, 'YYYY-MM'), output_type_name
        ORDER BY month, output_type_name
      `),

      // Feature adoption matrix (client x output_type)
      query(`
        SELECT
          client_id,
          output_type,
          COALESCE(SUM(created_count), 0)::int AS created_count,
          COALESCE(SUM(published_count), 0)::int AS published_count
        FROM output_type_processing_summary
        WHERE client_id IS NOT NULL
          AND output_type IS NOT NULL
        GROUP BY client_id, output_type
        ORDER BY client_id, output_type
      `),

      // Data Health Alerts (videos table has no headline column in schema)
      query(`
        SELECT video_id, published_platform, user_id,
          CASE
            WHEN published_platform IS NULL AND (user_id IS NULL OR user_id = '') THEN 'Missing platform & user'
            WHEN published_platform IS NULL THEN 'Missing platform'
            WHEN user_id IS NULL OR user_id = '' THEN 'Missing user'
            ELSE 'Other'
          END AS issue_type
        FROM videos
        WHERE published_flag = true
          AND (published_platform IS NULL OR user_id IS NULL OR user_id = '')
        ORDER BY video_id
        LIMIT 100
      `),

      // Monthly Time-to-Market (avg hours by month)
      query(`
        SELECT TO_CHAR(published_at, 'YYYY-MM') AS month,
          ROUND(AVG(EXTRACT(EPOCH FROM (published_at - uploaded_at)) / 3600)::numeric, 2) AS avg_hours
        FROM videos
        WHERE published_flag = true AND published_at IS NOT NULL AND uploaded_at IS NOT NULL
        GROUP BY TO_CHAR(published_at, 'YYYY-MM')
        ORDER BY month
      `),

      // Monthly Content Waste (created - published duration by month)
      query(`
        SELECT month,
          GREATEST(
            COALESCE(SUM(CASE WHEN total_created_duration IS NOT NULL AND TRIM(COALESCE(total_created_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (total_created_duration::text::interval)) ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN total_published_duration IS NOT NULL AND TRIM(COALESCE(total_published_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (total_published_duration::text::interval)) ELSE 0 END), 0),
            0
          )::numeric AS waste_seconds
        FROM monthly_duration_summary
        GROUP BY month
        ORDER BY month
      `),

      // Monthly Client Concentration (top client % by month)
      query(`
        WITH by_month_client AS (
          SELECT month, client_id,
            COALESCE(SUM(CASE WHEN total_uploaded_duration IS NOT NULL AND TRIM(COALESCE(total_uploaded_duration::text, '')) != ''
              THEN EXTRACT(EPOCH FROM (total_uploaded_duration::text::interval)) ELSE 0 END), 0)::numeric AS client_sec
          FROM monthly_duration_summary
          GROUP BY month, client_id
        ),
        by_month AS (
          SELECT month, SUM(client_sec) AS total_sec FROM by_month_client GROUP BY month
        ),
        top_per_month AS (
          SELECT DISTINCT ON (bmc.month) bmc.month, bmc.client_sec AS top_sec, bm.total_sec
          FROM by_month_client bmc
          JOIN by_month bm ON bmc.month = bm.month
          ORDER BY bmc.month, bmc.client_sec DESC
        )
        SELECT month, ROUND((top_sec / NULLIF(total_sec, 0) * 100)::numeric, 1) AS concentration_pct
        FROM top_per_month
        ORDER BY month
      `),

      // Monthly Top Output Type (per month)
      query(`
        WITH ranked AS (
          SELECT TO_CHAR(published_at, 'YYYY-MM') AS month, output_type_name,
            COUNT(*)::int AS cnt,
            ROW_NUMBER() OVER (PARTITION BY TO_CHAR(published_at, 'YYYY-MM') ORDER BY COUNT(*) DESC) AS rn
          FROM videos
          WHERE published_flag = true AND published_at IS NOT NULL AND output_type_name IS NOT NULL
          GROUP BY TO_CHAR(published_at, 'YYYY-MM'), output_type_name
        )
        SELECT month, output_type_name AS top_output
        FROM ranked WHERE rn = 1
        ORDER BY month
      `),

      // Last upload date per client (for inactive client alerts)
      query(`
        SELECT c.client_id,
          MAX(v.uploaded_at) AS last_upload
        FROM clients c
        LEFT JOIN videos v ON v.client_id = c.client_id AND v.uploaded_at IS NOT NULL
        GROUP BY c.client_id
        ORDER BY last_upload NULLS LAST
      `),
    ]);

    // Parse results
    const humanHoursSec = Number((humanHoursRes.rows[0] as { total_seconds: string })?.total_seconds ?? 0);
    const humanHoursSaved = humanHoursSec * 3;

    const timeToMarketHours = Number((timeToMarketRes.rows[0] as { avg_hours: string })?.avg_hours ?? 0);

    const contentWasteSec = Number((contentWasteRes.rows[0] as { waste_seconds: string })?.waste_seconds ?? 0);

    const ccRow = clientConcentrationRes.rows[0] as { top_sec: string; total_sec: string } | undefined;
    const topSec = Number(ccRow?.top_sec ?? 0);
    const totalSec = Number(ccRow?.total_sec ?? 1);
    const clientConcentrationPct = totalSec > 0 ? (topSec / totalSec) * 100 : 0;

    const totalUploadedCount = Number((totalUploadedCountRes.rows[0] as { total_uploaded: string })?.total_uploaded ?? 0);
    const totalUploadedDurationSec = Number((totalUploadedDurRes.rows[0] as { total_seconds: string })?.total_seconds ?? 0);

    const totalCreated = Number((totalCreatedRes.rows[0] as { total_created: string })?.total_created ?? 0);
    const totalCreatedDurationSec = Number((totalCreatedDurRes.rows[0] as { total_seconds: string })?.total_seconds ?? 0);

    const topOutputRow = topOutputRes.rows[0] as { output_type_name: string } | undefined;
    const topPerformingOutputType = topOutputRow?.output_type_name ?? "—";

    const monthlyRows = monthlyProcRes.rows as { month: string; total_uploaded: string; total_created: string; total_published: string }[];
    const sortedMonths = [...new Set(monthlyRows.map((r) => r.month))].sort();
    const currentMonth = sortedMonths[sortedMonths.length - 1] ?? "";
    const prevMonth = sortedMonths[sortedMonths.length - 2] ?? "";

    const currentRow = monthlyRows.find((r) => r.month === currentMonth);
    const prevRow = monthlyRows.find((r) => r.month === prevMonth);

    const currentUploaded = Number(currentRow?.total_uploaded ?? 0);
    const currentPublished = Number(currentRow?.total_published ?? 0);
    const prevUploaded = Number(prevRow?.total_uploaded ?? 0);
    const prevPublished = Number(prevRow?.total_published ?? 0);

    // Monthly KPI values (current + prev month)
    const ttMarketRows = timeToMarketMonthlyRes.rows as { month: string; avg_hours: string }[];
    const ttMarketCurrent = Number(ttMarketRows.find((r) => r.month === currentMonth)?.avg_hours ?? 0);
    const ttMarketPrev = Number(ttMarketRows.find((r) => r.month === prevMonth)?.avg_hours ?? 0);

    const wasteRows = contentWasteMonthlyRes.rows as { month: string; waste_seconds: string }[];
    const wasteCurrentSec = Number(wasteRows.find((r) => r.month === currentMonth)?.waste_seconds ?? 0);
    const wastePrevSec = Number(wasteRows.find((r) => r.month === prevMonth)?.waste_seconds ?? 0);

    const ccRows = clientConcentrationMonthlyRes.rows as { month: string; concentration_pct: string }[];
    const ccCurrentPct = Number(ccRows.find((r) => r.month === currentMonth)?.concentration_pct ?? 0);
    const ccPrevPct = Number(ccRows.find((r) => r.month === prevMonth)?.concentration_pct ?? 0);

    const topOutputRows = topOutputByMonthRes.rows as { month: string; top_output: string }[];
    const topOutputCurrent = topOutputRows.find((r) => r.month === currentMonth)?.top_output ?? "—";
    const topOutputPrev = topOutputRows.find((r) => r.month === prevMonth)?.top_output ?? "—";

    const currentCombined = currentUploaded + currentPublished;
    const prevCombined = prevUploaded + prevPublished;
    const popGrowthPct =
      prevCombined > 0 ? ((currentCombined - prevCombined) / prevCombined) * 100 : 0;

    // Trend % for each KPI (current vs prev month)
    type MonthlyDurRow = { month: string; total_seconds: string };
    const monthlyDurRows = monthlyDurRes.rows as MonthlyDurRow[];
    const humanHoursCurrent = monthlyDurRows
      .filter((r) => r.month === currentMonth)
      .reduce((s, r) => s + Number(r.total_seconds ?? 0), 0);
    const humanHoursPrev = monthlyDurRows
      .filter((r) => r.month === prevMonth)
      .reduce((s, r) => s + Number(r.total_seconds ?? 0), 0);
    const humanHoursTrendPct =
      humanHoursPrev > 0 ? ((humanHoursCurrent * 3 - humanHoursPrev * 3) / (humanHoursPrev * 3)) * 100 : 0;

    const aiMultiplier = totalUploadedCount > 0 ? totalCreated / totalUploadedCount : 0;
    const currentMonthMultiplier = currentUploaded > 0 ? (currentRow ? Number(currentRow.total_created ?? 0) : 0) / currentUploaded : 0;
    const prevMonthMultiplier = prevUploaded > 0 ? (prevRow ? Number(prevRow.total_created ?? 0) : 0) / prevUploaded : 0;

    // Build lifecycle trend by client
    const lifecycleCountRows = lifecycleCountRes.rows as { client_id: string; month: string; total_uploaded: string }[];
    const lifecycleDurRows = lifecycleDurRes.rows as { client_id: string; month: string; total_seconds: string }[];

    const clients = [...new Set(lifecycleCountRows.map((r) => r.client_id))].sort();
    const byClient: Record<string, { month: string; count: number; duration: number }[]> = {};
    for (const c of clients) {
      byClient[c] = [];
    }
    const allMonths = [...new Set(lifecycleCountRows.map((r) => r.month))].sort();
    for (const m of allMonths) {
      for (const c of clients) {
        const countRow = lifecycleCountRows.find((r) => r.client_id === c && r.month === m);
        const durRow = lifecycleDurRows.find((r) => r.client_id === c && r.month === m);
        byClient[c].push({
          month: m,
          count: Number(countRow?.total_uploaded ?? 0),
          duration: Number(durRow?.total_seconds ?? 0),
        });
      }
    }

    // Build alerts
    const alerts: Array<{ type: string; clientId: string; message: string; severity: string }> = [];
    const lastUploadRows = (lastUploadRes as { rows: { client_id: string; last_upload: string | null }[] }).rows;
    const now = new Date();
    for (const r of lastUploadRows) {
      if (!r.last_upload) {
        alerts.push({
          type: "inactive",
          clientId: r.client_id,
          message: `${r.client_id} has no upload activity recorded`,
          severity: "warning",
        });
      } else {
        const daysSince = Math.floor((now.getTime() - new Date(r.last_upload).getTime()) / 86400000);
        if (daysSince >= 30) {
          alerts.push({
            type: "inactive",
            clientId: r.client_id,
            message: `${r.client_id} hasn't uploaded in ${daysSince} days`,
            severity: daysSince >= 60 ? "critical" : "warning",
          });
        }
      }
    }
    // Volume drop alerts: current month < 50% of prev month per client
    if (currentMonth && prevMonth) {
      for (const c of clients) {
        const currRow = lifecycleCountRows.find(r => r.client_id === c && r.month === currentMonth);
        const prevClientRow = lifecycleCountRows.find(r => r.client_id === c && r.month === prevMonth);
        const currUpl = Number(currRow?.total_uploaded ?? 0);
        const prevUpl = Number(prevClientRow?.total_uploaded ?? 0);
        if (prevUpl >= 10 && currUpl < prevUpl * 0.5) {
          const dropPct = Math.round((1 - currUpl / prevUpl) * 100);
          alerts.push({
            type: "volume_drop",
            clientId: c,
            message: `${c} uploads dropped ${dropPct}% (${currUpl} vs ${prevUpl} last month)`,
            severity: dropPct >= 70 ? "critical" : "warning",
          });
        }
      }
    }

    // Pipeline stats monthly
    const pipelineMonthly = monthlyRows.map((r) => ({
      month: r.month,
      uploaded: Number(r.total_uploaded),
      created: Number(r.total_created),
      published: Number(r.total_published),
    }));

    // Efficiency matrix (EfficiencyMatrix expects created_count, published_count, publish_rate)
    const efficiencyMatrix = (efficiencyRes.rows as { client_id: string; channel_name: string; created_count: string; published_count: string }[]).map((r) => {
      const created = Number(r.created_count);
      const published = Number(r.published_count);
      return {
        client_id: r.client_id,
        channel_name: r.channel_name,
        created_count: created,
        published_count: published,
        publish_rate: created > 0 ? Math.round((published / created) * 1000) / 10 : 0,
      };
    });

    // Top formats over time - reshape for stacked chart
    const topFormatsRows = topFormatsRes.rows as { month: string; output_type: string; cnt: string }[];
    const topFormatsByMonth = new Map<string, Record<string, number>>();
    for (const r of topFormatsRows) {
      if (!topFormatsByMonth.has(r.month)) topFormatsByMonth.set(r.month, {});
      const row = topFormatsByMonth.get(r.month)!;
      row[r.output_type] = Number(r.cnt);
    }
    const topFormatsOverTime = Array.from(topFormatsByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, types]) => ({ month, ...types }));

    const outputTypes = [...new Set(topFormatsRows.map((r) => r.output_type))].sort();

    // Feature adoption matrix (for Page 1 lower panel)
    const featureRows = featureAdoptionRes.rows as {
      client_id: string;
      output_type: string;
      created_count: string | number;
      published_count: string | number;
    }[];
    const featureClients = Array.from(new Set(featureRows.map((r) => r.client_id))).sort();
    const featureOutputTypes = Array.from(new Set(featureRows.map((r) => r.output_type))).sort();
    const featureMatrixData: Record<
      string,
      Record<string, { created: number; published: number }>
    > = {};
    for (const row of featureRows) {
      if (!featureMatrixData[row.client_id]) featureMatrixData[row.client_id] = {};
      featureMatrixData[row.client_id][row.output_type] = {
        created: Number(row.created_count ?? 0),
        published: Number(row.published_count ?? 0),
      };
    }

    // Data health alerts
    const dataHealthAlerts = (dataHealthRes.rows as { video_id: string; published_platform: string | null; user_id: string; issue_type: string }[]).map((r) => ({
      video_id: r.video_id,
      headline: "—",
      published_platform: r.published_platform ?? "—",
      user_id: r.user_id ?? "—",
      issue_type: r.issue_type,
    }));

    // Trend % (current vs prev month)
    const timeToMarketTrendPct = ttMarketPrev > 0 ? ((ttMarketPrev - ttMarketCurrent) / ttMarketPrev) * 100 : 0; // lower is better
    const contentWasteTrendPct = wastePrevSec > 0 ? ((wasteCurrentSec - wastePrevSec) / wastePrevSec) * 100 : 0; // lower is better
    const clientConcentrationTrendPct = ccPrevPct > 0 ? ((ccPrevPct - ccCurrentPct) / ccPrevPct) * 100 : 0; // lower is better
    const totalUploadedTrendPct = prevUploaded > 0 ? ((currentUploaded - prevUploaded) / prevUploaded) * 100 : 0;
    const totalCreatedTrendPct = prevRow ? (Number(prevRow.total_created) > 0 ? ((currentRow ? Number(currentRow.total_created) : 0) - Number(prevRow.total_created)) / Number(prevRow.total_created) * 100 : 0) : 0;
    const aiMultiplierTrendPct = prevMonthMultiplier > 0 ? ((currentMonthMultiplier - prevMonthMultiplier) / prevMonthMultiplier) * 100 : 0;

    const humanHoursPrevFormatted = formatDuration(humanHoursPrev * 3);
    const humanHoursCurrentFormatted = formatDuration(humanHoursCurrent * 3);
    const currentMonthUploadedDurationFormatted = formatDuration(humanHoursCurrent);

    const createdDurRows = monthlyCreatedDurRes.rows as { month: string; created_seconds: string }[];
    const currentMonthCreatedDurationSec = Number(createdDurRows.find((r) => r.month === currentMonth)?.created_seconds ?? 0);
    const currentMonthCreatedDurationFormatted = formatDuration(currentMonthCreatedDurationSec);
    const prevMonthLabel = prevMonth || "previous month";
    const currentMonthLabel = currentMonth || "current month";
    // Format month for display: "2024-02" -> "Feb 2024"
    const formatMonthLabel = (m: string) => {
      if (!m || m.length < 7 || !m.includes("-")) return m;
      const [y, mo] = m.split("-");
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const monthName = months[parseInt(mo, 10) - 1] || mo;
      return `${monthName} ${y}`;
    };

    // YoY month: same month, previous year
    const yoyMonth = currentMonth
      ? `${parseInt(currentMonth.split("-")[0], 10) - 1}-${currentMonth.split("-")[1]}`
      : "";

    // Extract YoY values from already-fetched monthly arrays
    const yoyMonthlyRow = monthlyRows.find((r) => r.month === yoyMonth);
    const yoyUploaded = Number(yoyMonthlyRow?.total_uploaded ?? 0);
    const yoyCreated = Number(yoyMonthlyRow?.total_created ?? 0);

    const yoyHumanHoursSec = monthlyDurRows
      .filter((r) => r.month === yoyMonth)
      .reduce((s, r) => s + Number(r.total_seconds ?? 0), 0);

    const yoyTtmHours = Number(ttMarketRows.find((r) => r.month === yoyMonth)?.avg_hours ?? 0);
    const yoyWasteSec = Number(wasteRows.find((r) => r.month === yoyMonth)?.waste_seconds ?? 0);
    const yoyCCPct = Number(ccRows.find((r) => r.month === yoyMonth)?.concentration_pct ?? 0);
    const yoyTopOutput = topOutputRows.find((r) => r.month === yoyMonth)?.top_output ?? "—";
    const yoyMultiplier = yoyUploaded > 0 ? yoyCreated / yoyUploaded : 0;

    const humanHoursYoYTrendPct = yoyHumanHoursSec > 0
      ? ((humanHoursCurrent - yoyHumanHoursSec) / yoyHumanHoursSec) * 100 : 0;
    const ttmYoYTrendPct = yoyTtmHours > 0
      ? ((yoyTtmHours - ttMarketCurrent) / yoyTtmHours) * 100 : 0;
    const contentWasteYoYTrendPct = yoyWasteSec > 0
      ? ((wasteCurrentSec - yoyWasteSec) / yoyWasteSec) * 100 : 0;
    const ccYoYTrendPct = yoyCCPct > 0
      ? ((yoyCCPct - ccCurrentPct) / yoyCCPct) * 100 : 0;
    const uploadedYoYTrendPct = yoyUploaded > 0
      ? ((currentUploaded - yoyUploaded) / yoyUploaded) * 100 : 0;
    const currentCreatedVal = currentRow ? Number(currentRow.total_created ?? 0) : 0;
    const createdYoYTrendPct = yoyCreated > 0
      ? ((currentCreatedVal - yoyCreated) / yoyCreated) * 100 : 0;
    const aiMultiplierYoYTrendPct = yoyMultiplier > 0
      ? ((currentMonthMultiplier - yoyMultiplier) / yoyMultiplier) * 100 : 0;

    const response = {
      kpis: {
        humanHoursSaved: Math.round(humanHoursSaved / 3600),
        humanHoursSavedFormatted: formatDuration(humanHoursSaved),
        humanHoursTrendPct,
        humanHoursCurrentFormatted,
        humanHoursPrevFormatted,

        timeToMarketHours: Math.round(timeToMarketHours * 10) / 10,
        timeToMarketTrendPct,
        timeToMarketCurrentHours: ttMarketCurrent,
        timeToMarketPrevHours: ttMarketPrev,

        contentWasteFormatted: formatDuration(contentWasteSec),
        contentWasteSeconds: contentWasteSec,
        contentWasteTrendPct,
        contentWasteCurrentFormatted: formatDuration(wasteCurrentSec),
        contentWastePrevFormatted: formatDuration(wastePrevSec),

        clientConcentrationPct: Math.round(clientConcentrationPct * 10) / 10,
        clientConcentrationTrendPct,
        clientConcentrationCurrentPct: ccCurrentPct,
        clientConcentrationPrevPct: ccPrevPct,

        totalUploadedCount,
        totalUploadedDurationFormatted: formatDuration(totalUploadedDurationSec),
        totalUploadedTrendPct,
        currentMonthUploaded: currentUploaded,
        currentMonthUploadedDurationFormatted,
        prevMonthUploaded: prevUploaded,
        currentMonthCreated: currentRow ? Number(currentRow.total_created ?? 0) : 0,
        prevMonthCreated: prevRow ? Number(prevRow.total_created ?? 0) : 0,

        totalCreated,
        totalCreatedDurationFormatted: formatDuration(totalCreatedDurationSec),
        totalCreatedTrendPct,
        currentMonthCreatedDurationFormatted,

        aiContentMultiplier: Math.round(aiMultiplier * 10) / 10,
        aiMultiplierTrendPct,
        currentMonthMultiplier: Math.round(currentMonthMultiplier * 10) / 10,
        prevMonthMultiplier: Math.round(prevMonthMultiplier * 10) / 10,

        periodOverPeriodGrowthPct: Math.round(popGrowthPct * 10) / 10,
        currentMonthCombined: currentCombined,
        prevMonthCombined: prevCombined,

        topPerformingOutputType,
        topOutputCurrentMonth: topOutputCurrent,
        topOutputPrevMonth: topOutputPrev,

        prevMonthLabel: formatMonthLabel(prevMonthLabel),
        currentMonthLabel: formatMonthLabel(currentMonthLabel),

        yoyMonthLabel: formatMonthLabel(yoyMonth),
        humanHoursYoYTrendPct,
        humanHoursYoYFormatted: formatDuration(yoyHumanHoursSec * 3),
        timeToMarketYoYTrendPct: ttmYoYTrendPct,
        timeToMarketYoYHours: yoyTtmHours,
        contentWasteYoYTrendPct,
        contentWasteYoYFormatted: formatDuration(yoyWasteSec),
        clientConcentrationYoYTrendPct: ccYoYTrendPct,
        clientConcentrationYoYPct: yoyCCPct,
        totalUploadedYoYTrendPct: uploadedYoYTrendPct,
        yoyUploaded,
        totalCreatedYoYTrendPct: createdYoYTrendPct,
        yoyCreated,
        aiMultiplierYoYTrendPct,
        yoyMultiplier: Math.round(yoyMultiplier * 10) / 10,
        yoyTopOutput,
      },
      lifecycleTrend: { byClient: byClient, clients },
      pipelineStats: {
        totalUploaded: totalUploadedCount,
        totalProcessed: totalCreated,
        totalPublished: pipelineMonthly.reduce((sum, m) => sum + m.published, 0),
        monthly: pipelineMonthly,
      },
      efficiencyMatrix,
      topFormatsOverTime,
      topFormatsOutputTypes: outputTypes,
      featureMatrix: {
        clients: featureClients,
        outputTypes: featureOutputTypes,
        data: featureMatrixData,
      },
      dataHealthAlerts,
      alerts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Page1 API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch CEO dashboard data" },
      { status: 500 }
    );
  }
}
