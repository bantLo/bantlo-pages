-- ============================================================
-- UPI Settle-Up  (bantLo v2.4.0)
-- ============================================================
-- Run this against an existing Supabase project. DB_Query.sql is a one-shot
-- bootstrap and does not re-run on a provisioned database.
--
-- Idempotent: safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Payment handles
-- ------------------------------------------------------------
-- A UPI ID lives in its own table rather than as a column on `profiles`.
--
-- `profiles` is governed by "Public Profiles are viewable by everyone"
-- (USING (true)) — every authenticated user can read every row. That is fine
-- for a display name, and several flows depend on it (invite previews resolve
-- a group creator's name before the viewer is a member). Adding a UPI ID to
-- that table would publish every user's payment handle to every user.
--
-- Splitting it out means the sensitive field gets a strict policy of its own
-- without weakening a policy that existing features rely on.

CREATE TABLE IF NOT EXISTS user_payment_handles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  upi_id TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);


-- ------------------------------------------------------------
-- 2. Visibility helper
-- ------------------------------------------------------------
-- "Does the caller share at least one group with this user?" — the payment-handle
-- analogue of is_group_member(). SECURITY DEFINER so the policy can read
-- group_members without recursing through its own RLS.

CREATE OR REPLACE FUNCTION shares_group_with(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM group_members gm_self
    JOIN group_members gm_other ON gm_self.group_id = gm_other.group_id
    WHERE gm_self.user_id = auth.uid()
      AND gm_other.user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ------------------------------------------------------------
-- 3. RLS — readable only by the owner and their co-members
-- ------------------------------------------------------------
ALTER TABLE user_payment_handles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View payment handles of co-members" ON user_payment_handles;
DROP POLICY IF EXISTS "Insert own payment handle" ON user_payment_handles;
DROP POLICY IF EXISTS "Update own payment handle" ON user_payment_handles;
DROP POLICY IF EXISTS "Delete own payment handle" ON user_payment_handles;

CREATE POLICY "View payment handles of co-members" ON user_payment_handles
  FOR SELECT USING (user_id = auth.uid() OR shares_group_with(user_id));

-- Writes are owner-only: nobody may set or alter another user's payee address.
CREATE POLICY "Insert own payment handle" ON user_payment_handles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own payment handle" ON user_payment_handles
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Delete own payment handle" ON user_payment_handles
  FOR DELETE USING (user_id = auth.uid());
