-- ==========================================
-- bantLo Balance Healing Utility (v1.1)
-- ==========================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Reset all current balances to baseline 0.00
    DELETE FROM public.balances;

    -- 2. Ensure all group members have a baseline record
    INSERT INTO public.balances (group_id, user_id, balance)
    SELECT group_id, user_id, 0.00
    FROM public.group_members
    ON CONFLICT (group_id, user_id) DO NOTHING;

    -- 3. Sync Credits (Expense Payments)
    FOR r IN (
        SELECT e.group_id, ep.user_id, SUM(ep.amount_paid) as total 
        FROM public.expense_payments ep
        JOIN public.expenses e ON e.id = ep.expense_id
        GROUP BY e.group_id, ep.user_id
    ) LOOP
        UPDATE public.balances SET balance = balance + r.total 
        WHERE group_id = r.group_id AND user_id = r.user_id;
    END LOOP;

    -- 4. Sync Debts (Expense Splits)
    FOR r IN (
        SELECT e.group_id, es.user_id, SUM(es.amount_owed) as total 
        FROM public.expense_splits es
        JOIN public.expenses e ON e.id = es.expense_id
        GROUP BY e.group_id, es.user_id
    ) LOOP
        UPDATE public.balances SET balance = balance - r.total 
        WHERE group_id = r.group_id AND user_id = r.user_id;
    END LOOP;

    -- 5. Sync Settlement Transfers
    FOR r IN (
        SELECT group_id, from_user_id, to_user_id, SUM(amount) as total
        FROM public.settlements
        GROUP BY group_id, from_user_id, to_user_id
    ) LOOP
        UPDATE public.balances SET balance = balance + r.total 
        WHERE group_id = r.group_id AND user_id = r.from_user_id;
        UPDATE public.balances SET balance = balance - r.total 
        WHERE group_id = r.group_id AND user_id = r.to_user_id;
    END LOOP;
END $$;
