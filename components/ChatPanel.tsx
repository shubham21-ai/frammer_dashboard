"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import "@/app/dashboard/page2/components/ChartSetup";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { CHART_COLORS, CHART_FONT } from "@/app/dashboard/page2/components/ChartSetup";

const MIN_WIDTH = 420;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 560;
const DEFAULT_HEIGHT = 640;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  question?: string;
  sql_query?: string;
  table_data?: Record<string, unknown>[];
  chart_spec?: Record<string, unknown>;
  insights?: string[];
  error?: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  pageContext?: string;
}

// ─── Chart rendering ───────────────────────────────────────────────────────────

const BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: {
    legend: {
      position: "bottom" as const,
      labels: { font: CHART_FONT, boxWidth: 10, padding: 8 },
    },
    tooltip: {
      backgroundColor: "#fff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      titleColor: "#1e293b",
      bodyColor: "#64748b",
      titleFont: { ...CHART_FONT, size: 11, weight: "bold" as const },
      bodyFont: CHART_FONT,
      padding: 10,
      cornerRadius: 8,
    },
  },
};

const SCALE_OPTS = {
  x: {
    grid: { display: false },
    ticks: { color: "#94a3b8", font: CHART_FONT, maxRotation: 40 },
  },
  y: {
    grid: { color: "#f1f5f9" },
    border: { display: false },
    ticks: { color: "#94a3b8", font: CHART_FONT },
  },
};

/** Format cell for display; handles objects (e.g. pg PostgresInterval) that would render as [object Object] */
function formatCellValue(cell: unknown): string {
  if (cell == null) return "—";
  if (typeof cell === "object") {
    if (cell instanceof Date) return cell.toISOString();
    const o = cell as Record<string, unknown>;
    if (typeof (o as { toPostgres?: unknown }).toPostgres === "function") {
      return String((o as { toPostgres: () => unknown }).toPostgres());
    }
    if (
      typeof o.hours === "number" ||
      typeof o.minutes === "number" ||
      typeof o.milliseconds === "number" ||
      typeof o.seconds === "number" ||
      typeof o.days === "number"
    ) {
      const h = Number(o.hours ?? 0) + Number(o.days ?? 0) * 24;
      const m = Number(o.minutes ?? 0);
      const s = o.seconds != null
        ? Math.floor(Number(o.seconds))
        : Math.floor(Number(o.milliseconds ?? 0) / 1000);
      return [h, m, s].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
    }
    return JSON.stringify(cell);
  }
  return String(cell);
}

