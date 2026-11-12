-- Core persistent academic catalog for Academia DECOM.
-- Additive migration: no existing records, roles, or policies are modified.

create table public.academic_programs (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  code text not null,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_programs_code_nonempty check (length(trim(code)) between 2 and 40),
  constraint academic_programs_title_nonempty check (length(trim(title)) between 2 and 180),
  constraint academic_programs_district_code_key unique (district_id, code),
  constraint academic_programs_id_district_key unique (id, district_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  program_id uuid not null,
  code text not null,
  title text not null,
  description text,
  level text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_code_nonempty check (length(trim(code)) between 2 and 40),
  constraint courses_title_nonempty check (length(trim(title)) between 2 and 180),
  constraint courses_id_district_key unique (id, district_id),
  constraint courses_program_code_key unique (district_id, program_id, code),
  constraint courses_program_same_district_fkey
    foreign key (program_id, district_id)
    references public.academic_programs(id, district_id) on delete restrict
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  course_id uuid not null,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_modules_title_nonempty check (length(trim(title)) between 2 and 180),
  constraint course_modules_id_district_key unique (id, district_id),
  constraint course_modules_course_order_key unique (district_id, course_id, sort_order)
    deferrable initially deferred,
  constraint course_modules_course_same_district_fkey
    foreign key (course_id, district_id)
    references public.courses(id, district_id) on delete restrict
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  module_id uuid not null,
  title text not null,
  summary text,
  objectives text[] not null default '{}',
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_title_nonempty check (length(trim(title)) between 2 and 180),
  constraint lessons_id_district_key unique (id, district_id),
  constraint lessons_module_order_key unique (district_id, module_id, sort_order)
    deferrable initially deferred,
  constraint lessons_module_same_district_fkey
    foreign key (module_id, district_id)
    references public.course_modules(id, district_id) on delete restrict
);

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  course_id uuid not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  change_summary text,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint curriculum_versions_course_number_key unique (course_id, version_number),
  constraint curriculum_versions_id_district_key unique (id, district_id),
  constraint curriculum_versions_course_same_district_fkey
    foreign key (course_id, district_id)
    references public.courses(id, district_id) on delete restrict
);

