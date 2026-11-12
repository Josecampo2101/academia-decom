
drop policy if exists academic_activity_submissions_insert_draft on public.academic_activity_submissions;
drop policy if exists academic_activity_submissions_delete_draft on public.academic_activity_submissions;
revoke insert,delete,update on public.academic_activity_submissions from authenticated;
grant update(response_text,external_url) on public.academic_activity_submissions to authenticated;

revoke update on public.academic_activity_submission_files from authenticated;
