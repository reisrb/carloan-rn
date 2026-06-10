# CarLoan RN

App de gestão de financiamento de veículos — React Native (Expo) + Supabase, deploy web no Vercel. Port do [carloan-android](https://github.com/reisrb/carloan-android), na mesma arquitetura do compreis-rn.

## Features

- Financiamentos com foto, placa, banco, entrada e juros (Tabela Price)
- Parcelas com status (paga / aberta / vencida), marcação de pagamento com observação e recibos
- Dashboard com progresso e quick pay da próxima parcela
- Simulação de antecipação: reduzir prazo ou reduzir prestação
- Relatório consolidado com tabela de parcelas
- Backup/restore em JSON
- Login com username + senha, aprovação de novos usuários por admin
- Tema claro/escuro com cor de destaque configurável, PWA instalável

## Setup

1. Crie um projeto no [Supabase](https://supabase.com) e rode `supabase/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env` e preencha `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm install`
4. `npm run web` para rodar local, `npm run build:web` para gerar o `dist/`.
5. Primeiro admin: `node scripts/setup-admin.js` e rode o SQL impresso no Supabase.

## Deploy

Vercel com `vercel.json` (build via `expo export --platform web`). Env vars no painel do Vercel.
