"use client";

import { useState, useCallback, useRef, useEffect } from "react";

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

const COLORS = ["#e9434a", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

function ChartPreview({ spec }: { spec: Record<string, unknown> }) {
  const type = spec.type as string;
  const labels = (spec.labels as string[]) || [];
  const datasets = (spec.datasets as { name: string; data: number[] }[]) || [];
  const values = (spec.values as number[]) || [];

  if (type === "table") {
    const columns = (spec.columns as string[]) || [];
    const rows = (spec.rows as unknown[][]) || [];
    return (
      <div className="overflow-x-auto max-h-48 rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1.5 text-left font-semibold text-gray-600">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 text-gray-700">
                    {String(cell ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 10 && (
          <div className="text-[10px] text-gray-400 px-2 py-1 bg-gray-50">
            + {rows.length - 10} more rows
          </div>
        )}
      </div>
    );
  }

  if (type === "pie" && values.length > 0) {
    const total = values.reduce((a, b) => a + b, 0);
    return (
      <div className="flex flex-wrap gap-2">
        {labels.map((l, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length] }}
            />
            <span className="text-xs">
              {l}: {total > 0 ? ((values[i] / total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        ))}
      </div>
    );
  }

  if ((type === "bar" || type === "line") && datasets[0]) {
    const max = Math.max(...datasets.flatMap((d) => d.data), 1);
    return (
      <div className="space-y-1">
        {labels.slice(0, 8).map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-20 truncate text-xs text-gray-600">{l}</span>
            <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{
                  width: `${((datasets[0].data[i] ?? 0) / max) * 100}%`,
                  backgroundColor: COLORS[0],
                }}
              />
            </div>
            <span className="w-12 text-right text-xs font-medium">
              {datasets[0].data[i] ?? 0}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function SQLChatbot({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => [
    { id: "1", title: "New Chat", messages: [] },
  ]);
  const [activeId, setActiveId] = useState("1");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const revealTimersRef = useRef<number[]>([]);

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0];

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
        s.id === activeId
          ? {
              ...s,
              title: s.messages.length === 0 ? q.slice(0, 30) : s.title,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, sessionId: activeId }),
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
        const sqlQuery =
          typeof data.sql_query === "string" ? data.sql_query : "";
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

        // Then reveal SQL block
        if (sqlQuery) {
          const t = window.setTimeout(() => {
            updateAssistantMessage(assistantMsgId, { sql_query: sqlQuery });
          }, delay);
          revealTimersRef.current.push(t);
          delay += 220;
        }

        // Then reveal chart/table preview payload
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
  }, [input, loading, activeId, updateAssistantMessage]);

  const addChat = useCallback(() => {
    const id = crypto.randomUUID();
    setSessions((prev) => [
      ...prev,
      { id, title: "New Chat", messages: [] },
    ]);
    setActiveId(id);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-2xl ml-auto h-full bg-white shadow-2xl flex flex-col"
        style={{ maxHeight: "100vh" }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 overflow-x-auto">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeId === s.id
                    ? "bg-red-500 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {s.title}
              </button>
            ))}
            <button
              onClick={addChat}
              className="shrink-0 p-1.5 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
              title="New chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {active.messages.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              <p className="font-medium text-gray-700 mb-1">Ask about your data</p>
              <p className="text-xs">e.g. &quot;Top channels by published videos&quot;</p>
              <p className="text-xs mt-1">&quot;Monthly upload trend&quot;</p>
            </div>
          )}
          {active.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-xl p-3 ${
                m.role === "user"
                  ? "ml-8 bg-red-50 border border-red-100"
                  : "mr-8 bg-gray-50 border border-gray-100"
              }`}
            >
              {m.role === "user" && (
                <p className="text-sm font-medium text-gray-900">{m.question}</p>
              )}
              {m.role === "assistant" && (
                <div className="space-y-3">
                  {m.error && (
                    <p className="text-sm text-red-600">{m.error}</p>
                  )}
                  {m.insights && m.insights.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Insights</p>
                      <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                        {m.insights.map((ins, i) => (
                          <li key={i}>{ins}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {m.sql_query && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">SQL</p>
                      <pre className="text-xs bg-gray-800 text-gray-100 p-2 rounded overflow-x-auto font-mono">
                        {m.sql_query}
                      </pre>
                    </div>
                  )}
                  {m.chart_spec && Object.keys(m.chart_spec).length > 0 && (
                    <div className="mt-2">
                      <ChartPreview spec={m.chart_spec} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask a question about your data..."
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none text-sm"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
