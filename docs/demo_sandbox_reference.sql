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
