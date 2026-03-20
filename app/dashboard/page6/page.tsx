"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface GenerateResult {
  title: string;
  widget_type: string;
  sql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  chart_spec: Record<string, unknown>;
  error?: string;
}

interface SavedWidget {
  id: number;
  title: string;
  prompt: string;
  sql_query: string;
  widget_type: string;
  config: Record<string, unknown>;
  created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = [
  "#e9434a", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

const TYPE_BADGE: Record<string, string> = {
  kpi: "KPI",
  bar: "Bar",
  line: "Line",
  pie: "Pie",
  table: "Table",
};

const TYPE_BADGE_COLOR: Record<string, string> = {
  kpi: "bg-red-50 text-red-600",
  bar: "bg-amber-50 text-amber-600",
  line: "bg-blue-50 text-blue-600",
  pie: "bg-emerald-50 text-emerald-600",
  table: "bg-gray-100 text-gray-600",
};

// ── Widget renderer ───────────────────────────────────────────────────────────

function WidgetRenderer({
  type,
  config,
}: {
  type: string;
  config: Record<string, unknown>;
}) {
  if (type === "kpi") {
    const value = config.value as number | undefined;
    const label = (config.label as string | undefined) ?? "value";
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <p className="text-4xl font-black text-gray-900 tabular-nums">
          {value !== undefined ? value.toLocaleString() : "—"}
        </p>
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1.5">
          {label}
        </p>
      </div>
    );
  }

  if (type === "bar" || type === "line") {
    const spec = config as {
      labels?: string[];
      datasets?: { name: string; data: number[] }[];
    };
    const labels = spec.labels ?? [];
    const datasets = spec.datasets ?? [];
    const chartData = labels.map((label, i) => {
      const point: Record<string, unknown> = { name: label };
      for (const ds of datasets) point[ds.name] = ds.data[i] ?? 0;
      return point;
    });

    if (chartData.length === 0)
      return <p className="text-xs text-gray-400 py-4 text-center">No data</p>;

    if (type === "bar") {
      return (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 28 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 8, fill: "#94a3b8" }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
            <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <Legend wrapperStyle={{ fontSize: 9 }} />
            {datasets.map((ds, i) => (
              <Bar
                key={ds.name}
                dataKey={ds.name}
                fill={PALETTE[i % PALETTE.length]}
                radius={[3, 3, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={190}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 28 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 8, fill: "#94a3b8" }}
            angle={-30}
            textAnchor="end"
            interval={0}
          />
          <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          {datasets.map((ds, i) => (
            <Line
              key={ds.name}
              type="monotone"
              dataKey={ds.name}
              stroke={PALETTE[i % PALETTE.length]}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    const spec = config as { labels?: string[]; values?: number[] };
    const labels = spec.labels ?? [];
    const values = spec.values ?? [];
    const pieData = labels.map((name, i) => ({ name, value: values[i] ?? 0 }));

    if (pieData.length === 0)
      return <p className="text-xs text-gray-400 py-4 text-center">No data</p>;

    return (
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={72}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ fontSize: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
          <Legend wrapperStyle={{ fontSize: 9 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // table fallback
  const spec = config as { columns?: string[]; rows?: unknown[][] };
  const cols = spec.columns ?? [];
  const tableRows = spec.rows ?? [];

  if (cols.length === 0)
    return <p className="text-xs text-gray-400 py-4 text-center">No data</p>;

  return (
    <div className="overflow-x-auto max-h-[190px] overflow-y-auto rounded border border-gray-100">
      <table className="w-full text-left">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {cols.map((col) => (
              <th key={col} className="px-2 py-1.5 text-[9px] font-bold text-gray-400 uppercase whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {tableRows.slice(0, 50).map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 transition-colors">
              {(row as unknown[]).map((cell, j) => (
                <td key={j} className="px-2 py-1 text-[10px] text-gray-700 whitespace-nowrap">
                  {String(cell ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Page6() {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<GenerateResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [widgets, setWidgets] = useState<SavedWidget[]>([]);
  const [widgetsLoading, setWidgetsLoading] = useState(true);

  const loadWidgets = useCallback(async () => {
    setWidgetsLoading(true);
    try {
      const r = await fetch("/api/page6/widgets");
      const d = (await r.json()) as { widgets: SavedWidget[] };
      setWidgets(d.widgets ?? []);
    } finally {
      setWidgetsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWidgets();
  }, [loadWidgets]);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setGenerating(true);
    setPreview(null);
    setGenerateError(null);
    try {
      const r = await fetch("/api/page6/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const d = (await r.json()) as GenerateResult;
      if (!r.ok || d.error) {
        setGenerateError(d.error ?? "Generation failed");
      } else {
        setPreview(d);
        setEditTitle(d.title);
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const r = await fetch("/api/page6/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || preview.title,
          prompt,
          sql_query: preview.sql,
          widget_type: preview.widget_type,
          config: preview.chart_spec,
        }),
      });
      if (r.ok) {
        setPreview(null);
        setPrompt("");
        await loadWidgets();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/page6/widgets/${id}`, { method: "DELETE" });
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50/20 via-white to-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Custom Widgets</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Describe a KPI or chart in plain English — AI generates the SQL and renders the widget
            </p>
          </div>
          <span className="text-xs text-gray-400 mt-1 shrink-0">
            {widgets.length} saved
          </span>
        </div>

        {/* ── Prompt builder ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">
            New Widget
          </p>
          <div className="flex gap-2 items-end">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              rows={2}
              placeholder="e.g. 'Total uploaded videos per client as a bar chart' · 'Monthly publishing trend this year' · 'Top 5 languages by processed count'"
              className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:border-red-300 focus:outline-none focus:ring-1 focus:ring-red-100 leading-relaxed"
            />
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="px-5 py-2.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {generating ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Generating…
                </span>
              ) : (
                "Generate ↵"
              )}
            </button>
          </div>
          {generateError && (
            <p className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
              {generateError}
            </p>
          )}
        </div>

        {/* ── Preview ── */}
        {preview && (
          <div className="rounded-xl border border-red-100 bg-white shadow-sm overflow-hidden">
            {/* Preview header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  Preview
                </span>
                <span
                  className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                    TYPE_BADGE_COLOR[preview.widget_type] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {TYPE_BADGE[preview.widget_type] ?? preview.widget_type}
                </span>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                Dismiss ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Editable title */}
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800 focus:border-red-200 focus:outline-none focus:bg-white transition-colors"
                placeholder="Widget title"
              />

              {/* Widget preview */}
              <WidgetRenderer type={preview.widget_type} config={preview.chart_spec} />

              {/* SQL disclosure */}
              <details className="group">
                <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  View generated SQL
                </summary>
                <pre className="mt-1.5 text-[9px] text-gray-500 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap border border-gray-100 font-mono">
                  {preview.sql}
                </pre>
              </details>

              {/* Save */}
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save to Dashboard"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Saved widgets grid ── */}
        {widgetsLoading ? (
          <div className="flex items-center justify-center py-16 gap-2">
            <div className="h-5 w-5 rounded-full border-2 border-red-200 border-t-red-500 animate-spin" />
            <span className="text-xs text-gray-400">Loading widgets…</span>
          </div>
        ) : widgets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white/50 p-14 text-center">
            <p className="text-sm text-gray-400">
              No widgets yet — generate one above to get started
            </p>
            <p className="text-[10px] text-gray-300 mt-1">
              Try: "Total videos per client" · "Monthly trend this year" · "Top output types"
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {widgets.map((w) => (
              <div
                key={w.id}
                className="rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-start justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                          TYPE_BADGE_COLOR[w.widget_type] ?? "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {TYPE_BADGE[w.widget_type] ?? w.widget_type}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 leading-snug truncate">
                      {w.title}
                    </h3>
                    <p className="text-[9px] text-gray-400 truncate mt-0.5">{w.prompt}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="text-gray-200 hover:text-red-400 transition-colors ml-2 shrink-0 text-sm leading-none mt-0.5"
                    title="Delete widget"
                  >
                    ✕
                  </button>
                </div>

                {/* Chart area */}
                <div className="px-4 py-3">
                  <WidgetRenderer type={w.widget_type} config={w.config} />
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-gray-50 bg-gray-50/50">
                  <p className="text-[9px] text-gray-300">
                    {new Date(w.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
