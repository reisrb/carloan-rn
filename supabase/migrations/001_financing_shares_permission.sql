alter table public.financing_shares
  add column if not exists permission text not null default 'view'
  check (permission in ('view', 'edit'));
