-- Location and brand (bandeira) for fuel fill-ups. Run in the Supabase SQL Editor.

alter table public.fuel_fillups
  add column if not exists local text,
  add column if not exists flag  text;
