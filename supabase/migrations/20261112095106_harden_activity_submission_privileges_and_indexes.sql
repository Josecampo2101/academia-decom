
revoke all on public.academic_activities, public.academic_activity_rubric_criteria,
  public.academic_activity_assignments, public.academic_activity_submissions,
  public.academic_activity_submission_files from public, anon;
grant select,insert,update,delete on public.academic_activities,
  public.academic_activity_rubric_criteria,public.academic_activity_assignments,
  public.academic_activity_submission_files to authenticated;
grant select,delete on public.academic_activity_submissions to authenticated;
revoke insert,update on public.academic_activity_submissions from authenticated;
grant update(response_text,external_url) on public.academic_activity_submissions to authenticated;

create index academic_activities_course_district_fk_idx on public.academic_activities(course_id,district_id);
create index academic_activities_module_district_fk_idx on public.academic_activities(module_id,district_id);
create index academic_activities_lesson_district_fk_idx on public.academic_activities(lesson_id,district_id);
create index academic_activities_created_by_fk_idx on public.academic_activities(created_by);
create index academic_activity_assignments_activity_district_fk_idx on public.academic_activity_assignments(activity_id,district_id);
create index academic_activity_assignments_assigned_by_fk_idx on public.academic_activity_assignments(assigned_by);
create index academic_activity_rubric_activity_district_fk_idx on public.academic_activity_rubric_criteria(activity_id,district_id);
create index academic_activity_submissions_assignment_identity_fk_idx on public.academic_activity_submissions(assignment_id,activity_id,enrollment_id,district_id);
create index academic_activity_submissions_reviewed_by_fk_idx on public.academic_activity_submissions(reviewed_by);
create index academic_activity_submission_files_submission_identity_fk_idx on public.academic_activity_submission_files(submission_id,activity_id,district_id,user_id);
create index academic_activity_submission_files_user_fk_idx on public.academic_activity_submission_files(user_id);

create or replace function private.validate_activity_submission_file_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'academic-activity-submissions'
      and o.name = new.storage_path
      and (storage.foldername(o.name))[1] = new.district_id::text
      and (storage.foldername(o.name))[2] = new.user_id::text
      and (storage.foldername(o.name))[3] = new.submission_id::text
  ) then
    raise exception 'Uploaded object not found for this submission';
  end if;
  return new;
end;
$function$;

create trigger academic_activity_submission_file_object_guard
before insert or update on public.academic_activity_submission_files
for each row execute function private.validate_activity_submission_file_object();

create or replace function private.guard_academic_activity_submission_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.assignment_id is distinct from new.assignment_id
     or old.activity_id is distinct from new.activity_id
     or old.enrollment_id is distinct from new.enrollment_id
     or old.district_id is distinct from new.district_id
     or old.user_id is distinct from new.user_id
     or old.attempt_number is distinct from new.attempt_number
     or old.created_at is distinct from new.created_at then
    raise exception 'Submission identity fields are immutable';
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger academic_activity_submission_identity_guard
before update on public.academic_activity_submissions
for each row execute function private.guard_academic_activity_submission_identity();
