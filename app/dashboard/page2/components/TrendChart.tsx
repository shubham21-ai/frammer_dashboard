"use client";

import "@/app/dashboard/page2/components/ChartSetup";
import { Line } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { CHART_FONT } from "./ChartSetup";
import type { TrendItem } from "./types";
import { useState } from "react";

interface TrendChartProps {
  data: TrendItem[];
}

const lineConfigs = [
  { label: "Uploaded", key: "uploaded" as const, color: "#e9434a" },
  { label: "Published", key: "published" as const, color: "#10b981" },
];

export default function TrendChart({ data }: TrendChartProps) {
  const [visibleLines, setVisibleLines] = useState([true, true]);

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
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
        Uploaded vs Published Over Time
      </h4>
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
      <div className="h-[170px] sm:h-[200px]">
        <Line data={{ labels, datasets }} options={options} />
      </div>
    </div>
  );
}
