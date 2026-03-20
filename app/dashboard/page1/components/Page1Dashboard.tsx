"use client";

import { useState, useEffect, useCallback } from "react";
import type { Page1Data } from "./types";
import KPIGrid from "./KPIGrid";
import LifecycleTrendChart from "./LifecycleTrendChart";
import PipelineStats from "./PipelineStats";
import { FeatureAdoptionHeatmap } from "@/components/page4-charts";

export default function Page1Dashboard() {
  const [data, setData] = useState<Page1Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/page1");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-red-200 border-t-red-500 animate-spin" />
          <p className="text-sm font-medium text-gray-400">
            Loading CEO dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-3 text-4xl">⚠</div>
          <p className="text-sm font-medium text-red-500">{error}</p>
          <button
            onClick={fetchData}
            className="mt-3 rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen relative">
      {refreshing && (
        <div className="fixed top-12 left-0 right-0 z-50 h-0.5 overflow-hidden bg-gray-100">
          <div className="h-full w-1/3 animate-[slide_1s_ease-in-out_infinite] bg-red-500" />
        </div>
      )}

      <div className="px-5 pt-4 pb-2">
        <h1 className="text-base font-bold tracking-tight text-gray-900">
          CEO Dashboard
        </h1>
      </div>

      <div
        className={`px-5 pb-8 transition-opacity duration-200 ${
          refreshing ? "pointer-events-none opacity-60" : "opacity-100"
        }`}
      >
        {/* One-page layout:
            Top = KPIs (left) + lifecycle/pipeline (right), same baseline
            Bottom = Feature Adoption by Client (full width) */}
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-5 flex flex-col">
              <KPIGrid kpis={data.kpis} />
            </div>
            <div className="lg:col-span-7 flex flex-col min-h-0 grid grid-rows-[1fr_auto] gap-2">
              <div className="min-h-0">
                <LifecycleTrendChart data={data.lifecycleTrend} />
              </div>
              <div className="min-h-0">
                <PipelineStats data={data.pipelineStats} />
              </div>
            </div>
          </div>
          <div className="min-h-[360px] lg:min-h-[420px]">
            <FeatureAdoptionHeatmap matrix={data.featureMatrix} />
          </div>
        </div>
      </div>
    </div>
  );
}
