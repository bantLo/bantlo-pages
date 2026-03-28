# bantLo - Comprehensive Developer Documentation

Welcome to the internal source documentation for **bantLo**. This application is an offline-first, mathematically precise expense-sharing Progressive Web App (PWA). It is architected to run seamlessly as a static frontend relying entirely on a sophisticated Service Worker, IndexedDB caching layer, and a hardened Supabase PostgreSQL backend.

---

## 🏗️ 1. System Architecture & Tech Stack

- **Frontend Framework**: React 18 (Bootstrapped via Vite).
- **Routing**: `react-router-dom` v6 (Client-side routing).
- **Styling**: Pure vanilla CSS. Specifically built around a **NeoPop brutalist design system** (Pitch-black backgrounds `var(--bg-dark)`, high-contrast borders, sharp edges). No Tailwind or Bootstrap is used; all utilities are in `src/index.css`.
- **Backend & Auth**: Supabase (PostgreSQL, GoTrue Auth, and Row Level Security).
- **Offline Storage**: 
  - *Data*: IndexedDB (using the `idb` wrapper) for caching relational data.
  - *Assets*: `CacheStorage` via a custom Service Worker for the App Shell (HTML/JS/CSS).
- **Hosting Target**: Cloudflare Pages (Static Export via `npm run build`). No custom Node.js server exists or is permitted.

---

## 📂 2. Directory Structure & File Map

### `public/`
Assets here bypass the Vite bundler.
- `sw.js`: The core **Service Worker**. Intercepts HTTP `fetch` events to serve the cached App Shell. Contains mocked listeners for Background Sync (`sync-mutations`) to natively push offline queues when internet returns.
- `version.info`: A simple incremental text file. Used by the cache invalidation poller to natively verify if a new PWA update was published.

### `src/`
The application source code.
- **`App.tsx`**: The monolithic state orchestrator. 
  - Subscribes to Supabase `onAuthStateChange`.
  - Determines if the app is launched as a native PWA (`matchMedia('(display-mode: standalone)')`).
  - Intelligently routes PWA instances directly to the Dashboard/Auth, bypassing the Landing Page marketing material constraint.
- **`index.css`**: The design system. Defines CSS Variables (`--bg-dark`, `--text-accent`, `--border-color`) and the global `.np-button` and `.np-container` classes.
- **`versionPoller.ts`**: A custom hook that pings `/version.info` every 3.5 days. Discrepancies wipe `CacheStorage` to force a zero-downtime frontend update.

#### `src/lib/` (The Core Engine)
- **`supabase.ts`**: Initializes the singleton Supabase client using Environment variables.
- **`db.ts`**: The strict IndexedDB connection map. Defines the `bantlo-data-cache-v1` schema for local caching of `groups`, `expenses`, `balances`, and the `mutations` offline queue.
- **`api.ts`**: **CRITICAL**. The single source of truth for Supabase data fetching. No component mounts Supabase directly. `api.ts` executes Requests, and orchestrates gracefully caching the returned JSON directly into IndexedDB (`db.ts`). It catches network drops (`!navigator.onLine`) and serves offline cache seamlessly to the UI.

#### `src/components/`
- **`AddExpense.tsx`**: A highly complex modal managing the mathematics of expense creation. 
  - *Equal*: Slices the total evenly, dynamically assigning any fractional penny loss (e.g. 10.00 / 3) accurately to a specific subset of users to avoid rounding loss.
  - *Exact*: Prevents submission unless the exact inputs identically match the total.
  - *Shares*: Calculates fractional proportions based on variable assigned integer weights.
- **`NeoButton.tsx`**: A global programmatic wrapper scaling all clickable interactions. It forcibly locks CSS animations down for 150ms before allowing routing or submissions, guaranteeing satisfying tactical feedback.
- **`CacheManagerModal.tsx`**: Granular modal allowing independent execution against Service Worker Shell Caches versus IndexedDB Stores, serving as a dedicated failsafe.

#### `src/pages/`
- **`Landing.tsx`**: Public marketing page. Responsive CSS grids provide distinct views for Desktop (Dashboard CTA) and Mobile (`beforeinstallprompt` PWA installation trigger).
- **`Auth.tsx`**: Universal Login/Signup interface mapping strictly to Supabase GoTrue.
- **`Dashboard.tsx`**: Protected root view (`/dashboard`). Lists a user's associated Groups and captures Group Creation interactions.
- **`GroupDetails.tsx`**: Protected internal group view (`/groups/:id`). Pulls arrays from `api.ts` to strictly display absolute Net Balances (who genuinely owes whom overall) and chronological Expenses.
- **`Settings.tsx`**: Minimal profile view housing the Logout function and a hidden **"5-tap Easter Egg"** mechanism that wipes all local browser caches forcefully for emergency debugging.

---

## 🔒 3. Database Schema & RLS Security

The database relies on strict relational integrity. *(See `brain/database_schema.sql` for the raw definitions)*. 
Because there is no trusted backend Node server, **Row Level Security (RLS)** acts as the sole secure barrier.
- **`groups`**: Contains basic string metadata (Name, Currency).
- **`group_members`**: The mapping junction. Matches `auth.users` UUIDs against `group_id`s. 
- **The Security Policy**: The backend relies on a custom `is_group_member(target_group_id)` heavily chained inside `.eq()` SQL conditions. If a malicious client calls `supabase.from('expenses').select()`, PostgreSQL natively rejects rows the user shouldn't see at the database kernel level.
- **`balances`**: Caches absolute net worth. Positive values signify you are owed money; negative means you owe the group.

---

## 📡 4. The Offline-First Synchronization Loop

bantLo is functionally designed to survive a total degradation of cellular networks (e.g., splitting a cab fare while in a canyon).

1. **The Fallback**: A user opens the app while offline. `fetchUserGroups` fires in `api.ts` attempting to reach Supabase. It immediately throws a `TypeError: Failed to fetch`.
2. **The Intercept**: The `.catch()` block checks `!navigator.onLine`. It queries out to `idb` (`getDB().getAll('groups')`) and returns the successfully structured JSON. The React frontend continues to render as if nothing happened.
3. **Queueing Mutations (WIP)**: For POST requests, the architecture supports dropping payloads (e.g. `ADD_EXPENSE`) into the `mutations` IndexedDB store. 
4. **Background Flush**: The `sw.js` listens to the native browser `sync` event. Once internet restores, it transparently loops the `mutations` table and executes the queued Supabase actions.

---

## 🛠️ 5. Rules for Contributors

1. **Aesthetic Consistency**: Do not break the Pitch-Black NeoPop theme. Heavy shadows, curved `border-radius: 20px`, and soft pastel colors are strictly prohibited. Stick to brutalist sharp lines, `var(--bg-dark)`, and dashed component borders.
2. **No Backend Middleware**: Never attempt to build or demand an Express.js/Node instance to "handle a calculation securely". Do the math on the Client, and enforce the data validation/security universally using Supabase Database Triggers and RLS policies.
3. **Graceful Degradation**: Always anticipate that `supabase.from()` calls will fail. Wrap everything in Try/Catch structures and guarantee the UI presents fallback offline data arrays to prevent React crashes.
