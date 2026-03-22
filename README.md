# JCB Data Dashboard

AI-powered analytics dashboard built with Next.js 16, Supabase, and Google Gemini. Upload datasets, visualize processing summaries, chat with your data in natural language, and manage schema through the UI.

---

## Tech Stack

- **Framework**: Next.js 16 / React 19 / TypeScript
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini 2.5 Pro via LangChain
- **Charts**: Recharts, Chart.js, Plotly
- **Auth**: Supabase Auth (email restricted to `*.frammer@gmail.com`)
- **Styling**: Tailwind CSS v4

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (Gemini)

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# ─── Supabase (required) ──────────────────────────────────────────────────────
# Found in: Supabase Dashboard → Project Settings → API

NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-anon-key

# ─── AI / LLM (at least one required for Ask AI & Insights features) ──────────
# Get from: https://aistudio.google.com/apikey

GEMINI_API_KEY=your-gemini-api-key
GOOGLE_API_KEY=your-google-api-key          # Fallback if GEMINI_API_KEY is unset

# Optional: override the default model (default: gemini-2.5-pro)
GEMINI_MODEL=gemini-2.5-pro

# ─── Database direct connection (optional, for advanced use) ──────────────────
# Found in: Supabase Dashboard → Project Settings → Database → Connection string

DATABASE_URL=postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres
DB_POOL_MAX=10                              # Max DB connections (default: 10)

# ─── Debug flags (optional, development only) ────────────────────────────────
ASK_AI_LOG=0        # Set to 1 to log Ask AI requests/responses
ASK_AI_LOG_SQL=0    # Set to 1 to log generated SQL queries
```

### Where to find each value

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Supabase Dashboard → Project Settings → API → anon / public key |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → Create API Key |
| `DATABASE_URL` | Supabase Dashboard → Project Settings → Database → Connection string (URI) |

---

## Database Setup

Run these migrations in your Supabase SQL Editor (**Dashboard → SQL Editor**):

**1. Core schema** — run all files in `lib/migrations/` in order:

```
lib/migrations/001_*.sql        ← base tables (videos, channels, users, summary tables)
lib/migrations/002_exec_ddl.sql ← required for the "Add Column" UI feature
```

**2. `002_exec_ddl.sql`** — paste this directly if you prefer:

```sql
CREATE OR REPLACE FUNCTION exec_ddl(sql text)
RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/shubham21-ai/frammer_dashboard.git
cd frammer_dashboard

# 2. Install dependencies
npm install

# 3. Set up environment variables
#    Copy the template below into .env.local and fill in your values
#    (see Environment Variables section above)

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build optimised production bundle |
| `npm start` | Serve the production build (run `build` first) |
| `npm run lint` | Run ESLint |

---

## Features

| Feature | Description |
|---|---|
| **Dashboard** | Channel, user, input/output type, language processing summaries |
| **Upload Dataset** | CSV / Excel upload — auto-resolves FK chains and rebuilds summary tables |
| **Ask AI** | Natural-language SQL chat powered by Gemini 2.5 Pro |
| **AI Insights** | One-click chart + narrative generation for any table |
| **Schema Manager** | Add columns to any allowed table directly from the UI |
| **Custom Widgets** | User-specific pinned charts saved per account |
| **Dark Mode** | Full dark / light toggle |

---

## Auth

Sign-up and login require an email in the format **`xyz.frammer@gmail.com`**. Any other email format is rejected at the login page.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add all environment variables under **Project Settings → Environment Variables**
4. Deploy

> `NEXT_PUBLIC_*` variables are exposed to the browser — never store secrets in them.
