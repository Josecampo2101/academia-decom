
create table public.academic_library_categories (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint academic_library_categories_district_slug_unique unique(district_id,slug),
  constraint academic_library_categories_id_district_unique unique(id,district_id)
);

create table public.academic_library_resources (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id),
  category_id uuid not null,
  course_id uuid,
  version_parent_id uuid,
  title text not null check (char_length(btrim(title)) between 3 and 180),
  description text not null check (char_length(btrim(description)) between 12 and 2000),
  resource_type text not null check (resource_type in ('document','guide','template','video','audio','link','reading','infographic')),
  version_label text not null default '1.0' check (char_length(btrim(version_label)) between 1 and 24),
  storage_path text,
  external_url text,
  content text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 52428800),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid not null references auth.users(id),
  uploaded_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_library_resources_category_fk foreign key(category_id,district_id)
    references public.academic_library_categories(id,district_id),
  constraint academic_library_resources_course_fk foreign key(course_id,district_id)
    references public.courses(id,district_id),
  constraint academic_library_resources_parent_fk foreign key(version_parent_id,district_id)
    references public.academic_library_resources(id,district_id),
  constraint academic_library_resources_id_district_unique unique(id,district_id),
  constraint academic_library_resources_version_unique unique(version_parent_id,version_label),
  constraint academic_library_resources_payload_check check (
    (resource_type='link' and external_url is not null and external_url ~* '^https?://[^[:space:]]+$')
    or (resource_type<>'link' and (storage_path is not null or nullif(btrim(content),'') is not null))
  )
);

create index academic_library_categories_district_name_idx on public.academic_library_categories(district_id,name);
create index academic_library_resources_district_status_idx on public.academic_library_resources(district_id,status);
create index academic_library_resources_category_district_idx on public.academic_library_resources(category_id,district_id);
create index academic_library_resources_course_district_idx on public.academic_library_resources(course_id,district_id);
create index academic_library_resources_parent_district_idx on public.academic_library_resources(version_parent_id,district_id);
create index academic_library_resources_created_by_idx on public.academic_library_resources(created_by);

alter table public.academic_library_categories enable row level security;
alter table public.academic_library_resources enable row level security;

create policy academic_library_categories_select on public.academic_library_categories
for select to authenticated using (
  private.can_manage_academic_catalog(district_id)
  or private.can_view_academic_catalog(district_id,'published')
);
create policy academic_library_categories_insert on public.academic_library_categories
for insert to authenticated with check (
  private.can_manage_academic_catalog(district_id) and created_by=(select auth.uid())
);
create policy academic_library_categories_update on public.academic_library_categories
for update to authenticated using (private.can_manage_academic_catalog(district_id))
with check (private.can_manage_academic_catalog(district_id));
create policy academic_library_categories_delete on public.academic_library_categories
for delete to authenticated using (private.can_manage_academic_catalog(district_id));

create policy academic_library_resources_select on public.academic_library_resources
for select to authenticated using (
  private.can_manage_academic_catalog(district_id)
  or (status='published' and private.can_view_academic_catalog(district_id,'published'))
);
create policy academic_library_resources_insert on public.academic_library_resources
for insert to authenticated with check (
  private.can_manage_academic_catalog(district_id)
  and created_by=(select auth.uid()) and status='draft'
);
create policy academic_library_resources_update on public.academic_library_resources
for update to authenticated using (private.can_manage_academic_catalog(district_id))
with check (private.can_manage_academic_catalog(district_id));
create policy academic_library_resources_delete_drafts on public.academic_library_resources
for delete to authenticated using (private.can_manage_academic_catalog(district_id) and status='draft');

create or replace function private.guard_academic_library_resource()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status in ('published','archived') and not private.can_manage_academic_catalog(new.district_id) then
    raise exception 'Only academic editors or national administrators can publish or archive library resources';
  end if;
  if new.status='published' then
    if new.resource_type='link' then
      if new.external_url is null or new.external_url !~* '^https?://[^[:space:]]+$' then
        raise exception 'A valid HTTP or HTTPS URL is required';
      end if;
    elsif new.storage_path is null and nullif(btrim(new.content),'') is null then
      raise exception 'A file or reading content is required before publication';
    end if;
    if new.storage_path is not null and not exists (
      select 1 from storage.objects o
      where o.bucket_id='academic-library-resources' and o.name=new.storage_path
    ) then
      raise exception 'The uploaded resource file does not exist';
    end if;
    new.published_at:=coalesce(new.published_at,now());
  end if;
  new.updated_at:=now();
  return new;
end;
$function$;

create trigger academic_library_resource_publication_guard
before insert or update on public.academic_library_resources
for each row execute function private.guard_academic_library_resource();

grant select,insert,update,delete on public.academic_library_categories,public.academic_library_resources to authenticated;
revoke all on public.academic_library_categories,public.academic_library_resources from public,anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('academic-library-resources','academic-library-resources',false,52428800,
  array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/wav','video/mp4','video/webm','text/plain','text/markdown'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy academic_library_storage_insert on storage.objects
for insert to authenticated with check (
  bucket_id='academic-library-resources'
  and private.can_manage_academic_catalog((storage.foldername(name))[1]::uuid)
  and exists (
    select 1 from public.academic_library_resources r
    where r.id=(storage.foldername(name))[2]::uuid
      and r.district_id=(storage.foldername(name))[1]::uuid
      and r.status='draft'
  )
);
create policy academic_library_storage_select on storage.objects
for select to authenticated using (
  bucket_id='academic-library-resources'
  and exists (
    select 1 from public.academic_library_resources r
    where r.storage_path=objects.name
      and (private.can_manage_academic_catalog(r.district_id)
        or (r.status='published' and private.can_view_academic_catalog(r.district_id,'published')))
  )
);
create policy academic_library_storage_update on storage.objects
for update to authenticated using (
  bucket_id='academic-library-resources'
  and private.can_manage_academic_catalog((storage.foldername(name))[1]::uuid)
) with check (
  bucket_id='academic-library-resources'
  and private.can_manage_academic_catalog((storage.foldername(name))[1]::uuid)
);
create policy academic_library_storage_delete on storage.objects
for delete to authenticated using (
  bucket_id='academic-library-resources'
  and exists (
    select 1 from public.academic_library_resources r
    where r.storage_path=objects.name and r.status='draft'
      and private.can_manage_academic_catalog(r.district_id)
  )
);
