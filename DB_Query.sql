-- ==========================================
-- bantLo PostgreSQL Architecture V2.4 (Splitwise Parity Engine)
-- Execute this entire block in your Supabase SQL Editor
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Structural Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  is_friend_group BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  description VARCHAR(30) NOT NULL,
  notes TEXT,
  split_type SMALLINT NOT NULL CHECK (split_type IN (0, 1, 2)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_owed NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0)
);

CREATE TABLE IF NOT EXISTS balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ==========================================
-- 2. Aggressive Database Accounting Triggers
-- ==========================================

-- Trigger A: Create standard 0.00 entries for new group members automatically.
CREATE OR REPLACE FUNCTION init_user_balance() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO balances (group_id, user_id, balance) 
  VALUES (NEW.group_id, NEW.user_id, 0.00)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_user_balance ON group_members;
CREATE TRIGGER trg_init_user_balance
AFTER INSERT ON group_members
FOR EACH ROW EXECUTE FUNCTION init_user_balance();

-- Trigger B: When an expense_payment is added, increase the user's absolute balance because they funded the group.
CREATE OR REPLACE FUNCTION update_balance_on_payment() RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT group_id INTO v_group_id FROM expenses WHERE id = OLD.expense_id;
  ELSE
    SELECT group_id INTO v_group_id FROM expenses WHERE id = NEW.expense_id;
  END IF;

  -- If v_group_id is NULL (cascade situation), let the parent handle the math.
  IF v_group_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO balances (group_id, user_id, balance) VALUES (v_group_id, NEW.user_id, NEW.amount_paid)
      ON CONFLICT (group_id, user_id) DO UPDATE SET balance = balances.balance + EXCLUDED.balance;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE balances SET balance = balance - OLD.amount_paid WHERE group_id = v_group_id AND user_id = OLD.user_id;
    ELSIF TG_OP = 'UPDATE' THEN
      UPDATE balances SET balance = balance - OLD.amount_paid + NEW.amount_paid WHERE group_id = v_group_id AND user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payment_balance ON expense_payments;
CREATE TRIGGER trg_payment_balance
AFTER INSERT OR UPDATE OR DELETE ON expense_payments
FOR EACH ROW EXECUTE FUNCTION update_balance_on_payment();

-- Trigger C: Decrease absolute balances based on how the expense was strictly split.
CREATE OR REPLACE FUNCTION update_balance_on_split() RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT group_id INTO v_group_id FROM expenses WHERE id = OLD.expense_id;
  ELSE
    SELECT group_id INTO v_group_id FROM expenses WHERE id = NEW.expense_id;
  END IF;

  -- If v_group_id is NULL (cascade situation), let the parent handle the math.
  IF v_group_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO balances (group_id, user_id, balance) VALUES (v_group_id, NEW.user_id, -NEW.amount_owed)
      ON CONFLICT (group_id, user_id) DO UPDATE SET balance = balances.balance + EXCLUDED.balance;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE balances SET balance = balance + OLD.amount_owed WHERE group_id = v_group_id AND user_id = OLD.user_id;
    ELSIF TG_OP = 'UPDATE' THEN
      UPDATE balances SET balance = balance + OLD.amount_owed - NEW.amount_owed WHERE group_id = v_group_id AND user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger settlement: When a settlement is recorded, update balances for both participants.
CREATE OR REPLACE FUNCTION update_balance_on_settlement() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Payer (from_user_id) increases balance (paid debt)
    INSERT INTO balances (group_id, user_id, balance) VALUES (NEW.group_id, NEW.from_user_id, NEW.amount)
    ON CONFLICT (group_id, user_id) DO UPDATE SET balance = balances.balance + EXCLUDED.balance;
    -- Receiver (to_user_id) decreases balance (received payment)
    INSERT INTO balances (group_id, user_id, balance) VALUES (NEW.group_id, NEW.to_user_id, -NEW.amount)
    ON CONFLICT (group_id, user_id) DO UPDATE SET balance = balances.balance + EXCLUDED.balance;
  ELSIF TG_OP = 'DELETE' THEN
    -- Reverse effects
    UPDATE balances SET balance = balance - OLD.amount WHERE group_id = OLD.group_id AND user_id = OLD.from_user_id;
    UPDATE balances SET balance = balance + OLD.amount WHERE group_id = OLD.group_id AND user_id = OLD.to_user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_settlement_balance ON settlements;
CREATE TRIGGER trg_settlement_balance
AFTER INSERT OR DELETE ON settlements
FOR EACH ROW EXECUTE FUNCTION update_balance_on_settlement();


DROP TRIGGER IF EXISTS trg_split_balance ON expense_splits;
CREATE TRIGGER trg_split_balance
AFTER INSERT OR UPDATE OR DELETE ON expense_splits
FOR EACH ROW EXECUTE FUNCTION update_balance_on_split();

