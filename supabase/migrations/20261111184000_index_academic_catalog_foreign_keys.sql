-- Cover academic catalog foreign keys for predictable joins and deletes.
create index if not exists academic_programs_created_by_idx on public.academic_programs (created_by);
create index if not exists academic_programs_updated_by_idx on public.academic_programs (updated_by);
create index if not exists courses_program_district_fk_idx on public.courses (program_id, district_id);
create index if not exists courses_created_by_idx on public.courses (created_by);
create index if not exists courses_updated_by_idx on public.courses (updated_by);
create index if not exists course_modules_course_district_fk_idx on public.course_modules (course_id, district_id);
create index if not exists course_modules_created_by_idx on public.course_modules (created_by);
create index if not exists course_modules_updated_by_idx on public.course_modules (updated_by);
create index if not exists lessons_module_district_fk_idx on public.lessons (module_id, district_id);
create index if not exists lessons_created_by_idx on public.lessons (created_by);
create index if not exists lessons_updated_by_idx on public.lessons (updated_by);
create index if not exists curriculum_versions_course_district_fk_idx on public.curriculum_versions (course_id, district_id);
create index if not exists curriculum_versions_created_by_idx on public.curriculum_versions (created_by);
create index if not exists academic_catalog_events_actor_id_idx on public.academic_catalog_events (actor_id);
