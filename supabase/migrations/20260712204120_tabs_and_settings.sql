-- ============================================================================
--  Tabs + Settings: creator ownership, departed members, unique names,
--  and the new group/member management RPCs.
-- ============================================================================

-- --- schema changes ---------------------------------------------------------
alter table groups add column if not exists created_by uuid references members(id);

update groups g
set created_by = (
  select me.id from members me
  where me.group_id = g.id
  order by me.created_at asc
  limit 1
)
where g.created_by is null;

alter table members add column if not exists left_at timestamptz;

create unique index if not exists members_unique_name_per_group
  on members (group_id, lower(trim(name)))
  where left_at is null;

-- --- changed functions ------------------------------------------------------
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

create or replace function add_member(p_view_token text, p_name text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  m members%rowtype;
begin
  select * into g from groups where view_token = p_view_token;
  if not found then raise exception 'invalid view token'; end if;

  begin
    insert into members(group_id, name, write_token, account_id)
    values (g.id, trim(p_name), _new_token(), auth.uid())
    returning * into m;
  exception when unique_violation then
    raise exception 'That name''s already taken in this group.';
  end;

  return json_build_object('member_id', m.id, 'write_token', m.write_token);
end;
$$;

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
  if m.left_at is not null then raise exception 'You left this tracker, so you can''t log to it anymore.'; end if;

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

-- signature changed (added p_write_token), so the old one must be dropped
drop function if exists get_standings(text);

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
      'id', g.id, 'name', g.name, 'unit', g.unit,
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
        select me.id as member_id, me.name, e.amount, e.created_at
        from entries e
        join members me on me.id = e.member_id
        where e.group_id = g.id
        order by e.created_at desc
        limit 30
      ) r
    )
  );
end;
$$;

-- --- new functions ----------------------------------------------------------
create or replace function rename_member(p_write_token text, p_new_name text)
returns json
language plpgsql security definer set search_path = extensions, public as $$
declare
  m members%rowtype;
  v_name text;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;

  v_name := trim(p_new_name);

  begin
    update members set name = v_name where id = m.id;
  exception when unique_violation then
    raise exception 'That name''s already taken in this group.';
  end;

  return json_build_object('member_id', m.id, 'name', v_name);
end;
$$;

create or replace function update_group(
  p_write_token text,
  p_name text,
  p_unit text,
  p_increment numeric,
  p_goal numeric
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

  update groups
  set name = p_name, unit = p_unit, increment = p_increment, goal = p_goal
  where id = g.id;

  return json_build_object('ok', true);
end;
$$;

create or replace function leave_group(p_write_token text, p_successor_member_id uuid default null)
returns json
language plpgsql security definer set search_path = extensions, public as $$
declare
  m members%rowtype;
  g groups%rowtype;
  s members%rowtype;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;
  if m.left_at is not null then raise exception 'You already left this tracker.'; end if;

  select * into g from groups where id = m.group_id;

  if g.created_by = m.id then
    if p_successor_member_id is null then
      raise exception 'Pick someone to hand the tracker to before you leave.';
    end if;
    if p_successor_member_id = m.id then
      raise exception 'Pick someone other than yourself to hand the tracker to.';
    end if;

    select * into s from members
    where id = p_successor_member_id and group_id = m.group_id and left_at is null;
    if not found then
      raise exception 'Successor must be an active member of this tracker.';
    end if;

    update groups set created_by = s.id where id = g.id;
  end if;

  update members set left_at = now() where id = m.id;

  return json_build_object('ok', true);
end;
$$;

create or replace function delete_group(p_write_token text)
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
    raise exception 'Only the creator can delete this tracker.';
  end if;

  delete from groups where id = g.id;

  return json_build_object('ok', true);
end;
$$;

-- --- grants -----------------------------------------------------------------
grant execute on function
  create_group(text,text,text,numeric,numeric),
  add_member(text,text),
  log_entry(text,numeric),
  get_standings(text,text),
  claim_member(text),
  get_my_trackers(),
  rename_member(text,text),
  update_group(text,text,text,numeric,numeric),
  leave_group(text,uuid),
  delete_group(text)
to anon, authenticated;