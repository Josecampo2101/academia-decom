-- Planner académico: estructura pedagógica, recursos de clase y almacenamiento privado.
create or replace function private.can_manage_lesson_resources(p_district_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select p_district_id is not null
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.status='active')
 and (private.is_national_admin() or exists(
  select 1 from public.user_role_assignments ura join public.roles r on r.id=ura.role_id
  where ura.user_id=(select auth.uid()) and ura.district_id=p_district_id
  and ura.congregation_id is null and r.role_key in ('academic_editor','tutor','district_coordinator','area_coordinator')
 ));
$$;

create table if not exists public.academic_lesson_plans (
 id uuid primary key default gen_random_uuid(),
 district_id uuid not null references public.districts(id) on delete restrict,
 lesson_id uuid not null unique references public.lessons(id) on delete cascade,
 session_title text not null, topic text not null, description text, target_audience text,
 learning_outcomes text[] not null default '{}', teaching_method text, opening_activity text,
 lesson_development text, closing_activity text, assessment_strategy text, homework text,
 planned_for date, estimated_minutes integer check (estimated_minutes is null or estimated_minutes between 1 and 600),
 status text not null default 'draft' check (status in ('draft','review','approved')),
 created_by uuid references auth.users(id) on delete set null,
 updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint academic_lesson_plans_lesson_district_fk foreign key (lesson_id,district_id)
 references public.lessons(id,district_id) on delete cascade
);

create table if not exists public.lesson_materials (
 id uuid primary key default gen_random_uuid(),
 district_id uuid not null references public.districts(id) on delete restrict,
 lesson_id uuid not null references public.lessons(id) on delete cascade,
 title text not null, description text,
 material_type text not null check (material_type in ('lesson_text','pdf','document','presentation','image','audio','video','worksheet','infographic','external_link','other')),
 storage_path text unique, external_url text, mime_type text,
 size_bytes bigint check (size_bytes is null or size_bytes>=0),
 sort_order integer not null default 0,
 status text not null default 'draft' check (status in ('draft','published','archived')),
 uploaded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint lesson_materials_lesson_district_fk foreign key (lesson_id,district_id)
 references public.lessons(id,district_id) on delete cascade,
 constraint lesson_materials_source_check check (
  (storage_path is not null and external_url is null)
  or (storage_path is null and external_url is not null)
  or (storage_path is null and external_url is null and material_type='lesson_text')
 )
);

create index if not exists academic_lesson_plans_district_date_idx on public.academic_lesson_plans(district_id,planned_for);
create index if not exists lesson_materials_lesson_status_idx on public.lesson_materials(lesson_id,status,sort_order);

create or replace function public.set_academic_planner_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at:=now(); return new; end; $$;

drop trigger if exists academic_lesson_plans_updated_at on public.academic_lesson_plans;
create trigger academic_lesson_plans_updated_at before update on public.academic_lesson_plans for each row execute function public.set_academic_planner_updated_at();
drop trigger if exists lesson_materials_updated_at on public.lesson_materials;
create trigger lesson_materials_updated_at before update on public.lesson_materials for each row execute function public.set_academic_planner_updated_at();

alter table public.academic_lesson_plans enable row level security;
alter table public.lesson_materials enable row level security;

drop policy if exists academic_lesson_plans_select on public.academic_lesson_plans;
create policy academic_lesson_plans_select on public.academic_lesson_plans for select to authenticated
using (private.can_manage_lesson_resources(academic_lesson_plans.district_id)
 or (academic_lesson_plans.status='approved' and private.can_view_academic_catalog(academic_lesson_plans.district_id,'published')));

drop policy if exists academic_lesson_plans_write on public.academic_lesson_plans;
create policy academic_lesson_plans_write on public.academic_lesson_plans for all to authenticated
using (private.can_manage_lesson_resources(academic_lesson_plans.district_id))
with check (private.can_manage_lesson_resources(academic_lesson_plans.district_id)
 and exists(select 1 from public.lessons l where l.id=academic_lesson_plans.lesson_id
 and l.district_id=academic_lesson_plans.district_id and l.status='draft'));

drop policy if exists lesson_materials_select on public.lesson_materials;
create policy lesson_materials_select on public.lesson_materials for select to authenticated
using (private.can_manage_lesson_resources(lesson_materials.district_id)
 or (lesson_materials.status='published' and private.can_view_academic_catalog(lesson_materials.district_id,'published')
 and exists(select 1 from public.lessons l join public.course_modules cm on cm.id=l.module_id
 join public.courses c on c.id=cm.course_id join public.academic_programs p on p.id=c.program_id
 where l.id=lesson_materials.lesson_id and l.district_id=lesson_materials.district_id
 and l.status='published' and cm.status='published' and c.status='published' and p.status='published')));

drop policy if exists lesson_materials_write on public.lesson_materials;
create policy lesson_materials_write on public.lesson_materials for all to authenticated
using (private.can_manage_lesson_resources(lesson_materials.district_id))
with check (private.can_manage_lesson_resources(lesson_materials.district_id)
 and exists(select 1 from public.lessons l where l.id=lesson_materials.lesson_id
 and l.district_id=lesson_materials.district_id and l.status='draft'));

grant select,insert,update,delete on public.academic_lesson_plans,public.lesson_materials to authenticated;
revoke all on public.academic_lesson_plans,public.lesson_materials from anon;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('academic-lesson-materials','academic-lesson-materials',false,52428800,
 array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'image/jpeg','image/png','image/webp','audio/mpeg','audio/mp4','audio/wav','video/mp4','video/webm','text/plain','text/markdown'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists academic_materials_storage_select on storage.objects;
create policy academic_materials_storage_select on storage.objects for select to authenticated
using(bucket_id='academic-lesson-materials' and exists(select 1 from public.lesson_materials m
 where m.storage_path=storage.objects.name and (private.can_manage_lesson_resources(m.district_id)
 or (m.status='published' and private.can_view_academic_catalog(m.district_id,'published')))));

drop policy if exists academic_materials_storage_insert on storage.objects;
create policy academic_materials_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='academic-lesson-materials'
 and private.can_manage_lesson_resources(split_part(storage.objects.name,'/',1)::uuid)
 and exists(select 1 from public.lessons l where l.id=split_part(storage.objects.name,'/',2)::uuid
 and l.district_id=split_part(storage.objects.name,'/',1)::uuid and l.status='draft'));

drop policy if exists academic_materials_storage_update on storage.objects;
create policy academic_materials_storage_update on storage.objects for update to authenticated
using(bucket_id='academic-lesson-materials' and private.can_manage_lesson_resources(split_part(storage.objects.name,'/',1)::uuid))
with check(bucket_id='academic-lesson-materials' and private.can_manage_lesson_resources(split_part(storage.objects.name,'/',1)::uuid));

drop policy if exists academic_materials_storage_delete on storage.objects;
create policy academic_materials_storage_delete on storage.objects for delete to authenticated
using(bucket_id='academic-lesson-materials' and private.can_manage_lesson_resources(split_part(storage.objects.name,'/',1)::uuid));
