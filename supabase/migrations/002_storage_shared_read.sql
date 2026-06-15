-- Allow any authenticated user to read (create signed URLs for) images.
-- Paths are random UUIDs so unguessable; write/delete remain owner-only.
drop policy if exists "images_read_own" on storage.objects;

create policy "images_read_authenticated" on storage.objects
  for select using (
    bucket_id = 'images' and auth.role() = 'authenticated'
  );
