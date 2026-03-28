# bantLo

**bantLo** is a highly-optimized, brutalist, pitch-black NeoPop expense-sharing Progressive Web App (PWA) built specifically for offline resilience and mathematical precision. Inspired by apps like Splitwise, bantLo is designed so it never holds your ability to settle debts hostage when your cell network randomly drops.

### Core Features
- 🔌 **Offline-First by Design**: Engineered using Service Workers (`CacheStorage`) for the UI Shell and IndexedDB (`idb`) for caching group data, balances, and queueing offline expense creation actions.
- 🧮 **Precision Split Engine**: Supports three robust mathematical operations:
  - **Equal**: Slices the pie evenly, assigning any fractional penny loss accurately to avoid rounding discrepancies.
  - **Exact**: Validates the payload mathematically to ensure total sums match identically.
  - **Shares**: Automatically calculates proportional splits via integer weights.
- 📱 **Omni-platform PWA**: Automatically bypasses the Landing Page in standalone mobile installs for seamless, native-feeling experiences. 
- 🔒 **Secure Cloud Sync**: Runs on a pure Supabase backend utilizing uncompromising Row Level Security (RLS) policies.

---

### Running bantLo Locally

#### Prerequisites
- Node.js (v18+)
- A Supabase Project

#### Setup Steps
1. **Clone the repository.**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure the Environment:**
   Create a `.env` file in the root based on `.env.example`:
   ```env
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. **Deploy Database SQL:**
   You must run the SQL schema initialization via your Supabase SQL Editor. See the `database_schema.sql` (or refer to the `brain/` directory) for the strict DB structures and triggers.
5. **Launch Dev Server:**
   ```bash
   npm run dev
   ```
   *Your app will be available on `http://localhost:5173/`*

#### Deployment
The app is built utilizing **React Router** and **Vite** natively configured to be exported as static HTML (`npm run build`). It's heavily optimized to be hosted entirely on **Cloudflare Pages** natively. No custom Node server required!

---
*For a highly detailed developer and architectural deep-dive, consult [`devreadme.md`](./devreadme.md).*
