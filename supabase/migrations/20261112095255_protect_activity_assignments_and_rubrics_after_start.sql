
create or replace function private.guard_academic_activity_configuration()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op='UPDATE' and exists (
    select 1 from public.academic_activity_assignments a where a.activity_id=old.id
  ) then
    if old.district_id is distinct from new.district_id
      or old.course_id is distinct from new.course_id
      or old.module_id is distinct from new.module_id
      or old.lesson_id is distinct from new.lesson_id
      or old.response_type is distinct from new.response_type
      or old.total_points is distinct from new.total_points
      or old.max_attempts is distinct from new.max_attempts then
      raise exception 'Activity structure and grading settings are immutable after assignment';
    end if;
  end if;
  return new;
end;
$function$;

create trigger academic_activity_configuration_guard
before update on public.academic_activities
for each row execute function private.guard_academic_activity_configuration();

create or replace function private.guard_academic_activity_rubric()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_activity_id uuid;
begin
  v_activity_id:=case when tg_op='DELETE' then old.activity_id else new.activity_id end;
  if exists (
    select 1 from public.academic_activity_submissions s where s.activity_id=v_activity_id
  ) then
    raise exception 'The rubric cannot be changed after students have started submitting';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

create trigger academic_activity_rubric_guard
before insert or update or delete on public.academic_activity_rubric_criteria
for each row execute function private.guard_academic_activity_rubric();

create or replace function private.guard_academic_activity_assignment_identity()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if old.activity_id is distinct from new.activity_id
    or old.enrollment_id is distinct from new.enrollment_id
    or old.district_id is distinct from new.district_id
    or old.assigned_by is distinct from new.assigned_by
    or old.assigned_at is distinct from new.assigned_at then
    raise exception 'Assignment identity fields are immutable';
  end if;
  return new;
end;
$function$;

create trigger academic_activity_assignment_identity_guard
before update on public.academic_activity_assignments
for each row execute function private.guard_academic_activity_assignment_identity();
