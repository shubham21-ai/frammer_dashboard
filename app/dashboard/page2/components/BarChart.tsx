"use client";

import "@/app/dashboard/page2/components/ChartSetup";
import { Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { CHART_COLORS, CHART_FONT } from "./ChartSetup";
import type { BreakdownItem, ChartMode } from "./types";
import { useState } from "react";

const TOP_N = 8;

interface BarChartProps {
  dim1Data: BreakdownItem[];
  dim2Data: BreakdownItem[];
  dim1Label: string;
  dim2Label: string;
  chartMode: ChartMode;
  metric: "count" | "published";
}

function getMetricVal(item: BreakdownItem, metric: string) {
  return metric === "published" ? item.pb : item.up;
}

export default function AnalysisBarChart({
  dim1Data,
  dim2Data,
  dim1Label,
  dim2Label,
  chartMode,
  metric,
}: BarChartProps) {
  const [page, setPage] = useState(0);
  const stacked = chartMode === "stacked";

  const sortedDim1 = [...dim1Data].sort(
    (a, b) => getMetricVal(b, metric) - getMetricVal(a, metric)
  );
  const totalPages = Math.ceil(sortedDim1.length / TOP_N);
  const visibleDim1 = sortedDim1.slice(page * TOP_N, (page + 1) * TOP_N);
  const dim1Labels = visibleDim1.map((d) => d.name);

  const topDim2 = [...dim2Data]
    .sort((a, b) => getMetricVal(b, metric) - getMetricVal(a, metric))
    .slice(0, 6);

  const totalDim1 = dim1Data.reduce((s, d) => s + getMetricVal(d, metric), 0) || 1;
  const totalDim2 = dim2Data.reduce((s, d) => s + getMetricVal(d, metric), 0) || 1;

  const datasets = topDim2.map((d2, i) => {
    const d2Val = getMetricVal(d2, metric);
    return {
      label: d2.name,
      data: visibleDim1.map((d1) => {
        const d1Val = getMetricVal(d1, metric);
        return Math.round((d1Val * d2Val) / Math.max(totalDim1, totalDim2));
      }),
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
      borderRadius: 4,
      borderSkipped: false as const,
    };
  });

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked,
        grid: { display: false },
        ticks: {
          color: "#94a3b8",
          font: CHART_FONT,
          maxRotation: 45,
          callback: function (_, index) {
            const label = dim1Labels[index] || "";
            return label.length > 12 ? label.slice(0, 11) + "…" : label;
          },
        },
      },
      y: {
        stacked,
        grid: { color: "#f1f5f9" },
        border: { display: false },
        ticks: { color: "#94a3b8", font: CHART_FONT },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#64748b",
          font: { ...CHART_FONT, size: 10 },
          boxWidth: 10,
          boxHeight: 10,
          padding: 10,
          usePointStyle: true,
          pointStyle: "rectRounded",
        },
      },
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
  };

  const title = `${dim1Label} × ${dim2Label}`;

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </h4>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <span className="text-[10px] text-gray-400 font-medium px-1">
              {page + 1}/{totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        )}
      </div>
      <div className="h-[200px] sm:h-[220px]">
        <Bar data={{ labels: dim1Labels, datasets }} options={options} />
      </div>
      {sortedDim1.length > TOP_N && (
        <p className="text-[10px] text-gray-300 text-center">
          Showing top {Math.min(TOP_N, visibleDim1.length)} of{" "}
          {sortedDim1.length} {dim1Label.toLowerCase()}s
        </p>
      )}
    </div>
  );
}
