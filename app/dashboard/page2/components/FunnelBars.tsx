"use client";

import type { KPIs } from "./types";

interface FunnelBarsProps {
  kpis: KPIs;
}

export default function FunnelBars({ kpis }: FunnelBarsProps) {
  const { totalUploaded: u, totalPublished: b } = kpis;
  const stages = [
    { label: "Uploaded", val: u, pct: 100, color: "#e9434a" },
    {
      label: "Published",
      val: b,
      pct: u > 0 ? Math.round((b / u) * 100) : 0,
      color: "#10b981",
      drop: u - b,
      dPct: u > 0 ? Math.round(((u - b) / u) * 100) : 0,
    },
  ];

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
        Uploaded → Published Funnel
        <span className="flex-1 h-px bg-gray-100" />
      </h4>
      <div className="flex flex-col gap-3">
        {stages.map((s) => (
          <div key={s.label} className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-500">
                {s.label}
              </span>
              <span className="text-xs font-semibold text-gray-700">
                {s.val.toLocaleString()}{" "}
                <span className="text-gray-400 font-normal">
                  ({s.pct}% of uploaded)
                </span>
              </span>
            </div>
            <div className="h-3.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full flex items-center justify-end pr-2 text-[9px] font-bold text-white transition-all duration-700"
                style={{ width: `${Math.max(s.pct, 3)}%`, background: s.color }}
              >
                {s.pct > 8 && `${s.pct}%`}
              </div>
            </div>
            {"drop" in s && s.drop !== undefined && s.drop > 0 && (
              <div className="text-[11px] text-red-400 font-medium">
                ↓ {s.drop.toLocaleString()} not published ({s.dPct}% of
                uploaded)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
