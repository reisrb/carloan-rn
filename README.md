# CarLoan RN — Car Hub

A personal car management app. The **car** is the central entity; financing is
just one of its sections. Built with React Native (Expo) + Supabase, deployed as
a web PWA on Vercel. iOS-like UI with automatic light/dark theme.

Each car opens into a **hub** with a floating bottom menu:

| Section | What it holds |
|---|---|
| **Infos** | Photo, spec sheet (brand, model, year, plate, color, current km), edit, and sharing |
| **Total** | Monthly spend (installment + fixed expenses) and accumulated spend (down payment + paid installments + accessories + done maintenance) |
| **Financiamento** | Optional financing: installments, progress, quick pay, early-payoff simulation, report |
| **Manutenção** | Pending maintenance (with due-by km/date badges) and history with cost breakdown + receipt photos |
| **Acessórios** | Installed accessories (count toward spend) and a wishlist of accessories to install |

## Features

- **Multiple cars** — home lists your cars + a profile tab. A car can exist with or without financing.
- **Financing (optional)** — car photo, plate, bank, down payment, interest rate (Price table / French amortization); installments with status (paid / open / overdue), quick pay, early-payoff simulation (reduce term or monthly), consolidated report.
- **Maintenance** — pending items with due-by km/date and status badges (em dia / vence / vencida); history with total / item / labor cost, service date, km at service, item purchase date, and **attached receipt photos**. Logging a service with a higher km offers to update the car's current km.
- **Expenses (Total)** — recurring monthly cost = current installment + itemized fixed expenses; accumulated total across all sources.
- **Monthly fixed expenses** — itemized recurring costs (insurance, IPVA, parking, …) managed from the Total tab.
- **Accessories** — installed (with value + date, counted in spend) vs. wishlist (with estimated value, priority, notes).
- **Sharing** — invite another user by username with view or edit permission (per-car collaboration).
- **Auth** — username + password login; new users require admin approval.
- Light/dark theme with configurable accent color, installable PWA, JSON backup/restore.

## Tech stack

- **Expo** (SDK 54) + **React 19** + **React Native 0.81**, running on web via `react-native-web`.
- **@react-navigation** — a root native-stack holding `HomeTabs` (Carros / Perfil) and a per-car `CarHub` tab navigator, both using a shared floating tab bar.
- **Supabase** (`@supabase/supabase-js`) for Postgres + Auth + Storage; AsyncStorage for the session, image cache, and theme prefs.
- UI is plain `StyleSheet` + `@expo/vector-icons` (Ionicons). No component library.

## Architecture

- **Screens** in `src/screens/`, **reusable sheets/cards** in `src/components/`, **data access** in `src/services/` (one module per domain), **types + pure helpers** in `src/types/index.ts`.
- The car is provided to the hub sections via `src/contexts/CarContext.tsx`.
- The `financings` row **is** the car (holds car fields + optional financing). Child tables hang off `financing_id`:
  - `installments` / `payments` — financing schedule and payments
  - `maintenances` — pending + done, with `receipt_paths`
  - `accessories` — installed accessories
  - `wishlist_items` — accessories to install
  - `fixed_expenses` — recurring monthly costs
  - `financing_shares` — per-car collaboration
- **Row Level Security**: every table is owner-scoped or shared via the `has_access_to_financing()` function (owner or an accepted share). Car photos and receipts live in the private `images` bucket, read via short-lived signed URLs (cached in memory → AsyncStorage).

## Setup

1. Create a project on [Supabase](https://supabase.com).
2. In the SQL Editor, run **in order**:
   - `supabase/schema.sql`
   - `supabase/migrations/001_financing_shares_permission.sql`
   - `supabase/migrations/002_storage_shared_read.sql`
   - `supabase/migrations/003_car_hub.sql` — car fields + maintenances/accessories/wishlist
   - `supabase/migrations/004_fixed_expenses.sql` — monthly fixed expenses
   - `supabase/migrations/005_maintenance_receipts.sql` — receipt photos on maintenance
3. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. `npm install`
5. `npm run web` to run locally; `npm run build:web` to generate `dist/`.
6. First admin: `node scripts/setup-admin.js`, then run the printed SQL on Supabase.

## Deploy

Vercel using `vercel.json` (builds via `expo export --platform web`, output `dist/`). Set the env vars in the Vercel dashboard.
