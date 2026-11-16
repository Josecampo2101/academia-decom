create or replace function public.publish_academic_assessment(p_assessment_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare a public.academic_assessments%rowtype; total integer; invalid integer;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 select * into a from public.academic_assessments where id=p_assessment_id for update;
 if not found or not private.can_manage_assessment_course(a.course_id,a.district_id) then raise exception 'You cannot manage this assessment'; end if;
 if a.status<>'draft' then raise exception 'Only draft assessments can be published'; end if;
 select count(*) into total from public.academic_assessment_questions q
 join private.academic_assessment_answer_keys k on k.question_id=q.id where q.assessment_id=p_assessment_id;
 if total<1 then raise exception 'An assessment needs at least one question with an answer key'; end if;
 select count(*) into invalid from public.academic_assessment_questions q
 join private.academic_assessment_answer_keys k on k.question_id=q.id
 where q.assessment_id=p_assessment_id and (
  jsonb_typeof(q.options)<>'array'
  or exists(select 1 from jsonb_array_elements(q.options) o where jsonb_typeof(o)<>'string')
  or (q.question_type in ('single_choice','true_false') and (
    jsonb_typeof(k.answer_key)<>'string'
    or not exists(select 1 from jsonb_array_elements_text(q.options) o(value) where o.value=k.answer_key#>>'{}')))
  or (q.question_type='true_false' and (jsonb_array_length(q.options)<>2 or not(q.options @> '["Verdadero","Falso"]'::jsonb)))
  or (q.question_type='multiple_choice' and (
    jsonb_typeof(k.answer_key)<>'array' or jsonb_array_length(k.answer_key)=0
    or exists(select 1 from jsonb_array_elements(k.answer_key) v where jsonb_typeof(v)<>'string')
    or (select count(*) from jsonb_array_elements_text(k.answer_key))<>(select count(distinct value) from jsonb_array_elements_text(k.answer_key) x(value))
    or exists(select 1 from jsonb_array_elements_text(k.answer_key) v(value)
      where not exists(select 1 from jsonb_array_elements_text(q.options) o(value) where o.value=v.value))))
  or (q.question_type='short_answer' and (
    (jsonb_typeof(k.answer_key)='string' and length(trim(k.answer_key#>>'{}'))=0)
    or (jsonb_typeof(k.answer_key)='array' and (jsonb_array_length(k.answer_key)=0
      or exists(select 1 from jsonb_array_elements(k.answer_key) v where jsonb_typeof(v)<>'string' or length(trim(v#>>'{}'))=0)))
    or jsonb_typeof(k.answer_key) not in ('string','array')))
 );
 if invalid>0 then raise exception 'Question options or answer keys are invalid or inconsistent'; end if;
 if a.assessment_type='final' and exists(select 1 from public.academic_assessments x where x.course_id=a.course_id
  and x.assessment_type='final' and x.status='published' and x.id<>a.id)
 then raise exception 'This course already has a published final assessment'; end if;
 update public.academic_assessments set status='published',published_at=now(),updated_at=now() where id=p_assessment_id;
 return p_assessment_id;
end;
$function$;
revoke all on function public.publish_academic_assessment(uuid) from public,anon;
grant execute on function public.publish_academic_assessment(uuid) to authenticated;
