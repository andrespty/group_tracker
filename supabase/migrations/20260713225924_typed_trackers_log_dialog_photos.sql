-- ============================================================================
--  Typed trackers, log dialog (note/backdating/photos), delete entry.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- groups.kind — drives unit choices and number formatting client-side.
-- ---------------------------------------------------------------------------
alter table groups add column if not exists kind text not null default 'count';

alter table groups drop constraint if exists groups_kind_check;
alter table groups add constraint groups_kind_check
  check (kind in ('count', 'distance', 'money', 'duration'));

-- ---------------------------------------------------------------------------
-- entries: note, occurred_at (separate from created_at), photo paths.
-- occurred_at is when the thing happened (backdatable); created_at stays
-- the audit trail of when it was logged. Backfilled from created_at so
-- existing rows sort exactly as they did before this migration.
-- ---------------------------------------------------------------------------
alter table entries add column if not exists note text;
alter table entries add column if not exists occurred_at timestamptz;
alter table entries add column if not exists photo_path text;
alter table entries add column if not exists thumb_path text;

update entries set occurred_at = created_at where occurred_at is null;

alter table entries alter column occurred_at set default now();
alter table entries alter column occurred_at set not null;

create index if not exists entries_occurred_at_idx on entries(occurred_at);

-- ---------------------------------------------------------------------------
-- entry-photos storage bucket. Public, unguessable filenames — same
-- security posture as the view_token/write_token share links: nothing
-- stops someone from guessing a path, but nobody's going to. Declared here
-- (not just in config.toml) so `supabase db push` also creates it on cloud.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-photos', 'entry-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Uploads/deletes happen directly from the browser with the anon key, same
-- trust model as every RPC in this app (see log_entry/delete_entry below —
-- the *record* of an entry is token-gated; the photo file itself isn't,
-- since there's no clean way to check a write_token from a storage policy
-- without a lot more machinery than this app needs).
drop policy if exists "entry-photos public read" on storage.objects;
create policy "entry-photos public read"
  on storage.objects for select
  using (bucket_id = 'entry-photos');

drop policy if exists "entry-photos anon upload" on storage.objects;
create policy "entry-photos anon upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'entry-photos');

drop policy if exists "entry-photos anon delete" on storage.objects;
create policy "entry-photos anon delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'entry-photos');

-- ---------------------------------------------------------------------------
-- create_group: now also takes p_kind (defaults to 'count', matching the
-- column default, so nothing about existing behavior changes if omitted).
-- ---------------------------------------------------------------------------
drop function if exists create_group(text, text, text, numeric, numeric);

