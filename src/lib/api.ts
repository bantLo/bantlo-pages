import { supabase } from './supabase';
import { getDB, updateCachedGroupsSync, updateExpensesSync, getExpensesCached } from './db';
import { computeEqualSplits } from './splits';
import { EXPENSE_SELECT } from './expenseFields';

export { EXPENSE_SELECT };

// Fetch groups a user is part of
export async function fetchUserGroups(userId: string) {
  try {
    const [{ data: memberships, error: gError }, { data: balances, error: bError }] = await Promise.all([
      supabase
        .from('group_members')
        .select(`
          group_id,
          groups (
            id,
            name,
            currency,
            is_friend_group,
            updated_at
          )
        `)
        .eq('user_id', userId),
      supabase
        .from('balances')
        .select('group_id, balance')
        .eq('user_id', userId)
    ]);
      
    if (gError) throw gError;
    if (bError) throw bError;
    
    // Map balances for quick lookup
    const balanceMap = new Map(balances?.map(b => [b.group_id, b.balance]));
    
    const validGroups = memberships.map((membership: any) => {
      const g = membership.groups;
      if (g) {
        // Embed the standing for easier display
        (g as any).standing = balanceMap.get(g.id) || 0;
      }
      return g;
    }).filter(Boolean);
    
    try {
      // Background Sync: Update local cache with fresh server results without wiping
      await updateCachedGroupsSync(validGroups);
    } catch (dbError) {
      console.error('Background sync failed:', dbError);
    }
    
    return validGroups;
  } catch (error) {
    if (!navigator.onLine) {
      console.warn('Offline mode: serving cached groups');
      const db = await getDB();
      return await db.getAll('groups');
    }
    throw error;
  }
}

// Create a new group and automatically add the creator as the first member
export async function createGroup(userId: string, name: string, currency: string = 'USD') {
  const { data: groupData, error: groupError } = await supabase
    .from('groups')
    .insert([{ name, currency, created_by: userId }])
    .select()
    .single();

  if (groupError) throw groupError;

  const { error: memberError } = await supabase
    .from('group_members')
    .insert([{ group_id: groupData.id, user_id: userId }]);

  if (memberError) {
    // Attempt cleanup to prevent dangling groups that aren't visible to anyone
    await supabase.from('groups').delete().eq('id', groupData.id);
    throw memberError;
  }

  return groupData;
}

// Fetch a single group by ID
export async function fetchGroupDetails(groupId: string) {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single();

  if (error) throw error;
  return data;
}

