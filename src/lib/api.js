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
    }),
  addMember: (viewToken, name) =>
    rpc('add_member', { p_view_token: viewToken, p_name: name }),
  logEntry: (writeToken, amount = null) =>
    rpc('log_entry', { p_write_token: writeToken, p_amount: amount }),
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
    }),
  leaveGroup: (writeToken, successorMemberId = null) =>
    rpc('leave_group', { p_write_token: writeToken, p_successor_member_id: successorMemberId }),
  deleteGroup: (writeToken) =>
    rpc('delete_group', { p_write_token: writeToken }),
}
