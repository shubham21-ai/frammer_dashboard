"use client";

import { useState, useEffect } from "react";
import s from "./page5.module.css";

const ALL_SUMMARY_TABLES = [
  "channel_processing_summary",
  "channel_user_processing_summary",
  "channel_wise_publishing_counts",
  "channel_wise_publishing_duration",
  "input_type_processing_summary",
  "language_processing_summary",
  "monthly_duration_summary",
  "monthly_processing_summary",
  "output_type_processing_summary",
  "user_processing_summary",
] as const;

const TABLE_LABELS: Record<string, string> = {
  channel_processing_summary: "Channel Processing",
  channel_user_processing_summary: "Channel · User",
  channel_wise_publishing_counts: "Pub. Counts",
  channel_wise_publishing_duration: "Pub. Duration",
  input_type_processing_summary: "Input Type",
  language_processing_summary: "Language",
  monthly_duration_summary: "Monthly Dur.",
  monthly_processing_summary: "Monthly Proc.",
  output_type_processing_summary: "Output Type",
  user_processing_summary: "User Processing",
};

const TABLE_FULL_NAMES: Record<string, string> = {
  channel_processing_summary: "Channel Processing Summary",
  channel_user_processing_summary: "Channel × User Processing Summary",
  channel_wise_publishing_counts: "Channel-wise Publishing Counts",
  channel_wise_publishing_duration: "Channel-wise Publishing Duration",
  input_type_processing_summary: "Input Type Processing Summary",
  language_processing_summary: "Language Processing Summary",
  monthly_duration_summary: "Monthly Duration Summary",
  monthly_processing_summary: "Monthly Processing Summary",
  output_type_processing_summary: "Output Type Processing Summary",
  user_processing_summary: "User Processing Summary",
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
};

type Row = Record<string, unknown>;
type TableData = { rowCount: number; rows: Row[] };
type Alert = {
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  table: string;
};

function formatColumnName(col: string) {
  return col
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Hh Mm Ss/, "(HH:MM:SS)")
    .replace(/Id\b/g, "ID");
}

