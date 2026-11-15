-- Require active profiles for assessment attempts and prevent self-review.
-- These guards complement the existing enrollment and course-scope checks.

create or replace function public.start_academic_assessment_attempt(p_assessment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  exam public.academic_assessments%rowtype;
  enr public.course_enrollments%rowtype;
  attempt public.academic_assessment_attempts%rowtype;
  next_number integer;
  expired_current boolean := false;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.id = uid and p.status = 'active'
  for share;

  if not found then
    raise exception 'An active profile is required' using errcode = '42501';
  end if;

  select * into exam
  from public.academic_assessments
  where id = p_assessment_id and status = 'published'
  for share;

  if not found then
    raise exception 'Published assessment not found';
  end if;

  select * into enr
  from public.course_enrollments
  where user_id = uid
    and course_id = exam.course_id
    and district_id = exam.district_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'An active course enrollment is required';
  end if;

  if exam.assessment_type = 'final' and exists (
    select 1
    from public.lessons l
    join public.course_modules cm on cm.id = l.module_id
    left join public.lesson_progress lp
      on lp.lesson_id = l.id and lp.enrollment_id = enr.id
    where cm.course_id = exam.course_id
      and l.district_id = exam.district_id
      and cm.status = 'published'
      and l.status = 'published'
      and (lp.id is null or lp.status <> 'completed')
  ) then
    raise exception 'Complete all published lessons before taking the final assessment';
  end if;

  select * into attempt
  from public.academic_assessment_attempts
  where assessment_id = p_assessment_id
    and enrollment_id = enr.id
    and status = 'in_progress'
  for update;

  if found then
    if attempt.expires_at is not null and attempt.expires_at <= pg_catalog.now() then
      update public.academic_assessment_attempts
      set status = 'expired'
      where id = attempt.id;
      expired_current := true;
    else
      return pg_catalog.jsonb_build_object(
        'attempt_id', attempt.id,
        'attempt_number', attempt.attempt_number,
        'started_at', attempt.started_at,
        'expires_at', attempt.expires_at
      );
    end if;
  end if;

  select coalesce(max(attempt_number), 0) + 1
  into next_number
  from public.academic_assessment_attempts
  where assessment_id = p_assessment_id
    and enrollment_id = enr.id;

  if exam.max_attempts is not null and next_number > exam.max_attempts then
    if expired_current then
      return pg_catalog.jsonb_build_object(
        'status', 'max_attempts_reached',
        'attempt_number', attempt.attempt_number
      );
    end if;
    raise exception 'Maximum attempts reached';
  end if;

  insert into public.academic_assessment_attempts (
    assessment_id, enrollment_id, district_id, user_id,
    attempt_number, total_possible, status, started_at, expires_at
  )
  values (
    p_assessment_id, enr.id, exam.district_id, uid,
    next_number, 1, 'in_progress', pg_catalog.now(),
    case
      when exam.time_limit_minutes is null then null
      else pg_catalog.now() + pg_catalog.make_interval(mins => exam.time_limit_minutes)
    end
  )
  returning * into attempt;

  return pg_catalog.jsonb_build_object(
    'attempt_id', attempt.id,
    'attempt_number', attempt.attempt_number,
    'started_at', attempt.started_at,
    'expires_at', attempt.expires_at
  );
end;
$function$;

create or replace function public.submit_academic_assessment(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  attempt public.academic_assessment_attempts%rowtype;
  exam public.academic_assessments%rowtype;
  enr public.course_enrollments%rowtype;
  q record;
  ans jsonb;
  key_value jsonb;
  correct boolean;
  earned numeric(8,2) := 0;
  possible numeric(8,2) := 0;
  pending integer := 0;
  score numeric(5,2);
  did_pass boolean;
  total integer;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
  from public.profiles p
  where p.id = uid and p.status = 'active'
  for share;

  if not found then
    raise exception 'An active profile is required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Answers must be a JSON object';
  end if;

  select * into attempt
  from public.academic_assessment_attempts
  where id = p_attempt_id and user_id = uid
  for update;

  if not found then
    raise exception 'Assessment attempt not found';
  end if;

  if attempt.status <> 'in_progress' then
    raise exception 'This assessment attempt is no longer active';
  end if;

  if attempt.expires_at is not null and attempt.expires_at <= pg_catalog.now() then
    update public.academic_assessment_attempts
    set status = 'expired'
    where id = attempt.id;

    return pg_catalog.jsonb_build_object(
      'attempt_id', attempt.id,
      'attempt_number', attempt.attempt_number,
      'status', 'expired',
      'objective_earned', 0,
      'total_possible', 0,
      'manual_pending', 0,
      'score_percent', null,
      'passed', null
    );
  end if;

  select * into exam
  from public.academic_assessments
  where id = attempt.assessment_id and status = 'published';

  if not found then
    raise exception 'Published assessment not found';
  end if;

  select * into enr
  from public.course_enrollments
  where id = attempt.enrollment_id
    and user_id = uid
    and status = 'active'
  for update;

  if not found then
    raise exception 'An active course enrollment is required';
  end if;

  select count(*) into total
  from public.academic_assessment_questions
  where assessment_id = exam.id;

  if total = 0 then
    raise exception 'Assessment has no questions';
  end if;

  if (select count(*) from jsonb_object_keys(p_answers)) <> total then
    raise exception 'Answers must contain exactly one entry for every question';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_answers) k(question_id)
    where not exists (
      select 1
      from public.academic_assessment_questions q
      where q.assessment_id = exam.id and q.id::text = k.question_id
    )
  ) then
    raise exception 'Answers contain unknown question identifiers';
  end if;

  for q in
    select *
    from public.academic_assessment_questions
    where assessment_id = exam.id
    order by sort_order
  loop
    ans := p_answers -> q.id::text;

    select answer_key into key_value
    from private.academic_assessment_answer_keys
    where question_id = q.id;

    if key_value is null then
      raise exception 'Question is missing an answer key';
    end if;

    if q.question_type in ('single_choice', 'true_false') then
      if jsonb_typeof(ans) is distinct from 'string'
        or not exists (
          select 1
          from jsonb_array_elements_text(q.options) o(value)
          where o.value = ans #>> '{}'
        ) then
        raise exception 'Invalid answer option for question %', q.id;
      end if;

      correct := ans = key_value;
      possible := possible + q.points;
      if correct then earned := earned + q.points; end if;

      insert into public.academic_assessment_responses (
        attempt_id, question_id, answer, is_correct, awarded_points
      )
      values (
        attempt.id, q.id, ans, correct,
        case when correct then q.points else 0 end
      );

    elsif q.question_type = 'multiple_choice' then
      if jsonb_typeof(ans) is distinct from 'array'
        or jsonb_array_length(ans) = 0
        or exists (
          select 1 from jsonb_array_elements(ans) v
          where jsonb_typeof(v) <> 'string'
        )
        or (select count(*) from jsonb_array_elements_text(ans))
          <> (select count(distinct value) from jsonb_array_elements_text(ans) x(value))
        or exists (
          select 1
          from jsonb_array_elements_text(ans) v(value)
          where not exists (
            select 1
            from jsonb_array_elements_text(q.options) o(value)
            where o.value = v.value
          )
        ) then
        raise exception 'Invalid multiple-choice answer for question %', q.id;
      end if;

      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
      into ans
      from jsonb_array_elements_text(ans) x(value);

      correct := ans = (
        select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
        from jsonb_array_elements_text(key_value) x(value)
      );

      possible := possible + q.points;
      if correct then earned := earned + q.points; end if;

      insert into public.academic_assessment_responses (
        attempt_id, question_id, answer, is_correct, awarded_points
      )
      values (
        attempt.id, q.id, ans, correct,
        case when correct then q.points else 0 end
      );

    elsif q.question_type = 'short_answer' then
      if jsonb_typeof(ans) <> 'string'
        or length(pg_catalog.btrim(ans #>> '{}')) = 0
        or length(ans #>> '{}') > 4000 then
        raise exception 'Invalid short answer for question %', q.id;
      end if;

      pending := pending + 1;

      insert into public.academic_assessment_responses (
        attempt_id, question_id, answer
      )
      values (attempt.id, q.id, ans);

    else
      raise exception 'Unsupported question type';
    end if;
  end loop;

  select coalesce(sum(points), 0)
  into possible
  from public.academic_assessment_questions
  where assessment_id = exam.id;

  if pending > 0 then
    update public.academic_assessment_attempts
    set status = 'review_pending',
        objective_earned = earned,
        total_possible = possible,
        manual_pending = pending,
        submitted_at = pg_catalog.now()
    where id = attempt.id;
  else
    score := round((earned / nullif(possible, 0)) * 100, 2);
    did_pass := score >= exam.passing_score;

    update public.academic_assessment_attempts
    set status = 'graded',
        objective_earned = earned,
        total_possible = possible,
        manual_pending = 0,
        score_percent = score,
        passed = did_pass,
        graded_at = pg_catalog.now(),
        submitted_at = pg_catalog.now()
    where id = attempt.id;

    if exam.assessment_type = 'final' and did_pass then
      perform private.complete_course_and_unlock_next(enr.id);
    end if;
  end if;

  return pg_catalog.jsonb_build_object(
    'attempt_id', attempt.id,
    'attempt_number', attempt.attempt_number,
    'status', case when pending > 0 then 'review_pending' else 'graded' end,
    'objective_earned', earned,
    'total_possible', possible,
    'manual_pending', pending,
    'score_percent', score,
    'passed', did_pass
  );
end;
$function$;

create or replace function public.review_academic_assessment_response(
  p_response_id uuid,
  p_awarded_points numeric,
  p_feedback text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := (select auth.uid());
  r public.academic_assessment_responses%rowtype;
  a public.academic_assessment_attempts%rowtype;
  exam public.academic_assessments%rowtype;
  q public.academic_assessment_questions%rowtype;
begin
  if uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into r
  from public.academic_assessment_responses x
  where x.id = p_response_id
  for update;

  if not found then
    raise exception 'Response not found';
  end if;

  select * into a
  from public.academic_assessment_attempts
  where id = r.attempt_id
  for update;

  if not found then
    raise exception 'Assessment attempt not found';
  end if;

  if a.user_id = uid then
    raise exception 'You cannot review your own assessment';
  end if;

  select * into exam
  from public.academic_assessments
  where id = a.assessment_id and district_id = a.district_id;

  if not found then
    raise exception 'Assessment not found';
  end if;

  select * into q
  from public.academic_assessment_questions
  where id = r.question_id and assessment_id = a.assessment_id;

  if not found
    or not private.can_manage_assessment_course(exam.course_id, exam.district_id) then
    raise exception 'You cannot review this assessment';
  end if;

  if a.status <> 'review_pending' or r.awarded_points is not null then
    raise exception 'Response is not pending review';
  end if;

  if p_awarded_points is null
    or p_awarded_points < 0
    or p_awarded_points > q.points
    or p_feedback is null
    or length(pg_catalog.btrim(p_feedback)) = 0
    or length(p_feedback) > 2000 then
    raise exception 'Invalid score or feedback';
  end if;

  update public.academic_assessment_responses
  set awarded_points = p_awarded_points,
      is_correct = (p_awarded_points = q.points),
      feedback = pg_catalog.btrim(p_feedback),
      reviewed_by = uid,
      reviewed_at = pg_catalog.now()
  where id = p_response_id;

  perform private.finalize_academic_assessment_attempt(a.id);

  select * into a
  from public.academic_assessment_attempts
  where id = a.id;

  return pg_catalog.jsonb_build_object(
    'attempt_id', a.id,
    'status', a.status,
    'score_percent', a.score_percent,
    'passed', a.passed,
    'manual_pending', a.manual_pending
  );
end;
$function$;
