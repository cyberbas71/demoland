# Demoland — Interactive Demo Hub

The public landing site for our interactive product demos. It links visitors out
to three live, editable, no-sign-up demo instances:

- **Tuesday** — work planning
- **SystemReady** — construction punch lists
- **Docktrail** — dock / logistics tracking

This repo is **only the hub** (a small Next.js site). Each tool runs as its own
deploy in "demo mode" against its own demo Supabase project. See
[`docs/demo-playground-design.md`](docs/demo-playground-design.md) for the full
architecture and the per-tool demo recipe, and
[`docs/demo_sandbox_reference.sql`](docs/demo_sandbox_reference.sql) for the
ready-to-apply SystemReady reference migration that Tuesday and Docktrail mirror.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · deployed on Vercel
(project `demoland`).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Configuration

The "Launch interactive demo" buttons are env-driven so the hub can point at the
real demo subdomains without a code change. Copy `.env.example` to `.env.local`
(or set these in Vercel → Project `demoland` → Environment Variables):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_TUESDAY_DEMO_URL` | Tuesday demo URL |
| `NEXT_PUBLIC_SYSTEMREADY_DEMO_URL` | SystemReady demo URL |
| `NEXT_PUBLIC_DOCKTRAIL_DEMO_URL` | Docktrail demo URL |

Tool names, taglines, descriptions, and accent colors live in
[`src/lib/tools.ts`](src/lib/tools.ts).

## Architecture (summary)

```
try.<brand>.com               → this hub (3 product cards)
  ├── tuesday.try.<brand>.com     → Tuesday, demo mode
  ├── systemready.try.<brand>.com → SystemReady, demo mode
  └── docktrail.try.<brand>.com   → Docktrail, demo mode
```

Each tool is gated behind `NEXT_PUBLIC_DEMO_MODE=1`; demo mode signs visitors in
anonymously (Supabase `signInAnonymously()`), seeds an RLS-isolated workspace,
shows a "resets daily" banner, and a scheduled job recycles stale guest data.
The per-tool implementation is **not** in this repo — it lives in each tool's own
repo (`punchlist`, `Project-Tuesday`, `docktrail`).
