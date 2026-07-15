-- ============================================================================
--  Entry approvals: entries can require votes from other members before
--  they count toward the total/ring/leaderboard.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- groups: how many approvals an entry needs (0 = off, today's behavior),
-- and who's allowed to give them.
-- ---------------------------------------------------------------------------
alter table groups add column if not exists approvals_required int not null default 0;
alter table groups drop constraint if exists groups_approvals_required_check;
alter table groups add constraint groups_approvals_required_check check (approvals_required >= 0);

alter table groups add column if not exists approval_mode text not null default 'any_member';
alter table groups drop constraint if exists groups_approval_mode_check;
alter table groups add constraint groups_approval_mode_check
  check (approval_mode in ('any_member', 'chosen_approvers'));

-- members: only consulted when approval_mode = 'chosen_approvers'. The
-- creator is always treated as an approver regardless of this flag (see
-- every eligibility check below — each one also checks `id = created_by`).
alter table members add column if not exists is_approver boolean not null default false;

-- entries: pending entries are excluded from total/ring/leaderboard sums
-- until they're approved; rejected ones stay excluded permanently but are
-- still visible in the feed.
alter table entries add column if not exists status text not null default 'approved';
alter table entries drop constraint if exists entries_status_check;
alter table entries add constraint entries_status_check
  check (status in ('pending', 'approved', 'rejected'));

-- one vote per member per entry, enforced at the DB level — vote_entry
-- relies on the unique_violation this raises to give a friendly
-- "already voted" error rather than silently accepting a second vote.
create table if not exists entry_votes (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references entries(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  vote        text not null check (vote in ('approve', 'reject')),
  created_at  timestamptz not null default now(),
  unique (entry_id, member_id)
);

create index if not exists entry_votes_entry_idx on entry_votes(entry_id);

alter table entry_votes enable row level security;
revoke all on entry_votes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- _eligible_approver_count: how many active members could ever vote on an
-- entry in this group, under a given mode. Takes the mode as an explicit
-- argument (rather than reading groups.approval_mode) so update_group can
-- validate a proposed new mode before committing it.
-- ---------------------------------------------------------------------------
create or replace function _eligible_approver_count(p_group_id uuid, p_approval_mode text)
returns int
language sql stable set search_path = extensions, public as $$
  select case when p_approval_mode = 'chosen_approvers' then (
    select count(*)::int from members m
    join groups g on g.id = m.group_id
    where m.group_id = p_group_id and m.left_at is null
      and (m.is_approver or m.id = g.created_by)
  ) else (
    select count(*)::int from members m
    where m.group_id = p_group_id and m.left_at is null
  ) end;
$$;

-- ---------------------------------------------------------------------------
-- log_entry: same signature as before — lands 'pending' when the group
-- requires approvals, 'approved' (today's behavior) otherwise. The
-- existing iOS Shortcut needs no changes; its entries just land pending
-- like anyone else's when approvals are on.
-- ---------------------------------------------------------------------------
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
  v_status text;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;
  if m.left_at is not null then raise exception 'You left this tracker, so you can''t log to it anymore.'; end if;

  select * into g from groups where id = m.group_id;
  v_amount := coalesce(p_amount, g.increment);
  v_status := case when g.approvals_required > 0 then 'pending' else 'approved' end;

  insert into entries(group_id, member_id, amount, note, occurred_at, photo_path, thumb_path, status)
  values (
    m.group_id, m.id, v_amount,
    nullif(trim(p_note), ''),
    coalesce(p_occurred_at, now()),
    p_photo_path, p_thumb_path, v_status
  );

  select coalesce(sum(amount), 0) into v_total
  from entries where group_id = m.group_id and status = 'approved';

  return json_build_object(
    'logged', v_amount,
    'group_total', v_total,
    'goal', g.goal,
    'status', v_status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- vote_entry: approve or reject a pending entry. Recomputes status after
-- every vote using symmetric thresholds — first side (approve or reject)
-- to reach approvals_required distinct votes wins.
-- ---------------------------------------------------------------------------
create or replace function vote_entry(p_write_token text, p_entry_id uuid, p_vote text)
returns json
language plpgsql security definer set search_path = extensions, public as $$
declare
  m members%rowtype;
  e entries%rowtype;
  g groups%rowtype;
  v_is_approver boolean;
  v_approve_count int;
  v_reject_count int;
  v_new_status text;
begin
  if p_vote not in ('approve', 'reject') then
    raise exception 'Invalid vote.';
  end if;

  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;
  if m.left_at is not null then raise exception 'You left this tracker, so you can''t vote.'; end if;

  select * into e from entries where id = p_entry_id and group_id = m.group_id;
  if not found then raise exception 'Entry not found.'; end if;

  if e.status <> 'pending' then
    raise exception 'This entry has already been decided.';
  end if;

  if e.member_id = m.id then
    raise exception 'You can''t vote on your own entry.';
  end if;

  select * into g from groups where id = m.group_id;

  v_is_approver := (g.approval_mode = 'any_member') or m.is_approver or m.id = g.created_by;
  if not v_is_approver then
    raise exception 'You''re not an approver for this tracker.';
  end if;

  begin
    insert into entry_votes(entry_id, member_id, vote) values (p_entry_id, m.id, p_vote);
  exception when unique_violation then
    raise exception 'You''ve already voted on this entry.';
  end;

  select count(*) filter (where vote = 'approve') into v_approve_count from entry_votes where entry_id = p_entry_id;
  select count(*) filter (where vote = 'reject') into v_reject_count from entry_votes where entry_id = p_entry_id;

  v_new_status := e.status;
  if v_approve_count >= g.approvals_required then
    v_new_status := 'approved';
  elsif v_reject_count >= g.approvals_required then
    v_new_status := 'rejected';
  end if;

  if v_new_status <> e.status then
    update entries set status = v_new_status where id = e.id;
  end if;

  return json_build_object(
    'status', v_new_status,
    'approve_count', v_approve_count,
    'reject_count', v_reject_count
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- update_group: adds approvals_required, approval_mode, and (chosen mode
-- only) the approver set. No defaults on the first two, same reasoning as
-- p_kind before them — this is only ever called from our own Settings tab
-- with the tracker's current values, so there's no legacy caller to
-- default for, and a default risks silently turning approvals off.
-- ---------------------------------------------------------------------------
drop function if exists update_group(text, text, text, numeric, numeric, text);

create or replace function update_group(
  p_write_token text,
  p_name text,
  p_unit text,
  p_increment numeric,
  p_goal numeric,
  p_kind text,
  p_approvals_required int,
  p_approval_mode text,
  p_approver_ids uuid[] default null
)
returns json
language plpgsql security definer set search_path = extensions, public as $$
declare
  m members%rowtype;
  g groups%rowtype;
  v_eligible int;
begin
  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;

  select * into g from groups where id = m.group_id;
  if g.created_by is distinct from m.id then
    raise exception 'Only the creator can edit this tracker.';
  end if;

  if p_approval_mode = 'chosen_approvers' and p_approver_ids is not null then
    update members set is_approver = (id = any(p_approver_ids))
    where group_id = g.id;
  end if;

  v_eligible := _eligible_approver_count(g.id, p_approval_mode);

  if p_approvals_required > 0 and p_approvals_required > greatest(v_eligible - 1, 0) then
    raise exception
      'Approvals required (%) is more than this tracker can ever satisfy — with % eligible approver(s), at most % can vote on any single entry (the author never counts). Lower the requirement or add more approvers.',
      p_approvals_required, v_eligible, greatest(v_eligible - 1, 0);
  end if;

  begin
    update groups
    set name = p_name, unit = p_unit, increment = p_increment, goal = p_goal, kind = p_kind,
        approvals_required = p_approvals_required, approval_mode = p_approval_mode
    where id = g.id;
  exception when check_violation then
    raise exception 'Not a valid tracker type or approval mode.';
  end;

  return json_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_standings: total/leaderboard/past_total now count approved entries
-- only. `recent` carries status, per-entry approve/reject counts, and
-- (when a write_token is given) whether the caller already voted and
-- whether they're eligible to. `pending_count` is how many pending
-- entries the caller specifically can act on right now — not their own,
-- not already voted.
-- ---------------------------------------------------------------------------
create or replace function get_standings(p_view_token text, p_write_token text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  v_caller_id uuid;
  v_caller_is_approver boolean;
begin
  select * into g from groups where view_token = p_view_token;
  if not found then raise exception 'invalid view token'; end if;

  if p_write_token is not null then
    select id into v_caller_id from members where write_token = p_write_token and group_id = g.id;
  end if;

  v_caller_is_approver := v_caller_id is not null and (
    g.approval_mode = 'any_member'
    or exists (select 1 from members mm where mm.id = v_caller_id and (mm.is_approver or mm.id = g.created_by))
  );

  return json_build_object(
    'group', json_build_object(
      'id', g.id, 'name', g.name, 'unit', g.unit, 'kind', g.kind,
      'increment', g.increment, 'goal', g.goal, 'created_by', g.created_by,
      'approvals_required', g.approvals_required, 'approval_mode', g.approval_mode
    ),
    'total', (select coalesce(sum(amount),0) from entries where group_id = g.id and status = 'approved'),
    'is_creator', (v_caller_id is not null and v_caller_id = g.created_by),
    'my_member_id', v_caller_id,
    'leaderboard', (
      select coalesce(json_agg(row_to_json(t) order by t.total desc), '[]'::json)
      from (
        select me.id as member_id, me.name, me.is_approver,
               coalesce(sum(e.amount) filter (where e.status = 'approved'), 0) as total
        from members me
        left join entries e on e.member_id = me.id
        where me.group_id = g.id and me.left_at is null
        group by me.id, me.name, me.is_approver
      ) t
    ),
    'past_total', (
      select coalesce(sum(e.amount), 0)
      from entries e
      join members me on me.id = e.member_id
      where me.group_id = g.id and me.left_at is not null and e.status = 'approved'
    ),
    'pending_count', (
      case when not v_caller_is_approver then 0 else (
        select count(*)::int from entries e
        where e.group_id = g.id and e.status = 'pending' and e.member_id <> v_caller_id
          and not exists (select 1 from entry_votes v where v.entry_id = e.id and v.member_id = v_caller_id)
      ) end
    ),
    'recent', (
      select coalesce(json_agg(row_to_json(r)), '[]'::json)
      from (
        select
          e.id as entry_id, me.id as member_id, me.name, e.amount, e.note,
          e.occurred_at, e.photo_path, e.thumb_path, e.status,
          coalesce((select count(*) from entry_votes v where v.entry_id = e.id and v.vote = 'approve'), 0) as approve_count,
          coalesce((select count(*) from entry_votes v where v.entry_id = e.id and v.vote = 'reject'), 0) as reject_count,
          (v_caller_id is not null and exists (
            select 1 from entry_votes v where v.entry_id = e.id and v.member_id = v_caller_id
          )) as voted,
          (
            v_caller_is_approver and e.status = 'pending' and e.member_id <> v_caller_id
            and not exists (select 1 from entry_votes v where v.entry_id = e.id and v.member_id = v_caller_id)
          ) as can_vote
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
-- Grants — full list re-issued each migration (safe/idempotent to repeat).
-- _eligible_approver_count is a private helper, same as _new_token — not
-- granted directly; SECURITY DEFINER callers run with the definer's rights.
-- ---------------------------------------------------------------------------
grant execute on function
  create_group(text,text,text,numeric,numeric,text),
  add_member(text,text),
  log_entry(text,numeric,text,timestamptz,text,text),
  get_standings(text,text),
  claim_member(text),
  get_my_trackers(),
  rename_member(text,text),
  update_group(text,text,text,numeric,numeric,text,int,text,uuid[]),
  leave_group(text,uuid),
  delete_group(text),
  delete_entry(text,uuid),
  vote_entry(text,uuid,text)
to anon, authenticated;