create or replace function create_group(
  p_name text,
  p_creator_name text,
  p_unit text default 'entries',
  p_increment numeric default 1,
  p_goal numeric default null,
  p_kind text default 'count'
)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  m members%rowtype;
begin
  begin
    insert into groups(name, unit, increment, goal, kind, view_token)
    values (p_name, p_unit, p_increment, p_goal, p_kind, _new_token())
    returning * into g;
  exception when check_violation then
    raise exception 'Not a valid tracker type.';
  end;

  begin
    insert into members(group_id, name, write_token, account_id)
    values (g.id, trim(p_creator_name), _new_token(), auth.uid())
    returning * into m;
  exception when unique_violation then
    raise exception 'That name''s already taken in this group.';
  end;

  update groups set created_by = m.id where id = g.id;

  return json_build_object(
    'group_id', g.id,
    'view_token', g.view_token,
    'member_id', m.id,
    'write_token', m.write_token
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- log_entry: adds p_note, p_occurred_at, p_photo_path, p_thumb_path — all
-- optional with defaults, so the existing iOS Shortcut (which only ever
-- sends p_write_token and, optionally, p_amount) keeps working unchanged.
-- We drop + recreate rather than leaving the old 2-arg version in place
-- because PostgREST would then have two candidate functions for a call
-- that only supplies those first two args, which is an ambiguous-overload
-- error, not a "picks the simpler one" — dropping first keeps exactly one
-- function on file, and defaults are what make old callers still work.
-- ---------------------------------------------------------------------------
drop function if exists log_entry(text, numeric);

create or replace function log_entry(
  p_write_token text,
  p_amount numeric default null,
  p_note text default null,
  p_occurred_at timestamptz default null,
  p_photo_path text default null,
  p_thumb_path text default null
)
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
  if m.left_at is not null then raise exception 'You left this tracker, so you can''t log to it anymore.'; end if;

  select * into g from groups where id = m.group_id;
  v_amount := coalesce(p_amount, g.increment);

  insert into entries(group_id, member_id, amount, note, occurred_at, photo_path, thumb_path)
  values (
    m.group_id, m.id, v_amount,
    nullif(trim(p_note), ''),
    coalesce(p_occurred_at, now()),
    p_photo_path, p_thumb_path
  );

  select coalesce(sum(amount), 0) into v_total from entries where group_id = m.group_id;

  return json_build_object(
    'logged', v_amount,
    'group_total', v_total,
    'goal', g.goal
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_standings: group now includes kind; recent now includes entry_id,
-- note, and both photo paths, ordered by occurred_at (not created_at) so
-- backdated entries land where they actually happened.
-- ---------------------------------------------------------------------------
create or replace function get_standings(p_view_token text, p_write_token text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  v_caller_id uuid;
begin
  select * into g from groups where view_token = p_view_token;
  if not found then raise exception 'invalid view token'; end if;

  if p_write_token is not null then
    select id into v_caller_id from members where write_token = p_write_token and group_id = g.id;
  end if;

  return json_build_object(
    'group', json_build_object(
      'id', g.id, 'name', g.name, 'unit', g.unit, 'kind', g.kind,
      'increment', g.increment, 'goal', g.goal
    ),
    'total', (select coalesce(sum(amount),0) from entries where group_id = g.id),
    'is_creator', (v_caller_id is not null and v_caller_id = g.created_by),
    'my_member_id', v_caller_id,
    'leaderboard', (
      select coalesce(json_agg(row_to_json(t) order by t.total desc), '[]'::json)
      from (
        select me.id as member_id, me.name,
               coalesce(sum(e.amount), 0) as total
        from members me
        left join entries e on e.member_id = me.id
        where me.group_id = g.id and me.left_at is null
        group by me.id, me.name
      ) t
    ),
    'past_total', (
      select coalesce(sum(e.amount), 0)
      from entries e
      join members me on me.id = e.member_id
      where me.group_id = g.id and me.left_at is not null
    ),
    'recent', (
      select coalesce(json_agg(row_to_json(r)), '[]'::json)
      from (
        select e.id as entry_id, me.id as member_id, me.name, e.amount, e.note,
               e.occurred_at, e.photo_path, e.thumb_path
        from entries e
        join members me on me.id = e.member_id
        where e.group_id = g.id
        order by e.occurred_at desc
        limit 30
      ) r
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- get_my_trackers: needs kind too, so the dashboard can format each
-- tracker's total correctly (currency vs. plain count vs. decimal).
-- ---------------------------------------------------------------------------
create or replace function get_my_trackers()
returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;

  return (
    select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    from (
      select g.name, g.unit, g.kind, g.goal, g.view_token,
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
-- update_group: adds p_kind. No default — this is only ever called from
-- our own Settings tab, which always sends the tracker's current (possibly
-- unchanged) kind, so there's no legacy caller to default for. Defaulting
-- it would risk silently downgrading a distance/money/duration tracker
-- back to 'count' if a caller ever omitted it.
-- ---------------------------------------------------------------------------
drop function if exists update_group(text, text, text, numeric, numeric);

create or replace function update_group(
  p_write_token text,
  p_name text,
  p_unit text,
  p_increment numeric,
  p_goal numeric,
  p_kind text
)
returns json
language plpgsql security definer set search_path = extensions, public as $$
declare
  m members%rowtype;
  g groups%rowtype;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;

  select * into g from groups where id = m.group_id;
  if g.created_by is distinct from m.id then
    raise exception 'Only the creator can edit this tracker.';
  end if;

  begin
    update groups
    set name = p_name, unit = p_unit, increment = p_increment, goal = p_goal, kind = p_kind
    where id = g.id;
  exception when check_violation then
    raise exception 'Not a valid tracker type.';
  end;

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- delete_entry: the entry's own logger, or the tracker's creator, can
-- remove it. Returns the photo paths so the client can clean up storage
-- after a successful delete (storage isn't touched here — see photos.js).
-- ---------------------------------------------------------------------------
create or replace function delete_entry(p_write_token text, p_entry_id uuid)
returns json
language plpgsql security definer set search_path = extensions, public as $$
declare
  m members%rowtype;
  e entries%rowtype;
  g groups%rowtype;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;

  select * into e from entries where id = p_entry_id and group_id = m.group_id;
  if not found then raise exception 'Entry not found.'; end if;

  select * into g from groups where id = m.group_id;

  if e.member_id <> m.id and g.created_by is distinct from m.id then
    raise exception 'You can only delete your own entries.';
  end if;

  delete from entries where id = e.id;

  return json_build_object('photo_path', e.photo_path, 'thumb_path', e.thumb_path);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — full list re-issued each migration (safe/idempotent to repeat).
-- ---------------------------------------------------------------------------
grant execute on function
  create_group(text,text,text,numeric,numeric,text),
  add_member(text,text),
  log_entry(text,numeric,text,timestamptz,text,text),
  get_standings(text,text),
  claim_member(text),
  get_my_trackers(),
  rename_member(text,text),
  update_group(text,text,text,numeric,numeric,text),
  leave_group(text,uuid),
  delete_group(text),
  delete_entry(text,uuid)
to anon, authenticated;