function ChatTable({ columns, rows }: { columns: string[]; rows: unknown[][] }) {
  return (
    <div className="overflow-x-auto max-h-56 rounded-xl border border-slate-200/80 bg-white/80 text-xs shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50/90 sticky top-0">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              {(row as unknown[]).map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-700">
                  {formatCellValue(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && (
        <div className="text-[10px] text-slate-400 px-3 py-1.5 bg-slate-50/80 border-t border-slate-100">
          + {rows.length - 20} more rows
        </div>
      )}
    </div>
  );
}

function ChatChart({ spec }: { spec: Record<string, unknown> }) {
  const type = spec.type as string;

  if (type === "table") {
    const columns = (spec.columns as string[]) || [];
    const rows = (spec.rows as unknown[][]) || [];
    return <ChatTable columns={columns} rows={rows} />;
  }

  if (type === "bar") {
    const labels = (spec.labels as string[]) || [];
    const datasets = ((spec.datasets as { name: string; data: number[] }[]) || []).map((d, i) => ({
      label: d.name,
      data: d.data,
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
      borderRadius: 4,
    }));
    return (
      <div className="h-48">
        <Bar
          data={{ labels, datasets }}
          options={{ ...BASE_OPTIONS, scales: SCALE_OPTS }}
        />
      </div>
    );
  }

  if (type === "line") {
    const labels = (spec.labels as string[]) || [];
    const datasets = ((spec.datasets as { name: string; data: number[] }[]) || []).map((d, i) => ({
      label: d.name,
      data: d.data,
      borderColor: CHART_COLORS[i % CHART_COLORS.length],
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + "20",
      fill: true,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 3,
    }));
    return (
      <div className="h-48">
        <Line
          data={{ labels, datasets }}
          options={{ ...BASE_OPTIONS, scales: SCALE_OPTS }}
        />
      </div>
    );
  }

  if (type === "pie") {
    const labels = (spec.labels as string[]) || [];
    const values = (spec.values as number[]) || [];
    return (
      <div className="h-48">
        <Doughnut
          data={{
            labels,
            datasets: [
              {
                data: values,
                backgroundColor: CHART_COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: "#fff",
              },
            ],
          }}
          options={{ ...BASE_OPTIONS, cutout: "58%" }}
        />
      </div>
    );
  }

  return null;
}

// ─── SQL toggle ────────────────────────────────────────────────────────────────

function SqlBlock({ sql }: { sql: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl overflow-hidden border border-slate-200/80 bg-slate-900/95 shadow-lg">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200 flex items-center gap-1.5 bg-slate-800/80 transition-colors"
      >
        {open ? "▾" : "▸"} SQL
      </button>
      {open && (
        <pre className="text-xs text-slate-200 p-3 overflow-x-auto font-mono leading-relaxed">
          {sql}
        </pre>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

function useCenteredPosition(width: number, height: number) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const initialized = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined" || initialized.current) return;
    initialized.current = true;
    setPos({
      x: Math.max(0, (window.innerWidth - width) / 2),
      y: Math.max(0, (window.innerHeight - height) / 2),
    });
  }, [width, height]);
  return [pos, setPos] as const;
}

export default function ChatPanel({ open, onClose, pageContext }: ChatPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    { id: "1", title: "Chat 1", messages: [] },
  ]);
  const [activeId, setActiveId] = useState("1");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT });
  const [pos, setPos] = useCenteredPosition(size.w, size.h);
  const bottomRef = useRef<HTMLDivElement>(null);
  const revealTimersRef = useRef<number[]>([]);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];

  // Re-center when opening (stable deps: ref for size to avoid useEffect array size change)
  const sizeRef = useRef(size);
  sizeRef.current = size;
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      const { w, h } = sizeRef.current;
      setPos({
        x: Math.max(0, (window.innerWidth - w) / 2),
        y: Math.max(0, (window.innerHeight - h) / 2),
      });
    }
  }, [open]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
  }, [pos]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }, [size]);

  // Refs for stable access in global listeners (avoids stale closure + null crashes)
  const setPosRef = useRef(setPos);
  const setSizeRef = useRef(setSize);
  setPosRef.current = setPos;
  setSizeRef.current = setSize;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragStart.current;
      const rs = resizeStart.current;
      if (ds && typeof ds.posX === "number" && typeof ds.posY === "number") {
        const dx = e.clientX - ds.x;
        const dy = e.clientY - ds.y;
        setPosRef.current({
          x: Math.max(0, ds.posX + dx),
          y: Math.max(0, ds.posY + dy),
        });
      } else if (rs && typeof rs.w === "number" && typeof rs.h === "number") {
        const dx = e.clientX - rs.x;
        const dy = e.clientY - rs.y;
        setSizeRef.current({
          w: Math.max(MIN_WIDTH, rs.w + dx),
          h: Math.max(MIN_HEIGHT, rs.h + dy),
        });
      }
    };
    const onUp = () => {
      dragStart.current = null;
      resizeStart.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [active?.messages, scrollToBottom]);

  useEffect(() => {
    return () => {
      revealTimersRef.current.forEach((t) => window.clearTimeout(t));
      revealTimersRef.current = [];
    };
  }, []);

  const updateAssistantMessage = useCallback(
    (messageId: string, patch: Partial<ChatMessage>) => {
      setSessions((prev) =>
        prev.map((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === messageId ? { ...m, ...patch } : m
          ),
        }))
      );
    },
    []
  );

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    setInput("");
    setLoading(true);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      question: q,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeId ? { ...s, messages: [...s.messages, userMsg] } : s
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, sessionId: activeId, pageContext }),
      });
      const data = await res.json();

      const assistantMsgId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        question: q,
        insights: [],
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId ? { ...s, messages: [...s.messages, assistantMsg] } : s
        )
      );

      if (data.error) {
        updateAssistantMessage(assistantMsgId, { error: data.error });
      } else {
        const insights = Array.isArray(data.insights) ? data.insights : [];
        const sqlQuery = typeof data.sql_query === "string" ? data.sql_query : "";
        const chartSpec =
          data.chart_spec && typeof data.chart_spec === "object"
            ? (data.chart_spec as Record<string, unknown>)
            : {};
        const tableData = Array.isArray(data.table_data)
          ? (data.table_data as Record<string, unknown>[])
          : [];

        let delay = 120;

        // Reveal insights one-by-one
        insights.forEach((insight: string, idx: number) => {
          const t = window.setTimeout(() => {
            updateAssistantMessage(assistantMsgId, {
              insights: insights.slice(0, idx + 1),
            });
          }, delay);
          revealTimersRef.current.push(t);
          delay += 260;
        });

        // Then reveal SQL toggle (collapsed by default)
        if (sqlQuery) {
          const t = window.setTimeout(() => {
            updateAssistantMessage(assistantMsgId, { sql_query: sqlQuery });
          }, delay);
          revealTimersRef.current.push(t);
          delay += 220;
        }

        // Then reveal chart/table
        if (Object.keys(chartSpec).length > 0 || tableData.length > 0) {
          const t = window.setTimeout(() => {
            updateAssistantMessage(assistantMsgId, {
              chart_spec: chartSpec,
              table_data: tableData,
            });
          }, delay);
          revealTimersRef.current.push(t);
        }
      }
    } catch (err) {
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        question: q,
        error: err instanceof Error ? err.message : "Request failed",
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeId
            ? { ...s, messages: [...s.messages, assistantMsg] }
            : s
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, loading, activeId, pageContext, updateAssistantMessage]);

  const addChat = useCallback(() => {
    const id = crypto.randomUUID();
    setSessions((prev) => [
      ...prev,
      { id, title: `Chat ${prev.length + 1}`, messages: [] },
    ]);
    setActiveId(id);
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Floating, draggable, resizable window */}
      <div
        className="fixed z-[100] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-slate-200/60 bg-white/95 backdrop-blur-md transition-shadow hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]"
        style={{
          left: pos.x,
          top: pos.y,
          width: size.w,
          height: size.h,
        }}
      >
        {/* Draggable header */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60 shrink-0 cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeId === s.id
                    ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/25"
                    : "bg-white/80 border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                }`}
              >
                {s.title}
              </button>
            ))}
            <button
              onClick={addChat}
              className="shrink-0 p-1.5 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50/50 transition-colors"
              title="New chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 p-2 rounded-lg text-slate-500 hover:bg-slate-200/80 hover:text-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Page context */}
        {pageContext && (
          <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[10px] font-medium text-slate-500">
              Context: <span className="text-slate-700">{pageContext}</span>
            </span>
          </div>
        )}

        {/* Message list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gradient-to-b from-white to-slate-50/30">
          {active.messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-100/80 flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4-4-4z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Ask anything about your data</p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-500">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100/80">Top channels by published videos</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100/80">What is the AI Content Multiplier?</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100/80">Monthly upload trend</span>
              </div>
            </div>
          )}

          {active.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl p-4 shadow-sm ${
                m.role === "user"
                  ? "ml-6 bg-gradient-to-r from-red-50 to-rose-50/80 border border-red-100/80"
                  : "mr-6 bg-white/90 border border-slate-200/60 shadow-slate-200/50"
              }`}
            >
              {m.role === "user" && (
                <p className="text-sm font-medium text-slate-800">{m.question}</p>
              )}
              {m.role === "assistant" && (
                <div className="space-y-4">
                  {m.error && (
                    <p className="text-sm text-red-600 font-medium">{m.error}</p>
                  )}
                  {m.insights && m.insights.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Insights
                      </p>
                      <ul className="space-y-2.5">
                        {m.insights.map((ins, i) => (
                          <li
                            key={i}
                            className="flex gap-2.5 text-sm text-slate-700 leading-relaxed"
                          >
                            <span className="shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-[10px] font-bold">
                              {i + 1}
                            </span>
                            <span className="min-w-0">
                              {String(ins).replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.sql_query && (
                    <div className="pt-1">
                      <SqlBlock sql={m.sql_query} />
                    </div>
                  )}
                  {m.chart_spec && Object.keys(m.chart_spec).length > 0 && (
                    <div className="pt-2 rounded-xl overflow-hidden">
                      <ChatChart spec={m.chart_spec} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 mr-6">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-bounce [animation-delay:0ms]" />
                <span className="h-2 w-2 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
                <span className="h-2 w-2 rounded-full bg-red-400 animate-bounce [animation-delay:300ms]" />
              </div>
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about your data or KPIs..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm transition-all"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-red-500/25"
            >
              Send
            </button>
          </div>
        </div>

        {/* Resize handle — drag from bottom-right corner */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-end justify-end p-1.5 rounded-tl-lg hover:bg-slate-100/80 transition-colors"
          aria-label="Resize"
        >
          <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm0-4h-2v-2h2v2zm-4 4h-2v-2h2v2zm0-4h-2v-2h2v2z" />
          </svg>
        </div>
      </div>
    </>
  );
}
