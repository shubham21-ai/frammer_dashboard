"use client";

import { useState } from "react";
import type { Page1Alert } from "./types";

interface AlertsBannerProps {
  alerts: Page1Alert[];
}

export default function AlertsBanner({ alerts }: AlertsBannerProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(`${a.type}-${a.clientId}`));
  if (visible.length === 0) return null;

  const criticals = visible.filter((a) => a.severity === "critical");
  const warnings = visible.filter((a) => a.severity === "warning");

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚠</span>
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
            Alerts ({visible.length})
          </h4>
          {criticals.length > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
              {criticals.length} critical
            </span>
          )}
          {warnings.length > 0 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {warnings.length} warning
            </span>
          )}
        </div>
        <button
          onClick={() => setDismissed(new Set(alerts.map((a) => `${a.type}-${a.clientId}`)))}
          className="text-[9px] text-amber-500 hover:text-amber-700 border border-amber-200 rounded px-2 py-0.5"
        >
          Dismiss all
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {visible.map((a) => {
          const key = `${a.type}-${a.clientId}`;
          return (
            <div
              key={key}
              className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[10px] ${
                a.severity === "critical"
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-amber-50 border border-amber-200 text-amber-800"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0">{a.severity === "critical" ? "🔴" : "🟡"}</span>
                <span className="truncate">{a.message}</span>
              </div>
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, key]))}
                className="shrink-0 text-[9px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
