-- Expose only the roster for courses that are actively assigned to the authenticated tutor.
-- This avoids broadening profiles SELECT access: the RPC returns names only, not phone/avatar data.

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
    and (
      public.has_role('national_admin', null)
      or exists (
        select 1
        from public.user_role_assignments ura
        join public.roles r
          on r.id = ura.role_id
        join public.profiles tutor_profile
          on tutor_profile.id = ura.user_id
        where ura.user_id = (select auth.uid())
          and r.role_key = 'tutor'
          and ura.district_id = a.district_id
          and ura.congregation_id is null
          and tutor_profile.status = 'active'
      )
    )
  order by c.title, p.full_name nulls last, e.enrolled_at desc;
$function$;

revoke all on function private.get_tutor_course_roster() from public, anon;
grant execute on function private.get_tutor_course_roster() to authenticated;

create or replace function public.get_tutor_course_roster()
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
security invoker
set search_path = ''
as $function$
  select * from private.get_tutor_course_roster();
$function$;

revoke all on function public.get_tutor_course_roster() from public, anon;
grant execute on function public.get_tutor_course_roster() to authenticated;

comment on function public.get_tutor_course_roster() is
  'Returns student names and enrollment metadata only for courses actively assigned to the authenticated tutor.';
