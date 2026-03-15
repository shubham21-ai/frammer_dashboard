"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Page2Data, DimensionKey, ChartMode } from "./types";
import FilterBar from "./FilterBar";
import AnalysisBarChart from "./BarChart";
import DonutChart from "./DonutChart";
import TrendChart from "./TrendChart";
import KPIGrid from "./KPIGrid";
import FunnelKPIs from "./FunnelKPIs";
import FunnelBars from "./FunnelBars";
import BreakdownList from "./BreakdownList";
import UCCTable from "./UCCTable";
import InferenceBox from "./InferenceBox";

const DIMENSION_OPTIONS: { value: DimensionKey; label: string }[] = [
  { value: "channel", label: "Channel" },
  { value: "client", label: "Client" },
  { value: "user", label: "User" },
  { value: "inputType", label: "Input Type" },
  { value: "outputType", label: "Output Type" },
  { value: "language", label: "Language" },
];

export default function Page2Dashboard() {
  const [data, setData] = useState<Page2Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialLoad = useRef(true);

  const [selectedClient, setSelectedClient] = useState("All Clients");

  const [dim1, setDim1] = useState<DimensionKey>("channel");
  const [dim2, setDim2] = useState<DimensionKey>("inputType");
  const [chartMode, setChartMode] = useState<ChartMode>("stacked");
  const [metric, setMetric] = useState<"count" | "published">("count");

  const fetchData = useCallback(async () => {
    try {
      if (initialLoad.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const params = new URLSearchParams();
      if (selectedClient !== "All Clients")
        params.set("client", selectedClient);

      const res = await fetch(`/api/page2?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
      initialLoad.current = false;
    }
  }, [selectedClient]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-red-200 border-t-red-500 animate-spin" />
          <p className="text-sm text-gray-400 font-medium">
            Loading analytics...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-3">⚠</div>
          <p className="text-sm text-red-500 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-xs font-medium text-white bg-red-500 px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const dim1Data = data.breakdowns[dim1] || [];
  const dim2Data = data.breakdowns[dim2] || [];
  const dim1Label =
    DIMENSION_OPTIONS.find((o) => o.value === dim1)?.label || dim1;
  const dim2Label =
    DIMENSION_OPTIONS.find((o) => o.value === dim2)?.label || dim2;

  const dim2OptionsFiltered = DIMENSION_OPTIONS.filter(
    (o) => o.value !== dim1
  );

  const breakdownDimensions = DIMENSION_OPTIONS.filter(
    (o) => o.value !== "client" || data.filters.clients.length > 1
  ).map((o) => ({ key: o.value, label: o.label }));

  return (
    <div className="min-h-screen bg-white relative">
      {/* Refreshing indicator */}
      {refreshing && (
        <div className="fixed top-12 left-0 right-0 z-50 h-0.5 bg-gray-100 overflow-hidden">
          <div className="h-full w-1/3 bg-red-500 animate-[slide_1s_ease-in-out_infinite]" />
        </div>
      )}

      <FilterBar
        clients={data.filters.clients}
        selectedClient={selectedClient}
        onClientChange={setSelectedClient}
        onReset={() => setSelectedClient("All Clients")}
      />

      <div className="px-5 pt-4 pb-2 flex items-center gap-3">
        <h1 className="text-base font-bold text-gray-900 tracking-tight">
          Multi-Dimensional Analysis & Publishing Funnel
        </h1>
        <span className="text-[11px] font-semibold px-3 py-0.5 rounded-full bg-red-50 text-red-500">
          Page 2 / 5
        </span>
        {selectedClient !== "All Clients" && (
          <span className="text-[11px] font-semibold px-3 py-0.5 rounded-full bg-blue-50 text-blue-600">
            Filtered: {selectedClient}
          </span>
        )}
      </div>

      <div
        className={`grid grid-cols-1 lg:grid-cols-2 gap-4 px-5 pb-8 transition-opacity duration-200 ${
          refreshing ? "opacity-60 pointer-events-none" : "opacity-100"
        }`}
      >
        {/* LEFT: Multi-Dimensional Analysis */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30">
            <h2 className="text-sm font-bold text-gray-900">
              Multi-Dimensional Analysis
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Pick any two dimensions to compare — charts show top items with
              pagination
            </p>
          </div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
            {/* Dimension pickers */}
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                  Dimension 1 — X Axis
                </label>
                <select
                  value={dim1}
                  onChange={(e) => {
                    const v = e.target.value as DimensionKey;
                    setDim1(v);
                    if (v === dim2)
                      setDim2(
                        DIMENSION_OPTIONS.find((o) => o.value !== v)?.value ||
                          "channel"
                      );
                  }}
                  className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400"
                >
                  {DIMENSION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-gray-300 text-lg pb-2">×</span>
              <div className="flex-1 min-w-[120px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                  Dimension 2 — Color Stack
                </label>
                <select
                  value={dim2}
                  onChange={(e) => setDim2(e.target.value as DimensionKey)}
                  className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400"
                >
                  {dim2OptionsFiltered.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[90px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                  Metric
                </label>
                <select
                  value={metric}
                  onChange={(e) =>
                    setMetric(e.target.value as "count" | "published")
                  }
                  className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400"
                >
                  <option value="count">Upload Count</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="min-w-[80px]">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                  Chart
                </label>
                <select
                  value={chartMode}
                  onChange={(e) =>
                    setChartMode(e.target.value as ChartMode)
                  }
                  className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-red-400"
                >
                  <option value="stacked">Stacked</option>
                  <option value="grouped">Grouped</option>
                </select>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-[1.45fr_1fr] gap-3">
              <AnalysisBarChart
                dim1Data={dim1Data}
                dim2Data={dim2Data}
                dim1Label={dim1Label}
                dim2Label={dim2Label}
                chartMode={chartMode}
                metric={metric}
              />
              <DonutChart
                data={dim2Data}
                title={`Share by ${dim2Label}`}
                metric={metric}
              />
            </div>

            {/* Insight */}
            <InferenceBox
              data={dim1Data}
              label={dim1Label}
              variant="insight"
            />

            {/* Breakdown */}
            <BreakdownList
              data={data.breakdowns}
              dimensions={breakdownDimensions}
            />

            {/* KPIs */}
            <KPIGrid kpis={data.kpis} />
          </div>
        </div>

        {/* RIGHT: Publishing Funnel */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-white to-red-50/30">
            <h2 className="text-sm font-bold text-gray-900">
              Publishing Funnel
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Uploaded → Published comparison
            </p>
          </div>
          <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
            <FunnelKPIs kpis={data.kpis} />
            <TrendChart data={data.trend} />
            <FunnelBars kpis={data.kpis} />
            <InferenceBox
              data={data.breakdowns.channel}
              label="channel"
              variant="alert"
            />
            <UCCTable data={data.breakdowns} />
          </div>
        </div>
      </div>
    </div>
  );
}
