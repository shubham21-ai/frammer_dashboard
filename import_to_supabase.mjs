import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://ynyggcmnuimyajvorttm.supabase.co";
const SUPABASE_KEY = "sb_publishable_kRKTzqTyEtt3xTetyaFNBQ_o_CB1k2R";
const CSV_DIR = join(__dirname, "files (1)");

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Date normaliser: handles DD-MM-YYYY HH:MM  →  YYYY-MM-DD HH:MM:SS ──────
function normaliseDate(val) {
  if (!val) return null;
  // Already ISO: YYYY-MM-DD...
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val;
  // DD-MM-YYYY HH:MM or DD-MM-YYYY HH:MM:SS
  const m = val.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const [, dd, mm, yyyy, hh, min, ss = "00"] = m;
    return `${yyyy}-${mm}-${dd} ${hh.padStart(2,"0")}:${min}:${ss}`;
  }
  return val;
}

// ── Simple CSV parser (handles quoted fields) ─────────────────────────────
function parseCSV(filename) {
  const text = readFileSync(join(CSV_DIR, filename), "utf-8");
  const lines = text.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { values.push(cur); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, i) => {
      const v = (values[i] ?? "").trim();
      obj[h] = v === "" ? null : v;
    });
    return obj;
  });
}

// ── Type coercion per column ──────────────────────────────────────────────
const INT_COLS = new Set([
  "uploaded_count","created_count","published_count",
  "total_uploaded","total_created","total_published",
  "facebook_count","instagram_count","linkedin_count",
  "reels_count","shorts_count","x_count","youtube_count","threads_count","video_id",
]);
const DATE_COLS = new Set(["uploaded_at","processed_at","published_at"]);
const BOOL_COLS = new Set(["published_flag"]);

const NOT_NULL_STR_COLS = new Set(["user_name", "user_id", "channel_name", "client_id"]);

function coerceRow(row) {
  const r = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null) {
      // Replace null for columns that have NOT NULL constraint
      r[k] = NOT_NULL_STR_COLS.has(k) ? "" : null;
      continue;
    }
    if (INT_COLS.has(k))  { r[k] = parseInt(v) || 0; continue; }
    if (DATE_COLS.has(k)) { r[k] = normaliseDate(v); continue; }
    if (BOOL_COLS.has(k)) { r[k] = (v === "true" || v === "True" || v === "TRUE" || v === "1"); continue; }
    r[k] = v;
  }
  return r;
}

// ── Delete all rows from a table ──────────────────────────────────────────
async function clearTable(table) {
  // Try different columns that might exist to use as filter
  for (const col of ["video_id","client_id","created_at"]) {
    const { error } = await supabase.from(table).delete().not(col, "is", null);
    if (!error) return true;
  }
  // Last resort: delete where created_at exists (Supabase adds this by default)
  const { error } = await supabase.from(table).delete().gte("created_at","2000-01-01");
  return !error;
}

// ── Insert in batches ─────────────────────────────────────────────────────
async function insertBatches(table, rows, batchSize = 400) {
  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(error.message);
    done += chunk.length;
    process.stdout.write(`\r   Inserted ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
}

// ── Import one table ──────────────────────────────────────────────────────
async function importTable(table, filename, skipCols = [], dedupKey = null) {
  console.log(`\n📥  ${table}`);
  const raw = parseCSV(filename);
  let rows = raw.map((r) => {
    const cleaned = {};
    for (const [k, v] of Object.entries(r)) {
      if (!skipCols.includes(k)) cleaned[k] = v;
    }
    return coerceRow(cleaned);
  });

  // Deduplicate by key if specified
  if (dedupKey) {
    const seen = new Set();
    const before = rows.length;
    rows = rows.filter((r) => {
      const k = r[dedupKey];
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (rows.length < before) console.log(`   Deduplicated ${before - rows.length} duplicate ${dedupKey}s`);
  }

  process.stdout.write("   Clearing existing rows… ");
  const cleared = await clearTable(table);
  console.log(cleared ? "✓" : "⚠ could not clear (will insert over)");

  await insertBatches(table, rows);
  console.log(`   ✅ ${rows.length} rows imported`);
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀  Supabase CSV Import\n");

  // Create users table if missing (requires exec_sql to be set up)
  const { error: rpcErr } = await supabase.rpc("exec_sql", {
    query: `CREATE TABLE IF NOT EXISTS users (
      client_id TEXT, user_name TEXT, user_id TEXT,
      PRIMARY KEY (client_id, user_id)
    )`
  });
  if (rpcErr) console.log("ℹ  exec_sql not available yet — skipping users table DDL");

  const tables = [
    ["monthly_processing_summary",      "Data_Analytics_Extended_-_monthly_processing_summary.csv",      []],
    ["monthly_duration_summary",         "Data_Analytics_Extended_-_monthly_duration_summary.csv",         []],
    ["channel_processing_summary",       "Data_Analytics_Extended_-_channel_processing_summary.csv",       []],
    ["channel_user_processing_summary",  "Data_Analytics_Extended_-_channel_user_processing_summary.csv",  []],
    ["channel_wise_publishing_counts",   "Data_Analytics_Extended_-_channel_wise_publishing_counts.csv",   []],
    ["channel_wise_publishing_duration", "Data_Analytics_Extended_-_channel_wise_publishing_duration.csv", []],
    ["input_type_processing_summary",    "Data_Analytics_Extended_-_input_type_processing_summary.csv",    []],
    ["language_processing_summary",      "Data_Analytics_Extended_-_language_processing_summary.csv",      []],
    ["output_type_processing_summary",   "Data_Analytics_Extended_-_output_type_processing_summary.csv",   []],
    ["user_processing_summary",          "Data_Analytics_Extended_-_user_processing_summary.csv",          []],
    ["users",                            "Data_Analytics_Extended_-_user_ids.csv",                         []],
    ["videos",                           "Data_Analytics_Extended_-_videos.csv",                           ["user_name"], "video_id"],
  ];

  for (const [table, file, skip, dedup] of tables) {
    try {
      await importTable(table, file, skip, dedup ?? null);
    } catch (err) {
      console.error(`\n   ❌ ${table}: ${err.message}`);
    }
  }

  console.log("\n🎉  Import complete!");
}

main().catch(console.error);
