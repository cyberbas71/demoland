# Interactive Demo Playground — Design Doc

**Status:** Approved design, not yet built.
**Audience:** A fresh build session, working in a different repo/cloud, with a
**brand-new Supabase project** and a **brand-new Vercel project** to deploy into.
**Owner:** cyberbas@gmail.com

---

## 1. Goal

Ship **one public website** where prospects can *play with* our tools — not
watch a video, not read a brochure, but click around live, editable instances
seeded with realistic data. Three tools are in scope:

- **Tuesday**
- **SystemReady** (the construction punch-list tool; reference implementation
  for this doc)
- **Docktrail**

(A fourth tool exists but is out of scope for v1.)

The experience should feel like the real product, require **no sign-up**, and
**reset itself** so the next visitor always gets a clean, populated sandbox.

## 2. Decisions already made

These were decided with the owner and are **fixed inputs** for the build:

| Decision | Choice | Implication |
|---|---|---|
| How real is the hands-on experience? | **Editable sandbox that resets** | Visitors can create/edit/delete; data is isolated per visitor and recycled on a schedule. Not read-only, not a shared single dataset. |
| How are the three tools assembled? | **Hub + separate demo deploys** | A small landing site links out to each tool deployed independently on its own subdomain. No monorepo merge. |
| Stack of the three tools | **All Next.js + Supabase** | Tuesday and Docktrail do **not** have a demo mode yet; it must be added using the same recipe as SystemReady. |

## 3. High-level architecture

```
try.<brand>.com               → Hub: landing page, three product cards
  ├── tuesday.try.<brand>.com     → Tuesday, demo mode
  ├── systemready.try.<brand>.com → SystemReady, demo mode
  └── docktrail.try.<brand>.com   → Docktrail, demo mode
```

- **Hub** is a tiny static Next.js site (or a single route). Three cards, each
  with a screenshot, a one-line pitch, and a **"Launch interactive demo →"**
  button linking to that tool's subdomain.
- **Each tool** is deployed as its **own Vercel project**, in **demo mode**,
  pointed at its **own dedicated demo Supabase project** (kept entirely
  separate from any production data).
- Demo mode is gated by a single env flag (`NEXT_PUBLIC_DEMO_MODE=1`) so the
  same codebase runs normally everywhere else. **No production behaviour
  changes unless that flag is set.**

### Why separate deploys instead of a monorepo
Each tool keeps its own codebase, dependencies, and deploy pipeline. Zero risky
refactors of working software, and the hub ships in days. The only per-tool
engineering is adding the demo recipe below.

## 4. The demo sandbox recipe (per tool)

The core idea: **reuse the real app's code path** rather than faking client
state. Each visitor becomes a real (anonymous) authenticated user with their
own isolated, RLS-protected workspace. This makes the demo genuinely behave
like the product.

Five pieces, each tool needs all five:

1. **Guest entry** — visitor hits a demo entry route; the app calls Supabase
   `signInAnonymously()` (no form, no email). They get a real session.
2. **Auto-seed** — on first entry, a `security definer` Postgres function clones
   a template dataset into a fresh workspace owned by that guest. Existing RLS
   keeps guests from seeing each other.
3. **Guardrails** — an `is_demo` flag on the workspace; disable real outbound
   email/invites in demo mode; cap uploads; light rate-limiting.
4. **Reset** — a scheduled function deletes demo workspaces + anonymous users
   older than ~24h (cascades clean up all child rows).
5. **Demo banner** — persistent "You're in a live demo — data resets daily" bar
   with a **"Reset my sandbox"** button.

### Key gotchas discovered in SystemReady (apply to all tools)
- **Anonymous Supabase users have a `null` email.** Any `profiles`/users table
  with a `NOT NULL` email and an `auth.users` insert trigger will fail on
  anonymous sign-in. The trigger must synthesize a placeholder email.
