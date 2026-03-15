"use client";

import "@/app/dashboard/page2/components/ChartSetup";
import { Doughnut } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { CHART_COLORS, CHART_FONT } from "./ChartSetup";
import type { BreakdownItem } from "./types";

const TOP_N = 6;

interface DonutChartProps {
  data: BreakdownItem[];
  title: string;
  metric: "count" | "published";
}

export default function DonutChart({ data, title, metric }: DonutChartProps) {
  const sorted = [...data].sort((a, b) =>
    metric === "published" ? b.pb - a.pb : b.up - a.up
  );
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const restSum = rest.reduce(
    (s, d) => s + (metric === "published" ? d.pb : d.up),
    0
  );

  const items = restSum > 0 ? [...top, { name: "Others", up: restSum, pb: restSum } as BreakdownItem] : top;
  const labels = items.map((d) => d.name);
  const values = items.map((d) => (metric === "published" ? d.pb : d.up));
  const total = values.reduce((a, b) => a + b, 0);

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#64748b",
          font: { ...CHART_FONT, size: 10 },
          boxWidth: 10,
          boxHeight: 10,
          padding: 8,
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
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label(c) {
            const pct = total > 0 ? Math.round((c.parsed / total) * 100) : 0;
            return `  ${c.parsed.toLocaleString()}  (${pct}%)`;
          },
        },
      },
    },
    animation: { duration: 350 },
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 flex flex-col gap-2">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </h4>
      <div className="h-[200px] sm:h-[220px]">
        <Doughnut
          data={{
            labels,
            datasets: [
              {
                data: values,
                backgroundColor: CHART_COLORS.slice(0, items.length),
                borderWidth: 2,
                borderColor: "#ffffff",
                hoverOffset: 10,
              },
            ],
          }}
          options={options}
        />
      </div>
    </div>
  );
}
