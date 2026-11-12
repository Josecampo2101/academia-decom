-- Allow tutors and district leadership to read draft curriculum records for lesson planning.
alter table public.lesson_materials add column if not exists content text;
drop constraint if exists lesson_materials_source_check on public.lesson_materials;
alter table public.lesson_materials add constraint lesson_materials_source_check check (
 (storage_path is not null and external_url is null and content is null)
 or (storage_path is null and external_url is not null and content is null)
 or (storage_path is null and external_url is null and material_type='lesson_text' and content is not null)
);

drop policy if exists academic_programs_select_scope on public.academic_programs;
create policy academic_programs_select_scope on public.academic_programs for select to authenticated
using (private.can_manage_academic_catalog(district_id)
 or private.can_manage_lesson_resources(district_id)
 or (status='published' and private.can_view_academic_catalog(district_id,'published')));

drop policy if exists courses_select_scope on public.courses;
create policy courses_select_scope on public.courses for select to authenticated
using (private.can_manage_academic_catalog(district_id)
 or private.can_manage_lesson_resources(district_id)
 or (status='published' and private.can_view_academic_catalog(district_id,'published')
 and exists(select 1 from public.academic_programs p where p.id=courses.program_id and p.district_id=courses.district_id and p.status='published')));

drop policy if exists course_modules_select_scope on public.course_modules;
create policy course_modules_select_scope on public.course_modules for select to authenticated
using (private.can_manage_academic_catalog(district_id)
 or private.can_manage_lesson_resources(district_id)
 or (status='published' and private.can_view_academic_catalog(district_id,'published')
 and exists(select 1 from public.courses c join public.academic_programs p on p.id=c.program_id and p.district_id=c.district_id
 where c.id=course_modules.course_id and c.district_id=course_modules.district_id and c.status='published' and p.status='published')));

drop policy if exists lessons_select_scope on public.lessons;
create policy lessons_select_scope on public.lessons for select to authenticated
using (private.can_manage_academic_catalog(district_id)
 or private.can_manage_lesson_resources(district_id)
 or (status='published' and private.can_view_academic_catalog(district_id,'published')
 and exists(select 1 from public.course_modules cm join public.courses c on c.id=cm.course_id
 join public.academic_programs p on p.id=c.program_id
 where cm.id=lessons.module_id and cm.district_id=lessons.district_id and cm.status='published'
 and c.status='published' and p.status='published')));
