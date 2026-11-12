
alter table public.academic_activity_submissions
add constraint academic_activity_submission_feedback_length_check
check (feedback is null or char_length(feedback)<=4000);

create or replace function private.review_academic_activity_submission(
  p_submission_id uuid,p_awarded_points numeric,p_feedback text,
  p_status text default 'graded',p_rubric_scores jsonb default '[]'::jsonb
)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_submission public.academic_activity_submissions%rowtype;
  v_activity public.academic_activities%rowtype;
  v_score jsonb;
  v_sum numeric:=0;
  v_expected integer:=0;
  v_received integer:=0;
  v_points numeric;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_status not in ('graded','changes_requested') then raise exception 'Invalid review status'; end if;
  if p_feedback is not null and char_length(p_feedback)>4000 then raise exception 'Feedback is too long'; end if;
  if p_status='changes_requested' and nullif(btrim(p_feedback),'') is null then
    raise exception 'Feedback is required when changes are requested';
  end if;
  select * into v_submission from public.academic_activity_submissions where id=p_submission_id for update;
  if not found or not private.can_manage_lesson_resources(v_submission.district_id) then
    raise exception 'Not authorized to review this submission';
  end if;
  if v_submission.user_id=(select auth.uid()) then raise exception 'A tutor cannot review their own submission'; end if;
  if v_submission.status not in ('submitted','changes_requested') then
    raise exception 'Submission is not awaiting review';
  end if;
  select * into v_activity from public.academic_activities where id=v_submission.activity_id;
  if p_status='graded' then
    select count(*) into v_expected from public.academic_activity_rubric_criteria where activity_id=v_submission.activity_id;
    if v_expected>0 then
      if jsonb_typeof(p_rubric_scores)<>'array' then raise exception 'Invalid rubric scores'; end if;
      for v_score in select value from jsonb_array_elements(p_rubric_scores)
      loop
        select c.max_points into v_points from public.academic_activity_rubric_criteria c
          where c.id=(v_score->>'criterion_id')::uuid and c.activity_id=v_submission.activity_id;
        if not found then raise exception 'Rubric criterion not found'; end if;
        if (v_score->>'awarded_points') is null then raise exception 'Missing awarded points'; end if;
        if (v_score->>'awarded_points')::numeric<0 or (v_score->>'awarded_points')::numeric>v_points then
          raise exception 'Rubric score exceeds criterion limit';
        end if;
        v_sum:=v_sum+(v_score->>'awarded_points')::numeric;
        v_received:=v_received+1;
      end loop;
      if v_received<>v_expected then raise exception 'Score every rubric criterion exactly once'; end if;
      if exists (
        select 1 from (
          select (value->>'criterion_id')::uuid criterion_id,count(*) amount
          from jsonb_array_elements(p_rubric_scores) group by 1 having count(*)>1
        ) duplicate_scores
      ) then raise exception 'Duplicate rubric criterion score'; end if;
      if p_awarded_points is distinct from v_sum then raise exception 'Total score must equal the rubric sum'; end if;
    elsif coalesce(jsonb_array_length(p_rubric_scores),0)>0 then
      raise exception 'This activity has no rubric criteria';
    end if;
    if p_awarded_points is null or p_awarded_points<0 or p_awarded_points>v_activity.total_points then
      raise exception 'Score outside activity range';
    end if;
  end if;
  update public.academic_activity_submissions
    set status=p_status,
      awarded_points=case when p_status='graded' then p_awarded_points else null end,
      feedback=nullif(btrim(p_feedback),''),
      rubric_scores=case when p_status='graded' then coalesce(p_rubric_scores,'[]'::jsonb) else '[]'::jsonb end,
      reviewed_by=(select auth.uid()),reviewed_at=now(),updated_at=now()
    where id=p_submission_id;
end;
$function$;
