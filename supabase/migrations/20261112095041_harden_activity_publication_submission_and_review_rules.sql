
drop policy if exists academic_activity_rubric_manage on public.academic_activity_rubric_criteria;
create policy academic_activity_rubric_insert_manager on public.academic_activity_rubric_criteria
for insert to authenticated with check (private.can_manage_lesson_resources(district_id));
create policy academic_activity_rubric_update_manager on public.academic_activity_rubric_criteria
for update to authenticated using (private.can_manage_lesson_resources(district_id))
with check (private.can_manage_lesson_resources(district_id));
create policy academic_activity_rubric_delete_manager on public.academic_activity_rubric_criteria
for delete to authenticated using (private.can_manage_lesson_resources(district_id));

create or replace function private.guard_academic_activity_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and (old.status in ('published','archived') or new.status in ('published','archived'))
     and not private.can_manage_academic_catalog(new.district_id) then
    raise exception 'Only academic editors or national administrators can publish or archive activities';
  end if;

  if new.status = 'published' then
    if not private.can_manage_academic_catalog(new.district_id) then
      raise exception 'Only academic editors or national administrators can publish activities';
    end if;
    if not exists (
      select 1
      from public.lessons l
      join public.course_modules cm on cm.id = l.module_id and cm.district_id = l.district_id
      join public.courses c on c.id = cm.course_id and c.district_id = cm.district_id
      join public.academic_programs p on p.id = c.program_id and p.district_id = c.district_id
      where l.id = new.lesson_id
        and l.district_id = new.district_id
        and cm.id = new.module_id
        and c.id = new.course_id
        and l.status = 'published'
        and cm.status = 'published'
        and c.status = 'published'
        and p.status = 'published'
    ) then
      raise exception 'The lesson, module, course and program must all be published first';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger academic_activities_publication_guard
before insert or update on public.academic_activities
for each row execute function private.guard_academic_activity_publication();

