-- Publishing a course creates an immutable curriculum snapshot in the same transaction.

create or replace function private.validate_course_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1
      from public.course_modules cm
      where cm.course_id = new.id
        and cm.district_id = new.district_id
        and cm.status = 'published'
    ) then
      raise exception 'A course needs at least one published module before publication';
    end if;

    if not exists (
      select 1
      from public.lessons l
      join public.course_modules cm on cm.id = l.module_id
      where cm.course_id = new.id
        and l.district_id = new.district_id
        and cm.status = 'published'
        and l.status = 'published'
    ) then
      raise exception 'A course needs at least one published lesson before publication';
    end if;

    if not exists (
      select 1
      from public.curriculum_versions cv
      where cv.course_id = new.id
        and cv.district_id = new.district_id
        and cv.status = 'published'
    ) then
      raise exception 'A published curriculum version is required before publishing a course';
    end if;

    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$function$;

create or replace function public.publish_academic_course(
  p_course_id uuid,
  p_change_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_course public.courses%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_snapshot jsonb;
begin
  if (select auth.uid()) is null or not private.is_national_admin() then
    raise exception 'Only national administrators can publish academic courses';
  end if;

  select *
  into v_course
  from public.courses
  where id = p_course_id
  for update;

  if not found then
    raise exception 'Course not found';
  end if;

  if not private.can_manage_academic_catalog(v_course.district_id) then
    raise exception 'You cannot manage the academic catalog for this district';
  end if;

  if v_course.status = 'published' then
    select cv.id
    into v_version_id
    from public.curriculum_versions cv
    where cv.course_id = v_course.id
      and cv.status = 'published'
    order by cv.version_number desc
    limit 1;

    if v_version_id is not null then
      return v_version_id;
    end if;
    raise exception 'Published course has no published curriculum version';
  end if;

  if v_course.status <> 'draft' then
    raise exception 'Only draft courses can be published';
  end if;

  if exists (
    select 1
    from public.academic_programs p
    where p.id = v_course.program_id
      and p.district_id = v_course.district_id
      and p.status = 'archived'
  ) then
    raise exception 'Courses inside archived programs cannot be published';
  end if;

  select coalesce(max(cv.version_number), 0) + 1
  into v_version_number
  from public.curriculum_versions cv
  where cv.course_id = v_course.id;

  v_snapshot := jsonb_build_object(
    'program', (
      select to_jsonb(p)
      from public.academic_programs p
      where p.id = v_course.program_id
        and p.district_id = v_course.district_id
    ),
    'course', to_jsonb(v_course) || jsonb_build_object(
      'status', 'published',
      'published_at', now()
    ),
    'modules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'module', to_jsonb(cm),
          'lessons', coalesce((
            select jsonb_agg(to_jsonb(l) order by l.sort_order)
            from public.lessons l
            where l.module_id = cm.id
              and l.district_id = cm.district_id
              and l.status = 'published'
          ), '[]'::jsonb)
        )
        order by cm.sort_order
      )
      from public.course_modules cm
      where cm.course_id = v_course.id
        and cm.district_id = v_course.district_id
        and cm.status = 'published'
    ), '[]'::jsonb)
  );

  insert into public.curriculum_versions (
    district_id,
    course_id,
    version_number,
    status,
    change_summary,
    snapshot,
    created_by,
    published_at
  )
  values (
    v_course.district_id,
    v_course.id,
    v_version_number,
    'published',
    nullif(trim(coalesce(p_change_summary, '')), ''),
    v_snapshot,
    (select auth.uid()),
    now()
  )
  returning id into v_version_id;

  update public.courses
  set status = 'published',
      published_at = now(),
      updated_by = (select auth.uid())
  where id = v_course.id
    and district_id = v_course.district_id;

  return v_version_id;
end;
$function$;

revoke all on function public.publish_academic_course(uuid, text) from public, anon;
grant execute on function public.publish_academic_course(uuid, text) to authenticated;

drop policy if exists curriculum_versions_insert_scope on public.curriculum_versions;
drop policy if exists curriculum_versions_update_scope on public.curriculum_versions;
drop policy if exists curriculum_versions_select_scope on public.curriculum_versions;

create policy curriculum_versions_select_scope
on public.curriculum_versions for select to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.courses c
      where c.id = curriculum_versions.course_id
        and c.district_id = curriculum_versions.district_id
        and c.status = 'published'
    )
  )
);

revoke insert, update, delete, truncate, references, trigger
on public.curriculum_versions from public, anon, authenticated;
grant select on public.curriculum_versions to authenticated;
