-- Auto-approve the first 50 sign-ups (status = active); everyone after stays
-- pending for admin approval. Run in the Supabase SQL Editor.
-- Note: for instant login, keep "Enable email confirmations" OFF in Supabase Auth.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cnt int;
begin
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, username, email, role, status)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.email,
    'user',
    case when cnt < 50 then 'active' else 'pending' end
  );
  return new;
end;
$$;
