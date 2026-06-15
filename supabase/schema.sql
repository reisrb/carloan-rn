-- CarLoan — Supabase schema
-- Run this in the Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
--
-- Authentication → Settings → keep "Enable email confirmations" ON
-- Users sign up with username + real email + password.
-- New users start as 'pending' and must be approved by an admin.

-- ============================================================
-- profiles (username auth + admin approval)
-- ============================================================
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  username   text unique not null,
  email      text not null,  -- real email, used internally to sign in by username
  role       text not null default 'user'    check (role   in ('user', 'admin')),
  status     text not null default 'pending' check (status in ('pending', 'active')),
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

grant select on public.profiles to anon, authenticated;

create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Helper: check if current user is admin (used in policies)
create or replace function public.is_admin()
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: check if current user has access to a financing (owner or shared)
create or replace function public.has_access_to_financing(financing_id text)
returns boolean
language sql
stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.financings f
    where f.id = financing_id and f.user_id = auth.uid()
  ) or exists (
    select 1 from public.financing_shares s
    where s.financing_id = financing_id
      and s.shared_with_id = auth.uid()
      and s.status = 'accepted'
  );
$$;

create policy "profiles_admin_manage" on public.profiles
  for update using (public.is_admin());

-- Trigger: auto-create profile when auth user is inserted.
-- username is passed via raw_user_meta_data.username in supabase.auth.signUp().
-- If username already exists the INSERT fails → whole transaction rolls back →
-- auth user is NOT created. This gives us atomic uniqueness enforcement.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, role, status)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.email,
    'user',
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- financings (per user)
-- ============================================================
create table if not exists public.financings (
  id                 text primary key,
  user_id            uuid references public.profiles(id) on delete cascade not null,
  car_name           text not null,
  license_plate      text default '' not null,
  bank               text default '' not null,
  vehicle_value      real default 0 not null,
  down_payment       real default 0 not null,
  monthly_rate       real default 0 not null,
  total_installments int not null,
  first_due_date     float8 not null,
  created_at         float8 not null,
  car_photo_path     text
);

alter table public.financings enable row level security;

create policy "financings_own_or_shared" on public.financings
  for select using (
    auth.uid() = user_id or public.has_access_to_financing(id)
  );

create policy "financings_modify_own" on public.financings
  for insert with check (auth.uid() = user_id);

create policy "financings_update_own" on public.financings
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "financings_delete_own" on public.financings
  for delete using (auth.uid() = user_id);

-- ============================================================
-- installments (per user)
-- ============================================================
create table if not exists public.installments (
  id                text primary key,
  user_id           uuid references public.profiles(id) on delete cascade not null,
  financing_id      text references public.financings(id) on delete cascade not null,
  number            int not null,
  due_date          float8 not null,
  amount            real not null,
  principal_amount  real not null,
  interest_amount   real not null,
  remaining_balance real not null
);

create index if not exists installments_financing_idx on public.installments(financing_id);

alter table public.installments enable row level security;

create policy "installments_own_or_shared" on public.installments
  for select using (
    auth.uid() = user_id or public.has_access_to_financing(financing_id)
  );

create policy "installments_modify_own" on public.installments
  for insert with check (auth.uid() = user_id);

create policy "installments_update_own" on public.installments
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "installments_delete_own" on public.installments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- payments (per user, one per installment)
-- ============================================================
create table if not exists public.payments (
  id             text primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  installment_id text unique references public.installments(id) on delete cascade not null,
  paid_date      float8 not null,
  paid_amount    real not null,
  note           text,
  receipt_paths  text[] default '{}' not null
);

alter table public.payments enable row level security;

create policy "payments_own_or_shared" on public.payments
  for select using (
    auth.uid() = user_id or public.has_access_to_financing(
      (select financing_id from public.installments where id = installment_id)
    )
  );

create policy "payments_modify_own" on public.payments
  for insert with check (auth.uid() = user_id);

create policy "payments_update_own" on public.payments
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "payments_delete_own" on public.payments
  for delete using (auth.uid() = user_id);

-- ============================================================
-- financing_shares (view-only sharing of financings)
-- ============================================================
create table if not exists public.financing_shares (
  id                text primary key,
  financing_id      text references public.financings(id) on delete cascade not null,
  shared_by         uuid references public.profiles(id) on delete cascade not null,
  shared_with_email text not null,
  shared_with_id    uuid references public.profiles(id) on delete cascade,
  status            text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at        float8 not null,
  constraint unique_share unique(financing_id, shared_with_email)
);

alter table public.financing_shares enable row level security;

create policy "shares_view_own" on public.financing_shares
  for select using (auth.uid() = shared_by or (auth.uid() = shared_with_id and status = 'accepted'));

create policy "shares_insert_own" on public.financing_shares
  for insert with check (auth.uid() = shared_by);

create policy "shares_update_own" on public.financing_shares
  for update using (auth.uid() = shared_by or auth.uid() = shared_with_id)
  with check (auth.uid() = shared_by or auth.uid() = shared_with_id);

create policy "shares_delete_own" on public.financing_shares
  for delete using (auth.uid() = shared_by or auth.uid() = shared_with_id);

-- ============================================================
-- storage: bucket "images" (car photos + payment receipts)
-- Paths are always prefixed with the owner's user id: {user_id}/...
-- ============================================================
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

-- Any authenticated user can read (create signed URLs); paths are random UUIDs so unguessable.
-- Write/delete remain owner-only so guests cannot modify others' files.
create policy "images_read_authenticated" on storage.objects
  for select using (bucket_id = 'images' and auth.role() = 'authenticated');

create policy "images_insert_own" on storage.objects
  for insert with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "images_update_own" on storage.objects
  for update using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "images_delete_own" on storage.objects
  for delete using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
