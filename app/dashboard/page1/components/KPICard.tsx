"use client";

import { useState, useRef, useEffect } from "react";
import { InsightButton } from "@/components/ui/InsightButton";

interface KPICardProps {
  label: string;
  value: string;
  tooltip: string;
  trendPct: number | null;
  /** "higher" = positive trend is good, "lower" = negative trend is good */
  improvementDirection: "higher" | "lower" | "none";
  /** All-time total (shown when primary value is latest month) */
  allTimeValue?: string;
  /** Current month value (e.g. "120") */
  currentMonthValue?: string;
  /** Previous month value (e.g. "95") */
  prevValue?: string;
  /** Label for current period (e.g. "Mar 2024") */
  currentMonthLabel?: string;
  /** Label for prev period (e.g. "Feb 2024") */
  prevLabel?: string;
  insightPage: string;
  insightWidget: string;
}

export default function KPICard({
  label,
  value,
  tooltip,
  trendPct,
  improvementDirection,
  allTimeValue,
  currentMonthValue,
  prevValue,
  currentMonthLabel,
  prevLabel = "prev month",
  insightPage,
  insightWidget,
}: KPICardProps) {
  const [showDefinition, setShowDefinition] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasTrend = trendPct !== null && improvementDirection !== "none";
  const isImprovement =
    improvementDirection === "higher"
      ? (trendPct ?? 0) > 0
      : improvementDirection === "lower"
        ? (trendPct ?? 0) < 0
        : false;
  const isDecline =
    improvementDirection === "higher"
      ? (trendPct ?? 0) < 0
      : improvementDirection === "lower"
        ? (trendPct ?? 0) > 0
        : false;

  // Close popover when clicking outside
  useEffect(() => {
    if (!showDefinition) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowDefinition(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDefinition]);

  const trendDisplay = hasTrend && trendPct !== null && (
    <span
      className={`font-semibold ${
        isImprovement ? "text-emerald-600" : isDecline ? "text-red-500" : "text-gray-500"
      }`}
    >
      {trendPct >= 0 ? "↑" : "↓"} {Math.abs(Math.round(trendPct * 10) / 10)}%
    </span>
  );

  return (
    <div className="relative" ref={popoverRef}>
      <div className="w-full rounded-lg border border-gray-200 p-2.5 text-left transition-all hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 min-w-0">
            {label}
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowDefinition((v) => !v)}
              className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium transition-colors ${
                showDefinition ? "bg-emerald-100 text-emerald-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              }`}
              aria-label="Definition"
            >
              ?
            </button>
            <InsightButton page={insightPage} widget={insightWidget} title={`${label} insight`} />
          </div>
        </div>
        <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
        {allTimeValue && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            All-time: <span className="font-medium text-gray-500">{allTimeValue}</span>
          </div>
        )}
        {/* Comparison block - vs previous month */}
        {(currentMonthValue || prevValue || hasTrend) && (
          <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-100 pt-2">
            {currentMonthValue != null && !allTimeValue && (
              <div className="text-[10px] text-gray-500">
                {currentMonthLabel ?? "This month"}: <span className="font-medium text-gray-600">{currentMonthValue}</span>
              </div>
            )}
            {prevValue != null && (
              <div className="text-[10px] text-gray-500">
                {prevLabel}: <span className="font-medium text-gray-600">{prevValue}</span>
              </div>
            )}
            {hasTrend && (
              <div className="text-[10px]">
                {trendDisplay}
                <span className="text-gray-400 ml-1">vs {prevLabel}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Definition popover */}
      {showDefinition && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
            Definition
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{tooltip}</p>
          <button
            type="button"
            onClick={() => setShowDefinition(false)}
            className="mt-2 text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
