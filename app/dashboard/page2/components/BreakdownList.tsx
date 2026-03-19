"use client";

import { useState } from "react";
import { DefinitionButton } from "@/components/ui/DefinitionButton";
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
  const activeDimLabel = dimensions.find((d) => d.key === activeTab)?.label ?? activeTab;
  const activeSortLabel = sortButtons.find((s) => s.key === sortKey)?.label ?? "Published";

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Breakdown
          </h4>
          <DefinitionButton definition="Ranked list by dimension (channel, client, etc.). Processed = AI-generated; Published = live. Rate = published ÷ processed × 100." />
        </div>
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

      <div className="mb-2 rounded-lg border border-gray-100 bg-white px-2.5 py-2">
        <p className="text-[10px] text-gray-500">
          Showing <span className="font-semibold text-gray-700">{activeDimLabel}</span>, sorted by{" "}
          <span className="font-semibold text-gray-700">{activeSortLabel}</span>.
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Processed volume (bar length)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Published volume
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-300" />
            Gap to max processed
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
        {rows.map((r, i) => {
          const pct = r.pr > 0 ? Math.round((r.pb / r.pr) * 100) : 0;
          const procBarW = Math.round((r.pr / maxPr) * 100);
          const pubBarW = Math.round((r.pb / maxPr) * 100);
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
                  <span>
                    <span className="text-gray-400">Proc</span>{" "}
                    <span className="font-semibold text-gray-600">{r.pr.toLocaleString()}</span>
                  </span>
                  <span>
                    <span className="text-gray-400">Pub</span>{" "}
                    <span className="font-semibold text-emerald-500">{r.pb.toLocaleString()}</span>
                  </span>
                  <span>
                    <span className="text-gray-400">Rate</span>{" "}
                    <span className={`font-semibold ${rateColor}`}>{pct}%</span>
                  </span>
                </div>
              </div>
              <div className="h-[5px] bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-300/70 transition-all duration-500"
                  style={{ width: `${procBarW}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-400 transition-all duration-500"
                  style={{ width: `${pubBarW}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-red-200/60 transition-all duration-500"
                  style={{ width: `${100 - procBarW}%` }}
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
