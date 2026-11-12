drop policy if exists academic_assessments_select_scope on public.academic_assessments;
create policy academic_assessments_select_scope
on public.academic_assessments for select to authenticated
using (
  private.can_manage_academic_catalog(district_id)
  or (
    status = 'published'
    and exists (
      select 1
      from public.course_enrollments e
      where e.course_id = academic_assessments.course_id
        and e.district_id = academic_assessments.district_id
        and e.user_id = (select auth.uid())
        and e.status in ('active', 'completed')
    )
  )
);

drop policy if exists academic_assessment_questions_select on public.academic_assessment_questions;
create policy academic_assessment_questions_select
on public.academic_assessment_questions for select to authenticated
using (
  private.can_manage_assessment(district_id)
  or exists (
    select 1
    from public.academic_assessments a
    join public.course_enrollments e
      on e.course_id = a.course_id
     and e.district_id = a.district_id
    where a.id = academic_assessment_questions.assessment_id
      and a.status = 'published'
      and e.user_id = (select auth.uid())
      and e.status in ('active', 'completed')
  )
);
