create table public.academic_course_tutor_assignments (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null,
  course_id uuid not null,
  tutor_user_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','revoked')),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id) on delete restrict,
  notes text,
  constraint academic_course_tutor_assignments_course_district_fk
    foreign key (course_id,district_id) references public.courses(id,district_id) on delete restrict,
  constraint academic_course_tutor_assignments_revocation_check
    check ((status='active' and revoked_at is null and revoked_by is null)
        or (status='revoked' and revoked_at is not null and revoked_by is not null))
);
create unique index academic_course_tutor_assignments_active_unique on public.academic_course_tutor_assignments(course_id,tutor_user_id) where status='active';
create index academic_course_tutor_assignments_tutor_active_idx on public.academic_course_tutor_assignments(tutor_user_id,district_id,course_id) where status='active';
create index academic_course_tutor_assignments_district_course_idx on public.academic_course_tutor_assignments(district_id,course_id,status);
create or replace function private.can_manage_course_tutor_assignments(p_district_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select p_district_id is not null
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active')
 and (private.is_national_admin() or exists (
  select 1 from public.user_role_assignments ura join public.roles r on r.id=ura.role_id
  where ura.user_id=(select auth.uid()) and ura.district_id=p_district_id and ura.congregation_id is null
   and r.role_key in ('academic_editor','district_coordinator','area_coordinator')
 ));
$function$;
create or replace function private.can_manage_course_resources(p_course_id uuid)
returns boolean language sql stable security definer set search_path=''
as $function$
 select exists(select 1 from public.courses c where c.id=p_course_id and (
  private.can_manage_course_tutor_assignments(c.district_id)
  or exists(select 1 from public.academic_course_tutor_assignments a where a.course_id=c.id and a.district_id=c.district_id and a.tutor_user_id=(select auth.uid()) and a.status='active')
 ));
$function$;
alter table public.academic_course_tutor_assignments enable row level security;
grant select,insert,update on public.academic_course_tutor_assignments to authenticated;
create policy "Course tutors can view own assignments and managers can view district assignments" on public.academic_course_tutor_assignments for select to authenticated using (tutor_user_id=(select auth.uid()) or private.can_manage_course_tutor_assignments(district_id));
create policy "District academic managers assign course tutors" on public.academic_course_tutor_assignments for insert to authenticated with check (
 private.can_manage_course_tutor_assignments(district_id) and assigned_by=(select auth.uid())
 and exists(select 1 from public.user_role_assignments ura join public.roles r on r.id=ura.role_id where ura.user_id=tutor_user_id and ura.district_id=district_id and ura.congregation_id is null and r.role_key='tutor')
);
create policy "District academic managers revoke course tutors" on public.academic_course_tutor_assignments for update to authenticated using (private.can_manage_course_tutor_assignments(district_id)) with check (
 private.can_manage_course_tutor_assignments(district_id) and ((status='active' and revoked_at is null and revoked_by is null) or (status='revoked' and revoked_at is not null and revoked_by=(select auth.uid())))
);
revoke all on function private.can_manage_course_tutor_assignments(uuid) from public,anon;
revoke all on function private.can_manage_course_resources(uuid) from public,anon;
grant execute on function private.can_manage_course_tutor_assignments(uuid) to authenticated;
grant execute on function private.can_manage_course_resources(uuid) to authenticated;
