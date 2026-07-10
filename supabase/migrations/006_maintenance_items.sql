-- Line items for a maintenance record: [{ "name": "Radiador", "value": 350 }, ...].
-- item_value stays as the sum of the items. Run in the Supabase SQL Editor.

alter table public.maintenances
  add column if not exists items jsonb default '[]'::jsonb not null;
