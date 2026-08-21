-- Track whether a fill-up completed the tank. Enables correct segment-based
-- consumption: partial fill-ups (full_tank = false) accumulate liters/km
-- until the next full tank closes the segment, instead of every consecutive
-- pair producing its own (often noisy) average.
-- Existing rows default to true — under the old logic every past entry was
-- already treated as a complete measurement point.
alter table public.fuel_fillups
  add column if not exists full_tank boolean not null default true;
