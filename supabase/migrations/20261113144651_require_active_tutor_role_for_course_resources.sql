-- An active assignment is not sufficient after a tutor's district role or
-- profile has been disabled. Revalidate both at every course-resource access.

create or replace function private.can_manage_course_resources(p_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.courses c
    where c.id = p_course_id
      and (
        private.can_manage_course_tutor_assignments(c.district_id)
        or exists (
          select 1
          from public.academic_course_tutor_assignments a
          where a.course_id = c.id
            and a.district_id = c.district_id
            and a.tutor_user_id = (select auth.uid())
            and a.status = 'active'
            and private.is_active_district_tutor((select auth.uid()), a.district_id)
        )
      )
  );
$function$;
