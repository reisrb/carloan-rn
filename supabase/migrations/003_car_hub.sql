-- Car Hub — turn `financings` into the root "car" record and hang maintenance,
-- accessories and wishlist off it. Financing becomes optional (a car may exist
-- with total_installments = 0). Run in the Supabase SQL Editor.

-- ============================================================
-- 1. Extend financings with car fields; make financing optional
-- ============================================================
alter table public.financings
  add column if not exists brand        text,
  add column if not exists model        text,
  add column if not exists year         int,
  add column if not exists color        text,
  add column if not exists current_km   int  default 0 not null,
  add column if not exists monthly_cost real default 0 not null;

-- A car without financing has no installments/first due date.
alter table public.financings alter column total_installments drop not null;
alter table public.financings alter column total_installments set default 0;
alter table public.financings alter column first_due_date drop not null;

-- ============================================================
-- 2. maintenances (pending + done). Same access model as installments.
-- ============================================================
create table if not exists public.maintenances (
  id                text primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  financing_id      text references public.financings(id) on delete cascade not null,
  status            text not null default 'pending' check (status in ('pending', 'done')),
  description       text not null,
  total_value       real default 0 not null,
  item_value        real default 0 not null,
  labor_value       real default 0 not null,
  service_date      float8,
  km_at_service     int,
  item_purchase_date float8,
  due_km            int,
  due_date          float8,
  created_at        float8 not null
);

create index if not exists maintenances_financing_idx on public.maintenances(financing_id);

alter table public.maintenances enable row level security;

create policy "maintenances_own_or_shared" on public.maintenances
  for select using (auth.uid() = user_id or public.has_access_to_financing(financing_id));
create policy "maintenances_modify_own" on public.maintenances
  for insert with check (auth.uid() = user_id);
create policy "maintenances_update_own" on public.maintenances
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "maintenances_delete_own" on public.maintenances
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 3. accessories (installed — count toward spending)
-- ============================================================
create table if not exists public.accessories (
  id           text primary key,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  financing_id text references public.financings(id) on delete cascade not null,
  name         text not null,
  value        real default 0 not null,
  date         float8,
  created_at   float8 not null
);

create index if not exists accessories_financing_idx on public.accessories(financing_id);

alter table public.accessories enable row level security;

create policy "accessories_own_or_shared" on public.accessories
  for select using (auth.uid() = user_id or public.has_access_to_financing(financing_id));
create policy "accessories_modify_own" on public.accessories
  for insert with check (auth.uid() = user_id);
create policy "accessories_update_own" on public.accessories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "accessories_delete_own" on public.accessories
  for delete using (auth.uid() = user_id);

-- ============================================================
-- 4. wishlist_items (accessories the owner wants to install)
-- ============================================================
create table if not exists public.wishlist_items (
  id              text primary key,
  user_id         uuid references public.profiles(id) on delete cascade not null,
  financing_id    text references public.financings(id) on delete cascade not null,
  name            text not null,
  estimated_value real default 0 not null,
  priority        int default 0 not null,
  notes           text,
  created_at      float8 not null
);

create index if not exists wishlist_items_financing_idx on public.wishlist_items(financing_id);

alter table public.wishlist_items enable row level security;

create policy "wishlist_own_or_shared" on public.wishlist_items
  for select using (auth.uid() = user_id or public.has_access_to_financing(financing_id));
create policy "wishlist_modify_own" on public.wishlist_items
  for insert with check (auth.uid() = user_id);
create policy "wishlist_update_own" on public.wishlist_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wishlist_delete_own" on public.wishlist_items
  for delete using (auth.uid() = user_id);
