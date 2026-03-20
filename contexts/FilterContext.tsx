"use client";
import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export interface GlobalFilter {
  fromMonth: string;      // YYYY-MM or ""
  toMonth: string;        // YYYY-MM or ""
  selectedClient: string; // "all" or client_id
}

const DEFAULT: GlobalFilter = { fromMonth: "", toMonth: "", selectedClient: "all" };

interface FilterCtx extends GlobalFilter {
  setFromMonth: (v: string) => void;
  setToMonth: (v: string) => void;
  setSelectedClient: (v: string) => void;
  reset: () => void;
  isActive: boolean;
}

const FilterContext = createContext<FilterCtx>({
  ...DEFAULT,
  setFromMonth: () => {},
  setToMonth: () => {},
  setSelectedClient: () => {},
  reset: () => {},
  isActive: false,
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<GlobalFilter>(DEFAULT);

  const setFromMonth    = useCallback((v: string) => setFilter(f => ({ ...f, fromMonth: v })), []);
  const setToMonth      = useCallback((v: string) => setFilter(f => ({ ...f, toMonth: v })), []);
  const setSelectedClient = useCallback((v: string) => setFilter(f => ({ ...f, selectedClient: v })), []);
  const reset           = useCallback(() => setFilter(DEFAULT), []);
  const isActive = filter.fromMonth !== "" || filter.toMonth !== "" || filter.selectedClient !== "all";

  return (
    <FilterContext.Provider value={{ ...filter, setFromMonth, setToMonth, setSelectedClient, reset, isActive }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useGlobalFilter() {
  return useContext(FilterContext);
}
