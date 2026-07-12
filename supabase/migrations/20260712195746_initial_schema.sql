-- ============================================================================
--  GROUP TRACKER — Supabase schema
--  Paste this whole file into the Supabase SQL Editor and run it once.
--
--  Security model:
--   * The anon key is PUBLIC, so direct table access is locked down by RLS.
--   * Everything happens through SECURITY DEFINER functions that validate
--     tokens server-side. Public read needs a group's view_token; writing an
--     entry needs a member's write_token.
-- ============================================================================

-- Needed for gen_random_bytes() token generation.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  unit        text not null default 'entries',   -- e.g. 'drinks', 'km', 'dollars'
  increment   numeric not null default 1,        -- default amount per tap
  goal        numeric,                            -- e.g. 10000 (nullable = no goal)
  view_token  text not null unique,               -- in the shareable read link
  created_at  timestamptz not null default now()
);

create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  name        text not null,
  write_token text not null unique,               -- in each person's log link/Shortcut
  account_id  uuid references auth.users(id),     -- null = guest
  created_at  timestamptz not null default now()
);

create table if not exists entries (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references groups(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  amount      numeric not null default 1,
  created_at  timestamptz not null default now()
);

create index if not exists entries_group_idx  on entries(group_id);
create index if not exists entries_member_idx on entries(member_id);
create index if not exists members_account_idx on members(account_id);

-- ---------------------------------------------------------------------------
-- Lock everything down. RLS on + no policies = no direct anon/auth access.
-- All access flows through the SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------
alter table groups  enable row level security;
alter table members enable row level security;
alter table entries enable row level security;

revoke all on groups, members, entries from anon, authenticated;

-- Helper: short url-safe token.
create or replace function _new_token()
returns text language sql volatile as $$
  select encode(gen_random_bytes(12), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- create_group: makes a tracker + its first member (the creator).
-- If called while signed in, the creator member is linked to that account.
-- ---------------------------------------------------------------------------
create or replace function create_group(
  p_name text,
  p_creator_name text,
  p_unit text default 'entries',
  p_increment numeric default 1,
  p_goal numeric default null
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  m members%rowtype;
begin
  insert into groups(name, unit, increment, goal, view_token)
  values (p_name, p_unit, p_increment, p_goal, _new_token())
  returning * into g;

  insert into members(group_id, name, write_token, account_id)
  values (g.id, p_creator_name, _new_token(), auth.uid())
  returning * into m;

  return json_build_object(
    'group_id', g.id,
    'view_token', g.view_token,
    'member_id', m.id,
    'write_token', m.write_token
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- add_member: anyone holding the group's view link can add themselves.
-- ---------------------------------------------------------------------------
create or replace function add_member(p_view_token text, p_name text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  m members%rowtype;
begin
  select * into g from groups where view_token = p_view_token;
  if not found then raise exception 'invalid view token'; end if;

  insert into members(group_id, name, write_token, account_id)
  values (g.id, p_name, _new_token(), auth.uid())
  returning * into m;

  return json_build_object('member_id', m.id, 'write_token', m.write_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- log_entry: the core write. Needs only a member's write_token.
-- amount defaults to the group's configured increment.
-- ---------------------------------------------------------------------------
create or replace function log_entry(p_write_token text, p_amount numeric default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  m members%rowtype;
  g groups%rowtype;
  v_amount numeric;
  v_total numeric;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;

  select * into g from groups where id = m.group_id;
  v_amount := coalesce(p_amount, g.increment);

  insert into entries(group_id, member_id, amount)
  values (m.group_id, m.id, v_amount);

  select coalesce(sum(amount), 0) into v_total from entries where group_id = m.group_id;

  return json_build_object(
    'logged', v_amount,
    'group_total', v_total,
    'goal', g.goal
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_standings: public read via the group's view_token.
-- Returns group info + per-member totals (leaderboard) + grand total.
-- ---------------------------------------------------------------------------
create or replace function get_standings(p_view_token text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
begin
  select * into g from groups where view_token = p_view_token;
  if not found then raise exception 'invalid view token'; end if;

  return json_build_object(
    'group', json_build_object(
      'id', g.id, 'name', g.name, 'unit', g.unit,
      'increment', g.increment, 'goal', g.goal
    ),
    'total', (select coalesce(sum(amount),0) from entries where group_id = g.id),
    'leaderboard', (
      select coalesce(json_agg(row_to_json(t) order by t.total desc), '[]'::json)
      from (
        select me.id as member_id, me.name,
               coalesce(sum(e.amount), 0) as total
        from members me
        left join entries e on e.member_id = me.id
        where me.group_id = g.id
        group by me.id, me.name
      ) t
    ),
    'recent', (
      select coalesce(json_agg(row_to_json(r)), '[]'::json)
      from (
        select me.id as member_id, me.name, e.amount, e.created_at
        from entries e
        join members me on me.id = e.member_id
        where e.group_id = g.id
        order by e.created_at desc
        limit 8
      ) r
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_member: a signed-in user attaches an existing guest member row to
-- their account (so their history follows them). Needs the write_token.
-- ---------------------------------------------------------------------------
create or replace function claim_member(p_write_token text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  m members%rowtype;
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;

  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;
  if m.account_id is not null and m.account_id <> auth.uid() then
    raise exception 'already claimed by another account';
  end if;

  update members set account_id = auth.uid() where id = m.id;
  return json_build_object('member_id', m.id, 'group_id', m.group_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_trackers: dashboard for a signed-in user.
-- ---------------------------------------------------------------------------
create or replace function get_my_trackers()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;

  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select g.name, g.unit, g.goal, g.view_token,
             me.name as my_name, me.write_token, g.created_at,
             (select coalesce(sum(amount),0) from entries where group_id = g.id) as total
      from members me
      join groups g on g.id = me.group_id
      where me.account_id = auth.uid()
    ) t
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Expose only the functions to the API roles.
-- ---------------------------------------------------------------------------
grant execute on function
  create_group(text,text,text,numeric,numeric),
  add_member(text,text),
  log_entry(text,numeric),
  get_standings(text),
  claim_member(text),
  get_my_trackers()
to anon, authenticated;


create extension if not exists pgcrypto with schema extensions;

create or replace function _new_token()
returns text language sql volatile
set search_path = extensions, public as $$
  select encode(gen_random_bytes(12), 'hex');
$$;