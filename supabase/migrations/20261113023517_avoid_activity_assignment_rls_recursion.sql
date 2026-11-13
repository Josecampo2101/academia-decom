-- Avoid RLS policy recursion while validating activity assignment scope.
create or replace function private.can_manage_activity_assignment(
  p_activity_id uuid,
  p_district_id uuid,
  p_enrollment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.academic_activities a
    where a.id = p_activity_id
      and a.district_id = p_district_id
      and private.can_manage_course_resources(a.course_id)
      and (
        p_enrollment_id is null
        or (
          a.status = 'published'
          and exists (
            select 1
            from public.course_enrollments e
            join public.memberships m
              on m.user_id = e.user_id
             and m.member_status = 'active'
            join public.congregations g
              on g.id = m.congregation_id
             and g.district_id = e.district_id
             and g.status = 'active'
            where e.id = p_enrollment_id
              and e.course_id = a.course_id
              and e.district_id = a.district_id
              and e.status = 'active'
          )
        )
      )
  );
$function$;

revoke all on function private.can_manage_activity_assignment(uuid, uuid, uuid) from public, anon;
grant execute on function private.can_manage_activity_assignment(uuid, uuid, uuid) to authenticated;

drop policy if exists academic_activity_assignments_select_scope on public.academic_activity_assignments;
create policy academic_activity_assignments_select_scope
on public.academic_activity_assignments
for select
to authenticated
using (
  private.can_manage_activity_assignment(activity_id, district_id, null)
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
  and private.can_manage_activity_assignment(activity_id, district_id, enrollment_id)
);

drop policy if exists academic_activity_assignments_update_managers on public.academic_activity_assignments;
create policy academic_activity_assignments_update_managers
on public.academic_activity_assignments
for update
to authenticated
using (private.can_manage_activity_assignment(activity_id, district_id, null))
with check (private.can_manage_activity_assignment(activity_id, district_id, null));

drop policy if exists academic_activity_assignments_delete_managers on public.academic_activity_assignments;
create policy academic_activity_assignments_delete_managers
on public.academic_activity_assignments
for delete
to authenticated
using (private.can_manage_activity_assignment(activity_id, district_id, null));
