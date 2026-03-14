import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          Analytics Dashboard
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          PostgreSQL-backed dashboard. Go to the dashboard to get started.
        </p>
        <Link
          href="/dashboard"
          className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Open Dashboard
        </Link>
      </main>
    </div>
  );
}
