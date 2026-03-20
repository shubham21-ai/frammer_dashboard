/**
 * Sync dashboard data into RAG vector store
 * Builds text chunks from DB summaries and embeds them
 */

import { query } from "@/lib/db";
import { embedText } from "./rag-embeddings";
import { insertChunk, ensureRagTable, clearAllChunks } from "./rag-store";

export type SyncResult = {
  chunksCreated: number;
  errors: string[];
};

export async function syncRagStore(apiKey: string): Promise<SyncResult> {
  const errors: string[] = [];
  let chunksCreated = 0;

  await ensureRagTable();
  await clearAllChunks();

  const chunks: { source: string; type: string; content: string }[] = [];

  try {
    // 1. Schema / table descriptions (static knowledge)
    chunks.push({
      source: "schema",
      type: "schema",
      content: `Database schema for analytics: videos (video_id, client_id, channel_id, user_id, input_type_name, output_type_name, language_name, uploaded_at, processed_at, published_at, published_flag, published_platform, published_url). Summary tables: monthly_processing_summary (client_id, month, total_uploaded, total_created, total_published), monthly_duration_summary (client_id, month, total_uploaded_duration, total_created_duration, total_published_duration), channel_processing_summary, user_processing_summary, input_type_processing_summary, output_type_processing_summary, language_processing_summary, channel_wise_publishing_counts, channel_wise_publishing_duration.`,
    });

    // 2. KPI definitions
    chunks.push({
      source: "kpi",
      type: "definition",
      content: "Total Uploaded Volume: Raw amount of long-form and live content entering the system. Count and uploaded hours summed across all clients from monthly_processing_summary and monthly_duration_summary.",
    });

    // 3. Monthly aggregates
    const monthlyRes = await query<{ month: string; total_uploaded: string; total_created: string; total_published: string }>(
      `SELECT month, SUM(total_uploaded)::text AS total_uploaded, SUM(total_created)::text AS total_created, SUM(total_published)::text AS total_published
       FROM monthly_processing_summary GROUP BY month ORDER BY month DESC LIMIT 24`
    );
    if (monthlyRes.rows.length > 0) {
      const summary = monthlyRes.rows
        .map((r) => `${r.month}: uploaded ${r.total_uploaded}, processed ${r.total_created}, published ${r.total_published}`)
        .join("; ");
      chunks.push({
        source: "monthly",
        type: "summary",
        content: `Monthly processing totals (uploaded, processed, published): ${summary}`,
      });
    }

    // 4. Client breakdown
    const clientRes = await query<{ client_id: string; uploaded: string; created: string; published: string }>(
      `SELECT client_id, SUM(uploaded_count)::text AS uploaded, SUM(created_count)::text AS created, SUM(published_count)::text AS published
       FROM channel_processing_summary GROUP BY client_id ORDER BY SUM(published_count) DESC LIMIT 20`
    );
    if (clientRes.rows.length > 0) {
      const clientSummary = clientRes.rows
        .map((r) => `${r.client_id}: uploaded ${r.uploaded}, processed ${r.created}, published ${r.published}`)
        .join("; ");
      chunks.push({
        source: "clients",
        type: "summary",
        content: `Client processing summary (top by published): ${clientSummary}`,
      });
    }

    // 5. Channel leaders
    const channelRes = await query<{ channel_name: string; client_id: string; published: string }>(
      `SELECT channel_name, client_id, SUM(published_count)::text AS published
       FROM channel_processing_summary GROUP BY channel_name, client_id ORDER BY SUM(published_count) DESC LIMIT 15`
    );
    if (channelRes.rows.length > 0) {
      const channelSummary = channelRes.rows
        .map((r) => `${r.channel_name} (${r.client_id}): ${r.published} published`)
        .join("; ");
      chunks.push({
        source: "channels",
        type: "summary",
        content: `Top channels by published count: ${channelSummary}`,
      });
    }

    // 6. Platform distribution (simplified)
    try {
      const platformRes = await query<{ platform: string; hours: string }>(
        `WITH unpiv AS (
          SELECT 'YouTube' AS platform, SUM(CASE WHEN youtube_duration IS NOT NULL AND TRIM(COALESCE(youtube_duration::text,'')) != ''
            THEN EXTRACT(EPOCH FROM (youtube_duration::text::interval)) ELSE 0 END)/3600 AS hrs FROM channel_wise_publishing_duration
          UNION ALL SELECT 'Instagram', SUM(CASE WHEN instagram_duration IS NOT NULL AND TRIM(COALESCE(instagram_duration::text,'')) != ''
            THEN EXTRACT(EPOCH FROM (instagram_duration::text::interval)) ELSE 0 END)/3600 FROM channel_wise_publishing_duration
          UNION ALL SELECT 'X', SUM(CASE WHEN x_duration IS NOT NULL AND TRIM(COALESCE(x_duration::text,'')) != ''
            THEN EXTRACT(EPOCH FROM (x_duration::text::interval)) ELSE 0 END)/3600 FROM channel_wise_publishing_duration
        ) SELECT platform, ROUND(hrs::numeric, 1)::text AS hours FROM unpiv WHERE hrs > 0`
      );
      if (platformRes.rows.length > 0) {
        const platformSummary = platformRes.rows
          .map((r) => `${r.platform}: ${r.hours}h`)
          .join("; ");
        chunks.push({
          source: "platforms",
          type: "summary",
          content: `Published duration by platform (hours): ${platformSummary}`,
        });
      }
    } catch {
      /* skip platforms if table/columns differ */
    }

    // 7. Output types
    const outputRes = await query<{ output_type: string; created: string; published: string }>(
      `SELECT output_type, SUM(created_count)::text AS created, SUM(published_count)::text AS published
       FROM output_type_processing_summary GROUP BY output_type ORDER BY SUM(published_count) DESC LIMIT 10`
    );
    if (outputRes.rows.length > 0) {
      const outputSummary = (outputRes.rows as { output_type: string; created: string; published: string }[])
        .map((r) => `${r.output_type}: created ${r.created}, published ${r.published}`)
        .join("; ");
      chunks.push({
        source: "output_types",
        type: "summary",
        content: `Output type usage (created, published): ${outputSummary}`,
      });
    }

    // Embed and insert each chunk
    for (const chunk of chunks) {
      try {
        const embedding = await embedText(chunk.content, apiKey);
        await insertChunk(chunk.source, chunk.type, chunk.content, embedding, {
          source: chunk.source,
          type: chunk.type,
        });
        chunksCreated++;
      } catch (e) {
        errors.push(`${chunk.source}/${chunk.type}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { chunksCreated, errors };
}
