create or replace function private.can_manage_lesson_resources_for_lesson(p_lesson_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select exists(select 1 from public.lessons l
 join public.course_modules cm on cm.id=l.module_id and cm.district_id=l.district_id
 join public.courses c on c.id=cm.course_id and c.district_id=cm.district_id
 where l.id=p_lesson_id and private.can_manage_course_resources(c.id));
$function$;
revoke all on function private.can_manage_lesson_resources_for_lesson(uuid) from public,anon;
grant execute on function private.can_manage_lesson_resources_for_lesson(uuid) to authenticated;

create or replace function private.is_active_district_tutor(p_user_id uuid,p_district_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select exists(select 1 from public.profiles p join public.user_role_assignments ura on ura.user_id=p.id join public.roles r on r.id=ura.role_id
 where p.id=p_user_id and p.status='active' and ura.district_id=p_district_id and ura.congregation_id is null and r.role_key='tutor');
$function$;
revoke all on function private.is_active_district_tutor(uuid,uuid) from public,anon;
grant execute on function private.is_active_district_tutor(uuid,uuid) to authenticated;

drop policy "District academic managers assign course tutors" on public.academic_course_tutor_assignments;
create policy "District academic managers assign course tutors" on public.academic_course_tutor_assignments for insert to authenticated
with check (private.can_manage_course_tutor_assignments(district_id) and assigned_by=(select auth.uid()) and private.is_active_district_tutor(tutor_user_id,district_id));

drop policy academic_lesson_plans_delete on public.academic_lesson_plans;
create policy academic_lesson_plans_delete on public.academic_lesson_plans for delete to authenticated using (private.can_manage_lesson_resources_for_lesson(lesson_id) and ((status <> 'approved') or private.can_manage_academic_catalog(district_id)));
drop policy academic_lesson_plans_insert on public.academic_lesson_plans;
create policy academic_lesson_plans_insert on public.academic_lesson_plans for insert to authenticated with check (private.can_manage_lesson_resources_for_lesson(lesson_id) and ((status <> 'approved') or private.can_manage_academic_catalog(district_id)) and exists(select 1 from public.lessons l where l.id=academic_lesson_plans.lesson_id and l.district_id=academic_lesson_plans.district_id and l.status='draft'));
drop policy academic_lesson_plans_select on public.academic_lesson_plans;
create policy academic_lesson_plans_select on public.academic_lesson_plans for select to authenticated using (private.can_manage_lesson_resources_for_lesson(lesson_id) or (status='approved' and private.can_view_academic_catalog(district_id,'published')));
drop policy academic_lesson_plans_update on public.academic_lesson_plans;
create policy academic_lesson_plans_update on public.academic_lesson_plans for update to authenticated using (private.can_manage_lesson_resources_for_lesson(lesson_id)) with check (private.can_manage_lesson_resources_for_lesson(lesson_id) and ((status <> 'approved') or private.can_manage_academic_catalog(district_id)) and exists(select 1 from public.lessons l where l.id=academic_lesson_plans.lesson_id and l.district_id=academic_lesson_plans.district_id and l.status='draft'));

drop policy lesson_materials_delete on public.lesson_materials;
create policy lesson_materials_delete on public.lesson_materials for delete to authenticated using (private.can_manage_lesson_resources_for_lesson(lesson_id) and ((status='draft') or private.can_manage_academic_catalog(district_id)));
drop policy lesson_materials_insert on public.lesson_materials;
create policy lesson_materials_insert on public.lesson_materials for insert to authenticated with check (private.can_manage_lesson_resources_for_lesson(lesson_id) and status='draft' and exists(select 1 from public.lessons l where l.id=lesson_materials.lesson_id and l.district_id=lesson_materials.district_id and l.status='draft'));
drop policy lesson_materials_select on public.lesson_materials;
create policy lesson_materials_select on public.lesson_materials for select to authenticated using (private.can_manage_lesson_resources_for_lesson(lesson_id) or (status='published' and private.can_view_academic_catalog(district_id,'published') and exists(select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id join public.courses c on c.id=cm.course_id join public.academic_programs p on p.id=c.program_id where l.id=lesson_materials.lesson_id and l.district_id=lesson_materials.district_id and l.status='published' and cm.status='published' and c.status='published' and p.status='published')));
drop policy lesson_materials_update on public.lesson_materials;
create policy lesson_materials_update on public.lesson_materials for update to authenticated using (private.can_manage_lesson_resources_for_lesson(lesson_id)) with check (private.can_manage_lesson_resources_for_lesson(lesson_id) and (((status in ('draft','archived')) and exists(select 1 from public.lessons l where l.id=lesson_materials.lesson_id and l.district_id=lesson_materials.district_id and l.status='draft')) or (status='published' and private.can_manage_academic_catalog(district_id) and exists(select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id join public.courses c on c.id=cm.course_id join public.academic_programs p on p.id=c.program_id where l.id=lesson_materials.lesson_id and l.district_id=lesson_materials.district_id and l.status='published' and cm.status='published' and c.status='published' and p.status='published'))));

drop policy academic_materials_storage_delete on storage.objects;
create policy academic_materials_storage_delete on storage.objects for delete to authenticated using (bucket_id='academic-lesson-materials' and exists(select 1 from public.lesson_materials m where m.storage_path=objects.name and private.can_manage_lesson_resources_for_lesson(m.lesson_id) and ((m.status='draft') or private.can_manage_academic_catalog(m.district_id))));
drop policy academic_materials_storage_insert on storage.objects;
create policy academic_materials_storage_insert on storage.objects for insert to authenticated with check (bucket_id='academic-lesson-materials' and private.can_manage_lesson_resources_for_lesson((split_part(name,'/',2))::uuid) and exists(select 1 from public.lessons l where l.id=(split_part(objects.name,'/',2))::uuid and l.district_id=(split_part(objects.name,'/',1))::uuid and l.status='draft'));
drop policy academic_materials_storage_select on storage.objects;
create policy academic_materials_storage_select on storage.objects for select to authenticated using (bucket_id='academic-lesson-materials' and exists(select 1 from public.lesson_materials m where m.storage_path=objects.name and (private.can_manage_lesson_resources_for_lesson(m.lesson_id) or (m.status='published' and private.can_view_academic_catalog(m.district_id,'published')))));
drop policy academic_materials_storage_update on storage.objects;
create policy academic_materials_storage_update on storage.objects for update to authenticated using (bucket_id='academic-lesson-materials' and private.can_manage_lesson_resources_for_lesson((split_part(name,'/',2))::uuid)) with check (bucket_id='academic-lesson-materials' and private.can_manage_lesson_resources_for_lesson((split_part(name,'/',2))::uuid));

create or replace function private.enforce_course_tutor_review_scope()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_course_id uuid;
begin
 select a.course_id into v_course_id from public.academic_activities a where a.id=new.activity_id and a.district_id=new.district_id;
 if v_course_id is null or not private.can_manage_course_resources(v_course_id) then
  raise exception 'Not authorized to review submissions for this course';
 end if;
 return new;
end;
$function$;
revoke all on function private.enforce_course_tutor_review_scope() from public,anon,authenticated;
drop trigger if exists enforce_course_tutor_review_scope on public.academic_activity_submission_reviews;
create trigger enforce_course_tutor_review_scope before insert on public.academic_activity_submission_reviews for each row execute function private.enforce_course_tutor_review_scope();

drop policy academic_activity_submissions_select_scope on public.academic_activity_submissions;
create policy academic_activity_submissions_select_scope on public.academic_activity_submissions for select to authenticated
using (user_id=(select auth.uid()) or exists(select 1 from public.academic_activities a where a.id=academic_activity_submissions.activity_id and private.can_manage_course_resources(a.course_id)));
drop policy academic_activity_submission_reviews_select_scope on public.academic_activity_submission_reviews;
create policy academic_activity_submission_reviews_select_scope on public.academic_activity_submission_reviews for select to authenticated
using (user_id=(select auth.uid()) or exists(select 1 from public.academic_activities a where a.id=academic_activity_submission_reviews.activity_id and private.can_manage_course_resources(a.course_id)));
