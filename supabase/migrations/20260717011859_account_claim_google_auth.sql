-- ============================================================================
--  Account claiming from inside a tracker: one active member per account
--  per group, a friendlier claim_member, and get_standings exposing claim
--  status for the caller's own member.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- One active member per account per group. Partial (where left_at is null)
-- so a departed member doesn't block the same account from claiming a
-- fresh membership later — matches how members_unique_name_per_group
-- already treats departure as freeing things up.
-- ---------------------------------------------------------------------------
create unique index if not exists members_unique_account_per_group
  on members (group_id, account_id)
  where account_id is not null and left_at is null;

-- ---------------------------------------------------------------------------
-- claim_member: now also rejects claiming into a group where the caller's
-- account already actively owns a *different* member — named in the error
-- so the person understands why, without merging anything (out of scope
-- for this version). Re-claiming a member you already own is still a
-- harmless no-op, same as before.
-- ---------------------------------------------------------------------------
create or replace function claim_member(p_write_token text)
returns json
language plpgsql security definer set search_path = public as $$
declare
  m members%rowtype;
  v_existing_name text;
begin
  if auth.uid() is null then raise exception 'must be signed in'; end if;

  select * into m from members where write_token = p_write_token;
  if not found then raise exception 'invalid write token'; end if;
  if m.account_id is not null and m.account_id <> auth.uid() then
    raise exception 'already claimed by another account';
  end if;

  select name into v_existing_name from members
  where group_id = m.group_id and account_id = auth.uid() and left_at is null and id <> m.id
  limit 1;
  if v_existing_name is not null then
    raise exception 'Your account is already on this tracker as %.', v_existing_name;
  end if;

  begin
    update members set account_id = auth.uid() where id = m.id;
  exception when unique_violation then
    -- Race: another of the caller's write_tokens in this group got claimed
    -- between the check above and this update. Same rule, generic message
    -- since we no longer know which name won the race.
    raise exception 'Your account is already on this tracker as another member.';
  end;

  return json_build_object('member_id', m.id, 'group_id', m.group_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_standings: adds my_claim_status for the caller's own member — null
-- when there's no caller (no write_token given / not a member here),
-- 'unclaimed' when nobody's linked an account to it yet, 'me' when the
-- calling session's account is the one that claimed it, 'other' when a
-- different account already has (e.g. a shared/leaked write_token).
-- ---------------------------------------------------------------------------
create or replace function get_standings(p_view_token text, p_write_token text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  v_caller_id uuid;
  v_caller_is_approver boolean;
  v_caller_account_id uuid;
begin
  select * into g from groups where view_token = p_view_token;
  if not found then raise exception 'invalid view token'; end if;

  if p_write_token is not null then
    select id, account_id into v_caller_id, v_caller_account_id
    from members where write_token = p_write_token and group_id = g.id;
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
    'my_claim_status', (
      case
        when v_caller_id is null then null
        when v_caller_account_id is null then 'unclaimed'
        when v_caller_account_id = auth.uid() then 'me'
        else 'other'
      end
    ),
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
-- Grants — full list re-issued (safe/idempotent to repeat). Neither
-- function's signature changed, so this isn't strictly required, but every
-- migration that touches a function's body does this for consistency.
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
