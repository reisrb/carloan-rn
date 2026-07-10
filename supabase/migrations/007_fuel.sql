-- Fuel fill-ups per car. Run in the Supabase SQL Editor.

create table if not exists public.fuel_fillups (
  id           text primary key,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  financing_id text references public.financings(id) on delete cascade not null,
  date         float8,
  total_value  real default 0 not null,
  liters       real,
  km           int,
  created_at   float8 not null
);

create index if not exists fuel_fillups_financing_idx on public.fuel_fillups(financing_id);

alter table public.fuel_fillups enable row level security;

create policy "fuel_own_or_shared" on public.fuel_fillups
  for select using (auth.uid() = user_id or public.has_access_to_financing(financing_id));
create policy "fuel_modify_own" on public.fuel_fillups
  for insert with check (auth.uid() = user_id);
create policy "fuel_update_own" on public.fuel_fillups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fuel_delete_own" on public.fuel_fillups
  for delete using (auth.uid() = user_id);