function exportCSV(columns: string[], rows: Row[], filename: string) {
  let csv = columns.map((c) => `"${formatColumnName(c)}"`).join(",") + "\n";
  rows.forEach((row) => {
    csv +=
      columns
        .map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return "";
          return `"${String(v).replace(/"/g, '""')}"`;
        })
        .join(",") + "\n";
  });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CompactTable({ data }: { data: TableData | null }) {
  if (!data?.rows?.length) {
    return <div className={s.emptyState}>No data available</div>;
  }
  const columns = Object.keys(data.rows[0]);
  return (
    <table className={s.dataTable}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col} title={formatColumnName(col)}>
              {formatColumnName(col)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, idx) => (
          <tr key={idx}>
            {columns.map((col) => {
              const val = row[col];
              const display =
                val === null || val === undefined ? "—" : String(val);
              return (
                <td key={col} title={display}>
                  {display}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VideosTable({ data }: { data: TableData }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | "none">("none");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set());
  const [showColPicker, setShowColPicker] = useState(false);

  useEffect(() => {
    if (data?.rows?.length) {
      setVisibleColumns(new Set(Object.keys(data.rows[0])));
    }
  }, [data]);

  if (!data?.rows?.length) {
    return <div className={s.emptyState}>No video data</div>;
  }

  const allColumns = Object.keys(data.rows[0]);
  const activeColumns = allColumns.filter((c) => visibleColumns.has(c));

  let filteredRows = data.rows;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredRows = filteredRows.filter((row) =>
      activeColumns.some((col) => {
        const v = row[col];
        return v != null && String(v).toLowerCase().includes(term);
      })
    );
  }

  if (sortCol && sortDir !== "none") {
    const dir = sortDir === "asc" ? 1 : -1;
    filteredRows = [...filteredRows].sort((a, b) => {
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      if (!isNaN(Number(va)) && !isNaN(Number(vb)))
        return (Number(va) - Number(vb)) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortDir("none");
        setSortCol(null);
      } else setSortDir("asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const toggleCol = (col: string) => {
    const next = new Set(visibleColumns);
    if (next.has(col)) {
      if (next.size > 1) next.delete(col);
    } else {
      next.add(col);
    }
    setVisibleColumns(next);
  };

  const renderRows = filteredRows.slice(0, 200);

  return (
    <div className={s.dtHost}>
      <div className={s.dtToolbar}>
        <div className={s.dtToolbarLeft}>
          <div className={s.dtSearchWrap}>
            <svg
              className={s.dtSearchIcon}
              viewBox="0 0 16 16"
              width="13"
              height="13"
            >
              <path
                fill="currentColor"
                d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398h-.001l3.85 3.85a1 1 0 001.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 110-10 5 5 0 010 10z"
              />
            </svg>
            <input
              type="text"
              className={s.dtSearch}
              placeholder="Search across all columns…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                className={s.dtSearchClear}
                style={{ display: "flex" }}
                onClick={() => setSearchTerm("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className={s.dtToolbarRight}>
          <div style={{ position: "relative" }}>
            <button
              className={s.dtBtn}
              onClick={() => setShowColPicker(!showColPicker)}
            >
              ⋮⋮ Columns
            </button>
            {showColPicker && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 999 }}
                  onClick={() => setShowColPicker(false)}
                />
                <div
                  className={s.dtColvisPopup}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: "4px",
                  }}
                >
                  <div className={s.dtColvisHeader}>
                    <span>Toggle Columns</span>
                    <button
                      className={s.dtColvisClose}
                      onClick={() => setShowColPicker(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className={s.dtColvisList}>
                    {allColumns.map((col) => (
                      <label key={col} className={s.dtColvisItem}>
                        <input
                          type="checkbox"
                          checked={visibleColumns.has(col)}
                          onChange={() => toggleCol(col)}
                        />
                        <span>{formatColumnName(col)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <button
            className={s.dtBtn}
            onClick={() => exportCSV(activeColumns, filteredRows, "videos")}
          >
            ↓ Export
          </button>
        </div>
      </div>
      <div className={s.dtViewport}>
        <table className={s.dataTable}>
          <thead>
            <tr>
              {activeColumns.map((col) => (
                <th
                  key={col}
                  className={`${s.dtSortable} ${
                    sortCol === col
                      ? sortDir === "asc"
                        ? s.dtSortedAsc
                        : sortDir === "desc"
                        ? s.dtSortedDesc
                        : ""
                      : ""
                  }`}
                  onClick={() => handleSort(col)}
                >
                  {formatColumnName(col)}{" "}
                  <span className={s.dtSortIcon}></span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRows.map((row, idx) => (
              <tr key={idx}>
                {activeColumns.map((col) => (
                  <td key={col} title={row[col]?.toString()}>
                    {row[col] === null || row[col] === undefined
                      ? "—"
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length > 200 && (
              <tr>
                <td
                  colSpan={activeColumns.length}
                  style={{ textAlign: "center", color: "#94a3b8" }}
                >
                  + {filteredRows.length - 200} more rows (Export to view all)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Page5() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [videosData, setVideosData] = useState<TableData>({
    rowCount: 0,
    rows: [],
  });
  const [summaryDataMap, setSummaryDataMap] = useState<
    Record<string, TableData>
  >({});
  const [visibleSummaryTables, setVisibleSummaryTables] = useState<string[]>([
    ...ALL_SUMMARY_TABLES,
  ]);
  const [alertFilter, setAlertFilter] = useState("all");
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [upperHeight, setUpperHeight] = useState(28);
  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizingH, setIsResizingH] = useState(false);
  const [isResizingV, setIsResizingV] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/page5");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setAlerts(json.alerts || []);
        if (json.tables?.videos) setVideosData(json.tables.videos);
        const sMap: Record<string, TableData> = {};
        for (const t of ALL_SUMMARY_TABLES) {
          if (json.tables?.[t]) sMap[t] = json.tables[t];
        }
        setSummaryDataMap(sMap);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredAlerts =
    alertFilter === "all"
      ? alerts
      : alerts.filter((a) => a.severity === alertFilter);
  const alertCounts = {
    all: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    info: alerts.filter((a) => a.severity === "info").length,
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingH) {
        const newH = (e.clientY / window.innerHeight) * 100;
        if (newH > 10 && newH < 80) setUpperHeight(newH);
      } else if (isResizingV) {
        const newW = (e.clientX / window.innerWidth) * 100;
        if (newW > 20 && newW < 80) setLeftWidth(newW);
      }
    };
    const handleMouseUp = () => {
      setIsResizingH(false);
      setIsResizingV(false);
    };
    if (isResizingH || isResizingV) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = isResizingH ? "row-resize" : "col-resize";
    } else {
      document.body.style.userSelect = "";
      document.body.style.cursor = "default";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingH, isResizingV]);

  return (
    <>
      <div className={`${s.loadingOverlay} ${!loading ? s.hidden : ""}`}>
        <div className={s.loadingSpinner}>
          <div className={s.spinner} />
          <div className={s.text}>Loading dashboard…</div>
        </div>
      </div>

      <div className={s.dashboard}>
        {/* Alerts */}
        <section
          className={s.alertsSection}
          style={{ height: `${upperHeight}vh` }}
        >
          <div className={s.sectionHeader}>
            <h2>
              <span className={s.icon}>⚠</span> Data Quality Alerts
            </h2>
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <div className={s.alertFilters}>
                {(["all", "critical", "warning", "info"] as const).map(
                  (f) => (
                    <button
                      key={f}
                      onClick={() => setAlertFilter(f)}
                      className={`${s.alertFilterBtn} ${
                        alertFilter === f ? s.active : ""
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}{" "}
                      <span className={s.filterCount}>
                        {alertCounts[f]}
                      </span>
                    </button>
                  )
                )}
              </div>
              <span className={s.badge}>{alerts.length}</span>
            </div>
          </div>
          <div className={s.alertsContainer}>
            {filteredAlerts.length === 0 ? (
              <div className={s.emptyState}>No alerts in this category</div>
            ) : (
              filteredAlerts.map((alert, i) => (
                <div
                  key={i}
                  className={`${s.alertCard} ${
                    alert.severity === "critical"
                      ? s.criticalCard
                      : alert.severity === "warning"
                      ? s.warningCard
                      : s.infoCard
                  }`}
                  style={{ animationDelay: `${i * 0.02}s` }}
                >
                  <div className={s.alertHeader}>
                    <span className={s.alertSeverity}>
                      {SEVERITY_ICONS[alert.severity] || ""} {alert.severity}
                    </span>
                    <span className={s.alertCategory}>
                      · {alert.category}
                    </span>
                  </div>
                  <div className={s.alertMessage}>{alert.message}</div>
                  <div className={s.alertTable}>→ {alert.table}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* H-Resize */}
        <div
          className={`${s.resizeHandle} ${s.resizeHandleH}`}
          onMouseDown={() => setIsResizingH(true)}
        >
          <div className={s.resizeGrip} />
        </div>

        {/* Tables */}
        <section className={s.tablesSection}>
          {/* Videos */}
          <div
            className={s.videosPanel}
            style={{ flex: `0 0 ${leftWidth}%` }}
          >
            <div className={s.sectionHeader}>
              <h2>
                <span className={s.icon}>🎬</span> Videos
              </h2>
              <span className={s.badge}>
                {videosData.rowCount?.toLocaleString()} rows
              </span>
            </div>
            <VideosTable data={videosData} />
          </div>

          {/* V-Resize */}
          <div
            className={`${s.resizeHandle} ${s.resizeHandleV}`}
            onMouseDown={() => setIsResizingV(true)}
          >
            <div className={s.resizeGrip} />
          </div>

          {/* Summaries */}
          <div className={s.summaryWrapper}>
            <div className={s.summaryHeader}>
              <span className={s.summaryTitle}>Summary Tables</span>
              <div style={{ position: "relative" }}>
                <button
                  className={s.dtBtn}
                  onClick={() => setShowTableSelector(!showTableSelector)}
                >
                  ☰ Select Tables
                </button>
                {showTableSelector && (
                  <>
                    <div
                      style={{ position: "fixed", inset: 0, zIndex: 999 }}
                      onClick={() => setShowTableSelector(false)}
                    />
                    <div
                      className={s.tableSelectorPopup}
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "4px",
                      }}
                    >
                      <div className={s.tsHeader}>
                        <span>Select Tables</span>
                        <button
                          className={s.tsClose}
                          onClick={() => setShowTableSelector(false)}
                        >
                          ✕
                        </button>
                      </div>
                      <div className={s.tsList}>
                        {ALL_SUMMARY_TABLES.map((t) => (
                          <label key={t} className={s.tsItem}>
                            <input
                              type="checkbox"
                              checked={visibleSummaryTables.includes(t)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setVisibleSummaryTables((prev) => [
                                    ...prev,
                                    t,
                                  ]);
                                } else {
                                  setVisibleSummaryTables((prev) => {
                                    const next = prev.filter((v) => v !== t);
                                    return next.length === 0
                                      ? [ALL_SUMMARY_TABLES[0]]
                                      : next;
                                  });
                                }
                              }}
                            />
                            <span>{TABLE_FULL_NAMES[t] || t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div
              className={s.summaryPanel}
              style={{
                gridTemplateColumns: `repeat(${Math.min(
                  5,
                  visibleSummaryTables.length
                )}, 1fr)`,
                gridTemplateRows: `repeat(${Math.ceil(
                  visibleSummaryTables.length / 5
                )}, 1fr)`,
              }}
            >
              {visibleSummaryTables.map((t, i) => {
                const tableData = summaryDataMap[t];
                if (!tableData) return null;
                const columns =
                  tableData.rows?.length > 0
                    ? Object.keys(tableData.rows[0])
                    : [];
                return (
                  <div
                    key={t}
                    className={s.tableCard}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div
                      className={s.tableCardHeader}
                      title={TABLE_FULL_NAMES[t] || t}
                    >
                      <h3 title={TABLE_FULL_NAMES[t] || t}>
                        {TABLE_LABELS[t] || t}
                      </h3>
                      <div className={s.tableCardActions}>
                        <button
                          className={s.tcExportBtn}
                          title="Download CSV"
                          onClick={() =>
                            exportCSV(columns, tableData.rows, t)
                          }
                        >
                          ↓
                        </button>
                        <span className={s.rowCount}>
                          {tableData.rowCount?.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className={s.tableScrollContainer}>
                      <CompactTable data={tableData} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
