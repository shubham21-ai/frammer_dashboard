/**
 * Data ingestion pipeline: parse uploads, map to schema, insert into videos,
 * and recompute summary tables.
 *
 * Uses Supabase JS client directly for all DML (INSERT/UPDATE/DELETE) —
 * exec_sql wraps queries as SELECT * FROM (<sql>) t which rejects DML entirely.
 * Only SELECT aggregation queries use query() / exec_sql.
 */

import { supabase } from "./supabase";
import { query } from "./db";

/** Normalize date strings to ISO (YYYY-MM-DD HH:MM:SS) for PostgreSQL */
function toTimestamp(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  // Already ISO-like (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, day, month, year, h = "0", m = "0", sec = "0"] = dmy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")} ${h.padStart(2, "0")}:${m.padStart(2, "0")}:${sec.padStart(2, "0")}`;
  }
  return s;
}

function slugify(str: string, maxLen = 30): string {
  if (!str || typeof str !== "string") return "unknown";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, maxLen) || "unknown";
}

function toVideoRow(raw: Record<string, unknown>): Record<string, unknown> | null {
  const clientId = String(raw.client_id ?? raw.clientId ?? "").trim();
  const channelName = String(raw.channel_name ?? raw.channelName ?? raw.channel ?? "").trim();
  const userName = String(raw.user_name ?? raw.userName ?? raw.user ?? "").trim();
  const videoId = raw.video_id ?? raw.videoId;

  if (!clientId || !channelName || !userName) return null;
  if (videoId === undefined || videoId === null || videoId === "") return null;

  const channelId = (raw.channel_id ?? raw.channelId ?? slugify(channelName)) as string;
  const userId = (raw.user_id ?? raw.userId ?? slugify(userName)) as string;

  const publishedFlag = raw.published_flag ?? raw.publishedFlag ?? raw.published ?? false;
  const published = ["true", "1", "yes", "y"].includes(String(publishedFlag).toLowerCase());

  return {
    video_id: Number(videoId) || videoId,
    client_id: clientId.slice(0, 20),
    channel_id: String(channelId).slice(0, 30),
    channel_name: channelName.slice(0, 100),
    user_id: String(userId).slice(0, 30),
    user_name: userName.slice(0, 100),
    input_type_id: raw.input_type_id ?? raw.inputTypeId ?? null,
    input_type_name: raw.input_type_name ?? raw.inputTypeName ?? null,
    output_type_id: raw.output_type_id ?? raw.outputTypeId ?? null,
    output_type_name: raw.output_type_name ?? raw.outputTypeName ?? null,
    language_id: raw.language_id ?? raw.languageId ?? null,
    language_name: raw.language_name ?? raw.languageName ?? null,
    duration: raw.duration != null && String(raw.duration).trim() ? String(raw.duration) : null,
    uploaded_at: toTimestamp(raw.uploaded_at ?? raw.uploadedAt),
    processed_at: toTimestamp(raw.processed_at ?? raw.processedAt),
    published_at: toTimestamp(raw.published_at ?? raw.publishedAt),
    published_flag: published,
    published_platform: raw.published_platform ?? raw.publishedPlatform ?? null,
    published_url: raw.published_url ?? raw.publishedUrl ?? null,
  };
}

// ── Duration SQL helpers (used in aggregation SELECTs) ───────────────────────

const DUR_SECS = `CASE
  WHEN v.duration IS NULL OR TRIM(COALESCE(v.duration::text, '')) = '' THEN 0
  ELSE COALESCE(EXTRACT(EPOCH FROM (v.duration::text::interval))::numeric, 0)
END`;

function durSum(filter: string): string {
  return `(FLOOR(COALESCE(SUM(${DUR_SECS}) FILTER (${filter}), 0))::bigint || ' seconds')::interval`;
}

// ── Summary table helpers ─────────────────────────────────────────────────────

/** Delete all rows from a summary table via Supabase client. */
async function clearTable(table: string): Promise<void> {
  // Summary tables always have non-null client_id (populated from videos).
  // .not('client_id', 'is', null) matches every real row.
  const { error } = await supabase.from(table).delete().not("client_id", "is", null);
  if (error) throw new Error(`clear ${table}: ${error.message}`);
}

/** Run a SELECT aggregation via exec_sql then bulk-insert results via Supabase client. */
async function selectAndInsert(table: string, selectSql: string): Promise<void> {
  const { rows } = await query<Record<string, unknown>>(selectSql);
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw new Error(`insert ${table}: ${error.message}`);
}

async function recomputeSummaryTables(): Promise<void> {
  const tables = [
    "channel_processing_summary",
    "channel_user_processing_summary",
    "user_processing_summary",
    "input_type_processing_summary",
    "output_type_processing_summary",
    "language_processing_summary",
    "monthly_processing_summary",
    "monthly_duration_summary",
    "channel_wise_publishing_counts",
    "channel_wise_publishing_duration",
  ];

  for (const table of tables) {
    try {
      await clearTable(table);
      await runAggregation(table);
    } catch {
      // Non-fatal: dashboard data may be stale but upload succeeded
    }
  }
}

