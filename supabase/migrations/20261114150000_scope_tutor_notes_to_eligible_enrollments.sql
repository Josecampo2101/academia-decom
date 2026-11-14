create or replace function private.get_tutor_student_notes(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_notes jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_national_admin() and not exists (
    select 1 from public.academic_course_tutor_assignments a
    where a.tutor_user_id = (select auth.uid()) and a.status = 'active'
      and private.is_active_district_tutor((select auth.uid()), a.district_id)
  ) then
    raise exception 'Active tutor access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'course_id', n.course_id, 'course_title', c.title,
    'note', n.note,
    'author_name', coalesce(nullif(btrim(author.full_name), ''), 'Tutor'),
    'created_at', n.created_at
  ) order by n.created_at desc), '[]'::jsonb)
  into v_notes
  from public.academic_tutor_student_notes n
  join public.course_enrollments e on e.id = n.enrollment_id
    and e.user_id = p_student_id and e.course_id = n.course_id and e.district_id = n.district_id
    and e.status in ('active', 'completed')
  join public.courses c on c.id = n.course_id and c.district_id = n.district_id
  left join public.profiles author on author.id = n.author_user_id
  where n.student_id = p_student_id
    and (
      private.is_national_admin()
      or exists (
        select 1 from public.academic_course_tutor_assignments a
        where a.course_id = n.course_id and a.district_id = n.district_id
          and a.tutor_user_id = (select auth.uid()) and a.status = 'active'
          and private.is_active_district_tutor((select auth.uid()), a.district_id)
      )
    );

  return v_notes;
end;
$function$;

revoke all on function private.get_tutor_student_notes(uuid) from public, anon;
grant execute on function private.get_tutor_student_notes(uuid) to authenticated;
