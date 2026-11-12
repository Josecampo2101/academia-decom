create schema if not exists private;

create table public.academic_assessments (
 id uuid primary key default gen_random_uuid(),
 district_id uuid not null references public.districts(id),
 course_id uuid not null,
 lesson_id uuid,
 title text not null check(length(trim(title)) between 2 and 180),
 instructions text,
 assessment_type text not null check(assessment_type in ('lesson','practice','final')),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 passing_score numeric(5,2) not null default 70 check(passing_score between 0 and 100),
 max_attempts integer check(max_attempts is null or max_attempts between 1 and 20),
 time_limit_minutes integer check(time_limit_minutes is null or time_limit_minutes between 1 and 360),
 created_by uuid references auth.users(id),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint academic_assessments_course_district_fk foreign key(course_id,district_id) references public.courses(id,district_id),
 constraint academic_assessments_lesson_district_fk foreign key(lesson_id,district_id) references public.lessons(id,district_id),
 unique(id,district_id)
);

create table public.academic_assessment_questions (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null,
 district_id uuid not null references public.districts(id),
 question_type text not null check(question_type in ('single_choice','multiple_choice','true_false','short_answer')),
 prompt text not null check(length(trim(prompt)) between 2 and 4000),
 options jsonb not null default '[]'::jsonb check(jsonb_typeof(options)='array'),
 points integer not null default 1 check(points between 1 and 100),
 sort_order integer not null default 0 check(sort_order>=0),
 created_at timestamptz not null default now(),
 constraint academic_assessment_questions_assessment_fk foreign key(assessment_id,district_id) references public.academic_assessments(id,district_id),
 unique(assessment_id,sort_order),
 unique(id,assessment_id,district_id)
);

create table private.academic_assessment_answer_keys (
 question_id uuid primary key,
 assessment_id uuid not null,
 district_id uuid not null,
 answer_key jsonb not null,
 updated_at timestamptz not null default now(),
 constraint academic_assessment_answer_keys_question_fk foreign key(question_id,assessment_id,district_id)
 references public.academic_assessment_questions(id,assessment_id,district_id)
);

create table public.academic_assessment_attempts (
 id uuid primary key default gen_random_uuid(),
 assessment_id uuid not null references public.academic_assessments(id),
 enrollment_id uuid not null references public.course_enrollments(id),
 district_id uuid not null references public.districts(id),
 user_id uuid not null references auth.users(id),
 attempt_number integer not null check(attempt_number>0),
 status text not null default 'submitted' check(status in ('submitted','review_pending','graded')),
 objective_earned numeric(8,2) not null default 0 check(objective_earned>=0),
 total_possible numeric(8,2) not null check(total_possible>0),
 manual_pending integer not null default 0 check(manual_pending>=0),
 score_percent numeric(5,2) check(score_percent between 0 and 100),
 passed boolean,
 submitted_at timestamptz not null default now(),
 graded_at timestamptz,
 created_at timestamptz not null default now(),
 constraint academic_assessment_attempts_assessment_district_fk foreign key(assessment_id,district_id)
 references public.academic_assessments(id,district_id),
 unique(assessment_id,enrollment_id,attempt_number)
);

create table public.academic_assessment_responses (
 id uuid primary key default gen_random_uuid(),
 attempt_id uuid not null references public.academic_assessment_attempts(id),
 question_id uuid not null references public.academic_assessment_questions(id),
 answer jsonb not null,
 is_correct boolean,
 awarded_points numeric(8,2),
 feedback text check(feedback is null or length(feedback)<=2000),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(attempt_id,question_id)
);

create index academic_assessments_course_idx on public.academic_assessments(course_id,status);
create index academic_assessment_questions_assessment_idx on public.academic_assessment_questions(assessment_id,sort_order);
create index academic_assessment_attempts_user_idx on public.academic_assessment_attempts(user_id,assessment_id,submitted_at desc);
create index academic_assessment_attempts_enrollment_idx on public.academic_assessment_attempts(enrollment_id,assessment_id);
create index academic_assessment_responses_attempt_idx on public.academic_assessment_responses(attempt_id);
create unique index if not exists course_enrollments_user_course_uidx on public.course_enrollments(user_id,course_id);