- **Anonymous sessions use the `authenticated` Postgres role** (with
  `is_anonymous = true` in the JWT). Grant the seed function to `authenticated`;
  grant the reset function to `service_role` only.
- **Lifecycle/state guards** (e.g. SystemReady requires a resolution note +
  verifier rights to mark a punch `verified`) mean the seed should only insert
  records in *non-privileged* states and let the visitor drive the rest.
- The app must already support **"no Supabase env = static demo"** as a
  separate concept; do not confuse that with this **editable** demo, which
  *requires* a live (demo) Supabase project.

## 5. Reference implementation — SystemReady

SystemReady is Next.js 16 (App Router) + React 19 + Supabase + Tailwind, with
heavy RLS (20+ migrations) and server-action mutations. Its schema (relevant
tables): `profiles`, `workspaces`, `companies`, `workspace_members`,
`projects`, `project_members`, `boards`, `punch_items`, plus photos/comments/
activity. A guest who is workspace `owner` + project `manager` can exercise the
full punch lifecycle.

The following is a **complete, ready-to-apply** worked example. Tuesday and
Docktrail mirror the structure against their own schemas.

### 5.1 Migration: `0NN_demo_sandbox.sql`

```sql
-- Demo sandbox: anonymous guests get an isolated, pre-populated workspace they
-- can edit freely; a scheduled job recycles stale data. Opt-in only — nothing
-- changes for normal workspaces. The app exposes the guest entry point only
-- when deployed with NEXT_PUBLIC_DEMO_MODE=1.

-- 1. Tolerate anonymous auth users (null email) in the profile bootstrap.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (auth_user_id, email, full_name)
  values (
    new.id,
    coalesce(new.email, 'guest-' || new.id::text || '@demo.local'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Demo guest')
  )
  on conflict (auth_user_id) do update
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

-- 2. Mark demo workspaces so the reset job and the UI can find them.
alter table public.workspaces
  add column if not exists is_demo boolean not null default false;

create index if not exists workspaces_demo_created_idx
  on public.workspaces (created_at) where is_demo;

-- 3. Seed a private demo workspace for the calling user. Idempotent per profile
--    (reuses an existing demo workspace, so refreshing the entry point is
--    harmless). Definer-run inserts, all scoped to the caller's own profile.
create or replace function public.seed_demo_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_id uuid := auth.uid();
  v_profile_id uuid;
  v_workspace_id uuid;
  v_project_id uuid;
  internal_company_id uuid;
  pipepro_company_id uuid;
  elco_company_id uuid;
  v_board_comm uuid;
  v_board_mech uuid;
begin
  if v_auth_id is null then
    raise exception 'seed_demo_workspace requires an authenticated session';
  end if;

  insert into public.profiles (auth_user_id, email, full_name)
  values (v_auth_id, 'guest-' || v_auth_id::text || '@demo.local', 'Demo guest')
  on conflict (auth_user_id) do nothing;

  select id into v_profile_id from public.profiles where auth_user_id = v_auth_id;

  -- Idempotent: reuse an existing demo workspace owned by this guest.
  select w.id into v_workspace_id
  from public.workspaces w
  join public.workspace_members wm on wm.workspace_id = w.id
  where w.is_demo and wm.profile_id = v_profile_id and wm.role = 'owner'
  order by w.created_at desc
  limit 1;

  if v_workspace_id is not null then
    return jsonb_build_object('workspace_id', v_workspace_id, 'created', false);
  end if;

  insert into public.workspaces (name, created_by_profile_id, is_demo)
  values ('SystemReady Demo', v_profile_id, true)
  returning id into v_workspace_id;

  insert into public.companies (workspace_id, name, kind)
  values (v_workspace_id, 'SystemReady Internal', 'internal')
  returning id into internal_company_id;
  insert into public.companies (workspace_id, name, kind)
  values (v_workspace_id, 'PipePro GmbH', 'contractor')
  returning id into pipepro_company_id;
  insert into public.companies (workspace_id, name, kind)
  values (v_workspace_id, 'ELCO Electrical', 'contractor')
  returning id into elco_company_id;

  -- Guest is workspace owner + internal project manager => full lifecycle.
  insert into public.workspace_members (workspace_id, profile_id, company_id, role)
  values (v_workspace_id, v_profile_id, internal_company_id, 'owner');

  insert into public.projects (workspace_id, name, code, external_scope)
  values (v_workspace_id, 'Brunsbuttel terminal', 'BRB', 'assigned_company')
  returning id into v_project_id;

  insert into public.project_members (project_id, profile_id, company_id, role)
  values (v_project_id, v_profile_id, internal_company_id, 'manager');

  insert into public.boards (workspace_id, project_id, name, kind)
  values (v_workspace_id, v_project_id, 'Commissioning punch list', 'punch_list')
  returning id into v_board_comm;
  insert into public.boards (workspace_id, project_id, name, kind)
  values (v_workspace_id, v_project_id, 'Mechanical completion punch list', 'punch_list')
  returning id into v_board_mech;

  -- Sample punches across categories/statuses/contractors. Non-verified only
  -- (the verification guard requires a resolution note + verifier rights).
  insert into public.punch_items (
    workspace_id, project_id, board_id, title, description,
    category, status, area, system, discipline, location_text,
    contractor_company_id, raised_by_profile_id, assigned_to_profile_id,
    due_at, ready_at
  ) values
    (v_workspace_id, v_project_id, v_board_comm,
     'ESD valve tag mismatch at jetty battery limit',
     'Installed tag plate does not match the latest loop check package.',
     'A', 'open', 'Jetty', 'ESD', 'E&I', 'Jetty BL, rack J-14, valve XV-2141',
     elco_company_id, v_profile_id, v_profile_id, (now() - interval '2 days')::date, null),
    (v_workspace_id, v_project_id, v_board_comm,
     'Missing insulation on steam tracing line',
     'Reinstate cladding and weatherproofing on ST-204.',
     'B', 'in_progress', 'Process area', 'Steam', 'Mechanical', 'Pipe rack PR-02, +6m',
     pipepro_company_id, v_profile_id, null, (now() + interval '3 days')::date, null),
    (v_workspace_id, v_project_id, v_board_comm,
     'Cable gland not certified for zone rating',
     'Replace JB-118 gland with certified Ex-rated gland; update dossier.',
     'A', 'ready_for_inspection', 'Compressor house', 'Power', 'E&I', 'JB-118 north wall',
     elco_company_id, v_profile_id, v_profile_id, (now() + interval '1 day')::date, now() - interval '6 hours'),
    (v_workspace_id, v_project_id, v_board_mech,
     'Flange bolts not tensioned to spec',
     'Re-tension FL-2207 per joint integrity procedure; capture torque report.',
     'B', 'in_progress', 'Pipe rack', 'Process', 'Mechanical', 'PR-04, 8"-PG-2207',
     pipepro_company_id, v_profile_id, null, (now() - interval '1 day')::date, null),
    (v_workspace_id, v_project_id, v_board_mech,
     'Earthing strap missing on pump skid',
     'Install bonding strap SK-12 <-> steel; test continuity before energisation.',
     'A', 'ready_for_inspection', 'Pump house', 'Earthing', 'E&I', 'Skid SK-12, pump P-410',
     elco_company_id, v_profile_id, v_profile_id, (now() + interval '2 days')::date, now() - interval '2 hours'),
    (v_workspace_id, v_project_id, v_board_mech,
     'Painting touch-up required after welding',
     'Surface-prep and coat bare steel on handrail HR-09.',
     'C', 'open', 'Access platform', 'Structural', 'Civil', 'Platform EL+12m, north stair',
     pipepro_company_id, v_profile_id, null, (now() + interval '14 days')::date, null);

  return jsonb_build_object('workspace_id', v_workspace_id, 'project_id', v_project_id, 'created', true);
end;
$$;

-- 4. Recycle stale demo data (cascades clean up children + photos/comments).
create or replace function public.reset_demo_workspaces(max_age interval default interval '24 hours')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare workspaces_removed integer; users_removed integer;
begin
  with d as (delete from public.workspaces where is_demo and created_at < now() - max_age returning 1)
  select count(*) into workspaces_removed from d;
  with d as (delete from auth.users where is_anonymous and created_at < now() - max_age returning 1)
  select count(*) into users_removed from d;
  return jsonb_build_object('workspaces_removed', workspaces_removed, 'anonymous_users_removed', users_removed);
end;
$$;

-- 5. Grants. Anonymous sessions are the `authenticated` role.
revoke execute on function public.seed_demo_workspace() from public, anon;
grant  execute on function public.seed_demo_workspace() to authenticated;
revoke execute on function public.reset_demo_workspaces(interval) from public, anon, authenticated;
grant  execute on function public.reset_demo_workspaces(interval) to service_role;
```

