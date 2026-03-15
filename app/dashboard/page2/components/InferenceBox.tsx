"use client";

import type { BreakdownItem } from "./types";

interface InferenceBoxProps {
  data: BreakdownItem[];
  label: string;
  variant?: "insight" | "alert";
}

export default function InferenceBox({
  data,
  label,
  variant = "insight",
}: InferenceBoxProps) {
  if (data.length === 0) return null;

  const sorted = [...data].sort((a, b) => b.up - a.up);
  const topItem = sorted[0];
  const lowRate = [...data].filter((d) => d.pr > 0).sort((a, b) => a.rate - b.rate)[0];
  const highRate = [...data].filter((d) => d.pr > 0).sort((a, b) => b.rate - a.rate)[0];

  const isAlert = variant === "alert";

  const message = isAlert
    ? `${
        topItem
          ? `${topItem.name} has the highest upload volume (${topItem.up.toLocaleString()}) but only ${
              topItem.up > 0
                ? Math.round((topItem.pb / topItem.up) * 100)
                : 0
            }% are published.`
          : ""
      }${
        lowRate
          ? ` ${lowRate.name} has the lowest publish rate at ${lowRate.rate}% — review editorial workflow.`
          : ""
      }`
    : `${
        highRate
          ? `${highRate.name} leads with ${highRate.rate}% publish rate (${highRate.pb.toLocaleString()} published).`
          : ""
      }${
        topItem
          ? ` ${topItem.name} tops ${label} volume with ${topItem.up.toLocaleString()} uploads.`
          : ""
      }`;

  return (
    <div
      className={`rounded-xl border p-3 flex items-start gap-3 text-xs leading-relaxed ${
        isAlert
          ? "border-red-200 bg-red-50/70"
          : "border-emerald-200 bg-emerald-50/70"
      }`}
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
          isAlert ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
        }`}
      >
        {isAlert ? "↓" : "✦"}
      </div>
      <div className="text-gray-600">
        <strong
          className={
            isAlert
              ? "text-red-600 font-semibold"
              : "text-emerald-600 font-semibold"
          }
        >
          {isAlert ? "Drop-off alert:" : "Key insight:"}
        </strong>{" "}
        {message}
      </div>
    </div>
  );
}