// Fetch members of a group
export async function fetchGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      user_id,
      profiles:user_id ( display_name, email ) 
    `)
    .eq('group_id', groupId);

  if (error) throw error;
  return data;
}

export async function fetchGroupBalances(groupId: string) {
  try {
    const { data, error } = await supabase
      .from('balances')
      .select('user_id, balance')
      .eq('group_id', groupId);

    if (error) throw error;
    
    const db = await getDB();
    await db.put('balances', { group_id: groupId, balances: data as any[], updated_at: new Date().toISOString() });
    return data;
  } catch (error) {
    if (!navigator.onLine) {
      const db = await getDB();
      const cached = await db.get('balances', groupId);
      return cached ? cached.balances : [];
    }
    console.error('Failed fetching balances:', error);
    return [];
  }
}

export async function fetchRecentExpenses(groupId: string, limit: number = 20) {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    try {
      await updateExpensesSync(data);
    } catch (dbError) {
      console.error('Failed to sync expenses to IndexedDB:', dbError);
    }
    
    return data;
  } catch (error) {
    if (!navigator.onLine) {
      return await getExpensesCached(groupId, limit);
    }
    throw error;
  }
}

export async function fetchMoreExpenses(groupId: string, offset: number, limit: number = 20) {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  
  try {
    await updateExpensesSync(data);
  } catch (dbError) {
    console.error('Sync failed:', dbError);
  }
  
  return data;
}

// ==========================================
// Phase 2: Members & Deletions
// ==========================================

export async function addMemberByEmail(groupId: string, email: string) {
  const { data, error } = await supabase.rpc('add_member_by_email', {
    p_email: email,
    p_group_id: groupId
  });
  if (error) throw error;
  return data;
}

export async function deleteExpense(expenseId: string) {
  // With Database Triggers established natively inside PostgreSQL, deleting the absolute origin 
  // automatically cascades into `expense_splits` and reverse-calculates mathematical absolute 
  // distributions onto `balances` instantaneously on-chain!
  const { error: deletionErr } = await supabase.from('expenses').delete().eq('id', expenseId);
  if (deletionErr) throw deletionErr;
}

export async function updateExpenseDescription(expenseId: string, newDesc: string) {
  const { error } = await supabase.from('expenses').update({ description: newDesc.substring(0, 100) }).eq('id', expenseId);
  if (error) throw error;
}

export async function updateFullExpense(
  expenseId: string, 
  updates: { description: string, amount: number, split_type: number },
  payments: { user_id: string, amount_paid: number }[],
  splits: { user_id: string, amount_owed: number }[]
) {
  // 1. Update the parent expense record
  const { error: e1 } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', expenseId);
  if (e1) throw e1;

  // 2. Delete existing payments & splits
  await supabase.from('expense_payments').delete().eq('expense_id', expenseId);
  await supabase.from('expense_splits').delete().eq('expense_id', expenseId);

  // 3. Insert new payments & splits
  const { error: e2 } = await supabase
    .from('expense_payments')
    .insert(payments.map(p => ({ ...p, expense_id: expenseId })));
  if (e2) throw e2;

  const { error: e3 } = await supabase
    .from('expense_splits')
    .insert(splits.map(s => ({ ...s, expense_id: expenseId })));
  if (e3) throw e3;

  // 4. Return the full record
  const { data, error: e4 } = await supabase
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('id', expenseId)
    .single();
    
  if (e4) throw e4;
  
  try {
    await updateExpensesSync([data]);
  } catch (dbError) {
    console.error('Local sync failed:', dbError);
  }

  return data;
}

export async function updateGroupSettings(groupId: string, updates: { name?: string, currency?: string }) {
  const { error } = await supabase.from('groups').update(updates).eq('id', groupId);
  if (error) throw error;
}

export async function updateGroupName(groupId: string, newName: string) {
  return updateGroupSettings(groupId, { name: newName });
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw error;
  
  // Clean up local cache for this group
  try {
    const db = await getDB();
    await db.delete('groups', groupId);
    await db.delete('balances', groupId);
    await db.delete('expenses', groupId);
  } catch (err) {
    console.error('Failed to clean up local group cache:', err);
  }
}

export async function removeMember(groupId: string, userId: string) {
  const { error } = await supabase.from('group_members').delete().match({ group_id: groupId, user_id: userId });
  if (error) throw error;

  // preset_members cascades from auth.users, not from group_members — leaving a
  // group doesn't delete the account, so without this the rosters keep pointing
  // at someone no longer here. Quick-add filters ex-members out defensively, but
  // the stale rows would still show up when editing a preset.
  const { data: presets } = await supabase
    .from('expense_presets')
    .select('id')
    .eq('group_id', groupId);

  if (presets?.length) {
    const { error: cleanupError } = await supabase
      .from('preset_members')
      .delete()
      .eq('user_id', userId)
      .in('preset_id', presets.map(p => p.id));

    // The member is already out; a stale roster row is cosmetic by comparison.
    if (cleanupError) console.error('Failed clearing preset memberships:', cleanupError);
  }
}

// ==========================================
// Expense Presets (Quick Add)
// ==========================================

export interface ExpensePreset {
  id: string;
  group_id: string;
  name: string;
  default_amount: number | null;
  payer_id: string | null;
  members: { user_id: string }[];
}

export async function fetchGroupPresets(groupId: string): Promise<ExpensePreset[]> {
  const { data, error } = await supabase
    .from('expense_presets')
    .select('id, group_id, name, default_amount, payer_id, members:preset_members(user_id)')
    .eq('group_id', groupId)
    .order('name');

  if (error) throw error;
  return (data || []) as ExpensePreset[];
}

export async function createPreset(
  groupId: string,
  name: string,
  memberIds: string[],
  options: { defaultAmount?: number | null; payerId?: string | null } = {}
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('expense_presets')
    .insert([{
      group_id: groupId,
      name: name.trim(),
      default_amount: options.defaultAmount ?? null,
      payer_id: options.payerId ?? null,
      created_by: user.id
    }])
    .select('id')
    .single();

  if (error) throw error;

  try {
    await setPresetMembers(data.id, memberIds);
  } catch (err) {
    // A preset with no roster would silently split between nobody, so don't
    // leave one behind.
    await supabase.from('expense_presets').delete().eq('id', data.id);
    throw err;
  }

  return data.id as string;
}

export async function updatePreset(
  presetId: string,
  updates: { name?: string; default_amount?: number | null; payer_id?: string | null }
) {
  const { error } = await supabase.from('expense_presets').update(updates).eq('id', presetId);
  if (error) throw error;
}

export async function deletePreset(presetId: string) {
  // preset_members cascades; expenses.preset_id is ON DELETE SET NULL, so the
  // expenses booked through this preset survive untouched.
  const { error } = await supabase.from('expense_presets').delete().eq('id', presetId);
  if (error) throw error;
}

/** Replaces the roster wholesale — same delete-then-insert shape as updateFullExpense. */
export async function setPresetMembers(presetId: string, memberIds: string[]) {
  if (memberIds.length === 0) throw new Error('A preset needs at least one member');

  await supabase.from('preset_members').delete().eq('preset_id', presetId);

  const { error } = await supabase
    .from('preset_members')
    .insert(memberIds.map(user_id => ({ preset_id: presetId, user_id })));

  if (error) throw error;
}

/**
 * The most recent amount booked through each preset in a group, keyed by
 * preset_id — shown as a "last time" hint for presets with no fixed amount.
 */
export async function fetchLastPresetAmounts(groupId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('expenses')
    .select('preset_id, amount, created_at')
    .eq('group_id', groupId)
    .not('preset_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    // A convenience hint is never worth breaking the group screen over.
    console.error('Failed fetching last preset amounts:', error);
    return {};
  }

  const latest: Record<string, number> = {};
  for (const row of data || []) {
    // Rows arrive newest-first, so the first sighting of a preset is its latest.
    if (row.preset_id && latest[row.preset_id] === undefined) {
      latest[row.preset_id] = Number(row.amount);
    }
  }
  return latest;
}

/**
 * Books an expense from a preset: equal split across the roster, single payer.
 *
 * The roster is filtered against current group members by the caller — a preset
 * can outlive someone's removal from the group, and splitting to an ex-member
 * would corrupt balances.
 */
export async function createExpenseFromPreset(
  groupId: string,
  preset: { id: string; name: string },
  amount: number,
  payerId: string,
  memberIds: string[]
) {
  if (memberIds.length === 0) throw new Error('This preset has no members left in the group');

  let createdExpenseId: string | null = null;
  try {
    const { data: expense, error: eError } = await supabase
      .from('expenses')
      .insert([{
        group_id: groupId,
        amount,
        description: preset.name,
        split_type: 0, // Equal
        preset_id: preset.id
      }])
      .select('id')
      .single();

    if (eError) throw eError;
    createdExpenseId = expense.id;

    const { error: pError } = await supabase
      .from('expense_payments')
      .insert([{ expense_id: expense.id, user_id: payerId, amount_paid: amount }]);
    if (pError) throw pError;

    const splits = computeEqualSplits(amount, memberIds);
    const { error: sError } = await supabase
      .from('expense_splits')
      .insert(
        Object.entries(splits)
          .filter(([, owed]) => owed > 0)
          .map(([user_id, amount_owed]) => ({ expense_id: expense.id, user_id, amount_owed }))
      );
    if (sError) throw sError;

    const { data: full, error: fError } = await supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('id', expense.id)
      .single();
    if (fError) throw fError;

    return full;
  } catch (error) {
    // Without cleanup a half-written expense would leave payments or splits
    // booked against a total they no longer match.
    if (createdExpenseId) {
      try {
        await supabase.from('expenses').delete().eq('id', createdExpenseId);
      } catch (err) {
        console.error('Failed to clean up dangling preset expense:', err);
      }
    }
    throw error;
  }
}

export async function fetchExpenseCount(groupId: string) {
  const { count, error } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if (error) throw error;
  return count || 0;
}

export async function createSettlement(groupId: string, fromId: string, toId: string, amount: number) {
  let createdExpenseId: string | null = null;
  try {
    // 1. Create the primary expense record
    const { data: expense, error: eError } = await supabase
      .from('expenses')
      .insert([{
        group_id: groupId,
        amount: amount,
        description: 'Settle Payment',
        split_type: 1, // Exact
        is_settlement: true
      }])
      .select('id, group_id, description, amount, created_at, is_settlement')
      .single();
    
    if (eError) throw eError;
    createdExpenseId = expense.id;

    // 2. Insert Funding Record (Sender pays) and Debt Record (Receiver owes)
    // This causes the mathematical net effect to perfectly zero out the debt.
    const { error: pError } = await supabase.from('expense_payments').insert([{
      expense_id: expense.id,
      user_id: fromId,
      amount_paid: amount
    }]);
    if (pError) throw pError;

    const { error: sError } = await supabase.from('expense_splits').insert([{
      expense_id: expense.id,
      user_id: toId,
      amount_owed: amount
    }]);
    if (sError) throw sError;

    return expense;
  } catch (error) {
    if (createdExpenseId) {
      try {
        await supabase
          .from('expenses')
          .delete()
          .eq('id', createdExpenseId);
      } catch (err) {
        console.error('Failed to clean up dangling settlement expense:', err);
      }
    }
    throw error;
  }
}

/** The current user's saved UPI ID, or '' if they haven't set one. */
export async function fetchMyUpiId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '';

  const { data, error } = await supabase
    .from('user_payment_handles')
    .select('upi_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data?.upi_id || '';
}

/** Saves (or clears, when passed '') the current user's UPI ID. */
export async function saveMyUpiId(upiId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { error } = await supabase
    .from('user_payment_handles')
    .upsert({
      user_id: user.id,
      upi_id: upiId || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) throw error;
}

/**
 * UPI IDs for the given members, keyed by user_id. RLS restricts this to
 * co-members, so anyone not sharing a group simply comes back absent rather
 * than erroring. Missing handles are expected — setting one is optional.
 */
export async function fetchUpiHandles(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const { data, error } = await supabase
    .from('user_payment_handles')
    .select('user_id, upi_id')
    .in('user_id', userIds);

  if (error) {
    // A payment shortcut is never worth breaking the balances view over.
    console.error('Failed fetching UPI handles:', error);
    return {};
  }

  const handles: Record<string, string> = {};
  for (const row of data || []) {
    if (row.upi_id) handles[row.user_id] = row.upi_id;
  }
  return handles;
}

export async function fetchRecentSettlements(groupId: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      id, 
      amount, 
      created_at, 
      is_settlement,
      payments:expense_payments(user_id, amount_paid),
      splits:expense_splits(user_id, amount_owed)
    `)
    .eq('group_id', groupId)
    .eq('is_settlement', true)
    .order('created_at', { ascending: false })
    .limit(15);
  
  if (error) throw error;
  
  // Transform back to the flat structure the UI expects
  return (data || []).map(e => ({
    id: e.id,
    amount: e.amount,
    created_at: e.created_at,
    from_user_id: e.payments?.[0]?.user_id,
    to_user_id: e.splits?.[0]?.user_id
  }));
}

