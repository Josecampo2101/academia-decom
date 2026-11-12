drop policy if exists course_enrollments_insert_managers on public.course_enrollments;
create policy course_enrollments_insert_managers
on public.course_enrollments
for insert to authenticated
with check (
  (has_role('national_admin') or can_manage_district(district_id))
  and exists (
    select 1
    from public.courses c
    join public.academic_programs p
      on p.id = c.program_id
     and p.district_id = c.district_id
    where c.id = course_enrollments.course_id
      and c.district_id = course_enrollments.district_id
      and c.status = 'published'
      and p.status = 'published'
  )
  and exists (
    select 1
    from public.memberships m
    join public.congregations g on g.id = m.congregation_id
    where m.user_id = course_enrollments.user_id
      and m.member_status = 'active'
      and g.district_id = course_enrollments.district_id
      and g.status = 'active'
  )
);

drop policy if exists course_enrollments_update_managers on public.course_enrollments;
create policy course_enrollments_update_managers
on public.course_enrollments
for update to authenticated
using (has_role('national_admin') or can_manage_district(district_id))
with check (
  (has_role('national_admin') or can_manage_district(district_id))
  and exists (
    select 1
    from public.courses c
    join public.academic_programs p
      on p.id = c.program_id
     and p.district_id = c.district_id
    where c.id = course_enrollments.course_id
      and c.district_id = course_enrollments.district_id
      and c.status = 'published'
      and p.status = 'published'
  )
  and exists (
    select 1
    from public.memberships m
    join public.congregations g on g.id = m.congregation_id
    where m.user_id = course_enrollments.user_id
      and m.member_status = 'active'
      and g.district_id = course_enrollments.district_id
      and g.status = 'active'
  )
);
