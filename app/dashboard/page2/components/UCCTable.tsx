"use client";

import { useState } from "react";
import type { BreakdownItem, DimensionKey } from "./types";

interface UCCTableProps {
  data: Record<string, BreakdownItem[]>;
}

const tabs: { key: DimensionKey; label: string }[] = [
  { key: "channel", label: "Channel" },
  { key: "client", label: "Client" },
  { key: "user", label: "User" },
];

const typeColors: Record<string, string> = {
  channel: "#e9434a",
  client: "#8b5cf6",
  user: "#f59e0b",
};

export default function UCCTable({ data }: UCCTableProps) {
  const [activeTab, setActiveTab] = useState<DimensionKey>("channel");

  const rows = data[activeTab] || [];
  const maxUp = Math.max(...rows.map((d) => d.up), 1);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Uploaded vs Published
        </h4>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-md border transition-all ${
                activeTab === tab.key
                  ? "bg-red-500 border-red-500 text-white"
                  : "text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Name
              </th>
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Uploaded
              </th>
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Published
              </th>
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Rate
              </th>
              <th className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden sm:table-cell">
                Volume
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const barW = Math.round((d.up / maxUp) * 100);
              const pubRate =
                d.up > 0 ? Math.round((d.pb / d.up) * 100) : 0;
              const rateColor =
                pubRate >= 10
                  ? "text-emerald-600 bg-emerald-50"
                  : pubRate >= 3
                  ? "text-amber-600 bg-amber-50"
                  : "text-red-600 bg-red-50";
              return (
                <tr
                  key={d.id}
                  className="border-b border-gray-50 hover:bg-white transition-colors cursor-default"
                >
                  <td className="py-2 px-2 font-medium text-gray-700 max-w-[140px] truncate">
                    {d.name}
                  </td>
                  <td className="py-2 px-2 text-gray-500">
                    {d.up.toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-gray-500">
                    {d.pb.toLocaleString()}
                  </td>
                  <td className="py-2 px-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${rateColor}`}
                    >
                      {pubRate}%
                    </span>
                  </td>
                  <td className="py-2 px-2 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barW}%`,
                            background: typeColors[activeTab] || "#e9434a",
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-300 text-xs">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
