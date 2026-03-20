"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import MetricDictionary from "@/components/MetricDictionary";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const pageContext = PAGE_LABELS[pathname] ?? "Dashboard";

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-lg">
        <div className="flex items-center justify-between px-5 h-12">
          <Link
            href="/dashboard/page1"
            className="flex items-center gap-2"
          >
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">F</span>
            </div>
            <span className="text-sm font-bold text-gray-900 tracking-tight hidden sm:inline">
              FRAMMER AI
            </span>
          </Link>

          <nav className="flex gap-0.5 overflow-x-auto scrollbar-none">
            {nav.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-red-500 text-white shadow-sm shadow-red-200"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDocsOpen(true)}
              className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors flex items-center gap-1.5"
              title="Metric Dictionary"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.747 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="hidden sm:inline">Docs</span>
            </button>

            <button
              onClick={() => setChatOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
              aria-label="Open AI assistant"
              title="Open AI assistant"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4-4-4z" />
              </svg>
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            <button
              onClick={() => window.print()}
              className="text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-1.5"
              title="Export as PDF"
            >
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
      <MetricDictionary open={docsOpen} onClose={() => setDocsOpen(false)} />
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        pageContext={pageContext}
      />
    </div>
  );
}