-- Trigger D: Sync GoTrue Authentication strings down to the public schema instantaneously
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_update() 
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    display_name = NEW.raw_user_meta_data->>'full_name',
    email = NEW.email,
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();

-- ==========================================
-- 3. Row Level Security Overrides & RPCs
-- ==========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.group_id = check_group_id 
    AND group_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_member_by_email(p_email TEXT, p_group_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM group_members 
    WHERE group_members.group_id = p_group_id 
    AND group_members.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized. You must be inside the group to invite members.';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User email % not found. They must sign up to bantLo first.', p_email;
  END IF;

  INSERT INTO group_members (group_id, user_id) 
  VALUES (p_group_id, v_user_id) 
  ON CONFLICT DO NOTHING;
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_friend_by_email(p_email TEXT)
RETURNS JSONB AS $$
DECLARE
  v_friend_id UUID;
  v_group_id UUID;
BEGIN
  SELECT id INTO v_friend_id FROM auth.users WHERE email = p_email;
  IF v_friend_id IS NULL THEN
    RAISE EXCEPTION 'User email % not found. They must sign up to bantLo first.', p_email;
  END IF;

  IF v_friend_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot add yourself as a friend.';
  END IF;

  INSERT INTO groups (name, created_by, is_friend_group) 
  VALUES ('Friend: ' || p_email, auth.uid(), true) 
  RETURNING id INTO v_group_id;

  INSERT INTO group_members (group_id, user_id) VALUES (v_group_id, auth.uid());
  INSERT INTO group_members (group_id, user_id) VALUES (v_group_id, v_friend_id);
  
  RETURN jsonb_build_object('success', true, 'group_id', v_group_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- General Secure Access Models
-- Safely DROP existing policies before RE-CREATING (Idempotent Migration)
DROP POLICY IF EXISTS "Public Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Public Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "View groups natively" ON groups;
DROP POLICY IF EXISTS "Insert groups natively" ON groups;
DROP POLICY IF EXISTS "Update groups natively" ON groups;
DROP POLICY IF EXISTS "Delete groups natively" ON groups;
CREATE POLICY "View groups natively" ON groups FOR SELECT USING (is_group_member(id) OR created_by = auth.uid());
CREATE POLICY "Insert groups natively" ON groups FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Update groups natively" ON groups FOR UPDATE USING (is_group_member(id));
CREATE POLICY "Delete groups natively" ON groups FOR DELETE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "View memberships natively" ON group_members;
DROP POLICY IF EXISTS "Insert memberships natively" ON group_members;
DROP POLICY IF EXISTS "Delete memberships natively" ON group_members;
CREATE POLICY "View memberships natively" ON group_members FOR SELECT USING (is_group_member(group_id) OR user_id = auth.uid());
CREATE POLICY "Insert memberships natively" ON group_members FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid()));
CREATE POLICY "Delete memberships natively" ON group_members FOR DELETE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND created_by = auth.uid()));

DROP POLICY IF EXISTS "View expenses natively" ON expenses;
DROP POLICY IF EXISTS "Insert expenses natively" ON expenses;
DROP POLICY IF EXISTS "Delete expenses natively" ON expenses;
DROP POLICY IF EXISTS "Update expenses natively" ON expenses;
CREATE POLICY "View expenses natively" ON expenses FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Insert expenses natively" ON expenses FOR INSERT WITH CHECK (is_group_member(group_id));
CREATE POLICY "Delete expenses natively" ON expenses FOR DELETE USING (is_group_member(group_id));
CREATE POLICY "Update expenses natively" ON expenses FOR UPDATE USING (is_group_member(group_id));

DROP POLICY IF EXISTS "View splits natively" ON expense_splits;
DROP POLICY IF EXISTS "Insert splits natively" ON expense_splits;
DROP POLICY IF EXISTS "Update splits natively" ON expense_splits;
DROP POLICY IF EXISTS "Delete splits natively" ON expense_splits;
CREATE POLICY "View splits natively" ON expense_splits FOR SELECT USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));
CREATE POLICY "Insert splits natively" ON expense_splits FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));
CREATE POLICY "Update splits natively" ON expense_splits FOR UPDATE USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));
CREATE POLICY "Delete splits natively" ON expense_splits FOR DELETE USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));

DROP POLICY IF EXISTS "View payments natively" ON expense_payments;
DROP POLICY IF EXISTS "Insert payments natively" ON expense_payments;
DROP POLICY IF EXISTS "Update payments natively" ON expense_payments;
DROP POLICY IF EXISTS "Delete payments natively" ON expense_payments;
CREATE POLICY "View payments natively" ON expense_payments FOR SELECT USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));
CREATE POLICY "Insert payments natively" ON expense_payments FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));
CREATE POLICY "Update payments natively" ON expense_payments FOR UPDATE USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));
CREATE POLICY "Delete payments natively" ON expense_payments FOR DELETE USING (EXISTS (SELECT 1 FROM expenses WHERE expenses.id = expense_id AND is_group_member(expenses.group_id)));

