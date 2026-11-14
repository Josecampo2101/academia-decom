create or replace function private.complete_course_and_unlock_next(p_enrollment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_enrollment public.course_enrollments%rowtype;
  v_next_course_id uuid;
  v_next_enrollment_id uuid;
begin
  select *
  into v_enrollment
  from public.course_enrollments
  where id = p_enrollment_id
  for update;

  if not found then
    raise exception 'Enrollment not found';
  end if;

  -- A pending manual review may finish after an administrator withdraws the student.
  -- Never complete or unlock another course for a withdrawn enrollment.
  if v_enrollment.status = 'withdrawn' then
    return null;
  end if;

  update public.course_enrollments
  set status = 'completed',
      completed_at = coalesce(completed_at, now()),
      updated_at = now()
  where id = v_enrollment.id
    and status = 'active';

  select next_course.id
  into v_next_course_id
  from public.courses current_course
  join public.courses next_course
    on next_course.program_id = current_course.program_id
   and next_course.district_id = current_course.district_id
   and next_course.sort_order > current_course.sort_order
   and next_course.status = 'published'
  join public.academic_programs program
    on program.id = next_course.program_id
   and program.district_id = next_course.district_id
   and program.status = 'published'
  where current_course.id = v_enrollment.course_id
    and current_course.district_id = v_enrollment.district_id
  order by next_course.sort_order, next_course.created_at, next_course.id
  limit 1;

  if v_next_course_id is not null then
    insert into public.course_enrollments(district_id, course_id, user_id, status)
    values (v_enrollment.district_id, v_next_course_id, v_enrollment.user_id, 'active')
    on conflict (course_id, user_id) do update
      set status = case
            when public.course_enrollments.status = 'withdrawn' then 'active'
            else public.course_enrollments.status
          end,
          completed_at = case
            when public.course_enrollments.status = 'withdrawn' then null
            else public.course_enrollments.completed_at
          end,
          updated_at = now()
    returning id into v_next_enrollment_id;
  end if;

  return v_next_enrollment_id;
end;
$function$;
