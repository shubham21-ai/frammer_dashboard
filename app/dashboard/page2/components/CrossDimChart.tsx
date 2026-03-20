"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DefinitionButton } from "@/components/ui/DefinitionButton";
import { InsightButton } from "@/components/ui/InsightButton";

// ── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = [
  "#e9434a", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

// Map from Page2Dashboard DimensionKey → API param name
const DIM_API: Record<string, string> = {
  channel:    "channel",
  client:     "client",
  user:       "user",
  inputType:  "input_type",
  outputType: "output_type",
  language:   "language",
};

// Duration metrics fall back to their count equivalent in the cross-breakdown API
// (raw `duration` column type in videos table is ambiguous; counts are reliable)
const METRIC_API: Record<string, string> = {
  uploaded_count:   "uploaded_count",
  processed_count:  "processed_count",
  published_count:  "published_count",
  uploaded_duration:  "uploaded_count",
  processed_duration: "processed_count",
  published_duration: "published_count",
};

const METRIC_LABEL: Record<string, string> = {
  uploaded_count:   "Uploaded (count)",
  processed_count:  "Processed (count)",
  published_count:  "Published (count)",
  uploaded_duration:  "Uploaded (count)*",
  processed_duration: "Processed (count)*",
  published_duration: "Published (count)*",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrossRow {
  dim1Val: string;
  [key: string]: string | number;
}

interface CrossData {
  chartData: CrossRow[];
  dim2Keys: string[];
  totalDim1Distinct: number;
  totalDim2Distinct: number;
}

interface CrossDimChartProps {
  dim1: string;       // DimensionKey from Page2Dashboard
  dim2: string;
  dim1Label: string;
  dim2Label: string;
  metric: string;     // MetricKey
  chartMode: "stacked" | "grouped";
  selectedClient: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CrossDimChart({
  dim1,
  dim2,
  dim1Label,
  dim2Label,
  metric,
  chartMode,
  selectedClient,
}: CrossDimChartProps) {
  const [data, setData] = useState<CrossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDim1, setSelectedDim1] = useState<string | null>(null);

  const isDurationMetric = metric.includes("_duration");

  useEffect(() => {
    const apiDim1   = DIM_API[dim1]   ?? dim1;
    const apiDim2   = DIM_API[dim2]   ?? dim2;
    const apiMetric = METRIC_API[metric] ?? "processed_count";

    const params = new URLSearchParams({ dim1: apiDim1, dim2: apiDim2, metric: apiMetric });
    if (selectedClient !== "All Clients") params.set("client", selectedClient);

    setLoading(true);
    setError(null);
    setSelectedDim1(null);

    fetch(`/api/cross-breakdown?${params.toString()}`)
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error((d as { error?: string }).error ?? "Server error")));
        return r.json() as Promise<CrossData>;
      })
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [dim1, dim2, metric, selectedClient]);

  const title = `${dim1Label} × ${dim2Label}`;
  const metricLabel = METRIC_LABEL[metric] ?? metric;
  const stacked = chartMode === "stacked";

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 truncate">
            {title}
          </h4>
          <div className="flex items-center gap-1 shrink-0">
            <DefinitionButton
              definition={`Real cross-dimensional breakdown from the database: for each ${dim1Label}, the actual split by ${dim2Label} (${metricLabel}). Top 10 ${dim1Label.toLowerCase()}s × top 6 ${dim2Label.toLowerCase()}s by volume. No synthetic approximations — all values come from live GROUP BY queries.`}
            />
            <InsightButton page="page2" widget="cross_dim_chart" title={`${title} insight`} />
          </div>
        </div>
        {data && data.totalDim1Distinct > 10 && (
          <span className="text-[9px] text-gray-400 shrink-0">
            top 10 of {data.totalDim1Distinct}
          </span>
        )}
      </div>

      {/* Duration fallback notice */}
      {isDurationMetric && (
        <p className="text-[9px] text-amber-500 bg-amber-50 rounded px-2 py-1">
          * Duration breakdown uses video count (cross-dimension hours require raw duration column — use Page 3 heatmap for hours)
        </p>
      )}

      {/* Chart area */}
      {loading ? (
        <div className="h-[220px] flex items-center justify-center gap-2">
          <div className="h-4 w-4 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
          <span className="text-[10px] text-gray-400">Loading…</span>
        </div>
      ) : error ? (
        <div className="h-[220px] flex items-center justify-center">
          <p className="text-xs text-red-400">Error: {error}</p>
        </div>
      ) : !data || data.chartData.length === 0 ? (
        <div className="h-[220px] flex items-center justify-center">
          <p className="text-xs text-gray-400">No data for this combination</p>
        </div>
      ) : (
        <>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.chartData}
                margin={{ top: 4, right: 8, left: 0, bottom: 36 }}
                onClick={(chartData) => {
                  const dim1Val = chartData?.activeLabel as string | undefined;
                  if (dim1Val) setSelectedDim1(prev => prev === dim1Val ? null : dim1Val);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="dim1Val"
                  tick={{ fontSize: 8, fill: "#94a3b8" }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    fontSize: 10,
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#fff",
                  }}
                  labelStyle={{ fontWeight: "bold", color: "#1e293b", marginBottom: 4 }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
                {data.dim2Keys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId={stacked ? "s" : undefined}
                    fill={PALETTE[i % PALETTE.length]}
                    radius={stacked ? undefined : [3, 3, 0, 0]}
                    maxBarSize={stacked ? 60 : 32}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {(data.totalDim1Distinct > 10 || data.totalDim2Distinct > 6) && (
            <p className="text-[9px] text-gray-300 text-center">
              Showing top 10 {dim1Label.toLowerCase()}s × top 6 {dim2Label.toLowerCase()}s
              {data.totalDim1Distinct > 10 ? ` (${data.totalDim1Distinct} total ${dim1Label.toLowerCase()}s)` : ""}
            </p>
          )}

          {selectedDim1 && data && (() => {
            const row = data.chartData.find(r => r.dim1Val === selectedDim1);
            if (!row) return null;
            const total = data.dim2Keys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
            return (
              <div className="rounded-lg border border-gray-200 bg-white p-3 mt-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Drill-down</p>
                    <p className="text-xs font-semibold text-gray-800">{selectedDim1}</p>
                    <p className="text-[9px] text-gray-400">Total: {total.toLocaleString()} {metricLabel}</p>
                  </div>
                  <button onClick={() => setSelectedDim1(null)} className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-0.5">Close</button>
                </div>
                <div className="space-y-1">
                  {data.dim2Keys.map((key, i) => {
                    const val = Number(row[key]) || 0;
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <span className="text-[9px] text-gray-600 w-24 truncate">{key}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} />
                        </div>
                        <span className="text-[9px] font-mono text-gray-600 w-16 text-right">{val.toLocaleString()} ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
