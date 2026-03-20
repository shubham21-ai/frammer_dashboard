"use client";

import "@/app/dashboard/page2/components/ChartSetup";
import { DefinitionButton } from "@/components/ui/DefinitionButton";
import { InsightButton } from "@/components/ui/InsightButton";
import { Doughnut } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { CHART_COLORS, CHART_FONT } from "./ChartSetup";
import type { BreakdownItem, MetricKey } from "./types";
import { useState } from "react";

const TOP_N = 6;

interface DonutChartProps {
  data: BreakdownItem[];
  title: string;
  metric: MetricKey;
}

function getMetricVal(item: BreakdownItem, metric: MetricKey) {
  switch (metric) {
    case "uploaded_count":
      return item.up;
    case "processed_count":
      return item.pr;
    case "published_count":
      return item.pb;
    case "uploaded_duration":
      return item.durationUploaded ?? 0;
    case "processed_duration":
      return item.durationCreated ?? 0;
    case "published_duration":
      return item.durationPublished ?? 0;
  }
}

export default function DonutChart({ data, title, metric }: DonutChartProps) {
  const [selectedItem, setSelectedItem] = useState<BreakdownItem | null>(null);
  const sorted = [...data].sort(
    (a, b) => getMetricVal(b, metric) - getMetricVal(a, metric)
  );
  const top = sorted.slice(0, TOP_N);
  const rest = sorted.slice(TOP_N);
  const restSum = rest.reduce((s, d) => s + getMetricVal(d, metric), 0);

  const items =
    restSum > 0
      ? [
          ...top,
          {
            name: "Others",
            up: restSum,
            pr: restSum,
            pb: restSum,
            durationUploaded: restSum,
            durationCreated: restSum,
            durationPublished: restSum,
            rate: 0,
            id: "others",
          } as BreakdownItem,
        ]
      : top;
  const labels = items.map((d) => d.name);
  const values = items.map((d) => getMetricVal(d, metric));
  const total = values.reduce((a, b) => a + b, 0);

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    onClick: (_event, elements) => {
      if (elements.length === 0) return;
      const idx = elements[0].index;
      const clicked = items[idx];
      if (clicked) setSelectedItem((prev) => (prev?.name === clicked.name ? null : clicked));
    },
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

  const metricLabel = metric.includes("duration") ? "hrs" : "videos";
  const isHours = metric.includes("duration");

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {title}
          </h4>
          <div className="flex items-center gap-1">
            <DefinitionButton
              definition={`Share of the selected metric by ${title.toLowerCase()}. Top items shown; rest grouped as Others. Click a segment to drill down.`}
            />
            <InsightButton page="page2" widget="multi_dim_donut" title={`${title} insight`} />
          </div>
        </div>
        {selectedItem && (
          <button
            type="button"
            onClick={() => setSelectedItem(null)}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200"
          >
            ← Back
          </button>
        )}
      </div>

      {selectedItem ? (
        /* ── Detail view (like ClientShareDonut) ── */
        (() => {
          const up = selectedItem.up;
          const pr = selectedItem.pr;
          const pb = selectedItem.pb;
          const upD = selectedItem.durationUploaded ?? 0;
          const prD = selectedItem.durationCreated ?? 0;
          const pbD = selectedItem.durationPublished ?? 0;
          const selectedVal = getMetricVal(selectedItem, metric);
          const pct = total > 0 ? Math.round((selectedVal / total) * 1000) / 10 : 0;
          const processRate = up > 0 ? Math.round((pr / up) * 100) : 0;
          const publishRate = pr > 0 ? Math.round((pb / pr) * 100) : 0;
          const rank = sorted.findIndex((d) => d.name === selectedItem.name) + 1;
          const itemColor = CHART_COLORS[items.findIndex((d) => d.name === selectedItem.name) % CHART_COLORS.length];
          return (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: itemColor }} />
                <span className="text-sm font-bold text-gray-900 truncate">{selectedItem.name}</span>
                <span className="ml-auto text-[10px] font-semibold text-gray-400">#{rank} · {pct}% share</span>
              </div>
              {/* 3 metric boxes */}
              <div className="grid grid-cols-3 gap-1.5">
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-1.5 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Uploaded</p>
                  <p className="text-sm font-black text-gray-800">{isHours ? upD.toFixed(0) + "h" : up.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-400">{metricLabel}</p>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50/50 px-2 py-1.5 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Processed</p>
                  <p className="text-sm font-black text-red-600">{isHours ? prD.toFixed(0) + "h" : pr.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-400">{metricLabel}</p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-2 py-1.5 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase">Published</p>
                  <p className="text-sm font-black text-emerald-600">{isHours ? pbD.toFixed(0) + "h" : pb.toLocaleString()}</p>
                  <p className="text-[9px] text-gray-400">{metricLabel}</p>
                </div>
              </div>
              {/* Funnel visualization */}
              <div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Conversion funnel</p>
                <div className="space-y-1">
                  {[
                    { label: "Upload → Process", rate: processRate, color: processRate >= 80 ? "#10b981" : "#f59e0b" },
                    { label: "Process → Publish", rate: publishRate, color: publishRate >= 50 ? "#10b981" : "#ef4444" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-500 w-28 shrink-0">{f.label}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${f.rate}%`, backgroundColor: f.color }} />
                      </div>
                      <span className="text-[10px] font-bold w-8 text-right" style={{ color: f.color }}>{f.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Comparison: this item vs total */}
              <div className="rounded-lg border border-gray-100 bg-white px-2.5 py-2 text-[10px] text-gray-600">
                <span className="font-semibold text-gray-800">{selectedItem.name}</span> accounts for{" "}
                <span className="font-bold text-red-600">{pct}%</span> of the selected metric with a{" "}
                <span className={`font-bold ${publishRate >= 50 ? "text-emerald-600" : "text-rose-500"}`}>{publishRate}% publish rate</span>
                {publishRate < 50 ? " — potential improvement area." : " — healthy conversion."}
              </div>
            </div>
          );
        })()
      ) : (
        <>
          <p className="text-[9px] text-gray-400">Click a segment to drill down</p>
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
        </>
      )}
    </div>
  );
}
