create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  course_id uuid not null references public.courses(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_enrollments_course_user_unique unique (course_id,user_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete restrict,
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now(),
  constraint lesson_progress_enrollment_lesson_unique unique (enrollment_id,lesson_id)
);

create index if not exists course_enrollments_user_status_idx on public.course_enrollments(user_id,status);
create index if not exists course_enrollments_district_status_idx on public.course_enrollments(district_id,status);
create index if not exists lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

create or replace function public.set_learning_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

drop trigger if exists course_enrollments_set_updated_at on public.course_enrollments;
create trigger course_enrollments_set_updated_at before update on public.course_enrollments
for each row execute function public.set_learning_updated_at();
drop trigger if exists lesson_progress_set_updated_at on public.lesson_progress;
create trigger lesson_progress_set_updated_at before update on public.lesson_progress
for each row execute function public.set_learning_updated_at();

alter table public.course_enrollments enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists course_enrollments_select_scope on public.course_enrollments;
create policy course_enrollments_select_scope on public.course_enrollments for select to authenticated
using (course_enrollments.user_id = (select auth.uid()) or public.has_role('national_admin') or public.can_view_district(course_enrollments.district_id));

drop policy if exists course_enrollments_insert_managers on public.course_enrollments;
create policy course_enrollments_insert_managers on public.course_enrollments for insert to authenticated
with check (
 (public.has_role('national_admin') or public.can_manage_district(course_enrollments.district_id))
 and exists (select 1 from public.courses c join public.academic_programs p on p.id=c.program_id and p.district_id=c.district_id
 where c.id=course_enrollments.course_id and c.district_id=course_enrollments.district_id and c.status='published' and p.status='published')
);

drop policy if exists course_enrollments_update_managers on public.course_enrollments;
create policy course_enrollments_update_managers on public.course_enrollments for update to authenticated
using (public.has_role('national_admin') or public.can_manage_district(course_enrollments.district_id))
with check (public.has_role('national_admin') or public.can_manage_district(course_enrollments.district_id));

drop policy if exists lesson_progress_select_scope on public.lesson_progress;
create policy lesson_progress_select_scope on public.lesson_progress for select to authenticated
using (exists (select 1 from public.course_enrollments e where e.id=lesson_progress.enrollment_id and
 (e.user_id=(select auth.uid()) or public.has_role('national_admin') or public.can_view_district(e.district_id))));

drop policy if exists lesson_progress_insert_own on public.lesson_progress;
create policy lesson_progress_insert_own on public.lesson_progress for insert to authenticated
with check (exists (
 select 1 from public.course_enrollments e
 join public.lessons l on l.id=lesson_progress.lesson_id
 join public.course_modules cm on cm.id=l.module_id
 where e.id=lesson_progress.enrollment_id and e.user_id=(select auth.uid()) and e.status='active'
 and l.district_id=e.district_id and cm.course_id=e.course_id and l.status='published' and cm.status='published'
));

drop policy if exists lesson_progress_update_own on public.lesson_progress;
create policy lesson_progress_update_own on public.lesson_progress for update to authenticated
using (exists (select 1 from public.course_enrollments e where e.id=lesson_progress.enrollment_id and e.user_id=(select auth.uid()) and e.status='active'))
with check (exists (
 select 1 from public.course_enrollments e
 join public.lessons l on l.id=lesson_progress.lesson_id
 join public.course_modules cm on cm.id=l.module_id
 where e.id=lesson_progress.enrollment_id and e.user_id=(select auth.uid()) and e.status='active'
 and l.district_id=e.district_id and cm.course_id=e.course_id and l.status='published' and cm.status='published'
));

grant select, insert, update on public.course_enrollments to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
revoke all on public.course_enrollments, public.lesson_progress from anon;
