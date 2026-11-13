-- The roster RPC must require an active profile for every caller, including
-- national administrators who also hold an active course assignment.

create or replace function private.get_tutor_course_roster()
returns table (
  course_id uuid,
  course_title text,
  student_id uuid,
  student_name text,
  enrollment_id uuid,
  enrollment_status text,
  enrolled_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    c.id,
    c.title,
    e.user_id,
    coalesce(nullif(btrim(p.full_name), ''), 'Estudiante'),
    e.id,
    e.status,
    e.enrolled_at
  from public.academic_course_tutor_assignments a
  join public.courses c
    on c.id = a.course_id
   and c.district_id = a.district_id
  join public.course_enrollments e
    on e.course_id = a.course_id
   and e.district_id = a.district_id
  left join public.profiles p
    on p.id = e.user_id
  where a.tutor_user_id = (select auth.uid())
    and a.status = 'active'
    and e.status in ('active', 'completed')
    and exists (
      select 1
      from public.profiles caller_profile
      where caller_profile.id = (select auth.uid())
        and caller_profile.status = 'active'
    )
    and (
      public.has_role('national_admin', null)
      or exists (
        select 1
        from public.user_role_assignments ura
        join public.roles r
          on r.id = ura.role_id
        where ura.user_id = (select auth.uid())
          and r.role_key = 'tutor'
          and ura.district_id = a.district_id
          and ura.congregation_id is null
      )
    )
  order by c.title, p.full_name nulls last, e.enrolled_at desc;
$function$;