create table public.academic_catalog_events (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references public.districts(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index academic_programs_district_status_order_idx
  on public.academic_programs (district_id, status, sort_order);
create index courses_district_program_status_order_idx
  on public.courses (district_id, program_id, status, sort_order);
create index course_modules_district_course_status_order_idx
  on public.course_modules (district_id, course_id, status, sort_order);
create index lessons_district_module_status_order_idx
  on public.lessons (district_id, module_id, status, sort_order);
create index curriculum_versions_district_course_status_idx
  on public.curriculum_versions (district_id, course_id, status, version_number desc);
create index academic_catalog_events_district_created_idx
  on public.academic_catalog_events (district_id, created_at desc);
create index academic_catalog_events_entity_idx
  on public.academic_catalog_events (entity_type, entity_id, created_at desc);

create or replace function private.is_national_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles p
    join public.user_role_assignments ura on ura.user_id = p.id
    join public.roles r on r.id = ura.role_id
    where p.id = (select auth.uid())
      and p.status = 'active'
      and r.role_key = 'national_admin'
      and ura.district_id is null
      and ura.congregation_id is null
  );
$function$;

create or replace function private.can_manage_academic_catalog(p_district_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_district_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.status = 'active'
    )
    and (
      private.is_national_admin()
      or exists (
        select 1
        from public.user_role_assignments ura
        join public.roles r on r.id = ura.role_id
        where ura.user_id = (select auth.uid())
          and ura.district_id = p_district_id
          and ura.congregation_id is null
          and r.role_key = 'academic_editor'
      )
    );
$function$;

create or replace function private.can_view_academic_catalog(
  p_district_id uuid,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_district_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.status = 'active'
    )
    and (
      private.can_manage_academic_catalog(p_district_id)
      or (
        p_status = 'published'
        and (
          exists (
            select 1
            from public.memberships m
            join public.congregations c on c.id = m.congregation_id
            where m.user_id = (select auth.uid())
              and m.member_status = 'active'
              and c.district_id = p_district_id
              and c.status = 'active'
          )
          or exists (
            select 1
            from public.user_role_assignments ura
            join public.roles r on r.id = ura.role_id
            where ura.user_id = (select auth.uid())
              and ura.district_id = p_district_id
              and ura.congregation_id is null
              and r.role_key in ('district_coordinator', 'area_coordinator', 'tutor')
          )
        )
      )
    );
$function$;

create or replace function private.can_update_academic_catalog(
  p_district_id uuid,
  p_status text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select private.can_manage_academic_catalog(p_district_id)
    and (
      private.is_national_admin()
      or p_status = 'draft'
    );
$function$;

create or replace function private.set_academic_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  else
    new.updated_by := coalesce((select auth.uid()), new.updated_by);
  end if;

  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
  elsif new.status = 'archived' then
    new.archived_at := coalesce(new.archived_at, now());
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function private.prevent_published_catalog_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Academic catalog records are archived; physical deletion is disabled';
  end if;

  if old.status = 'archived' then
    raise exception 'Archived academic catalog records are immutable';
  end if;

  if old.status = 'published' then
    if new.status <> 'archived'
      or not private.is_national_admin()
      or (
        to_jsonb(new) - array['status', 'archived_at', 'updated_at', 'updated_by']
      ) <> (
        to_jsonb(old) - array['status', 'archived_at', 'updated_at', 'updated_by']
      )
    then
      raise exception 'Published academic content is immutable; create a new version instead';
    end if;
    new.archived_at := coalesce(new.archived_at, now());
  end if;

  return new;
end;
$function$;

create or replace function private.prevent_published_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Curriculum versions cannot be physically deleted';
  end if;

  if old.status in ('published', 'archived') then
    raise exception 'Published or archived curriculum versions are immutable';
  end if;

  if new.status = 'published' then
    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$function$;

create or replace function private.validate_course_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1
      from public.course_modules cm
      where cm.course_id = new.id
        and cm.district_id = new.district_id
        and cm.status = 'published'
    ) then
      raise exception 'A course needs at least one published module before publication';
    end if;

    if not exists (
      select 1
      from public.lessons l
      join public.course_modules cm on cm.id = l.module_id
      where cm.course_id = new.id
        and l.district_id = new.district_id
        and cm.status = 'published'
        and l.status = 'published'
    ) then
      raise exception 'A course needs at least one published lesson before publication';
    end if;

    new.published_at := coalesce(new.published_at, now());
  end if;

  return new;
end;
$function$;

create or replace function private.record_academic_catalog_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_new jsonb;
  v_old jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    insert into public.academic_catalog_events (
      district_id, actor_id, entity_type, entity_id, action, after_data
    )
    values (
      (v_new ->> 'district_id')::uuid,
      (select auth.uid()),
      tg_table_name,
      (v_new ->> 'id')::uuid,
      'created',
      v_new
    );
    return new;
  end if;

  v_new := to_jsonb(new);
  v_old := to_jsonb(old);
  insert into public.academic_catalog_events (
    district_id, actor_id, entity_type, entity_id, action, before_data, after_data
  )
  values (
    (v_new ->> 'district_id')::uuid,
    (select auth.uid()),
    tg_table_name,
    (v_new ->> 'id')::uuid,
    'updated',
    v_old,
    v_new
  );
  return new;
end;
$function$;

create trigger academic_programs_set_updated_at
before insert or update on public.academic_programs
for each row execute function private.set_academic_updated_at();
create trigger courses_set_updated_at
before insert or update on public.courses
for each row execute function private.set_academic_updated_at();
create trigger course_modules_set_updated_at
before insert or update on public.course_modules
for each row execute function private.set_academic_updated_at();
create trigger lessons_set_updated_at
before insert or update on public.lessons
for each row execute function private.set_academic_updated_at();

create trigger academic_programs_protect_published
before update or delete on public.academic_programs
for each row execute function private.prevent_published_catalog_mutation();
create trigger courses_protect_published
before update or delete on public.courses
for each row execute function private.prevent_published_catalog_mutation();
create trigger course_modules_protect_published
before update or delete on public.course_modules
for each row execute function private.prevent_published_catalog_mutation();
create trigger lessons_protect_published
before update or delete on public.lessons
for each row execute function private.prevent_published_catalog_mutation();

create trigger courses_validate_publication
before update on public.courses
for each row execute function private.validate_course_publication();
create or replace function private.set_curriculum_version_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    if new.status = 'published' then
      new.published_at := coalesce(new.published_at, now());
    end if;
  end if;
  return new;
end;
$function$;

create trigger curriculum_versions_set_metadata
before insert on public.curriculum_versions
for each row execute function private.set_curriculum_version_metadata();

create trigger curriculum_versions_immutable
before update or delete on public.curriculum_versions
for each row execute function private.prevent_published_version_mutation();

create trigger academic_programs_audit
after insert or update on public.academic_programs
for each row execute function private.record_academic_catalog_event();
create trigger courses_audit
after insert or update on public.courses
for each row execute function private.record_academic_catalog_event();
create trigger course_modules_audit
after insert or update on public.course_modules
for each row execute function private.record_academic_catalog_event();
create trigger lessons_audit
after insert or update on public.lessons
for each row execute function private.record_academic_catalog_event();
create trigger curriculum_versions_audit
after insert or update on public.curriculum_versions
for each row execute function private.record_academic_catalog_event();

alter table public.academic_programs enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.curriculum_versions enable row level security;
alter table public.academic_catalog_events enable row level security;

grant usage on schema private to authenticated;
grant execute on function private.is_national_admin() to authenticated;
grant execute on function private.can_manage_academic_catalog(uuid) to authenticated;
grant execute on function private.can_view_academic_catalog(uuid, text) to authenticated;
grant execute on function private.can_update_academic_catalog(uuid, text) to authenticated;
revoke all on function private.is_national_admin() from public, anon;
revoke all on function private.can_manage_academic_catalog(uuid) from public, anon;
revoke all on function private.can_view_academic_catalog(uuid, text) from public, anon;
revoke all on function private.can_update_academic_catalog(uuid, text) from public, anon;
revoke all on function private.set_academic_updated_at() from public, anon, authenticated;
revoke all on function private.prevent_published_catalog_mutation() from public, anon, authenticated;
revoke all on function private.prevent_published_version_mutation() from public, anon, authenticated;
revoke all on function private.set_curriculum_version_metadata() from public, anon, authenticated;
revoke all on function private.validate_course_publication() from public, anon, authenticated;
revoke all on function private.record_academic_catalog_event() from public, anon, authenticated;

revoke all on public.academic_programs from anon;
revoke all on public.courses from anon;
revoke all on public.course_modules from anon;
revoke all on public.lessons from anon;
revoke all on public.curriculum_versions from anon;
revoke all on public.academic_catalog_events from anon;

grant select, insert, update on public.academic_programs to authenticated;
grant select, insert, update on public.courses to authenticated;
grant select, insert, update on public.course_modules to authenticated;
grant select, insert, update on public.lessons to authenticated;
grant select, insert, update on public.curriculum_versions to authenticated;
grant select on public.academic_catalog_events to authenticated;

create policy academic_programs_select_scope
on public.academic_programs for select to authenticated
using (private.can_view_academic_catalog(district_id, status));
create policy academic_programs_insert_scope
on public.academic_programs for insert to authenticated
with check (private.can_update_academic_catalog(district_id, status));
create policy academic_programs_update_scope
on public.academic_programs for update to authenticated
using (private.can_update_academic_catalog(district_id, status))
with check (private.can_update_academic_catalog(district_id, status));

create policy courses_select_scope
on public.courses for select to authenticated
using (private.can_view_academic_catalog(district_id, status));
create policy courses_insert_scope
on public.courses for insert to authenticated
with check (private.can_update_academic_catalog(district_id, status));
create policy courses_update_scope
on public.courses for update to authenticated
using (private.can_update_academic_catalog(district_id, status))
with check (private.can_update_academic_catalog(district_id, status));

create policy course_modules_select_scope
on public.course_modules for select to authenticated
using (private.can_view_academic_catalog(district_id, status));
create policy course_modules_insert_scope
on public.course_modules for insert to authenticated
with check (private.can_update_academic_catalog(district_id, status));
create policy course_modules_update_scope
on public.course_modules for update to authenticated
using (private.can_update_academic_catalog(district_id, status))
with check (private.can_update_academic_catalog(district_id, status));

create policy lessons_select_scope
on public.lessons for select to authenticated
using (private.can_view_academic_catalog(district_id, status));
create policy lessons_insert_scope
on public.lessons for insert to authenticated
with check (private.can_update_academic_catalog(district_id, status));
create policy lessons_update_scope
on public.lessons for update to authenticated
using (private.can_update_academic_catalog(district_id, status))
with check (private.can_update_academic_catalog(district_id, status));

create policy curriculum_versions_select_scope
on public.curriculum_versions for select to authenticated
using (private.can_view_academic_catalog(district_id, status));
create policy curriculum_versions_insert_scope
on public.curriculum_versions for insert to authenticated
with check (private.can_update_academic_catalog(district_id, status));
create policy curriculum_versions_update_scope
on public.curriculum_versions for update to authenticated
using (private.can_update_academic_catalog(district_id, status))
with check (private.can_update_academic_catalog(district_id, status));

create policy academic_catalog_events_select_scope
on public.academic_catalog_events for select to authenticated
using (private.can_manage_academic_catalog(district_id));
