import Link from "next/link";

const nav = [
  { href: "/dashboard/page1", label: "Page 1" },
  { href: "/dashboard/page2", label: "Page 2" },
  { href: "/dashboard/page3", label: "Page 3" },
  { href: "/dashboard/page4", label: "Page 4" },
  { href: "/dashboard/page5", label: "Page 5" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <aside className="w-56 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <Link href="/dashboard/page1" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Analytics Dashboard
          </Link>
        </div>
        <nav className="p-2">
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
