-- Allow attaching receipts (photos) to maintenance records.
-- Paths point to the shared "images" storage bucket. Run in the Supabase SQL Editor.

alter table public.maintenances
  add column if not exists receipt_paths text[] default '{}' not null;