> ⚠️ Storage: SystemReady photos live in a private bucket. Deleting the
> `punch_items`/`punch_photos` rows leaves orphaned objects. Either (a) skip
> photo seeding in the demo, or (b) extend `reset_demo_workspaces` to also
> delete the storage objects for removed demo workspaces. v1 recommendation:
> skip photo uploads in demo, or cap and let them age out with a storage
> lifecycle rule.

### 5.2 App changes (all gated on `NEXT_PUBLIC_DEMO_MODE === "1"`)

1. **Env flag** — add `demoMode` to the env helper (`src/lib/env.ts`):
   `demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "1"`.

2. **Guest entry route** — `src/app/auth/demo/route.ts` (GET):
   - 404 if `!demoMode`.
   - Use the SSR server client to `supabase.auth.signInAnonymously()` (sets the
     auth cookies via the cookie adapter).
   - `await supabase.rpc("seed_demo_workspace")`.
   - `NextResponse.redirect` to `/dashboard` (or app home).
   - Path lives under `/auth`, already a public path in the proxy.

3. **Proxy/middleware** (`src/proxy.ts`) — when `demoMode` and there is no user
   and the path isn't public, redirect to **`/auth/demo`** instead of `/login`.
   Anonymous users are real users, so they pass the existing gate afterwards.

