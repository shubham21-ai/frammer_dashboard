import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_TABLES = [
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
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeQuery(sql: string): Promise<Record<string, any>[] | null> {
  try {
    const res = await query(sql);
    return res.rows as Record<string, any>[];
  } catch {
    return null;
  }
}

async function generateAlerts() {
  type Alert = {
    severity: "critical" | "warning" | "info";
    category: string;
    message: string;
    table: string;
  };
  const alerts: Alert[] = [];

  // ── 1. OVERALL PUBLISH RATE (single alert from videos table — the source of truth)
  const overallRes = await safeQuery(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE uploaded_at IS NOT NULL) AS uploaded,
           COUNT(*) FILTER (WHERE processed_at IS NOT NULL) AS processed,
           COUNT(*) FILTER (WHERE published_flag = true) AS published
    FROM videos
  `);
  if (overallRes?.[0]) {
    const total = parseInt(overallRes[0].total) || 0;
    const uploaded = parseInt(overallRes[0].uploaded) || 0;
    const published = parseInt(overallRes[0].published) || 0;
    const pubRate = uploaded > 0 ? (published / uploaded) * 100 : 0;

    if (uploaded > 0 && pubRate < 5) {
      alerts.push({
        severity: "critical",
        category: "Low Publish Rate",
        message: `Overall publish rate is ${pubRate.toFixed(1)}% — only ${published.toLocaleString()} of ${uploaded.toLocaleString()} uploaded videos were published.`,
        table: "videos",
      });
    } else if (uploaded > 0 && pubRate < 20) {
      alerts.push({
        severity: "warning",
        category: "Below-Target Publish Rate",
        message: `Publish rate is ${pubRate.toFixed(1)}% (${published.toLocaleString()} of ${uploaded.toLocaleString()}) — below the 20% target.`,
        table: "videos",
      });
    }

    const unpublished = total - published;
    if (unpublished > 0 && total > 0) {
      const unpubPct = (unpublished / total) * 100;
      alerts.push({
        severity: unpubPct > 90 ? "critical" : unpubPct > 50 ? "warning" : "info",
        category: "Unpublished Backlog",
        message: `${unpublished.toLocaleString()} of ${total.toLocaleString()} videos (${unpubPct.toFixed(1)}%) remain unpublished.`,
        table: "videos",
      });
    }
  }

  // ── 2. PER-CLIENT PUBLISH RATE — flag clients performing worst
  const clientRes = await safeQuery(`
    SELECT client_id,
           COUNT(*) FILTER (WHERE uploaded_at IS NOT NULL) AS uploaded,
           COUNT(*) FILTER (WHERE published_flag = true) AS published
    FROM videos
    GROUP BY client_id
    HAVING COUNT(*) FILTER (WHERE uploaded_at IS NOT NULL) > 0
    ORDER BY COUNT(*) FILTER (WHERE published_flag = true)::float / NULLIF(COUNT(*) FILTER (WHERE uploaded_at IS NOT NULL), 0) ASC
  `);
  if (clientRes) {
    for (const r of clientRes) {
      const up = parseInt(r.uploaded) || 0;
      const pub = parseInt(r.published) || 0;
      if (up > 50 && pub === 0) {
        alerts.push({
          severity: "critical",
          category: "Zero Publishing — Client",
          message: `${r.client_id} uploaded ${up.toLocaleString()} videos but published none — complete pipeline failure for this client.`,
          table: "videos",
        });
      } else if (up > 50 && (pub / up) * 100 < 1) {
        alerts.push({
          severity: "warning",
          category: "Very Low Client Output",
          message: `${r.client_id} has only ${pub} published out of ${up.toLocaleString()} uploaded (${((pub / up) * 100).toFixed(1)}%).`,
          table: "videos",
        });
      }
    }
  }

  // ── 3. MONTHLY TRENDS — flag significant month-over-month drops
  const allMonthly = await safeQuery(`
    SELECT month, SUM(total_uploaded) AS up, SUM(total_published) AS pub
    FROM monthly_processing_summary
    GROUP BY month ORDER BY month
  `);
  if (allMonthly && allMonthly.length >= 2) {
    const latest = allMonthly[allMonthly.length - 1];
    const prev = allMonthly[allMonthly.length - 2];
    const latestPub = parseInt(latest.pub) || 0;
    const prevPub = parseInt(prev.pub) || 0;
    const latestUp = parseInt(latest.up) || 0;

    if (latestPub === 0 && latestUp > 0) {
      alerts.push({
        severity: "critical",
        category: "Publishing Stalled",
        message: `Zero videos published in ${latest.month} despite ${latestUp.toLocaleString()} uploads — pipeline is completely stalled.`,
        table: "monthly_processing_summary",
      });
    } else if (prevPub > 0 && latestPub < prevPub * 0.5) {
      const dropPct = ((1 - latestPub / prevPub) * 100).toFixed(0);
      alerts.push({
        severity: "warning",
        category: "Publishing Decline",
        message: `Publishing dropped ${dropPct}% from ${prev.month} (${prevPub}) to ${latest.month} (${latestPub}).`,
        table: "monthly_processing_summary",
      });
    }
  }

  // ── 4. CHANNEL HEALTH — channels with zero published content
  const zeroPubChannels = await safeQuery(`
    SELECT COUNT(*) AS cnt,
           (SELECT COUNT(*) FROM channel_processing_summary) AS total_channels
    FROM channel_processing_summary WHERE published_count = 0
  `);
  if (zeroPubChannels?.[0]) {
    const zero = parseInt(zeroPubChannels[0].cnt) || 0;
    const total = parseInt(zeroPubChannels[0].total_channels) || 0;
    if (zero > 0 && total > 0) {
      const pct = ((zero / total) * 100).toFixed(0);
      alerts.push({
        severity: zero > total * 0.5 ? "critical" : "warning",
        category: "Inactive Channels",
        message: `${zero} of ${total} channels (${pct}%) have zero published content — these channels are not producing output.`,
        table: "channel_processing_summary",
      });
    }
  }

  // ── 5. TOP PERFORMING CHANNELS (positive signal)
  const topChannels = await safeQuery(`
    SELECT channel_name, published_count, uploaded_count,
           ROUND(published_count::numeric / NULLIF(uploaded_count, 0) * 100, 1) AS rate
    FROM channel_processing_summary
    WHERE uploaded_count > 0 AND published_count > 0
    ORDER BY published_count DESC LIMIT 3
  `);
  if (topChannels && topChannels.length > 0) {
    const names = topChannels.map((r: Record<string, string>) => `${r.channel_name} (${r.published_count} pub, ${r.rate}%)`).join(", ");
    alerts.push({
      severity: "info",
      category: "Top Performing Channels",
      message: `Best channels: ${names}.`,
      table: "channel_processing_summary",
    });
  }

  // ── 6. USER PERFORMANCE — users with high uploads but zero publish
  const inactiveUsers = await safeQuery(`
    SELECT user_name, SUM(uploaded_count) AS up
    FROM user_processing_summary
    WHERE published_count = 0
    GROUP BY user_name
    HAVING SUM(uploaded_count) > 50
    ORDER BY SUM(uploaded_count) DESC
  `);
  if (inactiveUsers && inactiveUsers.length > 0) {
    const names = inactiveUsers.slice(0, 3).map((r: Record<string, string>) => r.user_name).join(", ");
    const extra = inactiveUsers.length > 3 ? ` +${inactiveUsers.length - 3} more` : "";
    alerts.push({
      severity: "warning",
      category: "User Pipeline Stall",
      message: `${inactiveUsers.length} user(s) uploaded content but have 0% publish rate: ${names}${extra}.`,
      table: "user_processing_summary",
    });
  }

  // ── 7. PLATFORM DISTRIBUTION
  const platRows = await safeQuery(`
    SELECT SUM(facebook_count) as fb, SUM(instagram_count) as ig,
           SUM(linkedin_count) as li, SUM(reels_count) as rl,
           SUM(shorts_count) as sh, SUM(x_count) as xc,
           SUM(youtube_count) as yt, SUM(threads_count) as th
    FROM channel_wise_publishing_counts
  `);
  if (platRows?.[0]) {
    const p = platRows[0];
    const counts: Record<string, number> = {
      Facebook: parseInt(p.fb) || 0, Instagram: parseInt(p.ig) || 0,
      LinkedIn: parseInt(p.li) || 0, Reels: parseInt(p.rl) || 0,
      Shorts: parseInt(p.sh) || 0, "X (Twitter)": parseInt(p.xc) || 0,
      YouTube: parseInt(p.yt) || 0, Threads: parseInt(p.th) || 0,
    };
    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    if (total > 0) {
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const [topName, topCount] = sorted[0];
      const topPct = (topCount / total) * 100;
      if (topPct >= 80) {
        alerts.push({
          severity: "warning",
          category: "Platform Concentration",
          message: `${topPct.toFixed(0)}% of published content goes to ${topName} — consider diversifying across platforms.`,
          table: "channel_wise_publishing_counts",
        });
      }
      const zeroPlatforms = sorted.filter(([, v]) => v === 0).map(([n]) => n);
      if (zeroPlatforms.length > 0 && zeroPlatforms.length < sorted.length) {
        alerts.push({
          severity: "info",
          category: "Unused Platforms",
          message: `No content published to: ${zeroPlatforms.join(", ")} — growth opportunity on these platforms.`,
          table: "channel_wise_publishing_counts",
        });
      }
    }
  }

  // ── 8. INPUT TYPE ANALYSIS — types with lowest conversion
  const inputRows = await safeQuery(`
    SELECT input_type,
           SUM(uploaded_count) AS up, SUM(published_count) AS pub
    FROM input_type_processing_summary
    GROUP BY input_type
    HAVING SUM(uploaded_count) > 20
    ORDER BY SUM(published_count)::float / NULLIF(SUM(uploaded_count), 0) ASC
    LIMIT 3
  `);
  if (inputRows && inputRows.length > 0) {
    const worstTypes = inputRows
      .filter((r: Record<string, string>) => {
        const up = parseInt(r.up) || 0;
        const pub = parseInt(r.pub) || 0;
        return up > 0 && (pub / up) * 100 < 5;
      })
      .map((r: Record<string, string>) => {
        const rate = ((parseInt(r.pub) || 0) / (parseInt(r.up) || 1) * 100).toFixed(1);
        return `${r.input_type} (${rate}%)`;
      });
    if (worstTypes.length > 0) {
      alerts.push({
        severity: "warning",
        category: "Low-Converting Input Types",
        message: `These input types have <5% publish rate: ${worstTypes.join(", ")} — review processing pipeline for these formats.`,
        table: "input_type_processing_summary",
      });
    }
  }

  // ── 9. DATA QUALITY — missing metadata fields
  const missingChecks = [
    { col: "published_platform", label: "publishing platform", onlyPublished: true },
    { col: "duration", label: "duration" },
    { col: "language_name", label: "language" },
    { col: "input_type_name", label: "input type" },
  ];
  const qualityIssues: string[] = [];
  for (const check of missingChecks) {
    const where = check.onlyPublished
      ? `WHERE published_flag = true AND (${check.col} IS NULL OR CAST(${check.col} AS TEXT) = '')`
      : `WHERE ${check.col} IS NULL OR CAST(${check.col} AS TEXT) = ''`;
    const rows = await safeQuery(`SELECT COUNT(*) as cnt FROM videos ${where}`);
    if (rows && parseInt(rows[0].cnt) > 100) {
      qualityIssues.push(`${parseInt(rows[0].cnt).toLocaleString()} missing ${check.label}`);
    }
  }
  if (qualityIssues.length > 0) {
    alerts.push({
      severity: "warning",
      category: "Data Quality",
      message: `Metadata gaps detected: ${qualityIssues.join("; ")}.`,
      table: "videos",
    });
  }

  // ── 10. LANGUAGE DISTRIBUTION
  const langRows = await safeQuery(`
    SELECT language, SUM(uploaded_count) AS up
    FROM language_processing_summary GROUP BY language ORDER BY SUM(uploaded_count) DESC
  `);
  if (langRows && langRows.length > 0) {
    const totalLang = langRows.reduce((s: number, r: Record<string, string>) => s + (parseInt(r.up) || 0), 0);
    const topCount = parseInt(langRows[0].up) || 0;
    if (totalLang > 0 && topCount / totalLang >= 0.9) {
      alerts.push({
        severity: "info",
        category: "Language Distribution",
        message: `${((topCount / totalLang) * 100).toFixed(0)}% of content is in "${langRows[0].language}" — localization into other languages could expand reach.`,
        table: "language_processing_summary",
      });
    }
  }

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return alerts;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const table = sp.get("table");

  try {
    if (table === "_alerts") {
      const alerts = await generateAlerts();
      return NextResponse.json({ alertCount: alerts.length, alerts });
    }

    if (table) {
      if (
        !ALLOWED_TABLES.includes(table as (typeof ALLOWED_TABLES)[number]) &&
        table !== "videos"
      ) {
        return NextResponse.json(
          { error: `Table "${table}" not allowed` },
          { status: 400 }
        );
      }
      const res = await query(`SELECT * FROM ${table}`);
      return NextResponse.json({
        table,
        rowCount: res.rowCount,
        rows: res.rows,
      });
    }

    const results: Record<
      string,
      { rowCount: number | null; rows: unknown[] }
    > = {};
    const [videosRes, ...summaryResults] = await Promise.all([
      query("SELECT * FROM videos"),
      ...ALLOWED_TABLES.map((t) =>
        query(`SELECT * FROM ${t}`).catch(() => ({ rowCount: 0, rows: [] }))
      ),
    ]);

    results.videos = {
      rowCount: videosRes.rowCount,
      rows: videosRes.rows,
    };
    ALLOWED_TABLES.forEach((t, i) => {
      results[t] = {
        rowCount: summaryResults[i].rowCount,
        rows: summaryResults[i].rows,
      };
    });

    const alerts = await generateAlerts();

    return NextResponse.json({ tables: results, alerts });
  } catch (error) {
    console.error("Page5 API error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
