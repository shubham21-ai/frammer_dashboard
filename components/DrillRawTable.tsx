"use client";

import { useState, useEffect } from "react";

interface RawVideo {
  video_id: number;
  client_id: string;
  channel_name: string;
  user_name: string;
  input_type_name: string;
  output_type_name: string;
  language_name: string;
  published_platform: string;
  published_flag: boolean;
  uploaded_at: string;
  duration: string;
}

interface DrillRawTableProps {
  filters: {
    client_id?: string;
    channel_name?: string;
    month?: string;
    language?: string;
    output_type?: string;
    input_type?: string;
    platform?: string;
  };
  title?: string;
  onClose?: () => void;
}

export default function DrillRawTable({ filters, title, onClose }: DrillRawTableProps) {
  const [data, setData] = useState<{ videos: RawVideo[]; total: number; summary: { uploaded: number; processed: number; published: number } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (filters.client_id) params.set("client_id", filters.client_id);
    if (filters.channel_name) params.set("channel_name", filters.channel_name);
    if (filters.month) params.set("month", filters.month);
    if (filters.language) params.set("language", filters.language);
    if (filters.output_type) params.set("output_type", filters.output_type);
    if (filters.input_type) params.set("input_type", filters.input_type);
    if (filters.platform) params.set("platform", filters.platform);

    fetch(`/api/drilldown?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const publishRate = data && data.summary.processed > 0
    ? Math.round((data.summary.published / data.summary.processed) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/20 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold text-gray-800">{title ?? "Raw Video Records"}</p>
          {data && (
            <p className="text-[9px] text-gray-400">
              {data.total.toLocaleString()} matching records — showing {data.videos.length}
            </p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 shrink-0"
          >
            Close ✕
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
          <span className="text-[10px] text-gray-400">Loading records...</span>
        </div>
      ) : error ? (
        <p className="text-center text-[10px] text-red-500 py-6">Failed to load records</p>
      ) : !data || data.videos.length === 0 ? (
        <p className="text-center text-[10px] text-gray-400 py-6">No matching records found</p>
      ) : (
        <>
          {/* Summary bar */}
          <div className="px-3 py-2 flex gap-4 text-[10px] border-b border-gray-100 bg-gray-50/50">
            <span>
              Uploaded: <strong className="text-gray-700">{data.summary.uploaded.toLocaleString()}</strong>
            </span>
            <span>
              Processed: <strong className="text-red-600">{data.summary.processed.toLocaleString()}</strong>
            </span>
            <span>
              Published: <strong className="text-emerald-600">{data.summary.published.toLocaleString()}</strong>
            </span>
            <span className="ml-auto">
              Pub rate:{" "}
              <strong className={publishRate >= 50 ? "text-emerald-600" : "text-rose-500"}>{publishRate}%</strong>
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Input</th>
                  <th className="px-3 py-2">Output</th>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.videos.map((v, i) => (
                  <tr key={v.video_id ?? i} className="hover:bg-red-50/20 transition-colors">
                    <td className="px-3 py-1.5 text-[10px] font-mono text-gray-500">{v.video_id}</td>
                    <td className="px-3 py-1.5 text-[10px] font-medium text-gray-800">{v.client_id || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-gray-600">{v.channel_name || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-gray-600">{v.user_name || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-blue-600">{v.input_type_name || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-red-600 font-medium">{v.output_type_name || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-gray-600">{v.language_name || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-gray-600">{v.published_platform || "—"}</td>
                    <td className="px-3 py-1.5 text-[10px] text-gray-400">
                      {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${v.published_flag ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {v.published_flag ? "Published" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.total > data.videos.length && (
            <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-400 bg-gray-50/30">
              Showing top {data.videos.length} of {data.total.toLocaleString()} records
            </div>
          )}
        </>
      )}
    </div>
  );
}
