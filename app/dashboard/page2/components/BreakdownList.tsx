"use client";

import { useState } from "react";
import type { BreakdownItem, DimensionKey, SortKey } from "./types";

interface BreakdownListProps {
  data: Record<string, BreakdownItem[]>;
  dimensions: { key: DimensionKey; label: string }[];
}

export default function BreakdownList({ data, dimensions }: BreakdownListProps) {
  const [activeTab, setActiveTab] = useState<DimensionKey>(dimensions[0]?.key || "channel");
  const [sortKey, setSortKey] = useState<SortKey>("pub");

  const sortButtons: { key: SortKey; label: string; activeClass: string }[] = [
    { key: "pub", label: "Published", activeClass: "text-emerald-500 border-emerald-300 bg-emerald-50" },
    { key: "proc", label: "Processed", activeClass: "text-amber-500 border-amber-300 bg-amber-50" },
    { key: "rate", label: "Rate", activeClass: "text-red-500 border-red-300 bg-red-50" },
  ];

  const raw = data[activeTab] || [];
  const rows = [...raw];
  if (sortKey === "pub") rows.sort((a, b) => b.pb - a.pb);
  else if (sortKey === "proc") rows.sort((a, b) => b.pr - a.pr);
  else rows.sort((a, b) => b.rate - a.rate);

  const maxPr = Math.max(...rows.map((r) => r.pr), 1);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Breakdown
        </h4>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mr-1">
            Sort:
          </span>
          {sortButtons.map((sb) => (
            <button
              key={sb.key}
              onClick={() => setSortKey(sb.key)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all ${
                sortKey === sb.key
                  ? sb.activeClass
                  : "text-gray-400 border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {sb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none pb-1">
        {dimensions.map((dim) => (
          <button
            key={dim.key}
            onClick={() => setActiveTab(dim.key)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-md border transition-all whitespace-nowrap ${
              activeTab === dim.key
                ? "bg-red-500 border-red-500 text-white"
                : "text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500"
            }`}
          >
            {dim.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
        {rows.map((r, i) => {
          const pct = r.pr > 0 ? Math.round((r.pb / r.pr) * 100) : 0;
          const barW = Math.round((r.pr / maxPr) * 100);
          const rateColor =
            pct >= 65
              ? "text-emerald-500"
              : pct >= 45
              ? "text-amber-500"
              : "text-red-500";

          return (
            <div
              key={r.id}
              className="rounded-lg px-2 py-2 hover:bg-white transition-colors cursor-default"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-gray-700 flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] font-bold text-gray-300 flex-shrink-0 w-[18px]">
                    #{i + 1}
                  </span>
                  <span className="truncate">{r.name}</span>
                </span>
                <div className="flex gap-2 text-[11px] text-gray-400 flex-shrink-0 ml-2">
                  <span>{r.pr.toLocaleString()} proc</span>
                  <span className="font-semibold text-emerald-500">
                    {r.pb.toLocaleString()} pub
                  </span>
                  <span className={`font-semibold ${rateColor}`}>{pct}%</span>
                </div>
              </div>
              <div
                className="h-[5px] bg-gray-200 rounded-full overflow-hidden flex"
                style={{ width: `${barW}%` }}
              >
                <div
                  className="h-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
                <div
                  className="h-full bg-red-300 opacity-50 transition-all duration-500"
                  style={{ width: `${100 - pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-4">No data</p>
        )}
      </div>
    </div>
  );
}
