-- Adds account-profile fields surfaced in Settings → Account.
-- display_name overrides "First Last" in the UI when set.
-- avatar_url points at a Supabase Storage object; null = render initials.

alter table profiles
  add column if not exists display_name text,
  add column if not exists avatar_url   text;

-- Avatars storage bucket. Public-read so <img src> works without signed URLs.
-- Writes are scoped to the authenticated user's own folder ({user.id}/...).
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

-- Anyone can read (bucket is public anyway, but the policy is required for SELECT).
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users can upload only into a folder named after their auth uid.
create policy "avatars: owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
