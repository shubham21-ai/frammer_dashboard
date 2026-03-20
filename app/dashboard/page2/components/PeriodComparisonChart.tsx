"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { DefinitionButton } from "@/components/ui/DefinitionButton";

interface MonthPoint {
  month: string;
  uploaded: number;
  processed: number;
  published: number;
}

function fmtMonth(m: string) {
  if (!m || !m.includes("-")) return m;
  const [y, mo] = m.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(mo, 10) - 1] ?? mo} ${y}`;
}

const pctChange = (c: number, p: number) =>
  p > 0 ? `${c >= p ? "+" : ""}${Math.round(((c - p) / p) * 100)}%` : "—";

export default function PeriodComparisonChart() {
  const [allMonths, setAllMonths] = useState<MonthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodA, setPeriodA] = useState("");
  const [periodB, setPeriodB] = useState("");

  useEffect(() => {
    fetch("/api/period-compare")
      .then((r) => r.json())
      .then((d: { months: MonthPoint[] }) => {
        const sorted = (d.months ?? []).sort((a, b) => a.month.localeCompare(b.month));
        setAllMonths(sorted);
        if (sorted.length >= 2) {
          setPeriodA(sorted[sorted.length - 2].month);
          setPeriodB(sorted[sorted.length - 1].month);
        } else if (sorted.length === 1) {
          setPeriodA(sorted[0].month);
          setPeriodB(sorted[0].month);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 h-[220px] flex items-center justify-center gap-2">
        <div className="h-4 w-4 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
        <span className="text-[10px] text-gray-400">Loading…</span>
      </div>
    );
  }

  if (allMonths.length < 2) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 h-[220px] flex items-center justify-center">
        <p className="text-xs text-gray-400">Not enough monthly data for comparison</p>
      </div>
    );
  }

  const a = allMonths.find((m) => m.month === periodA);
  const b = allMonths.find((m) => m.month === periodB);

  const chartData = a && b ? [
    { metric: "Uploaded",  periodA: a.uploaded,  periodB: b.uploaded },
    { metric: "Processed", periodA: a.processed, periodB: b.processed },
    { metric: "Published", periodA: a.published, periodB: b.published },
  ] : [];

  const labelA = fmtMonth(periodA);
  const labelB = fmtMonth(periodB);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Period Comparison
          </h4>
          <DefinitionButton definition="Compare any two months side-by-side across all pipeline stages. Uses complete historical data — unaffected by the date range filter above." />
        </div>
        {/* Period selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-gray-400 uppercase">Period A</span>
            <select
              value={periodA}
              onChange={(e) => setPeriodA(e.target.value)}
              className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-red-300"
            >
              {allMonths.map((m) => (
                <option key={m.month} value={m.month}>{fmtMonth(m.month)}</option>
              ))}
            </select>
          </div>
          <span className="text-gray-300 text-xs">vs</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-semibold text-gray-400 uppercase">Period B</span>
            <select
              value={periodB}
              onChange={(e) => setPeriodB(e.target.value)}
              className="text-[10px] text-gray-700 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-red-300"
            >
              {allMonths.map((m) => (
                <option key={m.month} value={m.month}>{fmtMonth(m.month)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {(!a || !b || periodA === periodB) ? (
        <div className="h-[140px] flex items-center justify-center">
          <p className="text-[10px] text-gray-400">Select two different periods to compare</p>
        </div>
      ) : (
        <>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="metric" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e2e8f0", backgroundColor: "#fff" }}
                  labelStyle={{ fontWeight: "bold", color: "#1e293b" }}
                />
                <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} />
                <Bar dataKey="periodA" name={labelA} fill="#94a3b8" radius={[3, 3, 0, 0]} maxBarSize={44} />
                <Bar dataKey="periodB" name={labelB} fill="#e9434a" radius={[3, 3, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 justify-center text-[9px] text-gray-400">
            <span>Uploaded: <span className="font-semibold text-gray-600">{pctChange(b.uploaded, a.uploaded)}</span></span>
            <span>Processed: <span className="font-semibold text-gray-600">{pctChange(b.processed, a.processed)}</span></span>
            <span>Published: <span className="font-semibold text-gray-600">{pctChange(b.published, a.published)}</span></span>
          </div>
        </>
      )}
    </div>
  );
}
