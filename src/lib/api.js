import { supabase } from './supabase.js'

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export const api = {
  createGroup: (p) =>
    rpc('create_group', {
      p_name: p.name,
      p_creator_name: p.creatorName,
      p_unit: p.unit,
      p_increment: p.increment,
      p_goal: p.goal ?? null,
      p_kind: p.kind,
    }),
  addMember: (viewToken, name) =>
    rpc('add_member', { p_view_token: viewToken, p_name: name }),
  logEntry: (writeToken, p = {}) =>
    rpc('log_entry', {
      p_write_token: writeToken,
      p_amount: p.amount ?? null,
      p_note: p.note || null,
      p_occurred_at: p.occurredAt || null,
      p_photo_path: p.photoPath || null,
      p_thumb_path: p.thumbPath || null,
    }),
  getStandings: (viewToken, writeToken = null) =>
    rpc('get_standings', { p_view_token: viewToken, p_write_token: writeToken }),
  claimMember: (writeToken) =>
    rpc('claim_member', { p_write_token: writeToken }),
  getMyTrackers: () => rpc('get_my_trackers', {}),
  renameMember: (writeToken, name) =>
    rpc('rename_member', { p_write_token: writeToken, p_new_name: name }),
  updateGroup: (writeToken, p) =>
    rpc('update_group', {
      p_write_token: writeToken,
      p_name: p.name,
      p_unit: p.unit,
      p_increment: p.increment,
      p_goal: p.goal ?? null,
      p_kind: p.kind,
      p_approvals_required: p.approvalsRequired,
      p_approval_mode: p.approvalMode,
      p_approver_ids: p.approverIds ?? null,
    }),
  leaveGroup: (writeToken, successorMemberId = null) =>
    rpc('leave_group', { p_write_token: writeToken, p_successor_member_id: successorMemberId }),
  deleteGroup: (writeToken) =>
    rpc('delete_group', { p_write_token: writeToken }),
  deleteEntry: (writeToken, entryId) =>
    rpc('delete_entry', { p_write_token: writeToken, p_entry_id: entryId }),
  voteEntry: (writeToken, entryId, vote) =>
    rpc('vote_entry', { p_write_token: writeToken, p_entry_id: entryId, p_vote: vote }),
}