async function runAggregation(table: string): Promise<void> {
  switch (table) {
    case "channel_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id, v.channel_id, v.channel_id AS channel_name,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded_count,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS created_count,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS published_count,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS uploaded_duration_hh_mm_ss,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS created_duration_hh_mm_ss,
               ${durSum("WHERE v.published_flag")} AS published_duration_hh_mm_ss
        FROM videos v
        GROUP BY v.client_id, v.channel_id
      `);
      break;

    case "channel_user_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id, v.channel_id, v.user_id,
               v.channel_id AS channel_name, COALESCE(u.user_name, v.user_id) AS user_name,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded_count,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS created_count,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS published_count,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS uploaded_duration_hh_mm_ss,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS created_duration_hh_mm_ss,
               ${durSum("WHERE v.published_flag")} AS published_duration_hh_mm_ss
        FROM videos v
        LEFT JOIN users u ON v.client_id = u.client_id AND v.user_id = u.user_id
        GROUP BY v.client_id, v.channel_id, v.user_id, COALESCE(u.user_name, v.user_id)
      `);
      break;

    case "user_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id, v.user_id, COALESCE(u.user_name, v.user_id) AS user_name,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded_count,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS created_count,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS published_count,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS uploaded_duration_hh_mm_ss,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS created_duration_hh_mm_ss,
               ${durSum("WHERE v.published_flag")} AS published_duration_hh_mm_ss
        FROM videos v
        LEFT JOIN users u ON v.client_id = u.client_id AND v.user_id = u.user_id
        GROUP BY v.client_id, v.user_id, COALESCE(u.user_name, v.user_id)
      `);
      break;

    case "input_type_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id, COALESCE(v.input_type_name, 'unknown') AS input_type,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded_count,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS created_count,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS published_count,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS uploaded_duration_hh_mm_ss,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS created_duration_hh_mm_ss,
               ${durSum("WHERE v.published_flag")} AS published_duration_hh_mm_ss
        FROM videos v
        GROUP BY v.client_id, COALESCE(v.input_type_name, 'unknown')
      `);
      break;

    case "output_type_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id, COALESCE(v.output_type_name, 'unknown') AS output_type,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded_count,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS created_count,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS published_count,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS uploaded_duration_hh_mm_ss,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS created_duration_hh_mm_ss,
               ${durSum("WHERE v.published_flag")} AS published_duration_hh_mm_ss
        FROM videos v
        GROUP BY v.client_id, COALESCE(v.output_type_name, 'unknown')
      `);
      break;

    case "language_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id, COALESCE(v.language_name, 'unknown') AS language,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS uploaded_count,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS created_count,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS published_count,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS uploaded_duration_hh_mm_ss,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS created_duration_hh_mm_ss,
               ${durSum("WHERE v.published_flag")} AS published_duration_hh_mm_ss
        FROM videos v
        GROUP BY v.client_id, COALESCE(v.language_name, 'unknown')
      `);
      break;

    case "monthly_processing_summary":
      await selectAndInsert(table, `
        SELECT v.client_id,
               TO_CHAR(COALESCE(v.uploaded_at, v.published_at, v.processed_at, NOW()), 'YYYY-MM') AS month,
               COUNT(*) FILTER (WHERE v.uploaded_at IS NOT NULL)::int AS total_uploaded,
               COUNT(*) FILTER (WHERE v.processed_at IS NOT NULL)::int AS total_created,
               COUNT(*) FILTER (WHERE v.published_flag)::int AS total_published
        FROM videos v
        GROUP BY v.client_id, TO_CHAR(COALESCE(v.uploaded_at, v.published_at, v.processed_at, NOW()), 'YYYY-MM')
      `);
      break;

    case "monthly_duration_summary":
      await selectAndInsert(table, `
        SELECT v.client_id,
               TO_CHAR(COALESCE(v.uploaded_at, v.published_at, v.processed_at, NOW()), 'YYYY-MM') AS month,
               ${durSum("WHERE v.uploaded_at IS NOT NULL")} AS total_uploaded_duration,
               ${durSum("WHERE v.processed_at IS NOT NULL")} AS total_created_duration,
               ${durSum("WHERE v.published_flag")} AS total_published_duration
        FROM videos v
        GROUP BY v.client_id, TO_CHAR(COALESCE(v.uploaded_at, v.published_at, v.processed_at, NOW()), 'YYYY-MM')
      `);
      break;

    case "channel_wise_publishing_counts":
      await selectAndInsert(table, `
        SELECT v.client_id, v.channel_id, v.channel_id AS channel_name,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'facebook')::int AS facebook_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'instagram')::int AS instagram_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'linkedin')::int AS linkedin_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'reels')::int AS reels_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'shorts')::int AS shorts_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) IN ('x', 'twitter'))::int AS x_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'youtube')::int AS youtube_count,
               COUNT(*) FILTER (WHERE LOWER(v.published_platform::text) = 'threads')::int AS threads_count
        FROM videos v
        WHERE v.published_flag
        GROUP BY v.client_id, v.channel_id
      `);
      break;

    case "channel_wise_publishing_duration": {
      const platDur = (plat: string) =>
        `(FLOOR(COALESCE(SUM(${DUR_SECS}) FILTER (WHERE v.published_flag AND LOWER(v.published_platform::text) = '${plat}'), 0))::bigint || ' seconds')::interval`;
      await selectAndInsert(table, `
        SELECT v.client_id, v.channel_id, v.channel_id AS channel_name,
               ${platDur("facebook")} AS facebook_duration,
               ${platDur("instagram")} AS instagram_duration,
               ${platDur("linkedin")} AS linkedin_duration,
               ${platDur("reels")} AS reels_duration,
               ${platDur("shorts")} AS shorts_duration,
               (FLOOR(COALESCE(SUM(${DUR_SECS}) FILTER (WHERE v.published_flag AND LOWER(v.published_platform::text) IN ('x', 'twitter')), 0))::bigint || ' seconds')::interval AS x_duration,
               ${platDur("youtube")} AS youtube_duration,
               ${platDur("threads")} AS threads_duration
        FROM videos v
        WHERE v.published_flag
        GROUP BY v.client_id, v.channel_id
      `);
      break;
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function ingestRows(
  rows: Record<string, unknown>[]
): Promise<{ rawInserted: number; videosInserted: number; errors: string[] }> {
  const errors: string[] = [];
  let rawInserted = 0;
  let videosInserted = 0;

  // 1. Insert raw rows into raw_uploads (full row as JSONB)
  for (const row of rows) {
    const clientId = (row.client_id ?? row.clientId ?? null) as string | null;
    const { error } = await supabase.from("raw_uploads").insert({
      client_id: clientId ? String(clientId).slice(0, 20) : null,
      data: row,
    });
    if (error) {
      errors.push(`raw_uploads: ${error.message}`);
    } else {
      rawInserted++;
    }
  }

  // 2. Map to video rows
  const videoRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    const mapped = toVideoRow(row);
    if (mapped) videoRows.push(mapped);
  }

  if (videoRows.length === 0) {
    return { rawInserted, videosInserted, errors };
  }

  // 3. Upsert clients
  const clientIds = [...new Set(videoRows.map((r) => r.client_id as string))];
  for (const cid of clientIds) {
    await supabase
      .from("clients")
      .upsert({ client_id: cid }, { onConflict: "client_id", ignoreDuplicates: true });
  }

  // 3b. Upsert channels — videos FK references channels(client_id, channel_id)
  const channelKeys = new Set<string>();
  for (const r of videoRows) {
    const key = `${r.client_id}|${r.channel_id}`;
    if (!channelKeys.has(key)) {
      channelKeys.add(key);
      await supabase
        .from("channels")
        .upsert(
          { client_id: r.client_id, channel_id: r.channel_id, channel_name: (r.channel_name as string) || r.channel_id },
          { onConflict: "client_id,channel_id", ignoreDuplicates: true }
        );
    }
  }

  // 4. Upsert users
  const userKeys = new Set<string>();
  for (const r of videoRows) {
    const key = `${r.client_id}|${r.user_id}`;
    if (!userKeys.has(key)) {
      userKeys.add(key);
      await supabase.from("users").upsert(
        { client_id: r.client_id, user_id: r.user_id, user_name: r.user_name ?? r.user_id },
        { onConflict: "client_id,user_id" }
      );
    }
  }

  // 5. Upsert videos
  for (const r of videoRows) {
    const { error } = await supabase.from("videos").upsert(
      {
        video_id: r.video_id,
        client_id: r.client_id,
        channel_id: r.channel_id,
        user_id: r.user_id,
        input_type_id: r.input_type_id ?? null,
        input_type_name: r.input_type_name ?? null,
        output_type_id: r.output_type_id ?? null,
        output_type_name: r.output_type_name ?? null,
        language_id: r.language_id ?? null,
        language_name: r.language_name ?? null,
        duration: r.duration ?? null,
        uploaded_at: r.uploaded_at ?? null,
        processed_at: r.processed_at ?? null,
        published_at: r.published_at ?? null,
        published_flag: r.published_flag ?? false,
        published_platform: r.published_platform ?? null,
        published_url: r.published_url ?? null,
      },
      { onConflict: "video_id" }
    );
    if (error) {
      errors.push(`videos: ${error.message}`);
    } else {
      videosInserted++;
    }
  }

  // 6. Rebuild summary tables (non-fatal if aggregation fails)
  if (videosInserted > 0) {
    await recomputeSummaryTables();
  }

  return { rawInserted, videosInserted, errors };
}
