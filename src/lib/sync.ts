import { getPendingMutations, removeMutation } from './db';
import { supabase } from './supabase';
import { fetchUserGroups, fetchRecentExpenses, fetchGroupBalances, createGroup } from './api';

export async function performFullSync() {
  console.log('[Sync] Starting full manual synchronization...');
  
  // 1. Get Current User
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required for sync');

  // 2. Upstream: Process Pending Mutations
  const pending = await getPendingMutations();
  console.log(`[Sync] Processing ${pending.length} pending mutations...`);
  
  for (const mut of pending) {
    try {
      if (mut.action === 'CREATE_GROUP') {
        const { name, currency } = mut.payload;
        await createGroup(user.id, name, currency);
      } else if (mut.action === 'ADD_EXPENSE') {
        const { expData, payments, splits } = mut.payload;
        
        // Manual insertion logic for queued expenses
        const { data: exp, error: e1 } = await supabase.from('expenses').insert([expData]).select().single();
        if (e1) throw e1;

        await supabase.from('expense_payments').insert(payments.map((p: any) => ({ ...p, expense_id: exp.id })));
        await supabase.from('expense_splits').insert(splits.map((s: any) => ({ ...s, expense_id: exp.id })));
      }
      
      // Remove from queue if successful
      if (mut.id) await removeMutation(mut.id);
    } catch (err) {
      console.error(`[Sync] Mutation ${mut.id} failed:`, err);
      // We keep it in the queue for the next retry or professional troubleshooting
    }
  }

  // 3. Downstream: Refresh all local data
  console.log('[Sync] Fetching fresh remote data...');
  const groups = await fetchUserGroups(user.id);
  
  // For each group, we refresh balances and the most recent expenses to ensure cache integrity
  // We limit this to the most active/loaded groups to prevent massive network usage
  const syncPromises = groups.slice(0, 10).map(async (g: any) => {
    await Promise.all([
      fetchGroupBalances(g.id),
      fetchRecentExpenses(g.id, 20)
    ]);
  });
  
  await Promise.all(syncPromises);
  
  console.log('[Sync] Full synchronization complete.');
  return { success: true, processedMutations: pending.length };
}
