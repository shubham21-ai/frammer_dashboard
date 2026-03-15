"use client";

import { useState, useRef, useEffect } from "react";

interface FilterChipProps {
  label: string;
  value: string;
  options: string[];
  color: string;
  onChange: (val: string) => void;
}

function FilterChip({ label, value, options, color, onChange }: FilterChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
          open
            ? "border-red-500 text-red-600 shadow-[0_2px_12px_rgba(233,67,74,0.2)]"
            : "border-gray-200 text-gray-700 hover:border-red-400 hover:text-red-600"
        } bg-white`}
      >
        <span
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <span className="whitespace-nowrap">{value || label}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[160px] max-h-[240px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl z-50 scrollbar-thin">
          {options.map((opt, i) => (
            <button
              key={`${opt}-${i}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors flex items-center justify-between ${
                value === opt
                  ? "text-red-600 bg-red-50"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt}
              {value === opt && (
                <svg
                  className="h-3.5 w-3.5 text-red-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterBarProps {
  clients: string[];
  selectedClient: string;
  onClientChange: (v: string) => void;
  onReset: () => void;
}

export default function FilterBar({
  clients,
  selectedClient,
  onClientChange,
  onReset,
}: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap border-b border-gray-100 bg-white px-5 py-2.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mr-1">
        Filter
      </span>
      <FilterChip
        label="All Clients"
        value={selectedClient}
        options={["All Clients", ...clients]}
        color="#e9434a"
        onChange={onClientChange}
      />
      {selectedClient !== "All Clients" && (
        <button
          onClick={onReset}
          className="ml-2 text-[11px] font-medium text-gray-400 border border-dashed border-gray-300 rounded-md px-3 py-1 hover:text-red-500 hover:border-red-400 transition-colors"
        >
          ↺ Reset
        </button>
      )}
    </div>
  );
}
