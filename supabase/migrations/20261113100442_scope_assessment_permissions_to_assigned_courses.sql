-- Restrict assessment authoring and grading to assigned courses.
create or replace function private.can_manage_assessment(p_district_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.can_manage_academic_catalog(p_district_id); $$;

create or replace function private.can_manage_assessment_course(p_course_id uuid,p_district_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.courses c
 where c.id=p_course_id and c.district_id=p_district_id
 and (private.can_manage_academic_catalog(p_district_id) or private.can_manage_course_resources(c.id)));
$$;
revoke all on function private.can_manage_assessment_course(uuid,uuid) from public,anon;
grant execute on function private.can_manage_assessment_course(uuid,uuid) to authenticated;

drop policy if exists academic_assessments_select_scope on public.academic_assessments;
create policy academic_assessments_select_scope on public.academic_assessments for select to authenticated
using (private.can_manage_assessment_course(course_id,district_id) or
(status='published' and exists(select 1 from public.course_enrollments e
 where e.course_id=academic_assessments.course_id and e.district_id=academic_assessments.district_id
 and e.user_id=(select auth.uid()) and e.status in ('active','completed'))));

drop policy if exists academic_assessments_insert_manager on public.academic_assessments;
create policy academic_assessments_insert_manager on public.academic_assessments for insert to authenticated
with check (private.can_manage_assessment_course(course_id,district_id)
 and created_by=(select auth.uid()) and status='draft');

drop policy if exists academic_assessments_update_manager on public.academic_assessments;
create policy academic_assessments_update_manager on public.academic_assessments for update to authenticated
using(private.can_manage_assessment_course(course_id,district_id))
with check(private.can_manage_assessment_course(course_id,district_id));

drop policy if exists academic_assessments_delete_manager on public.academic_assessments;
create policy academic_assessments_delete_manager on public.academic_assessments for delete to authenticated
using(private.can_manage_assessment_course(course_id,district_id) and status='draft');

drop policy if exists academic_assessment_questions_select on public.academic_assessment_questions;
create policy academic_assessment_questions_select on public.academic_assessment_questions for select to authenticated
using(exists(select 1 from public.academic_assessments a
 where a.id=academic_assessment_questions.assessment_id and a.district_id=academic_assessment_questions.district_id
 and (private.can_manage_assessment_course(a.course_id,a.district_id) or
 (a.status='published' and exists(select 1 from public.course_enrollments e
 where e.course_id=a.course_id and e.district_id=a.district_id and e.user_id=(select auth.uid())
 and e.status in ('active','completed'))))));

drop policy if exists academic_assessment_questions_insert_manager on public.academic_assessment_questions;
create policy academic_assessment_questions_insert_manager on public.academic_assessment_questions for insert to authenticated
with check(exists(select 1 from public.academic_assessments a
 where a.id=academic_assessment_questions.assessment_id and a.district_id=academic_assessment_questions.district_id
 and a.status='draft' and private.can_manage_assessment_course(a.course_id,a.district_id)));

drop policy if exists academic_assessment_questions_update_manager on public.academic_assessment_questions;
create policy academic_assessment_questions_update_manager on public.academic_assessment_questions for update to authenticated
using(exists(select 1 from public.academic_assessments a
 where a.id=academic_assessment_questions.assessment_id and a.district_id=academic_assessment_questions.district_id
 and a.status='draft' and private.can_manage_assessment_course(a.course_id,a.district_id)))
with check(exists(select 1 from public.academic_assessments a
 where a.id=academic_assessment_questions.assessment_id and a.district_id=academic_assessment_questions.district_id
 and a.status='draft' and private.can_manage_assessment_course(a.course_id,a.district_id)));

drop policy if exists academic_assessment_questions_delete_manager on public.academic_assessment_questions;
create policy academic_assessment_questions_delete_manager on public.academic_assessment_questions for delete to authenticated
using(exists(select 1 from public.academic_assessments a
 where a.id=academic_assessment_questions.assessment_id and a.district_id=academic_assessment_questions.district_id
 and a.status='draft' and private.can_manage_assessment_course(a.course_id,a.district_id)));

drop policy if exists academic_assessment_attempts_select on public.academic_assessment_attempts;
create policy academic_assessment_attempts_select on public.academic_assessment_attempts for select to authenticated
using(user_id=(select auth.uid()) or exists(select 1 from public.academic_assessments a
 where a.id=academic_assessment_attempts.assessment_id and a.district_id=academic_assessment_attempts.district_id
 and private.can_manage_assessment_course(a.course_id,a.district_id)));

drop policy if exists academic_assessment_responses_select on public.academic_assessment_responses;
create policy academic_assessment_responses_select on public.academic_assessment_responses for select to authenticated
using(exists(select 1 from public.academic_assessment_attempts t
 join public.academic_assessments a on a.id=t.assessment_id and a.district_id=t.district_id
 where t.id=academic_assessment_responses.attempt_id
 and (t.user_id=(select auth.uid()) or private.can_manage_assessment_course(a.course_id,a.district_id))));

create or replace function public.save_academic_assessment_question(
 p_assessment_id uuid,p_question_id uuid,p_question_type text,p_prompt text,
 p_options jsonb,p_answer_key jsonb,p_points integer,p_sort_order integer)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare a public.academic_assessments%rowtype; qid uuid;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into a from public.academic_assessments where id=p_assessment_id for update;
 if not found or not private.can_manage_assessment_course(a.course_id,a.district_id)
 then raise exception 'You cannot manage this assessment'; end if;
 if a.status<>'draft' then raise exception 'Only draft assessments can be edited'; end if;
 if p_question_type not in ('single_choice','multiple_choice','true_false','short_answer')
 or p_points not between 1 and 100 or length(trim(coalesce(p_prompt,''))) not between 2 and 4000
 or jsonb_typeof(coalesce(p_options,'[]'::jsonb))<>'array' or p_answer_key is null
 then raise exception 'Invalid assessment question'; end if;
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
end; $$;

create or replace function public.publish_academic_assessment(p_assessment_id uuid)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare a public.academic_assessments%rowtype; total integer; invalid integer;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into a from public.academic_assessments where id=p_assessment_id for update;
 if not found or not private.can_manage_assessment_course(a.course_id,a.district_id)
 then raise exception 'You cannot manage this assessment'; end if;
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
end; $$;

create or replace function public.review_academic_assessment_response(
 p_response_id uuid,p_awarded_points numeric,p_feedback text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare uid uuid:=(select auth.uid()); r public.academic_assessment_responses%rowtype;
 a public.academic_assessment_attempts%rowtype; exam public.academic_assessments%rowtype;
 q public.academic_assessment_questions%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into r from public.academic_assessment_responses x where x.id=p_response_id for update;
 if not found then raise exception 'Response not found'; end if;
 select * into a from public.academic_assessment_attempts where id=r.attempt_id for update;
 select * into exam from public.academic_assessments where id=a.assessment_id and district_id=a.district_id;
 select * into q from public.academic_assessment_questions where id=r.question_id and assessment_id=a.assessment_id;
 if not found or not private.can_manage_assessment_course(exam.course_id,exam.district_id)
 then raise exception 'You cannot review this assessment'; end if;
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
end; $$;

revoke all on function public.save_academic_assessment_question(uuid,uuid,text,text,jsonb,jsonb,integer,integer) from public,anon;
grant execute on function public.save_academic_assessment_question(uuid,uuid,text,text,jsonb,jsonb,integer,integer) to authenticated;
revoke all on function public.publish_academic_assessment(uuid) from public,anon;
grant execute on function public.publish_academic_assessment(uuid) to authenticated;
revoke all on function public.review_academic_assessment_response(uuid,numeric,text) from public,anon;
grant execute on function public.review_academic_assessment_response(uuid,numeric,text) to authenticated;