DROP POLICY IF EXISTS "View balances natively" ON balances;
DROP POLICY IF EXISTS "Insert balances natively" ON balances;
DROP POLICY IF EXISTS "Update balances natively" ON balances;
CREATE POLICY "View balances natively" ON balances FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Insert balances natively" ON balances FOR INSERT WITH CHECK (is_group_member(group_id) OR (auth.uid() = user_id));
CREATE POLICY "Update balances natively" ON balances FOR UPDATE USING (is_group_member(group_id) OR (auth.uid() = user_id));

DROP POLICY IF EXISTS "View settlements natively" ON settlements;
DROP POLICY IF EXISTS "Insert settlements natively" ON settlements;
DROP POLICY IF EXISTS "Delete settlements natively" ON settlements;
CREATE POLICY "View settlements natively" ON settlements FOR SELECT USING (is_group_member(group_id));
CREATE POLICY "Insert settlements natively" ON settlements FOR INSERT WITH CHECK (is_group_member(group_id));
CREATE POLICY "Delete settlements natively" ON settlements FOR DELETE USING (is_group_member(group_id));

CREATE TABLE IF NOT EXISTS group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view invite metadata" ON group_invites;
DROP POLICY IF EXISTS "Members can create invites" ON group_invites;
CREATE POLICY "Anyone can view invite metadata" 
ON group_invites FOR SELECT 
USING (expires_at > now());

CREATE POLICY "Members can create invites" 
ON group_invites FOR INSERT 
WITH CHECK (is_group_member(group_id));

-- BANTLO MIGRATION V2.4 (Plus Invite Engine)
-- 1. REPAIR: Ensure every auth.user has a matching public.profile row
-- This prevents the foreign key updates from failing due to orphaned users.
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 2. SOLDER: Link group memberships to public profiles for nested names/emails
ALTER TABLE public.group_members 
DROP CONSTRAINT IF EXISTS fk_group_members_profiles;
ALTER TABLE public.group_members 
ADD CONSTRAINT fk_group_members_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. SOLDER: Link balances to profiles for consistent naming
ALTER TABLE public.balances 
DROP CONSTRAINT IF EXISTS fk_balances_profiles;
ALTER TABLE public.balances 
ADD CONSTRAINT fk_balances_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4. SOLDER: Link expense payments to profiles
ALTER TABLE public.expense_payments 
DROP CONSTRAINT IF EXISTS fk_expense_payments_profiles;
ALTER TABLE public.expense_payments 
ADD CONSTRAINT fk_expense_payments_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS JSONB AS $$
DECLARE
  v_user_uuid UUID := auth.uid();
  v_blocking_groups TEXT[];
BEGIN
  -- 1. Check for non-zero balances
  SELECT ARRAY_AGG(g.name) INTO v_blocking_groups
  FROM balances b
  JOIN groups g ON g.id = b.group_id
  WHERE b.user_id = v_user_uuid AND ABS(b.balance) > 0.01;

  IF v_blocking_groups IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot delete account. You have active balances in the following groups: %. Please settle all debts first.', array_to_string(v_blocking_groups, ', ');
  END IF;

  -- 2. Cleanup: Delete groups where this user is the last member
  -- This avoids orphaned groups in the database.
  DELETE FROM groups 
  WHERE id IN (
    SELECT group_id 
    FROM group_members 
    GROUP BY group_id 
    HAVING COUNT(*) = 1 AND MAX(user_id) = v_user_uuid
  );

  -- 3. Final Wipe: Delete the public profile
  -- Cascading logic defined in schema will handle the rest of public schema.
  DELETE FROM public.profiles WHERE id = v_user_uuid;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NEW: Trigger to handle recursive balance reversal BEFORE an expense is cascadingly deleted.
-- This ensures v_group_id is available during the removal of an entire expense parent.
CREATE OR REPLACE FUNCTION reverse_balance_before_expense_delete() RETURNS TRIGGER AS $$
BEGIN
  -- 1. Reverse all payments funded by users for this expense (Aggregated)
  UPDATE balances b
  SET balance = b.balance - sub.total_paid
  FROM (
    SELECT user_id, SUM(amount_paid) as total_paid
    FROM expense_payments
    WHERE expense_id = OLD.id
    GROUP BY user_id
  ) sub
  WHERE b.group_id = OLD.group_id AND b.user_id = sub.user_id;

  -- 2. Reverse all splits owed by users for this expense (Aggregated)
  UPDATE balances b
  SET balance = b.balance + sub.total_owed
  FROM (
    SELECT user_id, SUM(amount_owed) as total_owed
    FROM expense_splits
    WHERE expense_id = OLD.id
    GROUP BY user_id
  ) sub
  WHERE b.group_id = OLD.group_id AND b.user_id = sub.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reverse_balance_before_delete ON expenses;
CREATE TRIGGER trg_reverse_balance_before_delete
BEFORE DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION reverse_balance_before_expense_delete();
