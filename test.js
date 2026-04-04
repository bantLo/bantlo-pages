import { supabase } from './src/lib/supabase.js';

async function test() {
  console.log("Testing fetchUserGroups...");
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
      ),
      user_standing:balances(balance)
    `)
    .limit(1);
    
  console.log("fetchUserGroups Result:", { data, error });

  console.log("\Testing fetchRecentExpenses...");
  const res2 = await supabase
    .from('expenses')
    .select('id, group_id, description, amount, created_at, split_type, payments:expense_payments(user_id, amount_paid, profiles:user_id(display_name, email)), splits:expense_splits(user_id, amount_owed, profiles:user_id(display_name, email))')
    .limit(1);
    
  console.log("fetchRecentExpenses Result:", res2);
}

test();
