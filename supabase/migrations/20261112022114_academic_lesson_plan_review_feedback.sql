alter table public.academic_lesson_plans
  add column if not exists review_feedback text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

alter table public.academic_lesson_plans
  drop constraint if exists academic_lesson_plans_status_check;
alter table public.academic_lesson_plans
  add constraint academic_lesson_plans_status_check
  check (status = any (array['draft'::text,'review'::text,'approved'::text,'changes_requested'::text]));

create or replace function private.enforce_academic_lesson_plan_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status in ('approved','changes_requested')
      and not private.can_manage_academic_catalog(new.district_id) then
      raise exception 'Only academic editors or national administrators can decide a review';
    end if;
    if new.review_feedback is not null or new.reviewed_by is not null or new.reviewed_at is not null then
      raise exception 'Review metadata is managed by academic reviewers';
    end if;
    return new;
  end if;

  if (
    new.review_feedback is distinct from old.review_feedback
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or (new.status is distinct from old.status and new.status in ('approved','changes_requested'))
  ) and not private.can_manage_academic_catalog(old.district_id) then
    raise exception 'Only academic editors or national administrators can review lesson plans';
  end if;

  if old.status = 'approved'
    and not private.can_manage_academic_catalog(old.district_id) then
    raise exception 'Approved lesson plans are read-only';
  end if;

  return new;
end;
$function$;

drop trigger if exists academic_lesson_plan_review_guard on public.academic_lesson_plans;
create trigger academic_lesson_plan_review_guard
before insert or update on public.academic_lesson_plans
for each row execute function private.enforce_academic_lesson_plan_review();

grant execute on function private.enforce_academic_lesson_plan_review() to authenticated;
