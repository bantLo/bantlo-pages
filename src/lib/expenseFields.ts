/**
 * The canonical expense projection, used by every read path.
 *
 * Lives in its own module rather than in api.ts because tests mock that module
 * wholesale — importing a constant from it would resolve to undefined under
 * test, and a `.select(undefined)` fails in a way that looks unrelated.
 *
 * Previously this string was copy-pasted across five call sites, and one of
 * them had already drifted (AddExpense was missing is_settlement). A column
 * added to one copy and not the others silently vanishes on whichever path
 * was missed.
 */
export const EXPENSE_SELECT =
  'id, group_id, description, amount, created_at, split_type, is_settlement, preset_id, ' +
  'payments:expense_payments(user_id, amount_paid, profiles:user_id(display_name, email)), ' +
  'splits:expense_splits(user_id, amount_owed)';
