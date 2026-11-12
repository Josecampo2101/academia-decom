
drop policy if exists academic_activity_assignments_insert_managers on public.academic_activity_assignments;
create policy academic_activity_assignments_insert_managers on public.academic_activity_assignments
for insert to authenticated with check (
  private.can_manage_lesson_resources(district_id)
  and assigned_by=(select auth.uid()) and status='active'
  and exists (
    select 1
    from public.academic_activities a
    join public.course_enrollments e on e.course_id=a.course_id and e.district_id=a.district_id
    join public.memberships m on m.user_id=e.user_id and m.member_status='active'
    join public.congregations g on g.id=m.congregation_id and g.district_id=e.district_id and g.status='active'
    where a.id=academic_activity_assignments.activity_id
      and a.district_id=academic_activity_assignments.district_id
      and a.status='published'
      and e.id=academic_activity_assignments.enrollment_id and e.status='active'
  )
);

create or replace function private.start_academic_activity_submission(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_assignment public.academic_activity_assignments%rowtype;
  v_activity public.academic_activities%rowtype;
  v_enrollment public.course_enrollments%rowtype;
  v_attempt integer;
  v_submission_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_assignment from public.academic_activity_assignments where id=p_assignment_id for update;
  if not found or v_assignment.status<>'active' then raise exception 'Assignment unavailable'; end if;
  select * into v_activity from public.academic_activities where id=v_assignment.activity_id;
  select * into v_enrollment from public.course_enrollments where id=v_assignment.enrollment_id;
  if v_enrollment.user_id<>(select auth.uid()) or v_enrollment.status<>'active'
    or v_activity.status<>'published'
    or not exists (
      select 1 from public.memberships m
      join public.congregations g on g.id=m.congregation_id
      where m.user_id=(select auth.uid()) and m.member_status='active'
        and g.district_id=v_enrollment.district_id and g.status='active'
    ) then raise exception 'Assignment unavailable'; end if;
  if coalesce(v_assignment.due_at,v_activity.due_at) is not null
    and now()>coalesce(v_assignment.due_at,v_activity.due_at) then raise exception 'Submission deadline has passed'; end if;
  select id into v_submission_id from public.academic_activity_submissions
    where assignment_id=p_assignment_id and user_id=(select auth.uid()) and status='draft'
    order by attempt_number desc limit 1;
  if v_submission_id is not null then return v_submission_id; end if;
  select coalesce(max(attempt_number),0)+1 into v_attempt
    from public.academic_activity_submissions where assignment_id=p_assignment_id;
  if v_attempt>v_activity.max_attempts then raise exception 'Maximum attempts reached'; end if;
  insert into public.academic_activity_submissions(
    assignment_id,activity_id,enrollment_id,district_id,user_id,attempt_number,status
  ) values (
    v_assignment.id,v_assignment.activity_id,v_assignment.enrollment_id,v_assignment.district_id,
    (select auth.uid()),v_attempt,'draft'
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$function$;

create or replace function private.submit_academic_activity_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_activity public.academic_activities%rowtype;
  v_assignment public.academic_activity_assignments%rowtype;
  v_has_files boolean;
  v_has_text boolean;
  v_has_link boolean;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_submission from public.academic_activity_submissions where id=p_submission_id for update;
  if not found or v_submission.user_id<>(select auth.uid()) or v_submission.status<>'draft'
    then raise exception 'Draft unavailable'; end if;
  select * into v_activity from public.academic_activities where id=v_submission.activity_id;
  select * into v_assignment from public.academic_activity_assignments where id=v_submission.assignment_id;
  if v_assignment.status<>'active' or v_activity.status<>'published'
    or not exists (
      select 1 from public.memberships m
      join public.congregations g on g.id=m.congregation_id
      where m.user_id=(select auth.uid()) and m.member_status='active'
        and g.district_id=v_submission.district_id and g.status='active'
    ) then raise exception 'Assignment unavailable'; end if;
  if coalesce(v_assignment.due_at,v_activity.due_at) is not null
    and now()>coalesce(v_assignment.due_at,v_activity.due_at) then raise exception 'Submission deadline has passed'; end if;
  select exists(select 1 from public.academic_activity_submission_files f where f.submission_id=p_submission_id) into v_has_files;
  v_has_text:=nullif(btrim(v_submission.response_text),'') is not null;
  v_has_link:=v_submission.external_url ~* '^https?://[^[:space:]]+$';
  if v_submission.external_url is not null and not v_has_link then raise exception 'The submitted link must use http:// or https://'; end if;
  if v_activity.response_type='text' and not v_has_text then raise exception 'A written response is required'; end if;
  if v_activity.response_type='file' and not v_has_files then raise exception 'At least one file is required'; end if;
  if v_activity.response_type='link' and not v_has_link then raise exception 'A valid link is required'; end if;
  if v_activity.response_type='mixed' and not (v_has_text or v_has_files or v_has_link) then
    raise exception 'Add a written response, a link, or at least one attachment';
  end if;
  update public.academic_activity_submissions set status='submitted',submitted_at=now(),updated_at=now()
    where id=p_submission_id;
end;
$function$;

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