4. **Reset action** — server action `resetDemoAction()`:
   - Calls a `service_role` admin client to delete the current guest's demo
     workspace, then re-runs `seed_demo_workspace()` for them (or signs them out
     and bounces back through `/auth/demo`). Redirect to app home.

5. **Demo banner** — `src/components/demo-banner.tsx` (client), rendered in the
   `(app)` layout only when `demoMode`. Copy: *"You're exploring a live demo —
   data resets daily and is visible only to you."* + a **Reset my sandbox**
   button wired to `resetDemoAction`.

6. **Login page** — when `demoMode`, add an **"Explore the live demo →"** link
   to `/auth/demo` (nice-to-have; the proxy redirect already covers cold loads).

### 5.3 Scheduled reset

Add a Supabase scheduled Edge Function `demo-reset` (the repo already uses Edge
Functions like `daily-digest`) that calls `reset_demo_workspaces()` via the
service-role client. Schedule it via `pg_cron` / Supabase scheduled functions to
run hourly (deleting anything older than 24h). Alternatively a Vercel Cron route
hitting a protected endpoint.

## 6. Per-tool work: Tuesday & Docktrail

Repeat §4–§5 against each tool's own schema. For each:
1. Identify the top-level tenant table (workspace/org/board/project equivalent)
   and add an `is_demo` flag.
2. Make the new-auth-user trigger null-email-safe.
3. Write `seed_demo_<tool>()` that builds one realistic, self-contained tenant
   owned by the guest, respecting that tool's state/permission guards.
