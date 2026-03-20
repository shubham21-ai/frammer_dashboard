"use client";

import { useState, useMemo, useCallback } from "react";
import { DefinitionButton } from "@/components/ui/DefinitionButton";
import { InsightButton } from "@/components/ui/InsightButton";
import DrillRawTable from "@/components/DrillRawTable";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend,
} from "recharts";

/* ───────── types ───────── */

export type Page4KPIs = {
  totalCreatedHours: number; totalPublishedHours: number; totalUploadedHours: number;
  totalVideos: number; totalPublished: number; totalClients: number;
  dataQualityPct: number; avgFeatureTypes: number; maxFeatureTypes: number;
  publishEfficiencyHrs: number; atRiskCount: number;
};
export type DataQuality = { total: number; missingInputType: number; missingLanguage: number; publishedNoPlatform: number; publishedNoUrl: number };
export type ClientShare = { client_id: string; createdHours: number; publishedHours: number; uploadedHours: number };
export type FeatureMatrix = { clients: string[]; outputTypes: string[]; data: Record<string, Record<string, { created: number; published: number }>> };
export type LanguageMatrix = {
  clients: string[];
  languages: string[];
  data: Record<
    string,
    Record<
      string,
      {
        uploadedHours: number;
        processingHours: number;
        publishedHours: number;
        uploadedCount: number;
        processingCount: number;
        publishedCount: number;
      }
    >
  >;
};
export type AmplificationRow = { client_id: string; uploaded: number; created: number; published: number; amplification: number };
export type PlatformHoursRow = { platform: string; hours: number };
export type RiskRow = { client_id: string; totalVideos: number; unknownInput: number; pubNoPlatform: number; pubNoUrl: number; totalCreated: number; totalPublished: number; outputTypesUsed: number; totalOutputTypes: number; createdHours: number };
export type VideoRow = { video_id: number; client_id: string; channel_name: string; user_name: string; output_type_name: string; published_platform: string; published_url: string };

/* ───────── colors ───────── */

const COLORS = ["#e9434a","#3b82f6","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#ff7a85"];
const CLIENT_COLORS: Record<string, string> = {};
function getClientColor(id: string, idx: number) {
  if (!CLIENT_COLORS[id]) CLIENT_COLORS[id] = COLORS[idx % COLORS.length];
  return CLIENT_COLORS[id];
}

/* ================================================================
   1. KPI INSIGHT CARDS
   ================================================================ */

