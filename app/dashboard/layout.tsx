"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import MetricDictionary from "@/components/MetricDictionary";
import { useTheme } from "@/contexts/ThemeContext";

const ChatPanel = dynamic(() => import("@/components/ChatPanel"), { ssr: false });

const nav = [
  { href: "/dashboard/page1", label: "Overview" },
  { href: "/dashboard/page2", label: "Analysis & Funnel" },
  { href: "/dashboard/page3", label: "Channels" },
  { href: "/dashboard/page4", label: "Content Mix" },
  { href: "/dashboard/page5", label: "Explorer" },
  { href: "/dashboard/page6", label: "Custom Widgets" },
];

const PAGE_LABELS: Record<string, string> = {
  "/dashboard/page1": "CEO Overview",
  "/dashboard/page2": "Analysis & Funnel",
  "/dashboard/page3": "Channels",
  "/dashboard/page4": "Content Mix",
  "/dashboard/page5": "Data Explorer",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const pageContext = PAGE_LABELS[pathname] ?? "Dashboard";

  return (
    <div className="min-h-screen">
      {/* ── Aurora background ── */}
      <div aria-hidden="true" className="aurora-bg" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b
        dark:bg-[#06061a]/85 bg-white/80
        dark:border-white/[0.07] border-gray-100
        backdrop-blur-2xl"
      >
        {/* Thin gradient line at very top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent dark:via-red-400/50" />

        <div className="relative flex items-center justify-between px-5 h-14">
          {/* ── Brand ── */}
          <Link href="/dashboard/page1" className="flex items-center gap-2.5 group shrink-0">
            <div className="relative h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
              style={{
                background: "linear-gradient(135deg, #ff6b6b 0%, #e9434a 50%, #ff8c42 100%)",
                boxShadow: "0 4px 16px rgba(233,67,74,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <span className="text-white text-sm font-black tracking-tighter drop-shadow">F</span>
            </div>
            <span className="text-sm font-extrabold tracking-tight hidden sm:block gradient-text-brand">
              FRAMMER AI
            </span>
          </Link>

          {/* ── Nav ── */}
          <nav className="flex gap-0.5 overflow-x-auto scrollbar-none mx-4">
            {nav.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "text-white"
                      : "dark:text-white/40 text-gray-500 dark:hover:text-white/75 hover:text-gray-800 dark:hover:bg-white/[0.06] hover:bg-gray-100/80"
                  }`}
                  style={isActive ? {
                    background: "linear-gradient(135deg, #e9434a 0%, #c93040 100%)",
                    boxShadow: `0 4px 18px var(--nav-active-shadow), inset 0 1px 0 rgba(255,255,255,0.15)`,
                  } : {}}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* ── Controls ── */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Docs */}
            <button
              onClick={() => setDocsOpen(true)}
              title="Metric Dictionary"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200
                dark:bg-white/[0.06] dark:border-white/[0.10] dark:text-white/55 dark:hover:bg-white/[0.12] dark:hover:text-white/85
                bg-gray-50 border border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.747 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">Docs</span>
            </button>

            {/* Ask AI */}
            <button
              onClick={() => setChatOpen((v) => !v)}
              aria-label="Open AI assistant"
              title="Open AI assistant"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200
                dark:bg-white/[0.06] dark:border-white/[0.10] dark:text-white/55 dark:hover:bg-red-500/15 dark:hover:border-red-500/30 dark:hover:text-red-300
                bg-gray-50 border border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4-4-4z" />
              </svg>
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {/* PDF */}
            <button
              onClick={() => window.print()}
              title="Export as PDF"
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200
                dark:bg-white/[0.06] dark:border-white/[0.10] dark:text-white/55 dark:hover:bg-white/[0.12] dark:hover:text-white/85
                bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center h-8 w-8 rounded-xl text-xs font-semibold transition-all duration-200
                dark:bg-white/[0.06] dark:border-white/[0.10] dark:text-yellow-300/80 dark:hover:bg-yellow-400/10 dark:hover:text-yellow-300
                bg-gray-50 border border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600"
            >
              {theme === "dark" ? (
                /* Sun icon */
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="5" />
                  <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </svg>
              ) : (
                /* Moon icon */
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <MetricDictionary open={docsOpen} onClose={() => setDocsOpen(false)} />
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} pageContext={pageContext} />
    </div>
  );
}
