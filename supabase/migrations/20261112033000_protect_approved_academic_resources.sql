-- Preserve approved teaching resources: tutors and district operators may remove drafts only.
drop policy if exists lesson_materials_delete on public.lesson_materials;
create policy lesson_materials_delete
on public.lesson_materials for delete to authenticated
using (
  private.can_manage_lesson_resources(district_id)
  and (status = 'draft' or private.can_manage_academic_catalog(district_id))
);

drop policy if exists academic_lesson_plans_delete on public.academic_lesson_plans;
create policy academic_lesson_plans_delete
on public.academic_lesson_plans for delete to authenticated
using (
  private.can_manage_lesson_resources(district_id)
  and (status <> 'approved' or private.can_manage_academic_catalog(district_id))
);

drop policy if exists academic_materials_storage_delete on storage.objects;
create policy academic_materials_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'academic-lesson-materials'
  and exists (
    select 1
    from public.lesson_materials m
    where m.storage_path = storage.objects.name
      and private.can_manage_lesson_resources(m.district_id)
      and (m.status = 'draft' or private.can_manage_academic_catalog(m.district_id))
  )
);
