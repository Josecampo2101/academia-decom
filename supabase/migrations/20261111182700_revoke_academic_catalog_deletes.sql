-- The catalog uses logical archival; authenticated clients cannot physically delete rows.
revoke delete, truncate, references, trigger on public.academic_programs from public, anon, authenticated;
revoke delete, truncate, references, trigger on public.courses from public, anon, authenticated;
revoke delete, truncate, references, trigger on public.course_modules from public, anon, authenticated;
revoke delete, truncate, references, trigger on public.lessons from public, anon, authenticated;
revoke delete, truncate, references, trigger on public.curriculum_versions from public, anon, authenticated;
