create or replace function private.publish_academic_activity(p_activity_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_activity public.academic_activities%rowtype;
  v_criteria_count integer;
  v_criteria_total numeric;
  v_assigned_count integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_activity
  from public.academic_activities
  where id = p_activity_id
  for update;

  if not found or v_activity.status <> 'draft' then
    raise exception 'Only draft activities can be published';
  end if;

  if not private.can_manage_lesson_resources(v_activity.district_id)
     or not private.can_manage_academic_catalog(v_activity.district_id) then
    raise exception 'Only an authorized academic editor or national administrator can publish activities in this district';
  end if;

  select count(*), coalesce(sum(max_points), 0)
  into v_criteria_count, v_criteria_total
  from public.academic_activity_rubric_criteria
  where activity_id = v_activity.id
    and district_id = v_activity.district_id;

  if v_criteria_count = 0 or v_criteria_total <> v_activity.total_points then
    raise exception 'The activity rubric must contain criteria whose points equal the activity total';
  end if;

  update public.academic_activities
  set status = 'published',
      published_at = now(),
      updated_at = now()
  where id = v_activity.id
    and status = 'draft';

  if not found then
    raise exception 'Activity could not be published';
  end if;

  insert into public.academic_activity_assignments (
    activity_id, enrollment_id, district_id, assigned_by, due_at, status
  )
  select
    v_activity.id, eligible.id, v_activity.district_id,
    (select auth.uid()), v_activity.due_at, 'active'
  from (
    select distinct e.id
    from public.course_enrollments e
    where e.course_id = v_activity.course_id
      and e.district_id = v_activity.district_id
      and e.status = 'active'
      and exists (
        select 1
        from public.memberships m
        join public.congregations g on g.id = m.congregation_id
        where m.user_id = e.user_id
          and m.member_status = 'active'
          and g.district_id = e.district_id
          and g.status = 'active'
      )
  ) eligible
  on conflict (activity_id, enrollment_id) do nothing;

  get diagnostics v_assigned_count = row_count;
  return v_assigned_count;
end;
$function$;

revoke all on function private.publish_academic_activity(uuid) from public, anon, authenticated;
grant execute on function private.publish_academic_activity(uuid) to authenticated;

create or replace function public.publish_academic_activity(p_activity_id uuid)
returns integer
language sql
set search_path = ''
as $function$
  select private.publish_academic_activity(p_activity_id);
$function$;

revoke all on function public.publish_academic_activity(uuid) from public, anon;
grant execute on function public.publish_academic_activity(uuid) to authenticated;
