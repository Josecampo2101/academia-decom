-- Tutors may manage/view only resources belonging to courses with an active
-- assignment. District academic managers retain their existing district scope.

create or replace function private.can_manage_academic_program_courses(
  p_program_id uuid,
  p_district_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_program_id is not null
    and p_district_id is not null
    and exists (
      select 1
      from public.courses c
      where c.program_id = p_program_id
        and c.district_id = p_district_id
        and private.can_manage_course_resources(c.id)
    );
$function$;

revoke all on function private.can_manage_academic_program_courses(uuid, uuid) from public, anon;
grant execute on function private.can_manage_academic_program_courses(uuid, uuid) to authenticated;

drop policy if exists academic_programs_select_scope on public.academic_programs;
create policy academic_programs_select_scope
on public.academic_programs
for select
to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or private.can_manage_academic_program_courses(id, district_id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
  )
);

drop policy if exists courses_select_scope on public.courses;
create policy courses_select_scope
on public.courses
for select
to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or private.can_manage_course_resources(id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.academic_programs p
      where p.id = courses.program_id
        and p.district_id = courses.district_id
        and p.status = 'published'
    )
  )
);

drop policy if exists course_modules_select_scope on public.course_modules;
create policy course_modules_select_scope
on public.course_modules
for select
to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or private.can_manage_course_resources(course_id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.courses c
      join public.academic_programs p
        on p.id = c.program_id
       and p.district_id = c.district_id
      where c.id = course_modules.course_id
        and c.district_id = course_modules.district_id
        and c.status = 'published'
        and p.status = 'published'
    )
  )
);

drop policy if exists lessons_select_scope on public.lessons;
create policy lessons_select_scope
on public.lessons
for select
to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or private.can_manage_lesson_resources_for_lesson(id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.course_modules cm
      join public.courses c
        on c.id = cm.course_id
       and c.district_id = cm.district_id
      join public.academic_programs p
        on p.id = c.program_id
       and p.district_id = c.district_id
      where cm.id = lessons.module_id
        and cm.district_id = lessons.district_id
        and cm.status = 'published'
        and c.status = 'published'
        and p.status = 'published'
    )
  )
);

drop policy if exists academic_activity_rubric_delete_manager on public.academic_activity_rubric_criteria;
create policy academic_activity_rubric_delete_manager
on public.academic_activity_rubric_criteria
for delete
to authenticated
using (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_rubric_criteria.activity_id
      and a.district_id = academic_activity_rubric_criteria.district_id
      and private.can_manage_course_resources(a.course_id)
  )
);

drop policy if exists academic_activity_rubric_insert_manager on public.academic_activity_rubric_criteria;
create policy academic_activity_rubric_insert_manager
on public.academic_activity_rubric_criteria
for insert
to authenticated
with check (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_rubric_criteria.activity_id
      and a.district_id = academic_activity_rubric_criteria.district_id
      and private.can_manage_course_resources(a.course_id)
  )
);

drop policy if exists academic_activity_rubric_select_scope on public.academic_activity_rubric_criteria;
create policy academic_activity_rubric_select_scope
on public.academic_activity_rubric_criteria
for select
to authenticated
using (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_rubric_criteria.activity_id
      and a.district_id = academic_activity_rubric_criteria.district_id
      and private.can_manage_course_resources(a.course_id)
  )
  or (
    private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.academic_activities a
      join public.academic_activity_assignments aa
        on aa.activity_id = a.id
       and aa.district_id = a.district_id
      join public.course_enrollments e
        on e.id = aa.enrollment_id
      where a.id = academic_activity_rubric_criteria.activity_id
        and a.district_id = academic_activity_rubric_criteria.district_id
        and a.status = 'published'
        and aa.status = 'active'
        and e.user_id = (select auth.uid())
        and e.status = 'active'
    )
  )
);

drop policy if exists academic_activity_rubric_update_manager on public.academic_activity_rubric_criteria;
create policy academic_activity_rubric_update_manager
on public.academic_activity_rubric_criteria
for update
to authenticated
using (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_rubric_criteria.activity_id
      and a.district_id = academic_activity_rubric_criteria.district_id
      and private.can_manage_course_resources(a.course_id)
  )
)
with check (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_rubric_criteria.activity_id
      and a.district_id = academic_activity_rubric_criteria.district_id
      and private.can_manage_course_resources(a.course_id)
  )
);

drop policy if exists academic_activity_submission_files_select_scope on public.academic_activity_submission_files;
create policy academic_activity_submission_files_select_scope
on public.academic_activity_submission_files
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_submission_files.activity_id
      and a.district_id = academic_activity_submission_files.district_id
      and private.can_manage_course_resources(a.course_id)
  )
);

drop policy if exists academic_activity_submission_storage_select on storage.objects;
create policy academic_activity_submission_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'academic-activity-submissions'
  and exists (
    select 1
    from public.academic_activity_submission_files f
    join public.academic_activities a
      on a.id = f.activity_id
     and a.district_id = f.district_id
    where f.storage_path = objects.name
      and (
        f.user_id = (select auth.uid())
        or private.can_manage_course_resources(a.course_id)
      )
  )
);
