create or replace function public.get_course_tutor_candidates(p_district_id uuid)
returns table(user_id uuid,full_name text,phone text)
language sql stable security definer set search_path=''
as $function$
 select distinct p.id,p.full_name,p.phone
 from public.profiles p join public.user_role_assignments ura on ura.user_id=p.id join public.roles r on r.id=ura.role_id
 where p.status='active' and ura.district_id=p_district_id and ura.congregation_id is null and r.role_key='tutor'
 and private.can_manage_course_tutor_assignments(p_district_id)
 order by p.full_name;
$function$;
revoke all on function public.get_course_tutor_candidates(uuid) from public,anon;
grant execute on function public.get_course_tutor_candidates(uuid) to authenticated;
