-- Itemized recurring monthly expenses (insurance, IPVA, parking, ...).
-- Each row is one fixed monthly cost of the car. Run in the Supabase SQL Editor.

create table if not exists public.fixed_expenses (
  id           text primary key,
  user_id      uuid references public.profiles(id) on delete cascade not null,
  financing_id text references public.financings(id) on delete cascade not null,
  name         text not null,
  value        real default 0 not null,
  created_at   float8 not null
);

create index if not exists fixed_expenses_financing_idx on public.fixed_expenses(financing_id);

alter table public.fixed_expenses enable row level security;

create policy "fixed_expenses_own_or_shared" on public.fixed_expenses
  for select using (auth.uid() = user_id or public.has_access_to_financing(financing_id));
create policy "fixed_expenses_modify_own" on public.fixed_expenses
  for insert with check (auth.uid() = user_id);
create policy "fixed_expenses_update_own" on public.fixed_expenses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "fixed_expenses_delete_own" on public.fixed_expenses
  for delete using (auth.uid() = user_id);
