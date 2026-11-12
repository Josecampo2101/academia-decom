drop policy if exists academic_assessments_manage on public.academic_assessments;
drop policy if exists academic_assessment_questions_manage on public.academic_assessment_questions;

drop policy if exists academic_assessments_select_scope on public.academic_assessments;
create policy academic_assessments_select_scope
on public.academic_assessments for select to authenticated
using (
  private.can_manage_assessment(district_id)
  or (
    status = 'published'
    and exists (
      select 1 from public.course_enrollments e
      where e.course_id = academic_assessments.course_id
        and e.district_id = academic_assessments.district_id
        and e.user_id = (select auth.uid())
        and e.status in ('active','completed')
    )
  )
);

create policy academic_assessments_insert_manager
on public.academic_assessments for insert to authenticated
with check (private.can_manage_assessment(district_id));

create policy academic_assessments_update_manager
on public.academic_assessments for update to authenticated
using (private.can_manage_assessment(district_id))
with check (private.can_manage_assessment(district_id));

create policy academic_assessments_delete_manager
on public.academic_assessments for delete to authenticated
using (private.can_manage_assessment(district_id));

drop policy if exists academic_assessment_questions_select on public.academic_assessment_questions;
create policy academic_assessment_questions_select
on public.academic_assessment_questions for select to authenticated
using (
  private.can_manage_assessment(district_id)
  or exists (
    select 1 from public.academic_assessments a
    join public.course_enrollments e
      on e.course_id = a.course_id and e.district_id = a.district_id
    where a.id = academic_assessment_questions.assessment_id
      and a.status = 'published'
      and e.user_id = (select auth.uid())
      and e.status in ('active','completed')
  )
);

create policy academic_assessment_questions_insert_manager
on public.academic_assessment_questions for insert to authenticated
with check (private.can_manage_assessment(district_id));

create policy academic_assessment_questions_update_manager
on public.academic_assessment_questions for update to authenticated
using (private.can_manage_assessment(district_id))
with check (private.can_manage_assessment(district_id));

create policy academic_assessment_questions_delete_manager
on public.academic_assessment_questions for delete to authenticated
using (private.can_manage_assessment(district_id));

create index if not exists academic_assessments_course_district_fk_idx on public.academic_assessments(course_id,district_id);
create index if not exists academic_assessments_created_by_idx on public.academic_assessments(created_by);
create index if not exists academic_assessments_district_fk_idx on public.academic_assessments(district_id);
create index if not exists academic_assessments_lesson_district_fk_idx on public.academic_assessments(lesson_id,district_id);
create index if not exists academic_assessment_questions_assessment_district_fk_idx on public.academic_assessment_questions(assessment_id,district_id);
create index if not exists academic_assessment_questions_district_fk_idx on public.academic_assessment_questions(district_id);
create index if not exists academic_assessment_attempts_assessment_district_fk_idx on public.academic_assessment_attempts(assessment_id,district_id);
create index if not exists academic_assessment_attempts_district_fk_idx on public.academic_assessment_attempts(district_id);
create index if not exists academic_assessment_responses_question_fk_idx on public.academic_assessment_responses(question_id);
create index if not exists academic_assessment_responses_reviewed_by_idx on public.academic_assessment_responses(reviewed_by);
create index if not exists academic_assessment_answer_keys_question_fk_idx on private.academic_assessment_answer_keys(question_id,assessment_id,district_id);

drop index if exists public.academic_assessment_questions_assessment_idx;
drop index if exists public.academic_assessment_responses_attempt_idx;