export function KPIInsightCards({ kpis }: { kpis: Page4KPIs }) {
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);
  const cards = [
    { label: "Total Processed Hours", value: `${kpis.totalCreatedHours.toLocaleString("en-US",{maximumFractionDigits:0})}h`, sub: `${kpis.totalUploadedHours.toLocaleString("en-US",{maximumFractionDigits:0})}h uploaded · ${kpis.totalClients} clients`, icon: "⏱", valueColor: "text-gray-900", accent: "border-l-red-500", definition: "Total hours of content that have been fully processed (AI-generated) across all clients. Includes both uploaded and created duration." },
    { label: "Data Completeness", value: `${kpis.dataQualityPct}%`, sub: `${kpis.totalVideos.toLocaleString()} videos scanned`, icon: "✓", valueColor: kpis.dataQualityPct >= 95 ? "text-emerald-600" : "text-amber-500", accent: kpis.dataQualityPct >= 95 ? "border-l-emerald-500" : "border-l-amber-500", definition: "Percentage of videos with complete metadata (input type, language, platform, URL). Higher is better; 95%+ is healthy." },
    { label: "Feature Penetration", value: `${kpis.avgFeatureTypes} / ${kpis.maxFeatureTypes}`, sub: "Avg output types published per client", icon: "◎", valueColor: "text-blue-600", accent: "border-l-blue-500", definition: "Average number of output types (e.g. Shorts, Long-form) each client publishes, vs. total types available. Indicates feature adoption breadth." },
    { label: "Publish Efficiency (Hrs)", value: `${kpis.publishEfficiencyHrs}%`, sub: `${kpis.totalPublishedHours.toLocaleString("en-US",{maximumFractionDigits:0})}h of ${kpis.totalCreatedHours.toLocaleString("en-US",{maximumFractionDigits:0})}h`, icon: "↗", valueColor: kpis.publishEfficiencyHrs >= 1 ? "text-emerald-600" : "text-rose-500", accent: kpis.publishEfficiencyHrs >= 1 ? "border-l-emerald-500" : "border-l-rose-500", definition: "Published hours ÷ processed hours × 100. Shows how much of processed content reaches publishing. 100%+ means full utilization." },
    { label: "At-Risk Accounts", value: `${kpis.atRiskCount}`, sub: `of ${kpis.totalClients} with < 100 published`, icon: "⚠", valueColor: kpis.atRiskCount > 0 ? "text-rose-500" : "text-emerald-600", accent: kpis.atRiskCount > 0 ? "border-l-rose-500" : "border-l-emerald-500", definition: "Clients with fewer than 100 published outputs. May indicate low adoption, churn risk, or onboarding issues." },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border border-gray-200 bg-white shadow-sm px-3 py-2.5 border-l-4 ${c.accent} hover:shadow-md transition-shadow relative`}>
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-tight">{c.label}</p>
            <div className="flex items-center gap-1">
              <DefinitionButton definition={c.definition} />
              <InsightButton page="page4" widget={`kpi_${c.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`} title={`${c.label} insight`} />
              <span className="text-xs opacity-60">{c.icon}</span>
            </div>
          </div>
          <p className={`text-xl font-black mt-0.5 ${c.valueColor}`}>{c.value}</p>
          <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{c.sub}</p>
          <button
            type="button"
            onClick={() => setSelectedKpi((prev) => (prev === c.label ? null : c.label))}
            className="mt-1 text-[10px] font-semibold text-gray-500 hover:text-gray-700"
          >
            {selectedKpi === c.label ? "Hide details" : "Drill down"}
          </button>
          {selectedKpi === c.label && (
            <div className="mt-1 rounded-md border border-gray-100 bg-gray-50 p-1.5 text-[10px] text-gray-600">
              {c.definition}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   2. MONTHLY CLIENT BILLING CONTRIBUTION (Stacked Area)
   ================================================================ */

export function MonthlyContributionChart({ data, clientIds }: { data: Record<string, string | number>[]; clientIds: string[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [drillClient, setDrillClient] = useState<string | null>(null);
  const monthRow = data.find((r) => String(r.month) === selectedMonth);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col min-h-[340px]">
      <div className="shrink-0 px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2 rounded-t-2xl">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Monthly Client Billing Contribution</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Processed hours stacked by client</p>
        </div>
        <div className="flex items-center gap-1">
          <DefinitionButton definition="Stacked area chart of processed hours per client per month. Shows each client's contribution to total capacity over time." />
          <InsightButton page="page4" widget="monthly_client_billing_contribution" title="Monthly Client Billing Contribution insight" />
        </div>
      </div>
      <div className="h-[220px] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
            onClick={(state) => {
              const month = state?.activeLabel;
              if (month) setSelectedMonth((prev) => (prev === String(month) ? null : String(month)));
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
              tickFormatter={(v: string) => { const [m, y] = v.split(", "); return `${m.slice(0,3)} '${y?.slice(2)??""}` }} />
            <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => `${v}h`} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10, border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
              formatter={(v, name) => [`${Number(v).toFixed(1)}h`, String(name)]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {clientIds.map((id, i) => (
              <Area key={id} type="monotone" dataKey={id} stackId="1" fill={getClientColor(id, i)} stroke={getClientColor(id, i)} fillOpacity={0.7} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {selectedMonth && monthRow && (() => {
        const monthIndex = data.findIndex((r) => String(r.month) === selectedMonth);
        const prevRow = monthIndex > 0 ? data[monthIndex - 1] : null;
        const ranked = clientIds
          .map((id) => ({
            id,
            hours: Number(monthRow[id] ?? 0),
            prev: prevRow ? Number(prevRow[id] ?? 0) : null,
          }))
          .sort((a, b) => b.hours - a.hours);
        const maxHours = ranked[0]?.hours || 1;
        const total = ranked.reduce((s, r) => s + r.hours, 0);
        return (
          <div className="mx-2 mb-2 rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-800">Client breakdown — {selectedMonth}</p>
                <p className="text-[10px] text-gray-400">{total.toFixed(1)}h total across {ranked.filter(r => r.hours > 0).length} clients</p>
              </div>
              <div className="flex items-center gap-2">
                {drillClient && (
                  <button type="button" onClick={() => setDrillClient(null)} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">← Back</button>
                )}
                <button type="button" onClick={() => { setSelectedMonth(null); setDrillClient(null); }} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">Close</button>
              </div>
            </div>
            {drillClient ? (
              /* ── L3: selected client full monthly arc ── */
              (() => {
                const clientSeries = data.map((m) => ({ month: String(m.month), value: Number(m[drillClient] ?? 0) }));
                const clientTotal = clientSeries.reduce((s, r) => s + r.value, 0);
                const clientAvg = clientSeries.length > 0 ? clientTotal / clientSeries.length : 0;
                const clientPeak = clientSeries.reduce((best, r) => (r.value > best.value ? r : best), clientSeries[0] ?? { month: "", value: 0 });
                const maxV = Math.max(...clientSeries.map((s) => s.value), 0.01);
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Full monthly arc — {drillClient}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[["Total", `${clientTotal.toFixed(0)}h`], ["Avg/Mo", `${clientAvg.toFixed(1)}h`], ["Peak", `${clientPeak.value.toFixed(0)}h`]].map(([l, v]) => (
                        <div key={l} className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                          <p className="text-[9px] text-gray-400 uppercase">{l}</p>
                          <p className="text-xs font-black text-gray-800">{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-1">
                      {clientSeries.map((s) => (
                        <div key={s.month} className="flex items-center gap-2">
                          <span className="w-20 text-[9px] text-gray-500 truncate">{String(s.month).split(", ")[0]}</span>
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(s.value / maxV) * 100}%`, backgroundColor: s.value >= clientAvg ? "#e9434a" : "#fca5a5" }} />
                          </div>
                          <span className="w-12 text-right text-[9px] font-bold text-gray-700">{s.value.toFixed(1)}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                <p className="text-[9px] text-gray-400 mb-1">Click a client to drill into their full history →</p>
                <div className="space-y-1.5 mb-2">
                  {ranked.filter((r) => r.hours > 0).map((r, i) => {
                    const pct = (r.hours / maxHours) * 100;
                    const delta = r.prev !== null ? r.hours - r.prev : null;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setDrillClient(r.id)}
                        className="w-full flex items-center gap-2 text-left hover:bg-red-50/30 rounded px-1 transition-colors"
                      >
                        <span className="w-16 text-[10px] font-semibold text-gray-700 truncate">{r.id}</span>
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="w-14 text-right text-[10px] font-bold text-gray-800">{r.hours.toFixed(1)}h</span>
                        {delta !== null && (
                          <span className={`w-12 text-right text-[10px] font-bold ${delta > 0.05 ? "text-emerald-600" : delta < -0.05 ? "text-rose-500" : "text-gray-400"}`}>
                            {delta > 0.05 ? "↑" : delta < -0.05 ? "↓" : "→"}{Math.abs(delta).toFixed(1)}h
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {prevRow && (
                  <p className="text-[10px] text-gray-400">↑↓ vs {String(prevRow.month)}</p>
                )}
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ================================================================
   3. CLIENT GROWTH MOMENTUM (Sparklines)
   ================================================================ */

export function ClientMomentumTracker({ data, clientIds }: { data: Record<string, string | number>[]; clientIds: string[] }) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [drillMonth, setDrillMonth] = useState<string | null>(null);
  const clientRows = useMemo(() => clientIds.map((id, idx) => {
    const series = data.map((m) => ({ month: String(m.month), value: Number(m[id] ?? 0) }));
    const recent = series.slice(-3), prev = series.slice(-6, -3);
    const recentAvg = recent.length === 0 ? 0 : recent.reduce((s, r) => s + r.value, 0) / recent.length;
    const prevAvg = prev.length === 0 ? 0 : prev.reduce((s, r) => s + r.value, 0) / prev.length;
    const growth = prevAvg === 0 ? 0 : Math.round(((recentAvg - prevAvg) / prevAvg) * 1000) / 10;
    const total = series.reduce((s, r) => s + r.value, 0);
    return { id, series, growth, total, color: getClientColor(id, idx) };
  }), [data, clientIds]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm flex flex-col min-h-[340px]">
      <div className="shrink-0 px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2 rounded-t-2xl">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Client Growth Momentum</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Quarterly trend shift per account</p>
        </div>
        <div className="flex items-center gap-1">
          <DefinitionButton definition="Compares recent 3 months vs. prior 3 months per client. Growth % shows whether each account is accelerating or decelerating in processed volume." />
          <InsightButton page="page4" widget="client_growth_momentum" title="Client Growth Momentum insight" />
        </div>
      </div>
      <div className="max-h-[240px] overflow-y-auto px-3 py-1.5">
        {clientRows.map((row) => (
          <div
            key={row.id}
            className={`flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 cursor-pointer ${selectedClient === row.id ? "bg-red-50/30 rounded-md px-1" : ""}`}
            onClick={() => setSelectedClient((prev) => (prev === row.id ? null : row.id))}
          >
            <div className="w-14 shrink-0">
              <p className="text-[11px] font-bold text-gray-800">{row.id}</p>
              <p className="text-[9px] text-gray-400">{row.total.toFixed(0)}h</p>
            </div>
            <div className="flex-1 min-w-0 h-7">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={row.series} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                  <Area type="monotone" dataKey="value" stroke={row.color} fill={row.color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="w-16 shrink-0 text-right">
              <span className={`text-[11px] font-bold ${row.growth > 5 ? "text-emerald-600" : row.growth < -5 ? "text-rose-500" : "text-gray-500"}`}>
                {row.growth > 0 ? "↑" : row.growth < 0 ? "↓" : "→"} {Math.abs(row.growth)}%
              </span>
            </div>
          </div>
        ))}
      </div>
      {selectedClient && (() => {
        const row = clientRows.find((r) => r.id === selectedClient);
        if (!row) return null;
        const total = row.series.reduce((s, r) => s + r.value, 0);
        const avg = row.series.length > 0 ? total / row.series.length : 0;
        const peak = row.series.reduce((best, r) => (r.value > best.value ? r : best), row.series[0] ?? { month: "", value: 0 });
        const maxVal = Math.max(...row.series.map((s) => s.value), 0.01);
        return (
          <div className="border-t border-gray-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-800">{selectedClient} — Full Timeline</p>
                <p className="text-[10px] text-gray-400">
                  {row.growth > 0 ? "↑" : row.growth < 0 ? "↓" : "→"} {Math.abs(row.growth)}% QoQ · peak {peak.value.toFixed(0)}h in {String(peak.month).split(", ")[0]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {drillMonth && (
                  <button type="button" onClick={() => setDrillMonth(null)} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">← Back</button>
                )}
                <button type="button" onClick={() => { setSelectedClient(null); setDrillMonth(null); }} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">Close ✕</button>
              </div>
            </div>
            {drillMonth ? (
              /* ── L3: specific month context card ── */
              (() => {
                const monthIdx = row.series.findIndex((s) => s.month === drillMonth);
                const monthVal = row.series[monthIdx]?.value ?? 0;
                const prevMonthVal = monthIdx > 0 ? (row.series[monthIdx - 1]?.value ?? 0) : null;
                const delta = prevMonthVal !== null ? monthVal - prevMonthVal : null;
                const pctOfPeak = peak.value > 0 ? Math.round((monthVal / peak.value) * 100) : 0;
                const pctOfAvg = avg > 0 ? Math.round((monthVal / avg) * 100) : 0;
                return (
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{drillMonth} · {selectedClient}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                        <p className="text-[9px] text-gray-400 uppercase">Hours This Month</p>
                        <p className="text-sm font-black text-gray-800">{monthVal.toFixed(1)}h</p>
                      </div>
                      <div className={`rounded px-2 py-1.5 text-center border ${delta === null ? "bg-gray-50 border-gray-100" : delta > 0 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                        <p className="text-[9px] text-gray-400 uppercase">MoM Change</p>
                        <p className={`text-sm font-black ${delta === null ? "text-gray-500" : delta > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                          {delta === null ? "—" : `${delta > 0 ? "↑" : "↓"}${Math.abs(delta).toFixed(1)}h`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-[10px] text-gray-500">
                      <span className="rounded bg-gray-100 px-2 py-0.5">{pctOfPeak}% of peak</span>
                      <span className="rounded bg-gray-100 px-2 py-0.5">{pctOfAvg}% of avg</span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <div className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                    <p className="text-[9px] text-gray-400 uppercase">Total</p>
                    <p className="text-xs font-black text-gray-800">{total.toFixed(0)}h</p>
                  </div>
                  <div className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                    <p className="text-[9px] text-gray-400 uppercase">Avg / Mo</p>
                    <p className="text-xs font-black text-gray-800">{avg.toFixed(1)}h</p>
                  </div>
                  <div className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                    <p className="text-[9px] text-gray-400 uppercase">Peak</p>
                    <p className="text-xs font-black text-gray-800">{peak.value.toFixed(0)}h</p>
                  </div>
                </div>
                <p className="text-[9px] text-gray-400 mb-1">Click a month bar to drill down →</p>
                <div className="space-y-1">
                  {row.series.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDrillMonth(s.month)}
                      className="w-full flex items-center gap-2 text-left hover:bg-red-50/30 rounded px-1 transition-colors"
                    >
                      <span className="w-16 text-[9px] text-gray-500 truncate">{String(s.month).split(", ")[0]}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(s.value / maxVal) * 100}%`, backgroundColor: s.value >= avg ? row.color : row.color + "66" }}
                        />
                      </div>
                      <span className="w-12 text-right text-[9px] font-semibold text-gray-700">{s.value.toFixed(1)}h</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* ================================================================
   4. CLIENT PROCESSING SHARE (Donut) — with in-place drill-down
   ================================================================ */

export function ClientShareDonut({
  data,
  languageMatrix,
  monthlyContribution,
  clientIds,
}: {
  data: ClientShare[];
  languageMatrix?: LanguageMatrix;
  monthlyContribution?: Record<string, string | number>[];
  clientIds?: string[];
}) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.createdHours, 0);
  const pieData = data.map((d) => ({ name: d.client_id, value: d.createdHours, pct: total === 0 ? 0 : Math.round((d.createdHours / total) * 1000) / 10 }));

  const selectedRow = data.find((d) => d.client_id === selectedClient);
  const langRows = useMemo(() => {
    if (!selectedClient || !languageMatrix?.data[selectedClient]) return [];
    const cells = languageMatrix.data[selectedClient];
    return Object.entries(cells).map(([lang, c]) => ({
      language: lang,
      uploadedHours: Number(c.uploadedHours ?? 0),
      processingHours: Number(c.processingHours ?? 0),
      publishedHours: Number(c.publishedHours ?? 0),
    })).filter((r) => r.processingHours > 0 || r.uploadedHours > 0 || r.publishedHours > 0).sort((a, b) => b.processingHours - a.processingHours);
  }, [selectedClient, languageMatrix]);
  const monthlySeries = useMemo(() => {
    if (!selectedClient || !monthlyContribution?.length) return [];
    return monthlyContribution.map((m) => ({ month: String(m.month), value: Number(m[selectedClient] ?? 0) }));
  }, [selectedClient, monthlyContribution]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Client Processing Share</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Who drives capacity usage?</p>
        </div>
        <div className="flex items-center gap-1">
          {selectedClient && (
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              ← Back
            </button>
          )}
          <DefinitionButton definition="Donut chart showing each client's share of total processed hours. Click a segment to drill down into that client. Identifies which accounts drive the most capacity usage." />
          <InsightButton page="page4" widget="client_processing_share" title="Client Processing Share insight" />
        </div>
      </div>
      <div className="flex-1 p-2 min-h-0 overflow-auto">
        {selectedClient && selectedRow ? (
          <div className="h-full flex flex-col gap-3">
            <div className="shrink-0 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: getClientColor(selectedClient, data.findIndex((d) => d.client_id === selectedClient)) }} />
              <span className="text-sm font-bold text-gray-900">{selectedClient}</span>
            </div>
            <div className="shrink-0 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-2 py-1.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Uploaded</p>
                <p className="text-sm font-black text-gray-800">{selectedRow.uploadedHours.toFixed(0)}h</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-red-50/50 px-2 py-1.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Processed</p>
                <p className="text-sm font-black text-red-600">{selectedRow.createdHours.toFixed(0)}h</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-emerald-50/50 px-2 py-1.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Published</p>
                <p className="text-sm font-black text-emerald-600">{selectedRow.publishedHours.toFixed(0)}h</p>
              </div>
            </div>
            {monthlySeries.length > 0 && (
              <div className="flex-1 min-h-[80px]">
                <p className="text-[10px] font-bold text-gray-400 mb-1">Monthly trend</p>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySeries} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                    <Area type="monotone" dataKey="value" stroke={getClientColor(selectedClient, 0)} fill={getClientColor(selectedClient, 0)} fillOpacity={0.2} strokeWidth={1.5} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {langRows.length > 0 && (
              <div className="shrink-0">
                <p className="text-[10px] font-bold text-gray-400 mb-1">By language</p>
                <div className="flex flex-wrap gap-1">
                  {langRows.slice(0, 8).map((r) => (
                    <div key={r.language} className="px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-[10px]">
                      <span className="font-semibold text-gray-700">{r.language}</span>
                      <span className="text-gray-400 ml-1">{r.processingHours.toFixed(0)}h</span>
                    </div>
                  ))}
                  {langRows.length > 8 && <span className="text-[10px] text-gray-400">+{langRows.length - 8} more</span>}
                </div>
              </div>
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius="50%"
                outerRadius="78%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                onClick={(data) => {
                  const name = (data as { name?: string })?.name;
                  if (name) setSelectedClient((prev) => (prev === name ? null : String(name)));
                }}
                style={{ cursor: "pointer" }}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(v, name) => [`${Number(v).toFixed(0)}h (${pieData.find((p) => p.name === String(name))?.pct ?? 0}%)`, String(name)]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   5. CONTENT AMPLIFICATION FACTOR (unique — how much content each upload generates)
   ================================================================ */

export function AmplificationChart({
  data,
  featureMatrix,
}: {
  data: AmplificationRow[];
  featureMatrix?: FeatureMatrix;
}) {
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const chartData = data.map((d) => ({
    name: d.client_id, uploaded: d.uploaded, created: d.created, published: d.published, factor: d.amplification,
  }));

  const selectedRow = data.find((d) => d.client_id === selectedClient);
  const outputTypeRows = useMemo(() => {
    if (!selectedClient || !featureMatrix?.data[selectedClient]) return [];
    const cells = featureMatrix.data[selectedClient];
    return Object.entries(cells)
      .map(([ot, c]) => ({ outputType: ot, created: c.created, published: c.published }))
      .filter((r) => r.created > 0 || r.published > 0)
      .sort((a, b) => b.created - a.created);
  }, [selectedClient, featureMatrix]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Content Amplification Factor</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">For every 1 upload, how many outputs are generated?</p>
        </div>
        <div className="flex items-center gap-1">
          {selectedClient && (
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              ← Back
            </button>
          )}
          <DefinitionButton definition="Processed count ÷ uploaded count per client. Click a client to drill down. Shows how much content each upload generates (e.g. 5× means 1 upload yields 5 outputs)." />
          <InsightButton page="page4" widget="content_amplification_factor" title="Content Amplification Factor insight" />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-3 flex flex-col gap-2 overflow-auto">
        {selectedClient && selectedRow ? (
          <div className="flex flex-col gap-3">
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">{selectedClient}</span>
              <span className="text-xs font-black text-red-600">{selectedRow.amplification}×</span>
            </div>
            <div className="shrink-0 grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-2 py-1.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Uploaded</p>
                <p className="text-sm font-black text-gray-800">{selectedRow.uploaded.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-red-50/50 px-2 py-1.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Processed</p>
                <p className="text-sm font-black text-red-600">{selectedRow.created.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-emerald-50/50 px-2 py-1.5 text-center">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Published</p>
                <p className="text-sm font-black text-emerald-600">{selectedRow.published.toLocaleString()}</p>
              </div>
            </div>
            {outputTypeRows.length > 0 && (
              <div className="shrink-0">
                <p className="text-[10px] font-bold text-gray-400 mb-1">By output type</p>
                <div className="flex flex-wrap gap-1.5">
                  {outputTypeRows.map((r) => (
                    <div key={r.outputType} className="px-2 py-1 rounded-md bg-gray-50 border border-gray-100 text-[10px]">
                      <span className="font-semibold text-gray-700">{r.outputType}</span>
                      <span className="text-gray-400 ml-1">P:{r.published.toLocaleString()} · C:{r.created.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="uploaded" name="Uploaded" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32}
                    onClick={(data) => { const name = (data as { name?: string })?.name; if (name) setSelectedClient((p) => (p === name ? null : name)); }} cursor="pointer" />
                  <Bar dataKey="created" name="Processed" fill="#e9434a" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.7}
                    onClick={(data) => { const name = (data as { name?: string })?.name; if (name) setSelectedClient((p) => (p === name ? null : name)); }} cursor="pointer" />
                  <Bar dataKey="published" name="Published" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32}
                    onClick={(data) => { const name = (data as { name?: string })?.name; if (name) setSelectedClient((p) => (p === name ? null : name)); }} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="shrink-0 flex flex-wrap gap-1.5">
              {chartData.map((d, i) => (
                <button
                  key={d.name}
                  type="button"
                  onClick={() => setSelectedClient((p) => (p === d.name ? null : d.name))}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-[10px] font-semibold text-gray-700">{d.name}</span>
                  <span className="text-xs font-black text-gray-900">{d.factor}×</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   6. PUBLISHED HOURS BY PLATFORM (unique — from channel_wise_publishing_duration)
   ================================================================ */

export type PlatformHoursByClientRow = { client_id: string; platform: string; hours: number };

export function PlatformHoursChart({
  data,
  platformHoursByClient,
}: {
  data: PlatformHoursRow[];
  platformHoursByClient?: PlatformHoursByClientRow[];
}) {
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [drillClient, setDrillClient] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const platformGroups = useMemo(() => {
    if (!platformHoursByClient) return [];
    const byPlatform = new Map<string, { client_id: string; hours: number }[]>();
    for (const r of platformHoursByClient) {
      if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, []);
      byPlatform.get(r.platform)!.push({ client_id: r.client_id, hours: r.hours });
    }
    return data.map((p) => ({
      platform: p.platform,
      totalHours: p.hours,
      clients: (byPlatform.get(p.platform) ?? []).sort((a, b) => b.hours - a.hours),
    }));
  }, [data, platformHoursByClient]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Published Duration by Platform</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Total published hours reaching each platform</p>
        </div>
        <div className="flex items-center gap-1">
          {showAllPlatforms ? (
            <button
              type="button"
              onClick={() => setShowAllPlatforms(false)}
              className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAllPlatforms(true)}
              className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Show all platforms
            </button>
          )}
          <DefinitionButton definition="Total hours of content published to each platform. Use 'Show all platforms' to see client breakdown for every platform. Aggregated from channel_wise_publishing_duration." />
          <InsightButton page="page4" widget="published_hours_by_platform" title="Published Duration by Platform insight" />
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 overflow-auto">
        {showAllPlatforms ? (
          <div className="space-y-4">
            {platformGroups.map((g, idx) => (
              <div key={g.platform} className="rounded-lg border border-gray-100 bg-gray-50/30 p-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-900">{g.platform}</span>
                  <span className="text-[10px] font-bold text-emerald-600">{g.totalHours.toFixed(1)}h total</span>
                </div>
                {g.clients.length > 0 ? (
                  <div className="space-y-1">
                    {g.clients.map((r, i) => (
                      <div key={`${g.platform}-${r.client_id}`} className="flex items-center justify-between py-1 px-2 rounded bg-white border border-gray-100">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-[10px] font-semibold text-gray-700">{r.client_id}</span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-900">{r.hours.toFixed(1)}h</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-gray-400 py-1">No client data</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}h`} />
              <YAxis type="category" dataKey="platform" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(v) => [`${Number(v).toFixed(1)}h`, "Published"]} />
              <Bar
                dataKey="hours"
                radius={[0, 6, 6, 0]}
                maxBarSize={24}
                cursor="pointer"
                onClick={(barData) => {
                  const platform = (barData as { platform?: string }).platform;
                  if (platform) setSelectedPlatform((p) => (p === platform ? null : platform));
                }}
              >
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {selectedPlatform && !showAllPlatforms && (() => {
          const group = platformGroups.find((g) => g.platform === selectedPlatform);
          if (!group) return null;
          const maxClientHours = group.clients[0]?.hours || 1;
          return (
            <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800">{selectedPlatform} — Client breakdown</p>
                  <p className="text-[10px] text-emerald-600 font-bold">{group.totalHours.toFixed(1)}h total</p>
                </div>
                <div className="flex items-center gap-2">
                  {drillClient && (
                    <button type="button" onClick={() => { setDrillClient(null); setShowRaw(false); }} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">← Back</button>
                  )}
                  <button type="button" onClick={() => { setSelectedPlatform(null); setDrillClient(null); setShowRaw(false); }} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">Close ✕</button>
                </div>
              </div>
              {drillClient ? (
                /* ── L3: raw records for this client × platform ── */
                showRaw ? (
                  <DrillRawTable
                    filters={{ client_id: drillClient, platform: selectedPlatform }}
                    title={`Raw records — ${drillClient} · ${selectedPlatform}`}
                    onClose={() => setShowRaw(false)}
                  />
                ) : (
                  (() => {
                    const clientRow = group.clients.find((c) => c.client_id === drillClient);
                    const clientPct = group.totalHours > 0 ? ((clientRow?.hours ?? 0) / group.totalHours) * 100 : 0;
                    return (
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded bg-emerald-50 px-2 py-1.5 text-center border border-emerald-100">
                            <p className="text-[9px] text-gray-400 uppercase">Published Hours</p>
                            <p className="text-sm font-black text-emerald-600">{(clientRow?.hours ?? 0).toFixed(1)}h</p>
                          </div>
                          <div className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                            <p className="text-[9px] text-gray-400 uppercase">Platform Share</p>
                            <p className="text-sm font-black text-gray-800">{clientPct.toFixed(0)}%</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRaw(true)}
                          className="w-full rounded-lg border border-dashed border-gray-200 py-2 text-[10px] font-semibold text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                        >
                          🔍 View raw records for {drillClient} on {selectedPlatform}
                        </button>
                      </div>
                    );
                  })()
                )
              ) : group.clients.length > 0 ? (
                <>
                  <p className="text-[9px] text-gray-400 mb-1.5">Click a client to see their raw records →</p>
                  <div className="space-y-1.5">
                    {group.clients.map((r, i) => {
                      const pct = group.totalHours > 0 ? (r.hours / group.totalHours) * 100 : 0;
                      return (
                        <button
                          key={r.client_id}
                          type="button"
                          onClick={() => setDrillClient(r.client_id)}
                          className="w-full flex items-center gap-2 text-left hover:bg-red-50/30 rounded px-1 transition-colors"
                        >
                          <span className="w-16 text-[10px] font-semibold text-gray-700 truncate">{r.client_id}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(r.hours / maxClientHours) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                          </div>
                          <span className="w-14 text-right text-[10px] font-bold text-gray-800">{r.hours.toFixed(1)}h</span>
                          <span className="w-8 text-right text-[10px] text-gray-400">{pct.toFixed(0)}%</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-gray-400">No client data for this platform.</p>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ================================================================
   7. LANGUAGE COVERAGE BY CLIENT (Heatmap — unique)
   ================================================================ */

export function LanguageHeatmap({ matrix }: { matrix: LanguageMatrix }) {
  const [metric, setMetric] = useState<
    | "processingHours"
    | "uploadedHours"
    | "publishedHours"
    | "processingCount"
    | "uploadedCount"
    | "publishedCount"
  >("processingHours");
  const [selectedCell, setSelectedCell] = useState<{ client: string; language: string; value: number } | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const getLanguageMetricValue = useCallback(
    (clientId: string, language: string): number => {
    const cell = matrix.data[clientId]?.[language] as
      | (LanguageMatrix["data"][string][string] & {
          hours?: number;
          published?: number;
        })
      | undefined;
    if (!cell) return 0;

    switch (metric) {
      case "processingHours":
        return Number(cell.processingHours ?? cell.hours ?? 0);
      case "uploadedHours":
        return Number(cell.uploadedHours ?? 0);
      case "publishedHours":
        return Number(cell.publishedHours ?? 0);
      case "processingCount":
        return Number(cell.processingCount ?? 0);
      case "uploadedCount":
        return Number(cell.uploadedCount ?? 0);
      case "publishedCount":
        return Number(cell.publishedCount ?? cell.published ?? 0);
      default:
        return 0;
    }
    },
    [matrix, metric]
  );

  const maxVal = useMemo(() => {
    let mx = 0;
    for (const cid of matrix.clients) for (const lang of matrix.languages) {
      const v = getLanguageMetricValue(cid, lang);
      if (v > mx) mx = v;
    }
    return mx || 1;
  }, [matrix, metric, getLanguageMetricValue]);

  function cellColor(val: number) {
    if (val === 0) return "bg-gray-50 text-gray-300";
    const r = val / maxVal;
    if (r > 0.7) return "bg-blue-600 text-white";
    if (r > 0.4) return "bg-blue-400 text-white";
    if (r > 0.15) return "bg-blue-100 text-blue-700";
    return "bg-blue-50 text-blue-500";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Language Coverage by Client</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Which languages each account processes</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <DefinitionButton definition="Heatmap of uploaded, processing, and published metrics (hours/counts) by client and language. Shows language activity depth per account." />
            <InsightButton page="page4" widget="language_coverage_heatmap" title="Language Coverage insight" />
          </div>
        </div>
        <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-red-400">
          <option value="processingHours">Processing Hours</option>
          <option value="uploadedHours">Uploaded Hours</option>
          <option value="publishedHours">Published Hours</option>
          <option value="processingCount">Processing Count</option>
          <option value="uploadedCount">Uploaded Count</option>
          <option value="publishedCount">Published Count</option>
        </select>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1.5 text-left sticky left-0 bg-white">Client</th>
              {matrix.languages.map((l) => <th key={l} className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1.5">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.clients.map((cid) => (
              <tr key={cid}>
                <td className="text-[11px] font-semibold text-gray-700 px-2 py-1.5 text-left sticky left-0 bg-white">{cid}</td>
                {matrix.languages.map((lang) => {
                  const val = getLanguageMetricValue(cid, lang);
                  const isHours = metric.includes("Hours");
                  return (
                    <td key={lang} className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCell({ client: cid, language: lang, value: val })}
                        className={`w-full rounded-md px-2 py-1.5 text-[10px] font-bold ${cellColor(val)}`}
                      >
                        {val > 0 ? (isHours ? `${val}h` : val.toLocaleString()) : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {selectedCell && (() => {
          const cell = matrix.data[selectedCell.client]?.[selectedCell.language];
          if (!cell) return null;
          const uploadH = Number(cell.uploadedHours ?? 0);
          const procH = Number(cell.processingHours ?? 0);
          const pubH = Number(cell.publishedHours ?? 0);
          const uploadC = Number(cell.uploadedCount ?? 0);
          const procC = Number(cell.processingCount ?? 0);
          const pubC = Number(cell.publishedCount ?? 0);
          const processRate = uploadC > 0 ? Math.round((procC / uploadC) * 100) : 0;
          const publishRate = procC > 0 ? Math.round((pubC / procC) * 100) : 0;
          return (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-800">
                  {selectedCell.client} · {selectedCell.language}
                </p>
                <button type="button" onClick={() => { setSelectedCell(null); setShowRaw(false); }} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">Close ✕</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="rounded bg-gray-50 px-2 py-1.5 text-center border border-gray-100">
                  <p className="text-[9px] text-gray-400 uppercase">Uploaded</p>
                  <p className="text-xs font-black text-gray-800">{uploadH.toFixed(0)}h</p>
                  <p className="text-[9px] text-gray-400">{uploadC.toLocaleString()} videos</p>
                </div>
                <div className="rounded bg-red-50 px-2 py-1.5 text-center border border-red-100">
                  <p className="text-[9px] text-gray-400 uppercase">Processed</p>
                  <p className="text-xs font-black text-red-600">{procH.toFixed(0)}h</p>
                  <p className="text-[9px] text-gray-400">{procC.toLocaleString()} videos</p>
                </div>
                <div className="rounded bg-emerald-50 px-2 py-1.5 text-center border border-emerald-100">
                  <p className="text-[9px] text-gray-400 uppercase">Published</p>
                  <p className="text-xs font-black text-emerald-600">{pubH.toFixed(0)}h</p>
                  <p className="text-[9px] text-gray-400">{pubC.toLocaleString()} videos</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] flex-wrap mb-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600">{uploadC}</span>
                <span className="text-gray-300">→</span>
                <span className={`rounded px-2 py-0.5 font-bold ${processRate >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{processRate}%</span>
                <span className="text-gray-300">→</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600">{procC}</span>
                <span className="text-gray-300">→</span>
                <span className={`rounded px-2 py-0.5 font-bold ${publishRate >= 50 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{publishRate}%</span>
                <span className="text-gray-300">→</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-gray-600">{pubC}</span>
              </div>
              {showRaw ? (
                <DrillRawTable
                  filters={{ client_id: selectedCell.client, language: selectedCell.language }}
                  title={`Raw records — ${selectedCell.client} · ${selectedCell.language}`}
                  onClose={() => setShowRaw(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRaw(true)}
                  className="w-full rounded-lg border border-dashed border-gray-200 py-2 text-[10px] font-semibold text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  🔍 View raw records — {selectedCell.client} · {selectedCell.language}
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ================================================================
   8. FEATURE ADOPTION HEATMAP (Client × Output Type)
   ================================================================ */

export function FeatureAdoptionHeatmap({ matrix }: { matrix: FeatureMatrix }) {
  const [metric, setMetric] = useState<"published" | "created">("published");
  const [selectedCell, setSelectedCell] = useState<{ client: string; outputType: string; value: number } | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const maxVal = useMemo(() => {
    let mx = 0;
    for (const cid of matrix.clients) for (const ot of matrix.outputTypes) {
      const v = matrix.data[cid]?.[ot]?.[metric] ?? 0;
      if (v > mx) mx = v;
    }
    return mx || 1;
  }, [matrix, metric]);

  function cellColor(val: number) {
    if (val === 0) return "bg-gray-50 text-gray-300";
    const r = val / maxVal;
    if (r > 0.7) return "bg-red-500 text-white";
    if (r > 0.4) return "bg-red-300 text-white";
    if (r > 0.15) return "bg-red-100 text-red-700";
    return "bg-red-50 text-red-500";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Feature Adoption by Client</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Output type usage intensity across accounts</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <DefinitionButton definition="Heatmap of published or processed count by client and output type (e.g. Shorts, Long-form). Shows feature adoption intensity." />
            <InsightButton page="page4" widget="feature_adoption_heatmap" title="Feature Adoption insight" />
          </div>
        </div>
        <select value={metric} onChange={(e) => setMetric(e.target.value as "published" | "created")}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-red-400">
          <option value="published">Published</option>
          <option value="created">Processed</option>
        </select>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1.5 text-left sticky left-0 bg-white">Client</th>
              {matrix.outputTypes.map((ot) => <th key={ot} className="text-[10px] font-bold text-gray-400 uppercase px-2 py-1.5">{ot}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.clients.map((cid) => (
              <tr key={cid}>
                <td className="text-[11px] font-semibold text-gray-700 px-2 py-1.5 text-left sticky left-0 bg-white">{cid}</td>
                {matrix.outputTypes.map((ot) => {
                  const val = matrix.data[cid]?.[ot]?.[metric] ?? 0;
                  return (
                    <td key={ot} className="px-1 py-1">
                      <button
                        type="button"
                        onClick={() => setSelectedCell({ client: cid, outputType: ot, value: val })}
                        className={`w-full rounded-md px-2 py-1.5 text-[10px] font-bold ${cellColor(val)}`}
                      >
                        {val > 0 ? val.toLocaleString() : "—"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {selectedCell && (() => {
          const cell = matrix.data[selectedCell.client]?.[selectedCell.outputType];
          const created = Number(cell?.created ?? 0);
          const published = Number(cell?.published ?? 0);
          const publishRate = created > 0 ? Math.round((published / created) * 100) : 0;
          return (
            <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-800">
                  {selectedCell.client} · {selectedCell.outputType}
                </p>
                <button type="button" onClick={() => { setSelectedCell(null); setShowRaw(false); }} className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200">Close ✕</button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <div className="rounded bg-red-50 px-2 py-1.5 text-center border border-red-100">
                  <p className="text-[9px] text-gray-400 uppercase">Processed</p>
                  <p className="text-sm font-black text-red-600">{created.toLocaleString()}</p>
                </div>
                <div className="rounded bg-emerald-50 px-2 py-1.5 text-center border border-emerald-100">
                  <p className="text-[9px] text-gray-400 uppercase">Published</p>
                  <p className="text-sm font-black text-emerald-600">{published.toLocaleString()}</p>
                </div>
                <div className={`rounded px-2 py-1.5 text-center border ${publishRate >= 50 ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                  <p className="text-[9px] text-gray-400 uppercase">Pub Rate</p>
                  <p className={`text-sm font-black ${publishRate >= 50 ? "text-emerald-600" : "text-rose-500"}`}>{publishRate}%</p>
                </div>
              </div>
              {showRaw ? (
                <DrillRawTable
                  filters={{ client_id: selectedCell.client, output_type: selectedCell.outputType }}
                  title={`Raw records — ${selectedCell.client} · ${selectedCell.outputType}`}
                  onClose={() => setShowRaw(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRaw(true)}
                  className="w-full rounded-lg border border-dashed border-gray-200 py-2 text-[10px] font-semibold text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  🔍 View raw records — {selectedCell.client} · {selectedCell.outputType}
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ================================================================
   9. DATA QUALITY MONITOR
   ================================================================ */

export function DataQualityMonitor({ dq }: { dq: DataQuality }) {
  const issues = [
    { label: "Unknown Input Type", count: dq.missingInputType, color: "#f59e0b" },
    { label: "Unknown Language", count: dq.missingLanguage, color: "#8b5cf6" },
    { label: "Published — No Platform", count: dq.publishedNoPlatform, color: "#e9434a" },
    { label: "Published — No URL", count: dq.publishedNoUrl, color: "#ec4899" },
  ];
  const completePct = dq.total === 0 ? 100
    : Math.round(((dq.total - issues.reduce((s, i) => s + i.count, 0)) / dq.total) * 1000) / 10;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-center justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Data Quality Monitor</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Field-level completeness across {dq.total.toLocaleString()} videos</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <DefinitionButton definition="Counts of videos with missing input type, language, platform, or URL. Lower counts indicate better data quality." />
            <InsightButton page="page4" widget="data_quality_monitor" title="Data Quality Monitor insight" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${completePct >= 95 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${completePct}%` }} />
          </div>
          <span className={`text-xs font-bold ${completePct >= 95 ? "text-emerald-600" : "text-amber-600"}`}>{completePct}% complete</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={issues} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={170} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v) => { const n = Number(v); return [`${n} videos (${dq.total === 0 ? 0 : ((n / dq.total) * 100).toFixed(2)}%)`, "Count"]; }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {issues.map((item, i) => <Cell key={i} fill={item.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ================================================================
   10. RISK & UNDERPERFORMANCE TABLE
   ================================================================ */

function riskLevel(row: RiskRow) {
  const publishRate = row.totalCreated === 0 ? 0 : (row.totalPublished / row.totalCreated) * 100;
  const dataIssues = row.unknownInput + row.pubNoPlatform + row.pubNoUrl;
  const featureGap = row.totalOutputTypes - row.outputTypesUsed;
  let score = 0;
  if (publishRate < 0.5) score += 3; else if (publishRate < 1) score += 2; else if (publishRate < 2) score += 1;
  if (dataIssues > 50) score += 2; else if (dataIssues > 10) score += 1;
  if (featureGap >= 3) score += 2; else if (featureGap >= 1) score += 1;
  if (score >= 5) return { label: "HIGH RISK", cls: "bg-rose-50 text-rose-700 border-rose-200" };
  if (score >= 3) return { label: "MODERATE", cls: "bg-amber-50 text-amber-700 border-amber-200" };
  return { label: "HEALTHY", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
}

export function RiskTable({ data }: { data: RiskRow[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Client Risk & Underperformance Monitor</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Composite risk score from publish rate, data quality gaps, and feature adoption</p>
        </div>
        <div className="flex items-center gap-1">
          <DefinitionButton definition="Risk score combines: publish rate (published/created), data issues (unknown input, missing platform/URL), and feature gap (unused output types). HIGH/MODERATE/HEALTHY." />
          <InsightButton page="page4" widget="risk_underperformance_monitor" title="Risk Monitor insight" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/50 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            <tr>
              <th className="px-5 py-3">Account</th><th className="px-5 py-3">Processed Hrs</th>
              <th className="px-5 py-3">Published / Created</th><th className="px-5 py-3">Publish Rate</th>
              <th className="px-5 py-3">Data Issues</th><th className="px-5 py-3">Feature Gap</th>
              <th className="px-5 py-3 text-right">Risk Level</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {data.map((row) => {
              const rl = riskLevel(row);
              const pubRate = row.totalCreated === 0 ? 0 : Math.round((row.totalPublished / row.totalCreated) * 1000) / 10;
              const dataIssues = row.unknownInput + row.pubNoPlatform + row.pubNoUrl;
              return (
                <tr key={row.client_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-gray-800">{row.client_id}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-600">{row.createdHours.toLocaleString("en-US",{maximumFractionDigits:0})}h</td>
                  <td className="px-5 py-3.5 text-gray-600"><span className="font-semibold text-gray-800">{row.totalPublished.toLocaleString()}</span><span className="text-gray-400"> / </span>{row.totalCreated.toLocaleString()}</td>
                  <td className="px-5 py-3.5"><div className="flex items-center gap-2"><div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${pubRate >= 2 ? "bg-emerald-500" : pubRate >= 1 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${Math.min(pubRate * 10, 100)}%` }} /></div><span className="text-xs font-bold text-gray-700">{pubRate}%</span></div></td>
                  <td className="px-5 py-3.5">{dataIssues > 0 ? <span className="text-xs font-semibold text-amber-600">{dataIssues} issues</span> : <span className="text-xs text-emerald-500 font-medium">Clean</span>}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs font-medium">{row.outputTypesUsed}/{row.totalOutputTypes} types</td>
                  <td className="px-5 py-3.5 text-right"><span className={`text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full border ${rl.cls}`}>{rl.label}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   11. VIDEO EXPLORER
   ================================================================ */

export function VideoExplorer({ data }: { data: VideoRow[] }) {
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("All");
  const platforms = useMemo(() => ["All", ...Array.from(new Set(data.map((v) => v.published_platform))).sort()], [data]);
  const filtered = useMemo(() => {
    let rows = data;
    if (search) { const q = search.toLowerCase(); rows = rows.filter((r) => String(r.video_id).includes(q) || r.client_id.toLowerCase().includes(q) || r.channel_name.toLowerCase().includes(q) || r.user_name.toLowerCase().includes(q)); }
    if (platformFilter !== "All") rows = rows.filter((r) => r.published_platform === platformFilter);
    return rows;
  }, [data, search, platformFilter]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-900">Published Video Explorer</h3>
          <DefinitionButton definition="Searchable table of published videos with client, channel, user, output type, platform, and URL. Use filters to narrow results." />
          <InsightButton page="page4" widget="published_video_explorer" title="Published Video Explorer insight" />
        </div>
        <div className="flex gap-2">
          <input type="text" placeholder="Search ID, client, channel, user..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-red-400 transition-colors w-48" />
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-red-400 transition-colors font-medium text-gray-700">
            {platforms.map((p) => <option key={p} value={p}>{p === "All" ? "All Platforms" : p}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-gray-50 text-gray-400 font-bold uppercase sticky top-0">
            <tr>
              <th className="px-5 py-2.5">Video ID</th><th className="px-5 py-2.5">Client</th><th className="px-5 py-2.5">Channel</th>
              <th className="px-5 py-2.5">User</th><th className="px-5 py-2.5">Type</th><th className="px-5 py-2.5">Platform</th>
              <th className="px-5 py-2.5 text-right">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400 text-xs">No matching videos found</td></tr> :
              filtered.map((v, i) => (
                <tr key={v.video_id ?? `row-${i}`} className="hover:bg-red-50/20 transition-colors">
                  <td className="px-5 py-2.5 font-mono text-gray-600">{v.video_id}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800">{v.client_id}</td>
                  <td className="px-5 py-2.5 text-gray-600">{v.channel_name}</td>
                  <td className="px-5 py-2.5 text-gray-600">{v.user_name}</td>
                  <td className="px-5 py-2.5 text-red-600 font-medium">{v.output_type_name}</td>
                  <td className="px-5 py-2.5 text-gray-600">{v.published_platform}</td>
                  <td className="px-5 py-2.5 text-right">{v.published_url ? <a href={v.published_url} target="_blank" rel="noopener noreferrer" className="text-red-500 hover:text-red-700 font-medium transition-colors">View ↗</a> : <span className="text-gray-300">—</span>}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2 border-t border-gray-100 text-[10px] text-gray-400">Showing {filtered.length} of {data.length} published videos</div>
    </div>
  );
}
