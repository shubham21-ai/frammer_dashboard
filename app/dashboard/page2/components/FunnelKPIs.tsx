"use client";

import type { KPIs } from "./types";

interface FunnelKPIsProps {
  kpis: KPIs;
}

export default function FunnelKPIs({ kpis }: FunnelKPIsProps) {
  const pubRate =
    kpis.totalUploaded > 0
      ? Math.round((kpis.totalPublished / kpis.totalUploaded) * 100)
      : 0;

  const items = [
    {
      label: "Uploaded",
      value: kpis.totalUploaded,
      color: "border-red-200 bg-red-50/50",
      textColor: "text-red-600",
    },
    {
      label: "Published",
      value: kpis.totalPublished,
      color: "border-emerald-200 bg-emerald-50/50",
      textColor: "text-emerald-600",
    },
    {
      label: "Publish Rate",
      value: pubRate,
      suffix: "%",
      color:
        pubRate >= 30
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-red-200 bg-red-50/50",
      textColor: pubRate >= 30 ? "text-emerald-600" : "text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${item.color}`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {item.label}
          </div>
          <div className={`text-xl font-bold mt-1 ${item.textColor}`}>
            {item.value.toLocaleString()}
            {"suffix" in item && item.suffix ? (
              <span className="text-sm">{item.suffix}</span>
            ) : (
              <span className="text-xs font-normal text-gray-400 ml-1">
                videos
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
