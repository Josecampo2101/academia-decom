create table if not exists public.academic_tutor_student_notes (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null,
  course_id uuid not null,
  enrollment_id uuid not null references public.course_enrollments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  note text not null check (char_length(btrim(note)) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint academic_tutor_student_notes_course_district_fk
    foreign key (course_id, district_id)
    references public.courses(id, district_id) on delete restrict
);

create index if not exists academic_tutor_student_notes_student_created_idx
  on public.academic_tutor_student_notes(student_id, created_at desc);
create index if not exists academic_tutor_student_notes_enrollment_idx
  on public.academic_tutor_student_notes(enrollment_id, created_at desc);

alter table public.academic_tutor_student_notes enable row level security;
revoke all on public.academic_tutor_student_notes from public, anon, authenticated;

create or replace function private.add_tutor_student_note(p_enrollment_id uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_note text := btrim(coalesce(p_note, ''));
  v_note_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if char_length(v_note) < 1 or char_length(v_note) > 1000 then
    raise exception 'The note must contain between 1 and 1000 characters';
  end if;

  insert into public.academic_tutor_student_notes (
    district_id, course_id, enrollment_id, student_id, author_user_id, note
  )
  select e.district_id, e.course_id, e.id, e.user_id, (select auth.uid()), v_note
  from public.course_enrollments e
  where e.id = p_enrollment_id
    and e.status in ('active', 'completed')
    and (
      private.is_national_admin()
      or exists (
        select 1 from public.academic_course_tutor_assignments a
        where a.course_id = e.course_id and a.district_id = e.district_id
          and a.tutor_user_id = (select auth.uid()) and a.status = 'active'
          and private.is_active_district_tutor((select auth.uid()), a.district_id)
      )
    )
  returning id into v_note_id;

  if v_note_id is null then
    raise exception 'Enrollment is outside your assigned courses';
  end if;
  return v_note_id;
end;
$function$;

revoke all on function private.add_tutor_student_note(uuid, text) from public, anon;
grant execute on function private.add_tutor_student_note(uuid, text) to authenticated;

create or replace function public.add_tutor_student_note(p_enrollment_id uuid, p_note text)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.add_tutor_student_note(p_enrollment_id, p_note);
$function$;

revoke all on function public.add_tutor_student_note(uuid, text) from public, anon;
grant execute on function public.add_tutor_student_note(uuid, text) to authenticated;

create or replace function private.get_tutor_student_notes(p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_notes jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if not private.is_national_admin() and not exists (
    select 1 from public.academic_course_tutor_assignments a
    where a.tutor_user_id = (select auth.uid()) and a.status = 'active'
      and private.is_active_district_tutor((select auth.uid()), a.district_id)
  ) then
    raise exception 'Active tutor access required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'course_id', n.course_id, 'course_title', c.title,
    'note', n.note,
    'author_name', coalesce(nullif(btrim(author.full_name), ''), 'Tutor'),
    'created_at', n.created_at
  ) order by n.created_at desc), '[]'::jsonb)
  into v_notes
  from public.academic_tutor_student_notes n
  join public.course_enrollments e on e.id = n.enrollment_id
    and e.user_id = p_student_id and e.course_id = n.course_id and e.district_id = n.district_id
  join public.courses c on c.id = n.course_id and c.district_id = n.district_id
  left join public.profiles author on author.id = n.author_user_id
  where n.student_id = p_student_id
    and (
      private.is_national_admin()
      or exists (
        select 1 from public.academic_course_tutor_assignments a
        where a.course_id = n.course_id and a.district_id = n.district_id
          and a.tutor_user_id = (select auth.uid()) and a.status = 'active'
          and private.is_active_district_tutor((select auth.uid()), a.district_id)
      )
    );

  return v_notes;
end;
$function$;

revoke all on function private.get_tutor_student_notes(uuid) from public, anon;
grant execute on function private.get_tutor_student_notes(uuid) to authenticated;

create or replace function public.get_tutor_student_notes(p_student_id uuid)
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $function$
  select private.get_tutor_student_notes(p_student_id);
$function$;

revoke all on function public.get_tutor_student_notes(uuid) from public, anon;
grant execute on function public.get_tutor_student_notes(uuid) to authenticated;

comment on table public.academic_tutor_student_notes is
  'Immutable tutor observations scoped to the student enrollment and active course assignment; access is available only through scoped RPCs.';
