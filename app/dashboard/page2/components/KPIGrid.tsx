"use client";

import type { KPIs } from "./types";

interface KPIGridProps {
  kpis: KPIs;
}

interface KPITile {
  label: string;
  value: string;
  unit: string;
  direction: "up" | "down";
  sub: string;
}

export default function KPIGrid({ kpis }: KPIGridProps) {
  const tiles: KPITile[] = [
    {
      label: "Publish Rate",
      value: String(kpis.publishRate),
      unit: "%",
      direction: kpis.publishRate >= 50 ? "up" : "down",
      sub: "Processed → Published",
    },
    {
      label: "Process Rate",
      value: String(kpis.processRate),
      unit: "%",
      direction: kpis.processRate >= 70 ? "up" : "down",
      sub: "Uploaded → Processed",
    },
    {
      label: "Avg Duration",
      value: String(kpis.avgDuration),
      unit: " min",
      direction: "up",
      sub: "Per published video",
    },
    {
      label: "Drop Gap",
      value: kpis.dropGap.toLocaleString(),
      unit: "",
      direction: "down",
      sub: "Proc − Published count",
    },
    {
      label: "Total Uploaded",
      value: kpis.totalUploaded.toLocaleString(),
      unit: "",
      direction: "up",
      sub: "All uploaded videos",
    },
    {
      label: "Total Published",
      value: kpis.totalPublished.toLocaleString(),
      unit: "",
      direction: kpis.totalPublished > 0 ? "up" : "down",
      sub: "Successfully published",
    },
  ];

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
        Performance KPIs
        <span className="flex-1 h-px bg-gray-100" />
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className={`rounded-lg border p-3 transition-all hover:shadow-md cursor-default group ${
              t.direction === "up"
                ? "border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50"
                : "border-gray-100 hover:border-red-200 hover:bg-red-50/50"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {t.label}
            </div>
            <div className="text-lg font-bold text-gray-900 mt-0.5">
              {t.value}
              {t.unit && (
                <span className="text-xs font-normal text-gray-400 ml-0.5">
                  {t.unit}
                </span>
              )}
            </div>
            <div
              className={`text-[11px] font-semibold mt-0.5 ${
                t.direction === "up" ? "text-emerald-500" : "text-red-500"
              }`}
            >
              {t.direction === "up" ? "↑" : "↓"}{" "}
              {t.direction === "up" ? "Good" : "Needs attention"}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{t.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
