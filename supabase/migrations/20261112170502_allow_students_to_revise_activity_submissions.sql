create or replace function private.reopen_academic_activity_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_assignment public.academic_activity_assignments%rowtype;
  v_activity public.academic_activities%rowtype;
  v_enrollment public.course_enrollments%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select * into v_submission
  from public.academic_activity_submissions
  where id = p_submission_id
  for update;

  if not found
    or v_submission.user_id <> (select auth.uid())
    or v_submission.status <> 'changes_requested' then
    raise exception 'Submission is not available for revision';
  end if;

  select * into v_assignment
  from public.academic_activity_assignments
  where id = v_submission.assignment_id;

  select * into v_activity
  from public.academic_activities
  where id = v_submission.activity_id;

  select * into v_enrollment
  from public.course_enrollments
  where id = v_submission.enrollment_id;

  if v_assignment.id is null
    or v_assignment.status <> 'active'
    or v_activity.id is null
    or v_activity.status <> 'published'
    or v_enrollment.id is null
    or v_enrollment.user_id <> (select auth.uid())
    or v_enrollment.status <> 'active'
    or not exists (
      select 1
      from public.memberships m
      join public.congregations g on g.id = m.congregation_id
      where m.user_id = (select auth.uid())
        and m.member_status = 'active'
        and g.district_id = v_submission.district_id
        and g.status = 'active'
    ) then
    raise exception 'Assignment is no longer available';
  end if;

  if coalesce(v_assignment.due_at, v_activity.due_at) is not null
    and now() > coalesce(v_assignment.due_at, v_activity.due_at) then
    raise exception 'Submission deadline has passed';
  end if;

  update public.academic_activity_submissions
  set status = 'draft',
      awarded_points = null,
      feedback = null,
      rubric_scores = '[]'::jsonb,
      reviewed_by = null,
      reviewed_at = null,
      submitted_at = null,
      updated_at = now()
  where id = p_submission_id;
end;
$function$;

create or replace function public.reopen_academic_activity_submission(p_submission_id uuid)
returns void
language sql
set search_path to ''
as $function$
  select private.reopen_academic_activity_submission(p_submission_id);
$function$;

revoke all on function private.reopen_academic_activity_submission(uuid) from public, anon;
grant execute on function private.reopen_academic_activity_submission(uuid) to authenticated;
revoke all on function public.reopen_academic_activity_submission(uuid) from public, anon;
grant execute on function public.reopen_academic_activity_submission(uuid) to authenticated;
