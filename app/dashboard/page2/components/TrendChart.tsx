"use client";

import "@/app/dashboard/page2/components/ChartSetup";
import { DefinitionButton } from "@/components/ui/DefinitionButton";
import { InsightButton } from "@/components/ui/InsightButton";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { CHART_FONT } from "./ChartSetup";
import type { TrendItem, MonthlyByClientItem } from "./types";
import { useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TrendChartProps {
  data: TrendItem[];
  monthlyByClient: MonthlyByClientItem[];
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function formatMonth(ym: string): string {
  const [y, m] = String(ym).split("-");
  const idx = parseInt(m || "1", 10) - 1;
  return `${MONTH_NAMES[idx] ?? m}, ${y ?? ""}`;
}

const lineConfigs = [
  { label: "Uploaded", key: "uploaded" as const, color: "#e9434a" },
  { label: "Processed", key: "processed" as const, color: "#f59e0b" },
  { label: "Published", key: "published" as const, color: "#10b981" },
];

export default function TrendChart({ data, monthlyByClient }: TrendChartProps) {
  const [visibleLines, setVisibleLines] = useState(
    () => new Array(lineConfigs.length).fill(true) as boolean[]
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [drillClient, setDrillClient] = useState<string | null>(null);

  const drillDownRows = useMemo(() => {
    if (!selectedMonth) return [];
    return monthlyByClient
      .filter((r) => r.month === selectedMonth)
      .sort((a, b) => b.processed - a.processed);
  }, [selectedMonth, monthlyByClient]);

  // Empty state — after all hooks
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Uploaded vs Processed vs Published Over Time
        </h4>
        <div className="h-[170px] flex items-center justify-center">
          <p className="text-xs text-gray-400">No data for the selected period</p>
        </div>
      </div>
    );
  }

  const labels = data.map((d) => d.month);

  const datasets = lineConfigs.map((cfg, i) => ({
    label: cfg.label,
    data: data.map((d) => d[cfg.key]),
    borderColor: cfg.color,
    backgroundColor: cfg.color + "15",
    fill: true,
    tension: 0.4,
    borderWidth: 2.5,
    pointRadius: 4,
    pointBackgroundColor: cfg.color,
    pointBorderColor: "#fff",
    pointBorderWidth: 2,
    pointHoverRadius: 6,
    hidden: !visibleLines[i],
  }));

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    onClick: (_event, elements) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        const month = data[idx]?.month ?? null;
        setSelectedMonth((prev) => (prev === month ? null : month));
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#94a3b8", font: CHART_FONT },
      },
      y: {
        grid: { color: "#f1f5f9" },
        border: { display: false },
        ticks: { color: "#94a3b8", font: CHART_FONT },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#fff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        titleColor: "#1e293b",
        bodyColor: "#64748b",
        titleFont: { ...CHART_FONT, size: 12, weight: "bold" },
        bodyFont: CHART_FONT,
        padding: 12,
        cornerRadius: 10,
      },
    },
    animation: { duration: 350 },
    onHover: (event, elements) => {
      const el = event.native?.target as HTMLElement | undefined;
      if (el) el.style.cursor = elements.length > 0 ? "pointer" : "default";
    },
  };

  function toggleLine(idx: number) {
    setVisibleLines((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Uploaded vs Processed vs Published Over Time
        </h4>
        <div className="flex items-center gap-1">
          <DefinitionButton definition="Monthly trend of uploaded, processed (created), and published counts. Click any month or data point to drill down into client-wise breakdown for that month." />
          <InsightButton page="page2" widget="trend_chart" title="Trend Chart insight" />
        </div>
      </div>
      <div className="flex gap-2 mb-3 flex-wrap">
        {lineConfigs.map((cfg, i) => (
          <label
            key={cfg.label}
            className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md border cursor-pointer transition-all ${
              visibleLines[i]
                ? "border-gray-200 bg-white text-gray-700"
                : "border-gray-100 bg-gray-50 text-gray-300"
            }`}
          >
            <input
              type="checkbox"
              checked={visibleLines[i]}
              onChange={() => toggleLine(i)}
              className="h-3 w-3 rounded accent-red-500"
            />
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: cfg.color }}
            />
            {cfg.label}
          </label>
        ))}
      </div>
      <p className="text-[10px] text-gray-400 mb-2">
        Click a month or data point to see client-wise breakdown
      </p>
      <div className="h-[170px] sm:h-[200px]">
        <Line data={{ labels, datasets }} options={options} />
      </div>

      {selectedMonth && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 overflow-y-auto max-h-[420px]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                {formatMonth(selectedMonth)} — Client Breakdown
              </h5>
              {drillClient && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  → <span className="font-semibold text-gray-700">{drillClient}</span> selected — click a month to see raw records
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {drillClient && (
                <button
                  type="button"
                  onClick={() => setDrillClient(null)}
                  className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                onClick={() => { setSelectedMonth(null); setDrillClient(null); }}
                className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
              >
                Close
              </button>
            </div>
          </div>

          {drillDownRows.length === 0 ? (
            <p className="text-xs text-gray-400 py-4">No client data for this month.</p>
          ) : drillClient ? (
            /* ── L3: Selected client's full monthly arc ── */
            (() => {
              const clientMonths = monthlyByClient
                .filter((r) => r.client_id === drillClient)
                .sort((a, b) => String(a.month).localeCompare(String(b.month)));
              const total = clientMonths.reduce((s, r) => s + r.uploaded, 0);
              const avgUploaded = clientMonths.length > 0 ? total / clientMonths.length : 0;
              return (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    {["uploaded", "processed", "published"].map((k) => {
                      const sum = clientMonths.reduce((s, r) => s + (r[k as keyof typeof r] as number), 0);
                      return (
                        <div key={k} className={`rounded border px-2 py-1.5 text-center ${k === "uploaded" ? "border-gray-100 bg-gray-50" : k === "processed" ? "border-red-100 bg-red-50/50" : "border-emerald-100 bg-emerald-50/50"}`}>
                          <p className="text-[9px] text-gray-400 uppercase">{k}</p>
                          <p className={`text-sm font-black ${k === "uploaded" ? "text-gray-800" : k === "processed" ? "text-red-600" : "text-emerald-600"}`}>{sum.toLocaleString()}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Monthly arc for {drillClient}</p>
                  <div className="space-y-1">
                    {clientMonths.map((r) => (
                      <div key={r.month} className="flex items-center gap-2">
                        <span className="w-14 text-[9px] text-gray-500">{formatMonth(r.month)}</span>
                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${avgUploaded > 0 ? Math.min((r.uploaded / (avgUploaded * 2)) * 100, 100) : 0}%` }} />
                        </div>
                        <span className="w-20 text-right text-[9px] text-gray-600 font-mono">↑{r.uploaded} P{r.processed} Pub{r.published}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            /* ── L2: Client bar chart ── */
            <>
              <p className="text-[9px] text-gray-400 mb-2">Click a client bar to drill deeper →</p>
              <div className="h-[180px]">
                <Bar
                  data={{
                    labels: drillDownRows.map((r) => r.client_id),
                    datasets: [
                      { label: "Uploaded", data: drillDownRows.map((r) => r.uploaded), backgroundColor: "#e9434a", borderRadius: 4 },
                      { label: "Processed", data: drillDownRows.map((r) => r.processed), backgroundColor: "#f59e0b", borderRadius: 4 },
                      { label: "Published", data: drillDownRows.map((r) => r.published), backgroundColor: "#10b981", borderRadius: 4 },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (_e, elements, chart) => {
                      if (elements.length === 0) return;
                      const label = chart.data.labels?.[elements[0].index];
                      if (label) setDrillClient(String(label));
                    },
                    plugins: {
                      legend: { position: "top" as const },
                      tooltip: { callbacks: { title: (items) => items[0]?.label ?? "" } },
                    },
                    scales: {
                      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
                      y: { grid: { color: "#f1f5f9" }, ticks: { font: { size: 10 } } },
                    },
                  }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                {drillDownRows.map((r) => (
                  <button
                    key={r.client_id}
                    type="button"
                    onClick={() => setDrillClient(r.client_id)}
                    className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-100 hover:border-red-200 hover:bg-red-50 transition-colors text-left"
                  >
                    <span className="font-semibold text-gray-700">{r.client_id}</span>
                    <span className="text-gray-400 ml-1.5">
                      ↑{r.uploaded.toLocaleString()} · P{r.processed.toLocaleString()} · Pub{r.published.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
