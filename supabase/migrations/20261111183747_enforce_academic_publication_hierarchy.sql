-- Students see published items only when every ancestor in the curriculum tree is published.

drop policy if exists courses_select_scope on public.courses;
create policy courses_select_scope
on public.courses for select to authenticated
using (
  private.can_manage_academic_catalog(district_id)
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
on public.course_modules for select to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.courses c
      join public.academic_programs p
        on p.id = c.program_id and p.district_id = c.district_id
      where c.id = course_modules.course_id
        and c.district_id = course_modules.district_id
        and c.status = 'published'
        and p.status = 'published'
    )
  )
);

drop policy if exists lessons_select_scope on public.lessons;
create policy lessons_select_scope
on public.lessons for select to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.course_modules cm
      join public.courses c
        on c.id = cm.course_id and c.district_id = cm.district_id
      join public.academic_programs p
        on p.id = c.program_id and p.district_id = c.district_id
      where cm.id = lessons.module_id
        and cm.district_id = lessons.district_id
        and cm.status = 'published'
        and c.status = 'published'
        and p.status = 'published'
    )
  )
);

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
      join public.academic_programs p
        on p.id = c.program_id and p.district_id = c.district_id
      where c.id = curriculum_versions.course_id
        and c.district_id = curriculum_versions.district_id
        and c.status = 'published'
        and p.status = 'published'
    )
  )
);
