import { supabase } from './supabase';

import { getDB } from './db';

// Fetch groups a user is part of
export async function fetchUserGroups(userId: string) {
  try {
    const { data, error } = await supabase
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
      .eq('user_id', userId);
      
    if (error) throw error;
    
    const validGroups = data.map((membership: any) => membership.groups).filter(Boolean);
    
    try {
      // Full sync: Clear local cache and re-fill with fresh server results
      const db = await getDB();
      await db.clear('groups');
      const tx = db.transaction('groups', 'readwrite');
      for (const g of validGroups) {
        await tx.store.put(g);
      }
      await tx.done;
    } catch (dbError) {
      console.error('Failed to sync groups to IndexedDB:', dbError);
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

  if (memberError) throw memberError;

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
      .select('user_id, balance, profiles:user_id(display_name, email)')
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

export async function fetchRecentExpenses(groupId: string) {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('id, description, amount, created_at, payments:expense_payments(user_id, amount_paid, profiles:user_id(display_name, email)), splits:expense_splits(user_id, amount_owed)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;
    
    const db = await getDB();
    await db.put('expenses', { group_id: groupId, expenses: data as any[], updated_at: new Date().toISOString() });
    return data;
  } catch (error) {
    if (!navigator.onLine) {
      const db = await getDB();
      const cached = await db.get('expenses', groupId);
      return cached ? cached.expenses : [];
    }
    console.error('Failed fetching expenses:', error);
    return [];
  }
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
  const { error } = await supabase.from('expenses').update({ description: newDesc.substring(0, 30) }).eq('id', expenseId);
  if (error) throw error;
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
}

export async function fetchExpenseCount(groupId: string) {
  const { count, error } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', groupId);
  if (error) throw error;
  return count || 0;
}

export async function fetchRecentSettlements(groupId: string) {
  const { data, error } = await supabase
    .from('settlements')
    .select('id, amount, from_user_id, to_user_id, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data || [];
}

export async function deleteSettlement(settlementId: string) {
  const { error } = await supabase.from('settlements').delete().eq('id', settlementId);
  if (error) throw error;
}

export async function addFriendByEmail(email: string) {
  const { data, error } = await supabase.rpc('add_friend_by_email', { p_email: email });
  if (error) throw error;
  return data;
}
