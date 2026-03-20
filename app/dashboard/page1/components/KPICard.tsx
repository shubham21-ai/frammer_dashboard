"use client";

import { useState, useRef, useEffect } from "react";
import { InsightButton } from "@/components/ui/InsightButton";

interface KPICardProps {
  label: string;
  value: string;
  tooltip: string;
  trendPct: number | null;
  improvementDirection: "higher" | "lower" | "none";
  allTimeValue?: string;
  currentMonthValue?: string;
  prevValue?: string;
  currentMonthLabel?: string;
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
  const [showDef, setShowDef] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const hasTrend = trendPct !== null && improvementDirection !== "none";
  const isUp   = improvementDirection === "higher" ? (trendPct ?? 0) > 0 : improvementDirection === "lower" ? (trendPct ?? 0) < 0 : false;
  const isDown = improvementDirection === "higher" ? (trendPct ?? 0) < 0 : improvementDirection === "lower" ? (trendPct ?? 0) > 0 : false;

  useEffect(() => {
    if (!showDef) return;
    const h = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setShowDef(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showDef]);

  return (
    <div className="relative group" ref={popRef}>
      {/* ── Card shell ── */}
      <div className="relative rounded-2xl overflow-hidden glass-card cursor-default">
        {/* Top shimmer accent line (visible on hover) */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent
          opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="p-3">
          {/* ── Header row ── */}
          <div className="flex items-start justify-between gap-1.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--text-3)" }}>
              {label}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowDef((v) => !v)}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200 ${
                  showDef
                    ? "bg-red-500/20 text-red-400"
                    : "text-white/20 hover:bg-white/10 hover:text-white/60 dark:text-white/20 dark:hover:text-white/60"
                }`}
                style={{ color: showDef ? undefined : "var(--text-3)" }}
              >
                ?
              </button>
              <InsightButton page={insightPage} widget={insightWidget} title={`${label} insight`} />
            </div>
          </div>

          {/* ── Main value — gradient text ── */}
          <div className="text-xl font-black mt-1.5 leading-none tracking-tight gradient-text-kpi">
            {value}
          </div>

          {/* ── All-time ── */}
          {allTimeValue && (
            <div className="text-[9.5px] mt-1" style={{ color: "var(--text-3)" }}>
              All-time: <span style={{ color: "var(--text-2)" }} className="font-medium">{allTimeValue}</span>
            </div>
          )}

          {/* ── Comparison block ── */}
          {(currentMonthValue || prevValue || hasTrend) && (
            <div className="mt-2.5 flex flex-col gap-0.5 border-t pt-2" style={{ borderColor: "var(--border-dim)" }}>
              {currentMonthValue != null && !allTimeValue && (
                <div className="text-[9.5px]" style={{ color: "var(--text-2)" }}>
                  <span style={{ color: "var(--text-3)" }}>{currentMonthLabel ?? "This month"}:</span>{" "}
                  <span className="font-semibold">{currentMonthValue}</span>
                </div>
              )}
              {prevValue != null && (
                <div className="text-[9.5px]" style={{ color: "var(--text-2)" }}>
                  <span style={{ color: "var(--text-3)" }}>{prevLabel}:</span>{" "}
                  <span className="font-semibold">{prevValue}</span>
                </div>
              )}
              {hasTrend && trendPct !== null && (
                <div className="text-[9.5px] flex items-center gap-1 mt-0.5">
                  <span
                    className={`font-bold ${isUp ? "text-emerald-500" : isDown ? "text-red-400" : ""}`}
                    style={{
                      textShadow: isUp
                        ? "0 0 10px rgba(52,211,153,0.5)"
                        : isDown
                          ? "0 0 10px rgba(248,113,113,0.5)"
                          : undefined,
                    }}
                  >
                    {trendPct >= 0 ? "↑" : "↓"} {Math.abs(Math.round(trendPct * 10) / 10)}%
                  </span>
                  <span style={{ color: "var(--text-3)" }}>vs {prevLabel}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Definition popover ── */}
      {showDef && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-2xl border p-3.5 shadow-2xl"
          style={{
            background: "var(--bg-glass)",
            backdropFilter: "blur(24px)",
            borderColor: "var(--border-glass)",
          }}
        >
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--text-3)" }}>Definition</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-2)" }}>{tooltip}</p>
          <button
            type="button"
            onClick={() => setShowDef(false)}
            className="mt-2 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
