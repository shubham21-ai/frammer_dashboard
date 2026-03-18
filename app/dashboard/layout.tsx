"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import SQLChatbot from "@/components/SQLChatbot";

const nav = [
  { href: "/dashboard/page1", label: "Overview" },
  { href: "/dashboard/page2", label: "Analysis & Funnel" },
  { href: "/dashboard/page3", label: "Channels" },
  { href: "/dashboard/page4", label: "Content Mix" },
  { href: "/dashboard/page5", label: "Explorer" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);

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
              onClick={() => setChatOpen(true)}
              className="text-xs font-medium text-gray-700 bg-red-50 border border-red-200 px-2 sm:px-3 py-1.5 rounded-lg hover:border-red-300 hover:bg-red-100 transition-colors flex items-center gap-1.5"
              title="Ask questions about your data"
            >
              <svg className="h-3.5 w-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <span className="hidden sm:inline">AI Data Chat</span>
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
      <SQLChatbot open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
