# CarLoan RN

Vehicle financing management app — React Native (Expo) + Supabase, deployed as a web PWA on Vercel. Port of [carloan-android](https://github.com/reisrb/carloan-android), built on the same architecture as compreis-rn.

## Features

- Financings with car photo, license plate, bank, down payment and interest rate (Price table / French amortization system)
- Installments with status (paid / open / overdue), payment registration with notes and receipt images
- Dashboard with progress and quick pay for the next installment
- Early payoff simulation: reduce term or reduce monthly payment
- Consolidated report with full installment table
- JSON backup/restore
- Username + password login, new users require admin approval
- Light/dark theme with configurable accent color, installable PWA

## Setup

1. Create a project on [Supabase](https://supabase.com) and run `supabase/schema.sql` in the SQL Editor.
2. Copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm install`
4. `npm run web` to run locally, `npm run build:web` to generate `dist/`.
5. First admin: `node scripts/setup-admin.js`, then run the printed SQL on Supabase.

## Deploy

Vercel using `vercel.json` (build via `expo export --platform web`). Set the env vars in the Vercel dashboard.
