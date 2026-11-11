-- Publication gates keep incomplete programs, courses, modules, and lessons out of student views.

create or replace function private.validate_program_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1 from public.courses c
      where c.program_id = new.id
        and c.district_id = new.district_id
        and c.status = 'published'
    ) then
      raise exception 'A program needs at least one published course before publication';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$function$;

create or replace function private.validate_module_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if not exists (
      select 1 from public.lessons l
      where l.module_id = new.id
        and l.district_id = new.district_id
        and l.status = 'published'
        and nullif(trim(l.content ->> 'markdown'), '') is not null
    ) then
      raise exception 'A module needs at least one published lesson with content';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$function$;

create or replace function private.validate_lesson_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    if nullif(trim(new.content ->> 'markdown'), '') is null then
      raise exception 'A lesson needs non-empty content before publication';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$function$;

create trigger academic_programs_validate_publication
before update on public.academic_programs
for each row execute function private.validate_program_publication();

create trigger course_modules_validate_publication
before update on public.course_modules
for each row execute function private.validate_module_publication();

create trigger lessons_validate_publication
before update on public.lessons
for each row execute function private.validate_lesson_publication();

revoke all on function private.validate_program_publication() from public, anon, authenticated;
revoke all on function private.validate_module_publication() from public, anon, authenticated;
revoke all on function private.validate_lesson_publication() from public, anon, authenticated;
