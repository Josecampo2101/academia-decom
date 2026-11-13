-- Keep tutor access scoped to courses with an active assignment.
-- District-level academic managers retain their existing scope through
-- private.can_manage_course_resources(course_id).

drop policy if exists course_enrollments_select_scope on public.course_enrollments;
create policy course_enrollments_select_scope
on public.course_enrollments
for select
to authenticated
using (
  user_id = (select auth.uid())
  or has_role('national_admin')
  or can_view_district(district_id)
  or private.can_manage_course_resources(course_id)
);

drop policy if exists academic_activities_select_scope on public.academic_activities;
create policy academic_activities_select_scope
on public.academic_activities
for select
to authenticated
using (
  private.can_manage_course_resources(course_id)
  or (
    status = 'published'
    and exists (
      select 1
      from public.academic_activity_assignments aa
      join public.course_enrollments e
        on e.id = aa.enrollment_id
       and e.course_id = academic_activities.course_id
       and e.district_id = academic_activities.district_id
      where aa.activity_id = academic_activities.id
        and aa.district_id = academic_activities.district_id
        and aa.status = 'active'
        and e.user_id = (select auth.uid())
        and e.status = 'active'
    )
  )
);

drop policy if exists academic_activities_insert_managers on public.academic_activities;
create policy academic_activities_insert_managers
on public.academic_activities
for insert
to authenticated
with check (
  private.can_manage_course_resources(course_id)
  and created_by = (select auth.uid())
  and status = 'draft'
);

drop policy if exists academic_activities_update_managers on public.academic_activities;
create policy academic_activities_update_managers
on public.academic_activities
for update
to authenticated
using (private.can_manage_course_resources(course_id))
with check (
  private.can_manage_course_resources(course_id)
  and (status <> 'published' or private.can_manage_academic_catalog(district_id))
);

drop policy if exists academic_activities_delete_drafts on public.academic_activities;
create policy academic_activities_delete_drafts
on public.academic_activities
for delete
to authenticated
using (
  private.can_manage_course_resources(course_id)
  and status = 'draft'
);

drop policy if exists academic_activity_assignments_select_scope on public.academic_activity_assignments;
create policy academic_activity_assignments_select_scope
on public.academic_activity_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_assignments.activity_id
      and a.district_id = academic_activity_assignments.district_id
      and private.can_manage_course_resources(a.course_id)
  )
  or exists (
    select 1
    from public.course_enrollments e
    where e.id = academic_activity_assignments.enrollment_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists academic_activity_assignments_insert_managers on public.academic_activity_assignments;
create policy academic_activity_assignments_insert_managers
on public.academic_activity_assignments
for insert
to authenticated
with check (
  assigned_by = (select auth.uid())
  and status = 'active'
  and exists (
    select 1
    from public.academic_activities a
    join public.course_enrollments e
      on e.id = academic_activity_assignments.enrollment_id
     and e.course_id = a.course_id
     and e.district_id = a.district_id
    join public.memberships m
      on m.user_id = e.user_id
     and m.member_status = 'active'
    join public.congregations g
      on g.id = m.congregation_id
     and g.district_id = e.district_id
     and g.status = 'active'
    where a.id = academic_activity_assignments.activity_id
      and a.district_id = academic_activity_assignments.district_id
      and a.status = 'published'
      and e.status = 'active'
      and private.can_manage_course_resources(a.course_id)
  )
);

drop policy if exists academic_activity_assignments_update_managers on public.academic_activity_assignments;
create policy academic_activity_assignments_update_managers
on public.academic_activity_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_assignments.activity_id
      and a.district_id = academic_activity_assignments.district_id
      and private.can_manage_course_resources(a.course_id)
  )
)
with check (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_assignments.activity_id
      and a.district_id = academic_activity_assignments.district_id
      and private.can_manage_course_resources(a.course_id)
  )
);

drop policy if exists academic_activity_assignments_delete_managers on public.academic_activity_assignments;
create policy academic_activity_assignments_delete_managers
on public.academic_activity_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.academic_activities a
    where a.id = academic_activity_assignments.activity_id
      and a.district_id = academic_activity_assignments.district_id
      and private.can_manage_course_resources(a.course_id)
  )
);
