CREATE OR REPLACE FUNCTION private.get_tutor_student_academic_detail(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_national_admin() and not exists (
    select 1 from public.academic_course_tutor_assignments a
    where a.tutor_user_id = (select auth.uid())
      and a.status = 'active'
      and private.is_active_district_tutor((select auth.uid()), a.district_id)
  ) then
    raise exception 'Active tutor access required';
  end if;

  with accessible_enrollments as (
    select e.id, e.user_id, e.course_id, e.district_id, e.status, e.enrolled_at,
           c.title as course_title, c.sort_order as course_sort_order
    from public.course_enrollments e
    join public.courses c on c.id = e.course_id and c.district_id = e.district_id
    where e.user_id = p_student_id and e.status in ('active', 'completed')
      and (private.is_national_admin() or exists (
        select 1 from public.academic_course_tutor_assignments a
        where a.course_id = e.course_id and a.district_id = e.district_id
          and a.tutor_user_id = (select auth.uid()) and a.status = 'active'
          and private.is_active_district_tutor((select auth.uid()), a.district_id)
      ))
  ),
  course_rows as (
    select e.id as enrollment_id, e.course_id, e.course_title, e.status, e.enrolled_at,
      coalesce(lesson_totals.total_lessons, 0) as total_lessons,
      coalesce(lesson_totals.completed_lessons, 0) as completed_lessons,
      case when coalesce(lesson_totals.total_lessons, 0) = 0 then 0
        else round(100.0 * coalesce(lesson_totals.completed_lessons, 0) / lesson_totals.total_lessons)::integer
      end as progress, e.course_sort_order
    from accessible_enrollments e
    left join lateral (
      select count(*)::integer as total_lessons,
        count(*) filter (where lp.status = 'completed')::integer as completed_lessons
      from public.course_modules cm
      join public.lessons l on l.module_id = cm.id and l.district_id = cm.district_id and l.status = 'published'
      left join public.lesson_progress lp on lp.enrollment_id = e.id and lp.lesson_id = l.id
      where cm.course_id = e.course_id and cm.district_id = e.district_id and cm.status = 'published'
    ) lesson_totals on true
  ),
  activity_rows as (
    select aa.id, a.title, cr.course_title, aa.due_at,
      coalesce(sub.status, 'not_started') as status, sub.attempt_number,
      sub.awarded_points, a.total_points, sub.feedback, sub.submitted_at, sub.reviewed_at
    from accessible_enrollments e
    join course_rows cr on cr.enrollment_id = e.id
    join public.academic_activity_assignments aa on aa.enrollment_id = e.id
      and aa.district_id = e.district_id and aa.status = 'active'
    join public.academic_activities a on a.id = aa.activity_id
      and a.course_id = e.course_id and a.district_id = e.district_id
    left join lateral (
      select s.status, s.attempt_number, s.awarded_points, s.feedback, s.submitted_at, s.reviewed_at
      from public.academic_activity_submissions s
      where s.assignment_id = aa.id and s.enrollment_id = e.id and s.user_id = p_student_id
      order by s.attempt_number desc, s.created_at desc limit 1
    ) sub on true
    where a.status = 'published'
  ),
  assessment_rows as (
    select at.id, at.assessment_id, a.title, cr.course_title, a.assessment_type,
      at.attempt_number, at.status, at.score_percent, at.passed, at.manual_pending,
      at.submitted_at, at.graded_at
    from accessible_enrollments e
    join course_rows cr on cr.enrollment_id = e.id
    join public.academic_assessment_attempts at on at.enrollment_id = e.id
      and at.user_id = p_student_id and at.district_id = e.district_id
    join public.academic_assessments a on a.id = at.assessment_id
      and a.course_id = e.course_id and a.district_id = e.district_id
  )
  select jsonb_build_object(
    'student', jsonb_build_object('id', p.id,
      'name', coalesce(nullif(btrim(p.full_name), ''), 'Estudiante'), 'status', p.status),
    'courses', coalesce((select jsonb_agg(jsonb_build_object(
      'enrollment_id', c.enrollment_id, 'course_id', c.course_id, 'title', c.course_title,
      'status', c.status, 'enrolled_at', c.enrolled_at, 'total_lessons', c.total_lessons,
      'completed_lessons', c.completed_lessons, 'progress', c.progress
    ) order by c.course_sort_order, c.course_title) from course_rows c), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'title', a.title, 'course_title', a.course_title, 'due_at', a.due_at,
      'status', a.status, 'attempt_number', a.attempt_number, 'awarded_points', a.awarded_points,
      'total_points', a.total_points, 'feedback', a.feedback, 'submitted_at', a.submitted_at,
      'reviewed_at', a.reviewed_at
    ) order by coalesce(a.submitted_at, a.due_at) desc nulls last, a.title) from activity_rows a), '[]'::jsonb),
    'assessments', coalesce((select jsonb_agg(jsonb_build_object(
      'id', a.id, 'assessment_id', a.assessment_id, 'title', a.title,
      'course_title', a.course_title, 'type', a.assessment_type,
      'attempt_number', a.attempt_number, 'status', a.status, 'score_percent', a.score_percent,
      'passed', a.passed, 'manual_pending', a.manual_pending,
      'submitted_at', a.submitted_at, 'graded_at', a.graded_at
    ) order by a.submitted_at desc, a.attempt_number desc) from assessment_rows a), '[]'::jsonb)
  )
  into v_result
  from public.profiles p
  where p.id = p_student_id and exists (select 1 from course_rows);

  return v_result;
end;
$function$
revoke all on function private.get_tutor_student_academic_detail(uuid) from public, anon;
grant execute on function private.get_tutor_student_academic_detail(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.get_tutor_student_academic_detail(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select private.get_tutor_student_academic_detail(p_student_id);
$function$
revoke all on function public.get_tutor_student_academic_detail(uuid) from public, anon;
grant execute on function public.get_tutor_student_academic_detail(uuid) to authenticated;

comment on function public.get_tutor_student_academic_detail(uuid) is
  'Returns academic progress, assigned activities and assessment attempts for a student only within courses assigned to the authenticated tutor, or all courses for a national administrator.';