create or replace function public.start_academic_activity_submission(p_assignment_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_assignment public.academic_activity_assignments%rowtype;
  v_activity public.academic_activities%rowtype;
  v_enrollment public.course_enrollments%rowtype;
  v_attempt integer;
  v_submission_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_assignment from public.academic_activity_assignments
    where id = p_assignment_id for update;
  if not found or v_assignment.status <> 'active' then raise exception 'Assignment unavailable'; end if;
  select * into v_activity from public.academic_activities where id = v_assignment.activity_id;
  select * into v_enrollment from public.course_enrollments where id = v_assignment.enrollment_id;
  if v_enrollment.user_id <> (select auth.uid()) or v_enrollment.status <> 'active'
     or v_activity.status <> 'published' then raise exception 'Assignment unavailable'; end if;
  if coalesce(v_assignment.due_at,v_activity.due_at) is not null
     and now() > coalesce(v_assignment.due_at,v_activity.due_at) then raise exception 'Submission deadline has passed'; end if;

  select id into v_submission_id
  from public.academic_activity_submissions
  where assignment_id = p_assignment_id and user_id = (select auth.uid()) and status = 'draft'
  order by attempt_number desc limit 1;
  if v_submission_id is not null then return v_submission_id; end if;

  select coalesce(max(attempt_number),0)+1 into v_attempt
    from public.academic_activity_submissions where assignment_id = p_assignment_id;
  if v_attempt > v_activity.max_attempts then raise exception 'Maximum attempts reached'; end if;
  insert into public.academic_activity_submissions(
    assignment_id,activity_id,enrollment_id,district_id,user_id,attempt_number,status
  ) values (
    v_assignment.id,v_assignment.activity_id,v_assignment.enrollment_id,v_assignment.district_id,
    (select auth.uid()),v_attempt,'draft'
  ) returning id into v_submission_id;
  return v_submission_id;
end;
$function$;

create or replace function public.submit_academic_activity_submission(p_submission_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_activity public.academic_activities%rowtype;
  v_assignment public.academic_activity_assignments%rowtype;
  v_has_files boolean;
  v_has_text boolean;
  v_has_link boolean;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  select * into v_submission from public.academic_activity_submissions
    where id = p_submission_id for update;
  if not found or v_submission.user_id <> (select auth.uid()) or v_submission.status <> 'draft'
    then raise exception 'Draft unavailable'; end if;
  select * into v_activity from public.academic_activities where id = v_submission.activity_id;
  select * into v_assignment from public.academic_activity_assignments where id = v_submission.assignment_id;
  if v_assignment.status <> 'active' or v_activity.status <> 'published' then raise exception 'Assignment unavailable'; end if;
  if coalesce(v_assignment.due_at,v_activity.due_at) is not null
     and now() > coalesce(v_assignment.due_at,v_activity.due_at) then raise exception 'Submission deadline has passed'; end if;
  select exists(select 1 from public.academic_activity_submission_files f where f.submission_id = p_submission_id) into v_has_files;
  v_has_text := nullif(btrim(v_submission.response_text),'') is not null;
  v_has_link := v_submission.external_url ~* '^https?://[^[:space:]]+$';

  if v_submission.external_url is not null and not v_has_link then
    raise exception 'The submitted link must use http:// or https://';
  end if;
  if v_activity.response_type = 'text' and not v_has_text then raise exception 'A written response is required'; end if;
  if v_activity.response_type = 'file' and not v_has_files then raise exception 'At least one file is required'; end if;
  if v_activity.response_type = 'link' and not v_has_link then raise exception 'A valid link is required'; end if;
  if v_activity.response_type = 'mixed' and not (v_has_text or v_has_files or v_has_link) then
    raise exception 'Add a written response, a link, or at least one attachment';
  end if;

  update public.academic_activity_submissions
    set status = 'submitted', submitted_at = now(), updated_at = now()
    where id = p_submission_id;
end;
$function$;

create or replace function public.review_academic_activity_submission(
  p_submission_id uuid, p_awarded_points numeric, p_feedback text,
  p_status text default 'graded', p_rubric_scores jsonb default '[]'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_activity public.academic_activities%rowtype;
  v_score jsonb;
  v_sum numeric := 0;
  v_expected integer := 0;
  v_received integer := 0;
  v_points numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('graded','changes_requested') then raise exception 'Invalid review status'; end if;
  if p_status = 'changes_requested' and nullif(btrim(p_feedback),'') is null then
    raise exception 'Feedback is required when changes are requested';
  end if;
  select * into v_submission from public.academic_activity_submissions
    where id = p_submission_id for update;
  if not found or not private.can_manage_lesson_resources(v_submission.district_id) then
    raise exception 'Not authorized to review this submission';
  end if;
  if v_submission.status not in ('submitted','changes_requested') then raise exception 'Submission is not awaiting review'; end if;
  select * into v_activity from public.academic_activities where id = v_submission.activity_id;

  if p_status = 'graded' then
    select count(*) into v_expected from public.academic_activity_rubric_criteria
      where activity_id = v_submission.activity_id;
    if v_expected > 0 then
      if jsonb_typeof(p_rubric_scores) <> 'array' then raise exception 'Invalid rubric scores'; end if;
      for v_score in select value from jsonb_array_elements(p_rubric_scores)
      loop
        select c.max_points into v_points from public.academic_activity_rubric_criteria c
        where c.id = (v_score->>'criterion_id')::uuid and c.activity_id = v_submission.activity_id;
        if not found then raise exception 'Rubric criterion not found'; end if;
        if (v_score->>'awarded_points') is null then raise exception 'Missing awarded points'; end if;
        if (v_score->>'awarded_points')::numeric < 0 or (v_score->>'awarded_points')::numeric > v_points then
          raise exception 'Rubric score exceeds criterion limit';
        end if;
        v_sum := v_sum + (v_score->>'awarded_points')::numeric;
        v_received := v_received + 1;
      end loop;
      if v_received <> v_expected then raise exception 'Score every rubric criterion exactly once'; end if;
      if exists (
        select 1 from (
          select (value->>'criterion_id')::uuid as criterion_id, count(*) as amount
          from jsonb_array_elements(p_rubric_scores) group by 1 having count(*) > 1
        ) duplicate_scores
      ) then raise exception 'Duplicate rubric criterion score'; end if;
      if p_awarded_points is distinct from v_sum then raise exception 'Total score must equal the rubric sum'; end if;
    end if;
    if p_awarded_points is null or p_awarded_points < 0 or p_awarded_points > v_activity.total_points then
      raise exception 'Score outside activity range';
    end if;
  end if;

  update public.academic_activity_submissions
    set status = p_status,
        awarded_points = case when p_status = 'graded' then p_awarded_points else null end,
        feedback = nullif(btrim(p_feedback),''),
        rubric_scores = case when p_status = 'graded' then coalesce(p_rubric_scores,'[]'::jsonb) else '[]'::jsonb end,
        reviewed_by = (select auth.uid()), reviewed_at = now(), updated_at = now()
    where id = p_submission_id;
end;
$function$;

drop policy if exists academic_activity_submission_files_insert_draft on public.academic_activity_submission_files;
create policy academic_activity_submission_files_insert_draft on public.academic_activity_submission_files
for insert to authenticated with check (
  user_id = (select auth.uid())
  and storage_path like (
    district_id::text || '/' || user_id::text || '/' || submission_id::text || '/%'
  )
  and exists (
    select 1 from public.academic_activity_submissions s
    where s.id = academic_activity_submission_files.submission_id
      and s.activity_id = academic_activity_submission_files.activity_id
      and s.district_id = academic_activity_submission_files.district_id
      and s.user_id = (select auth.uid()) and s.status = 'draft'
  )
);