alter table public.academic_assessments enable row level security;
alter table public.academic_assessment_questions enable row level security;
alter table public.academic_assessment_attempts enable row level security;
alter table public.academic_assessment_responses enable row level security;
alter table private.academic_assessment_answer_keys enable row level security;

create or replace function private.can_manage_assessment(p_district_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select private.can_manage_academic_catalog(p_district_id)
 or exists(select 1 from public.profiles p
 join public.user_role_assignments ura on ura.user_id=p.id
 join public.roles r on r.id=ura.role_id
 where p.id=(select auth.uid()) and p.status='active'
 and ura.district_id=p_district_id and ura.congregation_id is null and r.role_key='tutor');
$function$;

create or replace function private.complete_course_and_unlock_next(p_enrollment_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare e public.course_enrollments%rowtype; next_id uuid; next_enrollment uuid;
begin
 select * into e from public.course_enrollments where id=p_enrollment_id for update;
 if not found then raise exception 'Enrollment not found'; end if;
 update public.course_enrollments set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
 where id=e.id and status<>'withdrawn';
 select n.id into next_id from public.courses c
 join public.courses n on n.program_id=c.program_id and n.district_id=c.district_id
 and n.sort_order>c.sort_order and n.status='published'
 join public.academic_programs p on p.id=n.program_id and p.district_id=n.district_id and p.status='published'
 where c.id=e.course_id and c.district_id=e.district_id order by n.sort_order limit 1;
 if next_id is not null then
  insert into public.course_enrollments(district_id,course_id,user_id,status)
  values(e.district_id,next_id,e.user_id,'active')
  on conflict(user_id,course_id) do nothing returning id into next_enrollment;
  if next_enrollment is null then
   select id into next_enrollment from public.course_enrollments
   where user_id=e.user_id and course_id=next_id and status<>'withdrawn';
  end if;
 end if;
 return next_enrollment;
end;
$function$;

create policy academic_assessments_select_scope on public.academic_assessments for select to authenticated
using(private.can_manage_academic_catalog(district_id) or (status='published' and exists(
 select 1 from public.course_enrollments e where e.course_id=academic_assessments.course_id
 and e.district_id=academic_assessments.district_id and e.user_id=(select auth.uid()) and e.status='active')));
create policy academic_assessments_manage on public.academic_assessments for all to authenticated
using(private.can_manage_assessment(district_id)) with check(private.can_manage_assessment(district_id));
create policy academic_assessment_questions_select on public.academic_assessment_questions for select to authenticated
using(private.can_manage_assessment(district_id) or exists(
 select 1 from public.academic_assessments a join public.course_enrollments e
 on e.course_id=a.course_id and e.district_id=a.district_id
 where a.id=academic_assessment_questions.assessment_id and a.status='published'
 and e.user_id=(select auth.uid()) and e.status='active'));
create policy academic_assessment_questions_manage on public.academic_assessment_questions for all to authenticated
using(private.can_manage_assessment(district_id)) with check(private.can_manage_assessment(district_id));
create policy academic_assessment_attempts_select on public.academic_assessment_attempts for select to authenticated
using(user_id=(select auth.uid()) or private.can_manage_assessment(district_id));
create policy academic_assessment_responses_select on public.academic_assessment_responses for select to authenticated
using(exists(select 1 from public.academic_assessment_attempts a where a.id=academic_assessment_responses.attempt_id
and (a.user_id=(select auth.uid()) or private.can_manage_assessment(a.district_id))));

revoke all on schema private from anon,authenticated;
grant usage on schema private to authenticated;
revoke all on private.academic_assessment_answer_keys from public,anon,authenticated;
revoke all on public.academic_assessment_attempts,public.academic_assessment_responses from public,anon,authenticated;
revoke all on public.academic_assessments,public.academic_assessment_questions from public,anon,authenticated;
grant select,insert,update,delete on public.academic_assessments,public.academic_assessment_questions to authenticated;
grant select on public.academic_assessment_attempts,public.academic_assessment_responses to authenticated;

create or replace function public.save_academic_assessment_question(
 p_assessment_id uuid,p_question_id uuid,p_question_type text,p_prompt text,p_options jsonb,
 p_answer_key jsonb,p_points integer,p_sort_order integer)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare a public.academic_assessments%rowtype; qid uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into a from public.academic_assessments where id=p_assessment_id for update;
 if not found or not private.can_manage_assessment(a.district_id) then raise exception 'You cannot manage this assessment'; end if;
 if a.status<>'draft' then raise exception 'Only draft assessments can be edited'; end if;
 if p_question_type not in ('single_choice','multiple_choice','true_false','short_answer')
 or p_points not between 1 and 100 or length(trim(coalesce(p_prompt,''))) not between 2 and 4000
 or jsonb_typeof(coalesce(p_options,'[]'::jsonb))<>'array' or p_answer_key is null then
 raise exception 'Invalid assessment question'; end if;
 if p_question_id is null then
  insert into public.academic_assessment_questions(assessment_id,district_id,question_type,prompt,options,points,sort_order)
  values(p_assessment_id,a.district_id,p_question_type,trim(p_prompt),coalesce(p_options,'[]'::jsonb),p_points,p_sort_order)
  returning id into qid;
 else
  update public.academic_assessment_questions set question_type=p_question_type,prompt=trim(p_prompt),
  options=coalesce(p_options,'[]'::jsonb),points=p_points,sort_order=p_sort_order
  where id=p_question_id and assessment_id=p_assessment_id returning id into qid;
  if qid is null then raise exception 'Question not found'; end if;
 end if;
 insert into private.academic_assessment_answer_keys(question_id,assessment_id,district_id,answer_key,updated_at)
 values(qid,p_assessment_id,a.district_id,p_answer_key,now())
 on conflict(question_id) do update set answer_key=excluded.answer_key,updated_at=now();
 return qid;
end;
$function$;

create or replace function public.publish_academic_assessment(p_assessment_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare a public.academic_assessments%rowtype; total integer; invalid integer;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into a from public.academic_assessments where id=p_assessment_id for update;
 if not found or not private.can_manage_assessment(a.district_id) then raise exception 'You cannot manage this assessment'; end if;
 if a.status<>'draft' then raise exception 'Only draft assessments can be published'; end if;
 select count(*) into total from public.academic_assessment_questions q
 join private.academic_assessment_answer_keys k on k.question_id=q.id where q.assessment_id=p_assessment_id;
 if total<1 then raise exception 'An assessment needs at least one question with an answer key'; end if;
 select count(*) into invalid from public.academic_assessment_questions q
 join private.academic_assessment_answer_keys k on k.question_id=q.id where q.assessment_id=p_assessment_id
 and ((q.question_type in ('single_choice','true_false') and jsonb_typeof(k.answer_key)<>'string')
 or (q.question_type='multiple_choice' and jsonb_typeof(k.answer_key)<>'array')
 or (q.question_type='short_answer' and jsonb_typeof(k.answer_key) not in ('string','array')));
 if invalid>0 then raise exception 'Answer keys do not match question types'; end if;
 if a.assessment_type='final' and exists(select 1 from public.academic_assessments x
 where x.course_id=a.course_id and x.assessment_type='final' and x.status='published' and x.id<>a.id)
 then raise exception 'This course already has a published final assessment'; end if;
 update public.academic_assessments set status='published',published_at=now(),updated_at=now() where id=p_assessment_id;
 return p_assessment_id;
end;
$function$;

create or replace function private.finalize_academic_assessment_attempt(p_attempt_id uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare a public.academic_assessment_attempts%rowtype; exam public.academic_assessments%rowtype;
 earned numeric(8,2); possible numeric(8,2); pending integer; score numeric(5,2); did_pass boolean;
begin
 select * into a from public.academic_assessment_attempts where id=p_attempt_id for update;
 select * into exam from public.academic_assessments where id=a.assessment_id;
 select coalesce(sum(coalesce(r.awarded_points,0)),0),coalesce(sum(q.points),0),
 count(*) filter(where r.awarded_points is null)
 into earned,possible,pending from public.academic_assessment_responses r
 join public.academic_assessment_questions q on q.id=r.question_id where r.attempt_id=p_attempt_id;
 if pending>0 then
  update public.academic_assessment_attempts set status='review_pending',objective_earned=earned,
  total_possible=possible,manual_pending=pending,score_percent=null,passed=null where id=p_attempt_id;
  return;
 end if;
 score:=round((earned/nullif(possible,0))*100,2); did_pass:=score>=exam.passing_score;
 update public.academic_assessment_attempts set status='graded',objective_earned=earned,
 total_possible=possible,manual_pending=0,score_percent=score,passed=did_pass,graded_at=now() where id=p_attempt_id;
 if exam.assessment_type='final' and did_pass then perform private.complete_course_and_unlock_next(a.enrollment_id); end if;
end;
$function$;

create or replace function public.submit_academic_assessment(p_assessment_id uuid,p_answers jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare uid uuid:=(select auth.uid()); exam public.academic_assessments%rowtype; enr public.course_enrollments%rowtype;
 attempt_id uuid; attempt_no integer; q record; ans jsonb; key_value jsonb; correct boolean;
 earned numeric(8,2):=0; possible numeric(8,2):=0; pending integer:=0; score numeric(5,2); did_pass boolean; total integer;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_answers)<>'object' then raise exception 'Answers must be a JSON object'; end if;
 select * into exam from public.academic_assessments where id=p_assessment_id and status='published';
 if not found then raise exception 'Published assessment not found'; end if;
 select * into enr from public.course_enrollments where user_id=uid and course_id=exam.course_id
 and district_id=exam.district_id and status='active' for update;
 if not found then raise exception 'An active course enrollment is required'; end if;
 if exam.assessment_type='final' and exists(
  select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id
  left join public.lesson_progress lp on lp.lesson_id=l.id and lp.enrollment_id=enr.id
  where cm.course_id=exam.course_id and l.district_id=exam.district_id
  and cm.status='published' and l.status='published' and (lp.id is null or lp.status<>'completed'))
 then raise exception 'Complete all published lessons before taking the final assessment'; end if;
 select count(*) into total from public.academic_assessment_questions where assessment_id=p_assessment_id;
 if total=0 then raise exception 'Assessment has no questions'; end if;
 if exists(select 1 from jsonb_object_keys(p_answers) as keys(question_id)
 where not exists(select 1 from public.academic_assessment_questions q
 where q.assessment_id=p_assessment_id and q.id::text=keys.question_id))
 then raise exception 'Answers contain unknown question identifiers'; end if;
 if exists(select 1 from public.academic_assessment_questions q where q.assessment_id=p_assessment_id
 and not (p_answers ? q.id::text)) then raise exception 'Every question must have an answer'; end if;
 select coalesce(max(attempt_number),0)+1 into attempt_no from public.academic_assessment_attempts
 where assessment_id=p_assessment_id and enrollment_id=enr.id;
 if exam.max_attempts is not null and attempt_no>exam.max_attempts then raise exception 'Maximum attempts reached'; end if;
 insert into public.academic_assessment_attempts(assessment_id,enrollment_id,district_id,user_id,attempt_number,total_possible)
 values(p_assessment_id,enr.id,exam.district_id,uid,attempt_no,1) returning id into attempt_id;
 for q in select * from public.academic_assessment_questions where assessment_id=p_assessment_id order by sort_order loop
  ans:=p_answers->q.id::text;
  select answer_key into key_value from private.academic_assessment_answer_keys where question_id=q.id;
  if q.question_type='short_answer' then
   pending:=pending+1;
   insert into public.academic_assessment_responses(attempt_id,question_id,answer) values(attempt_id,q.id,ans);
  else
   correct:=ans=key_value; 
   if correct then earned:=earned+q.points; end if;
   insert into public.academic_assessment_responses(attempt_id,question_id,answer,is_correct,awarded_points)
   values(attempt_id,q.id,ans,correct,case when correct then q.points else 0 end);
  end if;
 end loop;
 select sum(points) into possible from public.academic_assessment_questions where assessment_id=p_assessment_id;
 if pending>0 then
  update public.academic_assessment_attempts set status='review_pending',objective_earned=earned,
  total_possible=possible,manual_pending=pending where id=attempt_id;
 else
  score:=round((earned/nullif(possible,0))*100,2); did_pass:=score>=exam.passing_score;
  update public.academic_assessment_attempts set status='graded',objective_earned=earned,
  total_possible=possible,score_percent=score,passed=did_pass,graded_at=now() where id=attempt_id;
  if exam.assessment_type='final' and did_pass then perform private.complete_course_and_unlock_next(enr.id); end if;
 end if;
 return jsonb_build_object('attempt_id',attempt_id,'attempt_number',attempt_no,
 'status',case when pending>0 then 'review_pending' else 'graded' end,'objective_earned',earned,
 'total_possible',possible,'manual_pending',pending,'score_percent',score,'passed',did_pass);
end;
$function$;

create or replace function public.review_academic_assessment_response(p_response_id uuid,p_awarded_points numeric,p_feedback text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare uid uuid:=(select auth.uid()); r public.academic_assessment_responses%rowtype;
 a public.academic_assessment_attempts%rowtype; q public.academic_assessment_questions%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select x.* into r from public.academic_assessment_responses x where x.id=p_response_id for update;
 if not found then raise exception 'Response not found'; end if;
 select * into a from public.academic_assessment_attempts where id=r.attempt_id for update;
 select * into q from public.academic_assessment_questions where id=r.question_id;
 if not private.can_manage_assessment(a.district_id) then raise exception 'You cannot review this assessment'; end if;
 if a.status<>'review_pending' or r.awarded_points is not null then raise exception 'Response is not pending review'; end if;
 if p_awarded_points is null or p_awarded_points<0 or p_awarded_points>q.points
 or p_feedback is null or length(trim(p_feedback))=0 or length(p_feedback)>2000
 then raise exception 'Invalid score or feedback'; end if;
 update public.academic_assessment_responses set awarded_points=p_awarded_points,
 is_correct=(p_awarded_points=q.points),feedback=trim(p_feedback),reviewed_by=uid,reviewed_at=now()
 where id=p_response_id;
 perform private.finalize_academic_assessment_attempt(a.id);
 select * into a from public.academic_assessment_attempts where id=a.id;
 return jsonb_build_object('attempt_id',a.id,'status',a.status,'score_percent',a.score_percent,
 'passed',a.passed,'manual_pending',a.manual_pending);
end;
$function$;

revoke all on function public.save_academic_assessment_question(uuid,uuid,text,text,jsonb,jsonb,integer,integer) from public,anon;
revoke all on function public.publish_academic_assessment(uuid) from public,anon;
revoke all on function public.submit_academic_assessment(uuid,jsonb) from public,anon;
revoke all on function public.review_academic_assessment_response(uuid,numeric,text) from public,anon;
grant execute on function public.save_academic_assessment_question(uuid,uuid,text,text,jsonb,jsonb,integer,integer) to authenticated;
grant execute on function public.publish_academic_assessment(uuid) to authenticated;
grant execute on function public.submit_academic_assessment(uuid,jsonb) to authenticated;
grant execute on function public.review_academic_assessment_response(uuid,numeric,text) to authenticated;
revoke all on function private.complete_course_and_unlock_next(uuid) from public,anon,authenticated;
revoke all on function private.finalize_academic_assessment_attempt(uuid) from public,anon,authenticated;
revoke all on function private.can_manage_assessment(uuid) from public,anon;
