create or replace function public.start_academic_assessment_attempt(p_assessment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare uid uuid:=(select auth.uid()); exam public.academic_assessments%rowtype; enr public.course_enrollments%rowtype; attempt public.academic_assessment_attempts%rowtype; next_number integer; expired_current boolean:=false;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into exam from public.academic_assessments where id=p_assessment_id and status='published' for share;
 if not found then raise exception 'Published assessment not found'; end if;
 select * into enr from public.course_enrollments where user_id=uid and course_id=exam.course_id and district_id=exam.district_id and status='active' for update;
 if not found then raise exception 'An active course enrollment is required'; end if;
 if exam.assessment_type='final' and exists(
  select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id
  left join public.lesson_progress lp on lp.lesson_id=l.id and lp.enrollment_id=enr.id
  where cm.course_id=exam.course_id and l.district_id=exam.district_id and cm.status='published' and l.status='published'
  and (lp.id is null or lp.status<>'completed')
 ) then raise exception 'Complete all published lessons before taking the final assessment'; end if;
 select * into attempt from public.academic_assessment_attempts where assessment_id=p_assessment_id and enrollment_id=enr.id and status='in_progress' for update;
 if found then
  if attempt.expires_at is not null and attempt.expires_at<=now() then
   update public.academic_assessment_attempts set status='expired' where id=attempt.id;
   expired_current:=true;
  else
   return jsonb_build_object('attempt_id',attempt.id,'attempt_number',attempt.attempt_number,'started_at',attempt.started_at,'expires_at',attempt.expires_at);
  end if;
 end if;
 select coalesce(max(attempt_number),0)+1 into next_number from public.academic_assessment_attempts where assessment_id=p_assessment_id and enrollment_id=enr.id;
 if exam.max_attempts is not null and next_number>exam.max_attempts then
  if expired_current then return jsonb_build_object('status','max_attempts_reached','attempt_number',attempt.attempt_number); end if;
  raise exception 'Maximum attempts reached';
 end if;
 insert into public.academic_assessment_attempts(assessment_id,enrollment_id,district_id,user_id,attempt_number,total_possible,status,started_at,expires_at)
 values(p_assessment_id,enr.id,exam.district_id,uid,next_number,1,'in_progress',now(),case when exam.time_limit_minutes is null then null else now()+make_interval(mins=>exam.time_limit_minutes) end)
 returning * into attempt;
 return jsonb_build_object('attempt_id',attempt.id,'attempt_number',attempt.attempt_number,'started_at',attempt.started_at,'expires_at',attempt.expires_at);
end;
$function$;

revoke all on function public.start_academic_assessment_attempt(uuid) from public,anon;
grant execute on function public.start_academic_assessment_attempt(uuid) to authenticated;
