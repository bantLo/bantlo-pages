# bantLo — Feature Briefs

Four candidate features, each framed around a real problem shared-expense users actually hit.
Written against the codebase at `2.3.1`.

**Context that shapes all four:** balances are never computed in the client — they are derived
by Postgres triggers (`trg_split_balance`, `trg_payment_balance`) from rows in `expense_splits`
and `expense_payments`. Any feature that touches money must go through those rows, and any
feature that *doesn't* must stay well clear of them. That constraint is called out per-idea.

| # | Idea | Problem it solves | Rough size |
|---|------|-------------------|-----------|
| 1 | [Group tags with preset splits](#1--group-tags-with-preset-splits) | Re-picking the same 3 people every single time | ~520 lines |
| 2 | [Recurring expenses](#2--recurring-expenses) | Someone has to remember rent/milk/wifi every month | ~450 lines |
| 3 | [UPI settle-up](#3--upi-settle-up) | Knowing you owe ₹2,400 ≠ actually paying it | ~300 lines |
| 4 | [Trust layer: authorship, history, disputes](#4--trust-layer-authorship-history-disputes) | "Who added this? I never agreed to it" | ~600 lines |

Ideas 1 and 2 compose strongly — a recurring expense needs a roster, and a tag *is* a roster.
Build 1 first if you intend to build 2.

---

## 1 — Group tags with preset splits

### The problem

In a flatshare, the same expense recurs with the same *subset* of people. Rent splits 4 ways,
milk splits 3 ways because one person doesn't drink it, the Netflix bill splits 2 ways. Today
every one of those requires manually unchecking the right people from a list, every time. It's
tedious, and worse, it's error-prone in a way that silently moves money — uncheck the wrong
person and the balance is wrong until someone notices.

### What it does

Named, group-level tags that carry a member roster. Tap "milk" when adding an expense and the
split pre-fills to the right 3 people. Tags belong to the group, so everyone sees and uses the
same set.

### Data model

```sql
CREATE TABLE group_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  split_type SMALLINT NOT NULL DEFAULT 0 CHECK (split_type IN (0, 2)),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX idx_group_tags_name ON group_tags (group_id, lower(name));

CREATE TABLE group_tag_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID REFERENCES group_tags(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (weight > 0),
  UNIQUE(tag_id, user_id)
);

ALTER TABLE expenses ADD COLUMN tag_id UUID REFERENCES group_tags(id) ON DELETE SET NULL;
```

`weight` covers both shapes in one table: all-weights-1 with `split_type = 0` is your
"milk = these 3 people"; `split_type = 2` with uneven weights is a couple counting 2:1 for rent.
`split_type = 1` (exact amounts) is excluded by the CHECK — exact amounts depend on the total,
so they can't be preset.

RLS mirrors the existing pattern exactly: `is_group_member(group_id)` on `group_tags`, and an
`EXISTS` through the parent tag on `group_tag_members` — the same shape `expense_splits` uses
to reach `expenses`.

### Safety property

A tag only pre-fills client-side split state. It never changes how `expense_splits` rows are
written, so the balance engine is untouched. The one place this could go wrong is
`ON DELETE SET NULL` on `expenses.tag_id` — a CASCADE there would delete expenses when a tag is
deleted, firing `trg_reverse_balance_before_delete` and silently rewriting everyone's balances.
Deleting the "milk" tag must never move money.

### Files

- `DB_Query.sql` + a new `migrations/` delta (the bootstrap script won't re-run on a live project)
- `src/lib/api.ts` — `fetchGroupTags`, `createTag`, `updateTag`, `deleteTag`, `setTagMembers`
- `src/lib/db.ts` — IDB version 2 → 3, add a `tags` store
- `src/components/AddExpense.tsx` — chip row that overwrites `includedInEqual` / `shares`
- `src/pages/GroupDetails.tsx` — CRUD under the existing `management` tab
- `src/components/TagManager.tsx` — new

⚠️ The expense `select` string is duplicated in **4 places** (`api.ts:136`, `api.ts:161`,
`api.ts:234`, `AddExpense.tsx:200`). Adding `tag_id` means updating all four or it silently
vanishes on some paths. Worth extracting a shared `EXPENSE_SELECT` constant.

### The edge case that will bite

`removeMember()` (`api.ts:273`) deletes only the `group_members` row. The account still exists,
so `group_tag_members` keeps pointing at someone no longer in the group — applying "flat" would
then assign a split to an ex-member and corrupt balances. Filter the roster against live members
at apply-time (this is the one that protects the money) *and* clean up in `removeMember`.

---

## 2 — Recurring expenses

### The problem

Rent, milk, wifi, maid, electricity. Same amount, same people, same time every month — and every
month a human has to remember to type it in. In practice they forget, remember three weeks later,
and then nobody can agree whether August's milk was ever actually added. The ledger drifts from
reality precisely because the most predictable expenses depend on the least reliable step.

### What it does

Define an expense once with a cadence — monthly on the 1st, weekly on Sundays — and bantLo posts
it automatically. Fixed-amount bills (rent, subscriptions) post silently. Variable bills
(electricity) post as a **draft** that someone confirms with the real number, so the app never
invents an amount it can't know.

### Data model

```sql
CREATE TABLE recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2),                  -- NULL = variable, posts as a draft
  split_type SMALLINT NOT NULL CHECK (split_type IN (0, 2)),
  tag_id UUID REFERENCES group_tags(id) ON DELETE SET NULL,   -- reuses idea 1's roster
  payer_id UUID REFERENCES auth.users(id),
  cadence TEXT NOT NULL CHECK (cadence IN ('weekly', 'monthly')),
  day_of_period SMALLINT NOT NULL,       -- 1-31 monthly, 0-6 weekly
  next_run_on DATE NOT NULL,
  is_paused BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE expenses ADD COLUMN recurring_id UUID REFERENCES recurring_expenses(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN is_draft BOOLEAN DEFAULT false;
```

### The hard part: what actually fires it

This is the real design decision, and it's a genuine three-way tradeoff:

| Approach | How | Cost |
|---|---|---|
| **`pg_cron` in Supabase** | A scheduled SQL function materializes due rows nightly | Correct and reliable; needs the extension enabled and the logic lives in SQL, away from the rest of the codebase |
| **Client-side catch-up** | On group open, find rows where `next_run_on <= today` and post them | No new infra, works with the existing offline model — but nothing posts until *someone opens the app*, and two people opening simultaneously can double-post |
| **Supabase Edge Function + cron** | Same as pg_cron but in TypeScript | Logic stays in TS; adds a deploy target the project doesn't currently have |

**Recommendation: `pg_cron`.** The whole point is that the ledger stays correct when nobody is
paying attention, and client-side catch-up fails exactly that case. If you take the client-side
route anyway, a `UNIQUE(recurring_id, period_key)` on `expenses` is mandatory to make
double-posting impossible rather than merely unlikely.

### Files

- `DB_Query.sql` + migration + (if chosen) a `pg_cron` job
- `src/lib/api.ts` — recurring CRUD, `confirmDraftExpense`
- `src/pages/GroupDetails.tsx` — a "Scheduled" section, draft badges on the expense list
- `src/components/RecurringManager.tsx` — new
- `src/components/AddExpense.tsx` — "make this recurring" toggle

### Edge cases

- **Day 31 in February.** Clamp to the last day of the month; don't skip the month.
- **A paused group.** Recurring posts into a settled group will silently un-settle it. Pause
  recurrence when everyone settles up, or at minimum surface it loudly.
- **Member leaves mid-cycle.** Same stale-roster problem as idea 1, with the added twist that
  nobody is watching when it fires. Validate the roster at post-time and skip + flag if it's empty.
- **Drafts must not move money.** A draft expense must write *no* `expense_splits` rows until
  confirmed, or the triggers will book it. Safest is to keep drafts in a separate table entirely
  rather than a flag on `expenses`.

---

## 3 — UPI settle-up

### The problem

The app currently ends its job one step early. "Quick Settle Suggestions" already tells you
*"Harshit owes Ankit ₹2,400"* — and then you switch to GPay, retype the amount, hope you picked
the right person, pay, switch back, and manually record a settlement. That context switch is
where settlements get forgotten, mistyped, or recorded but never actually paid. The gap between
*knowing* a debt and *clearing* it is the single biggest source of stale balances.

### What it does

Each member optionally saves a UPI ID on their profile. A settle-up suggestion then becomes a
one-tap action: bantLo opens the user's payment app with payee, amount, and a reference note
pre-filled. On return, it asks "did that go through?" and records the settlement on confirmation.

```
upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=bantLo%20<group>%20settlement
```

### Data model

Genuinely small — one column plus an optional provenance field:

```sql
ALTER TABLE profiles ADD COLUMN upi_id TEXT;
ALTER TABLE settlements ADD COLUMN method TEXT CHECK (method IN ('manual', 'upi_intent'));
```

### The honest constraint

**UPI deep links give a web app no payment confirmation.** There is no callback, no status, no
way to verify from the browser that the money moved. Anyone promising otherwise is describing a
merchant integration (Razorpay/PhonePe PG) with KYC, fees, and a backend — a fundamentally
different product from a splitting app.

So this feature is explicitly *"pre-fill the payment, then ask"*. That's still a large win — it
removes the retyping and the wrong-person risk, which are the actual failure modes — but the
settlement record stays trust-based, exactly as it is today. `method = 'upi_intent'` records that
a payment app was opened, which is weaker evidence than a receipt and should never be presented
as confirmation.

Two further constraints worth knowing up front:
- `upi://` intents work on Android and iOS browsers, but **not on desktop**. Desktop needs a
  graceful fallback — show the UPI ID with a copy button.
- A UPI ID is personal data. It belongs behind RLS that exposes it only to co-members
  (`is_group_member`), not via the current `"Public Profiles are viewable by everyone"` policy
  on `profiles` (`DB_Query.sql:268`), which would otherwise leak every user's UPI ID to every
  authenticated user. **This policy must be tightened as part of the feature, not after.**

### Files

- `src/pages/AccountSettings.tsx` — UPI ID field with format validation
- `src/pages/GroupDetails.tsx` — "Pay via UPI" on settle suggestions + the return-confirmation step
- `src/components/AddSettlement.tsx` — prefilled from the intent
- `src/lib/api.ts` — thread `method` through `createSettlement`
- `DB_Query.sql` — the two columns **and** the `profiles` SELECT policy fix

### Why this one is worth its size

It's the smallest of the four by code volume and the only one that changes whether the app
finishes the job it starts. Everything else makes bookkeeping nicer; this one gets people paid.

---

## 4 — Trust layer: authorship, history, disputes

### The problem

Shared money between friends is a social contract, and the app currently has no memory of who did
what. Three concrete gaps in the schema today:

1. **`expenses` has no `created_by`.** Once an expense exists, there is no record of who added
   it. "I never agreed to this ₹3,000" has no answer.
2. **Edits leave no trace.** `updateFullExpense` (`api.ts:203`) deletes and re-inserts all splits.
   The previous state is simply gone — someone can change an amount after the fact, invisibly.
3. **Deletes are permanent and move money.** `trg_reverse_balance_before_delete` rewrites balances
   on delete, with no record that the expense ever existed.

None of this matters until it matters, and then it matters a lot — this is where flatshares
actually fall out, not over the arithmetic.

### What it does

Records who did what, keeps edits visible, and gives members a way to flag a disputed expense
without silently editing someone else's entry.

### Data model

```sql
ALTER TABLE expenses ADD COLUMN created_by UUID REFERENCES auth.users(id);

CREATE TABLE expense_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL,              -- deliberately NOT a FK: survives expense deletion
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'edited', 'deleted', 'disputed', 'resolved')),
  snapshot JSONB,                        -- amount/description/splits at the time
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE expenses ADD COLUMN disputed_by UUID REFERENCES auth.users(id);
```

`expense_id` intentionally carries no foreign key — the whole point is that the trail outlives
the row. RLS is `is_group_member(group_id)` for SELECT, and **INSERT-only with no UPDATE or
DELETE policy at all**, so the log cannot be rewritten by anyone through the client.

Writing it from a trigger on `expenses` rather than from client code is strongly preferable:
client-side logging is exactly the kind that gets skipped on one code path and quietly stops
being trustworthy.

### Files

- `DB_Query.sql` — table, RLS, and an `AFTER INSERT OR UPDATE OR DELETE` trigger on `expenses`
- `src/lib/api.ts` — `fetchExpenseActivity`, `disputeExpense`, `resolveDispute`; set `created_by`
- `src/pages/GroupDetails.tsx` — "added by" on each row, a dispute badge, a history view
- `src/components/ExpenseActivity.tsx` — new

### Notes

- **Backfill is impossible.** Existing expenses have no author and never will; the UI needs to
  render "unknown" without looking broken.
- **A dispute must not auto-reverse anything.** It's a flag for humans to resolve, not an
  accounting action. The moment it moves money it becomes a way to unilaterally erase a debt.
- `snapshot JSONB` grows unboundedly on edit-heavy groups. Fine at this scale; worth knowing.
- This is the largest of the four and the least immediately gratifying — it earns its keep on the
  bad day, not the first day.

---

## Suggested order

1. **Tags** (#1) — smallest real win, and #2 depends on its roster concept.
2. **UPI settle-up** (#3) — best value-per-line of the four; closes the loop the app already opens.
3. **Recurring** (#2) — highest ongoing value for flatshares, but needs the `pg_cron` decision first.
4. **Trust layer** (#4) — do it before the group gets large enough to need it, not after.

A cheap prerequisite worth doing regardless of order: add `created_by` to `expenses`. It's one
column and one insert field, it can't be backfilled later, and three of the four ideas above are
more useful once it exists.
