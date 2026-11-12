-- Tutors and district roles can draft and request review; only academic editors and national admins can approve/publish.
drop policy if exists academic_lesson_plans_write on public.academic_lesson_plans;
drop policy if exists academic_lesson_plans_insert on public.academic_lesson_plans;
drop policy if exists academic_lesson_plans_update on public.academic_lesson_plans;
drop policy if exists academic_lesson_plans_delete on public.academic_lesson_plans;
create policy academic_lesson_plans_insert on public.academic_lesson_plans for insert to authenticated
with check (
 private.can_manage_lesson_resources(academic_lesson_plans.district_id)
 and (academic_lesson_plans.status <> 'approved' or private.can_manage_academic_catalog(academic_lesson_plans.district_id))
 and exists(select 1 from public.lessons l where l.id=academic_lesson_plans.lesson_id
   and l.district_id=academic_lesson_plans.district_id and l.status='draft')
);
create policy academic_lesson_plans_update on public.academic_lesson_plans for update to authenticated
using (private.can_manage_lesson_resources(academic_lesson_plans.district_id))
with check (
 private.can_manage_lesson_resources(academic_lesson_plans.district_id)
 and (academic_lesson_plans.status <> 'approved' or private.can_manage_academic_catalog(academic_lesson_plans.district_id))
 and exists(select 1 from public.lessons l where l.id=academic_lesson_plans.lesson_id
   and l.district_id=academic_lesson_plans.district_id and l.status='draft')
);
create policy academic_lesson_plans_delete on public.academic_lesson_plans for delete to authenticated
using (private.can_manage_lesson_resources(academic_lesson_plans.district_id));

drop policy if exists lesson_materials_write on public.lesson_materials;
drop policy if exists lesson_materials_insert on public.lesson_materials;
drop policy if exists lesson_materials_update on public.lesson_materials;
drop policy if exists lesson_materials_delete on public.lesson_materials;
create policy lesson_materials_insert on public.lesson_materials for insert to authenticated
with check (
 private.can_manage_lesson_resources(lesson_materials.district_id)
 and lesson_materials.status='draft'
 and exists(select 1 from public.lessons l where l.id=lesson_materials.lesson_id
   and l.district_id=lesson_materials.district_id and l.status='draft')
);
create policy lesson_materials_update on public.lesson_materials for update to authenticated
using (private.can_manage_lesson_resources(lesson_materials.district_id))
with check (
 private.can_manage_lesson_resources(lesson_materials.district_id)
 and (
  (lesson_materials.status in ('draft','archived') and exists(
    select 1 from public.lessons l where l.id=lesson_materials.lesson_id
      and l.district_id=lesson_materials.district_id and l.status='draft'))
  or
  (lesson_materials.status='published'
   and private.can_manage_academic_catalog(lesson_materials.district_id)
   and exists(select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id
     join public.courses c on c.id=cm.course_id join public.academic_programs p on p.id=c.program_id
     where l.id=lesson_materials.lesson_id and l.district_id=lesson_materials.district_id
       and l.status='published' and cm.status='published' and c.status='published' and p.status='published'))
 )
);
create policy lesson_materials_delete on public.lesson_materials for delete to authenticated
using (private.can_manage_lesson_resources(lesson_materials.district_id));
