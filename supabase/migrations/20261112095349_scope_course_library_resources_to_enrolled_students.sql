
drop policy if exists academic_library_resources_select on public.academic_library_resources;
create policy academic_library_resources_select on public.academic_library_resources
for select to authenticated using (
  private.can_manage_academic_catalog(district_id)
  or (
    status='published'
    and private.can_view_academic_catalog(district_id,'published')
    and (
      course_id is null
      or exists (
        select 1 from public.course_enrollments e
        where e.course_id=academic_library_resources.course_id
          and e.district_id=academic_library_resources.district_id
          and e.user_id=(select auth.uid())
          and e.status in ('active','completed')
      )
    )
  )
);

drop policy if exists academic_library_storage_select on storage.objects;
create policy academic_library_storage_select on storage.objects
for select to authenticated using (
  bucket_id='academic-library-resources'
  and exists (
    select 1 from public.academic_library_resources r
    where r.storage_path=objects.name
      and (
        private.can_manage_academic_catalog(r.district_id)
        or (
          r.status='published'
          and private.can_view_academic_catalog(r.district_id,'published')
          and (
            r.course_id is null
            or exists (
              select 1 from public.course_enrollments e
              where e.course_id=r.course_id
                and e.district_id=r.district_id
                and e.user_id=(select auth.uid())
                and e.status in ('active','completed')
            )
          )
        )
      )
  )
);
