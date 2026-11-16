-- Prevent students from forging lesson completion through direct table writes.
-- Students may only persist playback/reading position through a scoped RPC.
-- Completion remains reserved for a separately validated trusted academic workflow.

revoke insert, update on table public.lesson_progress from public, anon, authenticated;
grant select on table public.lesson_progress to authenticated;

drop policy if exists lesson_progress_insert_own on public.lesson_progress;
drop policy if exists lesson_progress_update_own on public.lesson_progress;

create or replace function public.save_lesson_progress(
  p_enrollment_id uuid,
  p_lesson_id uuid,
  p_last_position_seconds integer
)
returns table (
  progress_id uuid,
  progress_status text,
  last_position_seconds integer,
  started_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_enrollment public.course_enrollments%rowtype;
  v_progress public.lesson_progress%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_enrollment_id is null or p_lesson_id is null
     or p_last_position_seconds is null or p_last_position_seconds < 0 then
    raise exception 'Invalid lesson progress input';
  end if;

  select e.*
    into v_enrollment
  from public.course_enrollments e
  where e.id = p_enrollment_id
    and e.user_id = v_user_id
    and e.status = 'active';

  if not found then
    raise exception 'Active enrollment not found for current user';
  end if;

  if not exists (
    select 1
    from public.lessons l
    join public.course_modules cm
      on cm.id = l.module_id
     and cm.course_id = v_enrollment.course_id
    where l.id = p_lesson_id
      and l.district_id = v_enrollment.district_id
      and l.status = 'published'
      and cm.status = 'published'
  ) then
    raise exception 'Lesson is not published in the enrolled course';
  end if;

  insert into public.lesson_progress (
    enrollment_id,
    lesson_id,
    last_position_seconds
  )
  values (
    v_enrollment.id,
    p_lesson_id,
    p_last_position_seconds
  )
  on conflict (enrollment_id, lesson_id)
  do update
    set last_position_seconds = excluded.last_position_seconds
  where public.lesson_progress.status <> 'completed'
  returning * into v_progress;

  -- A completed record is immutable through this student-facing RPC.
  if not found then
    select lp.*
      into v_progress
    from public.lesson_progress lp
    where lp.enrollment_id = v_enrollment.id
      and lp.lesson_id = p_lesson_id;
  end if;

  return query
    select
      v_progress.id,
      v_progress.status,
      v_progress.last_position_seconds,
      v_progress.started_at,
      v_progress.completed_at;
end;
$function$;

revoke all on function public.save_lesson_progress(uuid, uuid, integer)
  from public, anon;
grant execute on function public.save_lesson_progress(uuid, uuid, integer)
  to authenticated;

comment on function public.save_lesson_progress(uuid, uuid, integer) is
  'Stores a student lesson position only. It cannot mark a lesson completed or alter completion timestamps.';
