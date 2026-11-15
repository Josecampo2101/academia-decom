-- Private profile avatars: each authenticated user can manage only their own files.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'decom-profile-avatars',
  'decom-profile-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Allow users to update only the profile fields exposed by the onboarding form.
-- The existing profiles UPDATE RLS policy continues to enforce row ownership/scope.
grant update (full_name, phone, avatar_path)
on table public.profiles
to authenticated;

create policy decom_profile_avatars_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'decom-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy decom_profile_avatars_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'decom-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy decom_profile_avatars_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'decom-profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
