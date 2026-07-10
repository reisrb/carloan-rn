-- Allow fractional km driven (e.g. 321.2). Run in the Supabase SQL Editor.

alter table public.fuel_fillups
  alter column km_driven type real using km_driven::real;
