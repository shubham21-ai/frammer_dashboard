"use client";

import { useState, useMemo, useCallback } from "react";
import { DefinitionButton } from "@/components/ui/DefinitionButton";
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
              <span className="text-xs opacity-60">{c.icon}</span>
            </div>
          </div>
          <p className={`text-xl font-black mt-0.5 ${c.valueColor}`}>{c.value}</p>
          <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ================================================================
   2. MONTHLY CLIENT BILLING CONTRIBUTION (Stacked Area)
   ================================================================ */

export function MonthlyContributionChart({ data, clientIds }: { data: Record<string, string | number>[]; clientIds: string[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Monthly Client Billing Contribution</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Processed hours stacked by client</p>
        </div>
        <DefinitionButton definition="Stacked area chart of processed hours per client per month. Shows each client's contribution to total capacity over time." />
      </div>
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
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
    </div>
  );
}

/* ================================================================
   3. CLIENT GROWTH MOMENTUM (Sparklines)
   ================================================================ */

export function ClientMomentumTracker({ data, clientIds }: { data: Record<string, string | number>[]; clientIds: string[] }) {
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
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Client Growth Momentum</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Quarterly trend shift per account</p>
        </div>
        <DefinitionButton definition="Compares recent 3 months vs. prior 3 months per client. Growth % shows whether each account is accelerating or decelerating in processed volume." />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-1.5">
        {clientRows.map((row) => (
          <div key={row.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
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
    </div>
  );
}

/* ================================================================
   4. CLIENT PROCESSING SHARE (Donut)
   ================================================================ */

export function ClientShareDonut({ data }: { data: ClientShare[] }) {
  const total = data.reduce((s, d) => s + d.createdHours, 0);
  const pieData = data.map((d) => ({ name: d.client_id, value: d.createdHours, pct: total === 0 ? 0 : Math.round((d.createdHours / total) * 1000) / 10 }));
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-4 py-2 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Client Processing Share</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Who drives capacity usage?</p>
        </div>
        <DefinitionButton definition="Donut chart showing each client's share of total processed hours. Identifies which accounts drive the most capacity usage." />
      </div>
      <div className="flex-1 p-2 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius="50%" outerRadius="78%" paddingAngle={2} dataKey="value" nameKey="name">
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v, name) => [`${Number(v).toFixed(0)}h (${pieData.find((p) => p.name === String(name))?.pct ?? 0}%)`, String(name)]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ================================================================
   5. CONTENT AMPLIFICATION FACTOR (unique — how much content each upload generates)
   ================================================================ */

export function AmplificationChart({ data }: { data: AmplificationRow[] }) {
  const chartData = data.map((d) => ({
    name: d.client_id, uploaded: d.uploaded, created: d.created, published: d.published, factor: d.amplification,
  }));
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="shrink-0 px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Content Amplification Factor</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">For every 1 upload, how many outputs are generated?</p>
        </div>
        <DefinitionButton definition="Processed count ÷ uploaded count per client. Shows how much content each upload generates (e.g. 5× means 1 upload yields 5 outputs)." />
      </div>
      <div className="flex-1 min-h-0 p-3 flex flex-col gap-2">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="uploaded" name="Uploaded" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="created" name="Processed" fill="#e9434a" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.7} />
              <Bar dataKey="published" name="Published" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="shrink-0 flex flex-wrap gap-1.5">
          {chartData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-[10px] font-semibold text-gray-700">{d.name}</span>
              <span className="text-xs font-black text-gray-900">{d.factor}×</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   6. PUBLISHED HOURS BY PLATFORM (unique — from channel_wise_publishing_duration)
   ================================================================ */

export function PlatformHoursChart({ data }: { data: PlatformHoursRow[] }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Published Duration by Platform</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Total published hours reaching each platform</p>
        </div>
        <DefinitionButton definition="Total hours of content published to each platform (YouTube, TikTok, etc.). Aggregated from channel_wise_publishing_duration." />
      </div>
      <div className="flex-1 min-h-0 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}h`} />
            <YAxis type="category" dataKey="platform" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={80} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
              formatter={(v) => [`${Number(v).toFixed(1)}h`, "Published"]} />
            <Bar dataKey="hours" radius={[0, 6, 6, 0]} maxBarSize={24}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
        <div className="flex items-start gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Language Coverage by Client</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Which languages each account processes</p>
          </div>
          <DefinitionButton definition="Heatmap of uploaded, processing, and published metrics (hours/counts) by client and language. Shows language activity depth per account." />
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
                  return <td key={lang} className="px-1 py-1"><div className={`rounded-md px-2 py-1.5 text-[10px] font-bold ${cellColor(val)}`}>{val > 0 ? (isHours ? `${val}h` : val.toLocaleString()) : "—"}</div></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================================================================
   8. FEATURE ADOPTION HEATMAP (Client × Output Type)
   ================================================================ */

export function FeatureAdoptionHeatmap({ matrix }: { matrix: FeatureMatrix }) {
  const [metric, setMetric] = useState<"published" | "created">("published");
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
        <div className="flex items-start gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Feature Adoption by Client</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Output type usage intensity across accounts</p>
          </div>
          <DefinitionButton definition="Heatmap of published or processed count by client and output type (e.g. Shorts, Long-form). Shows feature adoption intensity." />
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
                  return <td key={ot} className="px-1 py-1"><div className={`rounded-md px-2 py-1.5 text-[10px] font-bold ${cellColor(val)}`}>{val > 0 ? val.toLocaleString() : "—"}</div></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
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
        <div className="flex items-start gap-2">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Data Quality Monitor</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Field-level completeness across {dq.total.toLocaleString()} videos</p>
          </div>
          <DefinitionButton definition="Counts of videos with missing input type, language, platform, or URL. Lower counts indicate better data quality." />
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
        <DefinitionButton definition="Risk score combines: publish rate (published/created), data issues (unknown input, missing platform/URL), and feature gap (unused output types). HIGH/MODERATE/HEALTHY." />
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
