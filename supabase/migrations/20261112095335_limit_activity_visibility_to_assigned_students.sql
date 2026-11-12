
drop policy if exists academic_activities_select_scope on public.academic_activities;
create policy academic_activities_select_scope on public.academic_activities
for select to authenticated using (
  private.can_manage_lesson_resources(district_id)
  or (
    status='published'
    and private.can_view_academic_catalog(district_id,'published')
    and exists (
      select 1
      from public.academic_activity_assignments aa
      join public.course_enrollments e on e.id=aa.enrollment_id
      where aa.activity_id=academic_activities.id
        and aa.district_id=academic_activities.district_id
        and aa.status='active'
        and e.user_id=(select auth.uid())
        and e.status='active'
    )
  )
);

drop policy if exists academic_activity_rubric_select_scope on public.academic_activity_rubric_criteria;
create policy academic_activity_rubric_select_scope on public.academic_activity_rubric_criteria
for select to authenticated using (
  private.can_manage_lesson_resources(district_id)
  or (
    private.can_view_academic_catalog(district_id,'published')
    and exists (
      select 1
      from public.academic_activities a
      join public.academic_activity_assignments aa on aa.activity_id=a.id and aa.district_id=a.district_id
      join public.course_enrollments e on e.id=aa.enrollment_id
      where a.id=academic_activity_rubric_criteria.activity_id
        and a.status='published'
        and aa.status='active'
        and e.user_id=(select auth.uid())
        and e.status='active'
    )
  )
);
