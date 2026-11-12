
drop policy if exists academic_activity_assignments_select_scope on public.academic_activity_assignments;
create policy academic_activity_assignments_select_scope on public.academic_activity_assignments
for select to authenticated using (
  private.can_manage_lesson_resources(district_id)
  or (
    private.can_view_academic_catalog(district_id,'published')
    and exists (
      select 1 from public.course_enrollments e
      where e.id=academic_activity_assignments.enrollment_id
        and e.user_id=(select auth.uid())
    )
  )
);
