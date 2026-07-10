-- Fuel type (gasolina, etanol, diesel, GNV...). Run in the Supabase SQL Editor.

alter table public.fuel_fillups
  add column if not exists fuel_type text;
