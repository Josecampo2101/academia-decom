-- Restrict private lesson-material metadata and downloads to enrolled learners.
-- Scoped academic managers/tutors retain the existing access to their resources.
-- Validate in staging before production rollout.

drop policy if exists lesson_materials_select on public.lesson_materials;

create policy lesson_materials_select
on public.lesson_materials
for select
to authenticated
using (
  private.can_manage_lesson_resources_for_lesson(lesson_id)
  or (
    status = 'published'
    and private.can_view_academic_catalog(district_id, 'published')
    and exists (
      select 1
      from public.lessons l
      join public.course_modules cm
        on cm.id = l.module_id
       and cm.district_id = l.district_id
      join public.courses c
        on c.id = cm.course_id
       and c.district_id = cm.district_id
      join public.academic_programs p
        on p.id = c.program_id
       and p.district_id = c.district_id
      join public.course_enrollments e
        on e.course_id = c.id
       and e.district_id = c.district_id
      where l.id = lesson_materials.lesson_id
        and l.district_id = lesson_materials.district_id
        and l.status = 'published'
        and cm.status = 'published'
        and c.status = 'published'
        and p.status = 'published'
        and e.user_id = (select auth.uid())
        and e.status in ('active', 'completed')
    )
  )
);

drop policy if exists academic_materials_storage_select on storage.objects;

create policy academic_materials_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'academic-lesson-materials'
  and exists (
    select 1
    from public.lesson_materials m
    join public.lessons l
      on l.id = m.lesson_id
     and l.district_id = m.district_id
    join public.course_modules cm
      on cm.id = l.module_id
     and cm.district_id = l.district_id
    join public.courses c
      on c.id = cm.course_id
     and c.district_id = cm.district_id
    join public.academic_programs p
      on p.id = c.program_id
     and p.district_id = c.district_id
    where m.storage_path = objects.name
      and (
        private.can_manage_lesson_resources_for_lesson(m.lesson_id)
        or (
          m.status = 'published'
          and l.status = 'published'
          and cm.status = 'published'
          and c.status = 'published'
          and p.status = 'published'
          and private.can_view_academic_catalog(m.district_id, 'published')
          and exists (
            select 1
            from public.course_enrollments e
            where e.course_id = c.id
              and e.district_id = c.district_id
              and e.user_id = (select auth.uid())
              and e.status in ('active', 'completed')
          )
        )
      )
  )
);

comment on policy lesson_materials_select on public.lesson_materials is
  'Scoped academic managers retain lesson-resource metadata access; learners need an active or completed course enrollment.';
comment on policy academic_materials_storage_select on storage.objects is
  'Scoped academic managers retain lesson-resource access; learners need an active or completed course enrollment for published materials.';
