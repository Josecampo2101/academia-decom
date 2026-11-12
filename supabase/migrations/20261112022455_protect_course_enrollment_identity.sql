create or replace function private.prevent_course_enrollment_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.district_id is distinct from old.district_id
    or new.course_id is distinct from old.course_id
    or new.user_id is distinct from old.user_id then
    raise exception 'A course enrollment cannot be reassigned to another student, course, or district';
  end if;
  return new;
end;
$function$;

drop trigger if exists course_enrollment_identity_immutable on public.course_enrollments;
create trigger course_enrollment_identity_immutable
before update on public.course_enrollments
for each row execute function private.prevent_course_enrollment_identity_change();

drop policy if exists course_enrollments_update_managers on public.course_enrollments;
create policy course_enrollments_update_managers
on public.course_enrollments
for update to authenticated
using (has_role('national_admin') or can_manage_district(district_id))
with check (has_role('national_admin') or can_manage_district(district_id));

grant execute on function private.prevent_course_enrollment_identity_change() to authenticated;
