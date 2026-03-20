"use client";
import { useEffect, useState } from "react";
import { useGlobalFilter } from "@/contexts/FilterContext";

export default function GlobalFilterBar() {
  const { fromMonth, toMonth, selectedClient, setFromMonth, setToMonth, setSelectedClient, reset, isActive } = useGlobalFilter();
  const [clients, setClients] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/filters")
      .then(r => r.json())
      .then((d: { clients: string[] }) => setClients(d.clients ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className={`global-filter-bar border-b px-5 py-2 flex items-center gap-3 flex-wrap text-xs transition-colors ${isActive ? "bg-red-50/60 border-red-100" : "bg-gray-50/50 border-gray-100"}`}>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-red-500" : "text-gray-400"}`}>
        {isActive ? "● Filters Active" : "Filters"}
      </span>

      {/* Client selector */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase">Client</label>
        <select
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
          className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-red-300"
        >
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase">From</label>
        <input
          type="month"
          value={fromMonth}
          onChange={e => setFromMonth(e.target.value)}
          className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-red-300"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <label className="text-[10px] font-semibold text-gray-400 uppercase">To</label>
        <input
          type="month"
          value={toMonth}
          onChange={e => setToMonth(e.target.value)}
          className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-red-300"
        />
      </div>

      {isActive && (
        <button
          onClick={reset}
          className="text-[10px] font-semibold text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-200 bg-white transition-colors"
        >
          Reset ✕
        </button>
      )}

      <span className="ml-auto text-[9px] text-gray-300 hidden sm:block">Filters apply to Analysis &amp; all breakdown charts</span>
    </div>
  );
}
