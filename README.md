# Demoland — Interactive Demo Hub

The public landing site for our interactive product demos. It links visitors out
to three live, editable, no-sign-up demo instances:

- **Tuesday** — work planning
- **SystemReady** — construction punch lists
- **Docktrail** — dock / logistics tracking

This is a **single combined app**: one repo, one Vercel project, one Supabase
project. The landing page lets a visitor pick a tool, and each tool's demo is
mounted under its own path (`/tuesday`, `/systemready`, `/docktrail`), backed by
its own schema in the shared `Demoland` Supabase project.

The three tools' code is merged in from their source repos (`punchlist`,
`Project-Tuesday`, `docktrail`). Until a tool is merged, its route shows a
"being set up" placeholder. See
[`docs/demo-playground-design.md`](docs/demo-playground-design.md) for the demo
recipe and [`docs/demo_sandbox_reference.sql`](docs/demo_sandbox_reference.sql)
for the ready-to-apply SystemReady reference migration the others mirror.

## Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · deployed on Vercel
(project `demoland`).

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

Tool names, taglines, descriptions, accent colors, and routes live in
[`src/lib/tools.ts`](src/lib/tools.ts).

Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) are added in Vercel → Project `demoland` once the
tool demos are wired up.

## Architecture (summary)

```
demoland.com/                 → pick-a-tool landing page
  ├── /tuesday/...                → Tuesday, demo mode
  ├── /systemready/...            → SystemReady, demo mode
  └── /docktrail/...              → Docktrail, demo mode
```

One Vercel deploy, one `Demoland` Supabase project (each tool in its own Postgres
schema). Demo mode signs visitors in anonymously (Supabase
`signInAnonymously()`), seeds an RLS-isolated workspace per tool, shows a "resets
daily" banner, and a scheduled job recycles stale guest data.