4. Write `reset_demo_*()` + schedule it.
5. Add the same env flag, guest-entry route, proxy redirect, banner, and reset
   action.
6. Handle storage cleanup if the tool stores uploads.

> The build session will need the Tuesday and Docktrail **repos attached** to do
> this — they are not in the SystemReady repo.

## 7. Infrastructure setup (fresh instances)

For **each** tool (do this once per tool) plus the hub:

**Supabase (new demo project per tool):**
1. Create a dedicated demo project (NOT shared with production data).
2. Apply all existing migrations, then the new `demo_sandbox` migration.
3. **Authentication → enable "Allow anonymous sign-ins".**
4. Set a conservative anonymous rate limit and enable CAPTCHA/abuse protection
   if available.
5. Grab `URL`, `anon key`, `service_role key`.

**Vercel (new project per tool + hub):**
1. New project from the tool's repo/branch.
2. Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, **`NEXT_PUBLIC_DEMO_MODE=1`**.
3. Assign the subdomain (`<tool>.try.<brand>.com`).
4. Hub project gets `try.<brand>.com` and links to the three subdomains.

**DNS:** point `try.<brand>.com` and the three subdomains at Vercel.

## 8. Security & abuse considerations

- **Isolation** rests entirely on existing RLS scoping data to the guest's
  workspace/profile. Before launch, run the repo's RLS smoke tests against the
  demo project and confirm a guest cannot read another guest's workspace.
- **No real outbound** — in demo mode, disable email invites, notifications,
  webhooks, and any third-party side effects.
- **Rate-limit** anonymous sign-ins (Supabase setting) to blunt sign-in floods.
- **Cap** uploads/record counts per demo workspace; rely on the reset job to
  bound total data.
- **Service-role key** stays server-only (never `NEXT_PUBLIC_`).
- Keep demo projects on **separate** Supabase orgs/projects from production so a
  demo incident can never touch real customer data.

## 9. Phasing

| Phase | Deliverable | Notes |
|---|---|---|
| 1 | SystemReady demo (reference) end-to-end on its own subdomain | Proves the recipe |
| 2 | Hub landing site | Parallelizable |
| 3 | Tuesday + Docktrail demos | Needs those repos attached |
| 4 | Polish: analytics, "Book a demo" CTA, abuse limits, copy | — |

## 10. Open questions for the owner

1. **Brand/domain** for the hub (`try.<brand>.com`?).
2. **Reset cadence** — 24h proposed; could be shorter for heavy traffic.
3. **Photos in the SystemReady demo** — seed none (simplest) vs. seed sample
   images vs. allow guest uploads with storage cleanup.
4. **Lead capture** — purely anonymous, or an optional "email me this demo"/
   "book a call" step?
5. **Analytics** — which tool, and is product analytics (event tracking) wanted
   inside the demos?

---

### Appendix: SystemReady facts the build session can rely on
- Stack: Next.js 16 App Router, React 19, `@supabase/ssr`, Tailwind v4,
  `@tanstack/react-query`, Vercel.
- Auth gate lives in `src/proxy.ts` (Next 16 "Proxy", Node runtime);
  `PUBLIC_PATHS = ["/login", "/auth"]`; session validated with
  `supabase.auth.getUser()`.
- Supabase clients: `src/lib/supabase/server.ts` (SSR, returns `null` when env
  absent), `admin.ts` (service role), `client.ts` (browser).
- Static (non-editable) demo data already exists in `src/lib/data/demo.ts` and
  is served only when Supabase env vars are absent — this is a *different*
  mechanism from the editable demo above and should be left intact.
- Punch number format auto-assigned by trigger (`SR-<cat>-<hash>`); lifecycle
  enforced by `enforce_punch_lifecycle` (verification needs resolution note +
  `can_verify_punch`).