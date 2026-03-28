# bantLo Developer Documentation

This document outlines the architectural map, routing paths, and key files spanning across the `bantlo-pages` React SPA/PWA. It is intended for contributors looking to scale out features or maintain the codebase.

## 🗂️ File Directory Purpose

- `public/sw.js`: The custom **Service Worker**. Handles the immediate fetching and caching of external App Shell assets. Contains mocked listener shells for Background Sync (`sync-mutations`).
- `public/version.info`: An incremental build-tracker polled by `src/versionPoller.ts` 2 times a week to force the browser to invalidate old Service Worker CSS/JS caches.
- `src/App.tsx`: The primary mounting interface and state wrapper. Houses session management checking against Supabase Auth, and the critical PWA display-mode routing mechanism.
- `src/index.css`: Contains the foundational **NeoPop** pitch-black brutalist design system. Core CSS variables and standard `.np-button` utility classes reside here.

### 🌐 Routing Topology
Located exclusively inside `src/App.tsx`.

| Path | Component | Purpose | Access Control |
| :--- | :--- | :--- | :--- |
| `/` | `Landing.tsx` | Informational landing view and PWA Install Hook (`beforeinstallprompt`). | Public (Redirects to `/dashboard` if Auth'd, or `/auth` if PWA standalone) |
| `/auth` | `Auth.tsx` | Supabase login and signup view. | Public |
| `/dashboard` | `Dashboard.tsx` | The root internal page listing a user's associated Groups and Group creation form. | Protected |
| `/groups/:id` | `GroupDetails.tsx`| Detailed group view, lists recent expenses, net balances, and mounts `<AddExpense />`. | Protected |
| `/settings` | `Settings.tsx` | Barebones session view housing Logout and the 5-tap Force Reload Cache mechanism. | Protected |

### 🧠 Data Flow & Subsystems

#### The Supabase Layer (`src/lib/api.ts` & `src/lib/supabase.ts`)
`supabase.ts` simply initializes the client. All Supabase logic is aggregated in `api.ts`.
- **Row Level Security (RLS)**: The database is violently protected by `is_group_member(group_id)` policies. Only members of a specific `group_id` can `SELECT`, `INSERT`, or `DELETE` anything regarding expenses and balances related to it.

#### The Offline Engine (`src/lib/db.ts`)
The PWA mandates offline accessibility.
- **IndexedDB**: Handled by the popular `idb` package. `getDB()` maps out schemas corresponding to offline caching of `groups`, `expenses`, and `balances`. 
- **Graceful Fallbacks**: Every API request in `api.ts` (like `fetchUserGroups`) aggressively attempts to fetch the live Supabase dataset and cache it via `await db.put(...)`. If `try{}` catches network drops (e.g. `!navigator.onLine`), the catch block falls back to querying IndexedDB so the `.tsx` components never notice they are detached from the internet.
- **Mutations (WIP)**: The offline Queue is initialized as the `mutations` IndexedDB object store. Currently, online modifications process securely.

#### Complex Components (`src/components/AddExpense.tsx`)
Because of rounding errors prevalent in banking algorithms, `AddExpense.tsx` relies natively on BigInt/Cents or calculated rounding. 
- **Exact Split**: Enforces rigorous `<input>` checks summing against `total`.
- **Shares**: Translates arbitrary weights mapping strictly to percentage pie-slices.

### 🚀 Contribution Guidelines
1. **Never override Pitch Black themes:** Avoid large vibrant backgrounds; rely on the stark `var(--bg-dark)` with `var(--text-accent)` highlights.
2. **Never import direct `supabase` instances to `.tsx`:** Keep your components pure. Direct any functional queries into `api.ts` so they can be securely bundled with DB caching logic.
3. **Handle Errors Cleanly:** The app cannot crash natively. Ensure React isn't unmounting due to `undefined` API mappings on Offline returns.
