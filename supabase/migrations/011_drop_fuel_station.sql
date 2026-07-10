-- Drop the unused station column from fuel_fillups (replaced by local + flag).
-- Run in the Supabase SQL Editor.

alter table public.fuel_fillups
  drop column if exists station;
