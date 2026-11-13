create or replace function private.protect_course_tutor_assignment_history()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if old.status <> 'active' then raise exception 'Revoked tutor assignments are immutable'; end if;
 if new.id is distinct from old.id or new.district_id is distinct from old.district_id
  or new.course_id is distinct from old.course_id or new.tutor_user_id is distinct from old.tutor_user_id
  or new.assigned_by is distinct from old.assigned_by or new.assigned_at is distinct from old.assigned_at
  or new.notes is distinct from old.notes then
  raise exception 'Tutor assignment identity and history fields are immutable';
 end if;
 if new.status <> 'revoked' or new.revoked_at is null or new.revoked_by is distinct from (select auth.uid()) then
  raise exception 'An active tutor assignment can only be revoked by an authorized district manager';
 end if;
 return new;
end;
$function$;
revoke all on function private.protect_course_tutor_assignment_history() from public,anon,authenticated;
drop trigger if exists protect_course_tutor_assignment_history on public.academic_course_tutor_assignments;
create trigger protect_course_tutor_assignment_history before update on public.academic_course_tutor_assignments for each row execute function private.protect_course_tutor_assignment_history();

drop policy "District academic managers assign course tutors" on public.academic_course_tutor_assignments;
create policy "District academic managers assign course tutors" on public.academic_course_tutor_assignments for insert to authenticated
with check (private.can_manage_course_tutor_assignments(district_id) and assigned_by=(select auth.uid()) and status='active' and revoked_at is null and revoked_by is null and private.is_active_district_tutor(tutor_user_id,district_id));
