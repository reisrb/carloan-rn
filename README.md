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

- **Expo** (SDK 54) + **React 19** + **React Native 0.81**, running on web via `react-native-web`. It's a **pure client app** (no custom backend server).
- **@react-navigation** — a root native-stack holding `HomeTabs` (Carros / Perfil) and a per-car `CarHub` tab navigator, both using a shared floating tab bar.
- **Supabase** (`@supabase/supabase-js`) — Postgres + Auth + Storage + **Edge Functions** (Deno). AsyncStorage holds the session, image cache, and theme prefs.
- **Resend** — transactional email, called from a Supabase Edge Function (`send-report`).
- **Vercel** — hosting of the exported web PWA.
- UI is plain `StyleSheet` + `@expo/vector-icons`. No component library. PDF export uses the browser print engine (web) / `expo-print` (native); images are downscaled in-browser before upload.

## Serviços e sites usados

| Serviço | Uso | Onde |
|---|---|---|
| **Supabase** | Postgres, Auth, Storage (bucket `images`), Edge Functions | https://supabase.com — projeto `upwuvfjjplvrkopeykum` |
| **Resend** | Envio de e-mail (relatórios) | https://resend.com — domínio `@carloan.com` |
| **Vercel** | Deploy do PWA web | https://vercel.com |
| **Expo / EAS** | Runtime React Native + export web | https://expo.dev |

> Segredos (ex: `RESEND_API_KEY`, service role) **nunca** ficam no repositório — vivem como secrets no Supabase / variáveis de ambiente na Vercel.

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
   - `supabase/migrations/006_maintenance_items.sql` — maintenance line items
   - `supabase/migrations/007_fuel.sql` — fuel fill-ups
   - `supabase/migrations/008_fuel_consumption.sql` — station/km driven + tank size
   - `supabase/migrations/009_km_driven_decimal.sql` — fractional km driven
   - `supabase/migrations/010_fuel_local_flag.sql` — fuel location + brand
   - `supabase/migrations/011_drop_fuel_station.sql` — drop old station column
   - `supabase/migrations/012_fuel_type.sql` — fuel type
   - `supabase/migrations/013_auto_approve_first_50.sql` — auto-approve first N signups
3. Copy `.env.example` to `.env` and fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. In Supabase Auth → Settings, keep **email confirmations OFF** (instant login for approved users).
5. `npm install`
6. `npm run web` to run locally; `npm run build:web` to generate `dist/`.
7. First admin: `node scripts/setup-admin.js`, then run the printed SQL on Supabase.

## E-mail (SMTP / nodemailer)

Reports are emailed to the logged-in user by a **Vercel Serverless Function**
(`api/send-report.ts`) deployed with the web app (monolith — front + back in one
project). It validates the caller's Supabase JWT, then sends via SMTP using
**nodemailer** (no third-party email API). The web app POSTs to `/api/send-report`
(same origin).

Set env vars in Vercel → Settings → Environment Variables:
`SMTP_HOST`, `SMTP_PORT` (587 or 465), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
(optional), `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Secrets never live in the repo.

1. Set the secret (never in the repo):
   ```
   supabase secrets set RESEND_API_KEY=<sua-key>
   ```
   (ou Supabase Dashboard → Edge Functions → Secrets)
2. Deploy the function:
   ```
   supabase functions deploy send-report
   ```
3. The function sends from `noreply@carloan.com` (verified domain on Resend) to the caller's account email.

## Signup / limite de usuários

Migration `013` auto-approves the first N signups (`status = active`, instant login); after that new signups stay `pending` and see a waiting screen until an admin approves. The limit is the `cnt < N` check inside `handle_new_user()`.

## Deploy

Vercel using `vercel.json` (builds via `expo export --platform web`, output `dist/`). Set the env vars in the Vercel dashboard.
