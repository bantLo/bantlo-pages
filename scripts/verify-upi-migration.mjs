#!/usr/bin/env node
/**
 * Verifies that migrations/2026-09-12_upi_settle_up.sql has been applied.
 *
 * Uses the anon key, so it can only confirm that the schema objects exist and
 * are reachable through PostgREST — it cannot inspect policy definitions.
 *
 *   node scripts/verify-upi-migration.mjs
 */
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

async function probe(path) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  return { status: res.status, body: await res.text() };
}

const missing = (r) =>
  r.status === 404 ||
  /does not exist|could not find|schema cache/i.test(r.body);

let ok = true;

const table = await probe('user_payment_handles?select=user_id&limit=1');
if (missing(table)) {
  ok = false;
  console.log('✗ user_payment_handles — not found. Migration has not been applied.');
} else {
  console.log('✓ user_payment_handles exists and is reachable');
}

const column = await probe('expenses?select=settlement_method&limit=1');
if (missing(column)) {
  ok = false;
  console.log('✗ expenses.settlement_method — not found.');
} else {
  console.log('✓ expenses.settlement_method exists');
}

console.log(
  ok
    ? '\nMigration looks applied. Add a UPI ID under Account Settings to try it.'
    : '\nRun migrations/2026-09-12_upi_settle_up.sql in the Supabase SQL editor:\n' +
      `  ${url.replace('.supabase.co', '').replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`
);

process.exit(ok ? 0 : 1);
