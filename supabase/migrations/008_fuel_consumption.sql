-- Fuel consumption tracking: station name + km driven since the last full tank,
-- and the car's tank size for range estimates. Run in the Supabase SQL Editor.

alter table public.fuel_fillups
  add column if not exists station   text,
  add column if not exists km_driven int;

alter table public.financings
  add column if not exists tank_liters real;