export async function deleteSettlement(settlementId: string) {
  // Since settlements are now Expenses, deleting the parent removes the split/payment effect immediately
  const { error } = await supabase.from('expenses').delete().eq('id', settlementId);
  if (error) throw error;
}

export async function updateSettlement(settlementId: string, amount: number) {
  // 1. Update expense amount
  const { error: e1 } = await supabase.from('expenses').update({ amount }).eq('id', settlementId);
  if (e1) throw e1;

  // 2. Update split and payment amount
  const { error: e2 } = await supabase.from('expense_payments').update({ amount_paid: amount }).eq('expense_id', settlementId);
  if (e2) throw e2;

  const { error: e3 } = await supabase.from('expense_splits').update({ amount_owed: amount }).eq('expense_id', settlementId);
  if (e3) throw e3;
}

export async function addFriendByEmail(email: string) {
  const { data, error } = await supabase.rpc('add_friend_by_email', { p_email: email });
  if (error) throw error;
  return data;
}

export async function createGroupInvite(groupId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Auth required');

  // 1. Check if a link was created in the last 12 hours
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: e1 } = await supabase
    .from('group_invites')
    .select('*')
    .eq('group_id', groupId)
    .eq('inviter_id', user.id)
    .gt('created_at', twelveHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing && !e1) {
    return { ...existing, reused: true };
  }

  // 2. Create new if none exists or older than 12h
  const { data, error } = await supabase
    .from('group_invites')
    .insert([{ 
      group_id: groupId, 
      inviter_id: user.id
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}


export async function fetchInviteMetadata(inviteId: string) {
  const { data, error } = await supabase
    .from('group_invites')
    .select(`
      id,
      expires_at,
      group:group_id (
        id,
        name
      )
    `)
    .eq('id', inviteId)
    .single();
  if (error) throw error;
  return data;
}

export async function acceptGroupInvite(inviteId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to join the group.');

  // 1. Fetch group ID from invite
  const { data: invite, error: e1 } = await supabase
    .from('group_invites')
    .select('group_id, expires_at')
    .eq('id', inviteId)
    .single();
    
  if (e1 || !invite) throw new Error('Invite not found or expired.');
  if (new Date(invite.expires_at) < new Date()) throw new Error('This invite link has expired.');

  // 2. Add member
  const { error: e2 } = await supabase
    .from('group_members')
    .insert([{ group_id: invite.group_id, user_id: user.id }]);
    
  if (e2 && !e2.message.includes('unique constraint')) throw e2;
  
  return invite.group_id;
}

export async function deleteAccount() {
  const { data, error } = await supabase.rpc('delete_user_account');
  if (error) throw error;
  return data;
}


