
create unique index academic_library_resources_storage_path_unique
on public.academic_library_resources(storage_path) where storage_path is not null;

alter table public.academic_library_resources
add constraint academic_library_resources_external_url_check
check (external_url is null or external_url ~* '^https?://[^[:space:]]+$');

create or replace function private.guard_academic_library_resource()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_parent public.academic_library_resources%rowtype;
begin
  if tg_op='UPDATE' and old.status='published' then
    if new.status='draft' then
      raise exception 'Published library resources cannot be reverted to draft; create a new version instead';
    end if;
    if old.title is distinct from new.title
      or old.description is distinct from new.description
      or old.category_id is distinct from new.category_id
      or old.course_id is distinct from new.course_id
      or old.resource_type is distinct from new.resource_type
      or old.version_label is distinct from new.version_label
      or old.version_parent_id is distinct from new.version_parent_id
      or old.storage_path is distinct from new.storage_path
      or old.external_url is distinct from new.external_url
      or old.content is distinct from new.content
      or old.mime_type is distinct from new.mime_type
      or old.size_bytes is distinct from new.size_bytes then
      raise exception 'Published library resources are immutable; create a new version';
    end if;
  end if;
  if new.version_parent_id is not null then
    if new.version_parent_id=new.id then raise exception 'A resource cannot be its own parent'; end if;
    select * into v_parent from public.academic_library_resources
      where id=new.version_parent_id and district_id=new.district_id;
    if not found or v_parent.version_parent_id is not null then
      raise exception 'A resource version must reference an original resource, not another version';
    end if;
    if v_parent.category_id is distinct from new.category_id then
      raise exception 'A resource version must keep the original category';
    end if;
  end if;
  if new.storage_path is not null and new.storage_path not like (new.district_id::text || '/' || new.id::text || '/%') then
    raise exception 'Resource storage path must be scoped to its district and resource';
  end if;
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
    ) then raise exception 'The uploaded resource file does not exist'; end if;
    new.published_at:=coalesce(new.published_at,now());
  end if;
  new.updated_at:=now();
  return new;
end;
$function$;

create or replace function private.guard_academic_activity_rubric()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_activity_id uuid;
  v_total numeric;
  v_maximum numeric;
begin
  v_activity_id:=case when tg_op='DELETE' then old.activity_id else new.activity_id end;
  if exists (select 1 from public.academic_activity_submissions s where s.activity_id=v_activity_id) then
    raise exception 'The rubric cannot be changed after students have started submitting';
  end if;
  select a.total_points into v_total from public.academic_activities a where a.id=v_activity_id;
  select coalesce(sum(c.max_points),0) into v_maximum
    from public.academic_activity_rubric_criteria c
    where c.activity_id=v_activity_id
      and (tg_op<>'UPDATE' or c.id<>new.id);
  if tg_op<>'DELETE' then v_maximum:=v_maximum+new.max_points; end if;
  if v_maximum>v_total then raise exception 'Rubric maximum points cannot exceed the activity total'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;
