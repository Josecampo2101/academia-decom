
create index academic_library_categories_created_by_fk_idx on public.academic_library_categories(created_by);
create index academic_library_resources_uploaded_by_fk_idx on public.academic_library_resources(uploaded_by);

create or replace function private.guard_academic_library_resource()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_parent public.academic_library_resources%rowtype;
begin
  if tg_op='UPDATE' and old.status='published' and new.status='draft' then
    raise exception 'Published library resources cannot be reverted to draft; create a new version instead';
  end if;

  if new.status in ('published','archived') and not private.can_manage_academic_catalog(new.district_id) then
    raise exception 'Only academic editors or national administrators can publish or archive library resources';
  end if;

  if new.version_parent_id is not null then
    select * into v_parent from public.academic_library_resources
    where id=new.version_parent_id and district_id=new.district_id;
    if not found or v_parent.version_parent_id is not null then
      raise exception 'A resource version must reference an original resource, not another version';
    end if;
    if v_parent.category_id is distinct from new.category_id then
      raise exception 'A resource version must keep the original category';
    end if;
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

drop policy if exists academic_library_storage_update on storage.objects;
create policy academic_library_storage_update on storage.objects
for update to authenticated using (
  bucket_id='academic-library-resources'
  and exists (
    select 1 from public.academic_library_resources r
    where r.storage_path=objects.name and r.status='draft'
      and private.can_manage_academic_catalog(r.district_id)
  )
) with check (
  bucket_id='academic-library-resources'
  and exists (
    select 1 from public.academic_library_resources r
    where r.storage_path=objects.name and r.status='draft'
      and private.can_manage_academic_catalog(r.district_id)
  )
);
