-- Remove API-role privileges that bypass row-level security.
-- TRUNCATE is not governed by RLS; API roles must never hold it.
DO $migration$
DECLARE
    item record;
BEGIN
    FOR item IN
        SELECT c.oid::regclass AS table_name
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
    LOOP
        EXECUTE format(
            'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %s FROM anon, authenticated',
            item.table_name
        );
    END LOOP;
END;
$migration$;

-- Prevent future public tables created by either migration owner from
-- reintroducing structural privileges that bypass RLS.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- The role catalogue is read-only to API clients.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES
ON TABLE public.roles
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.roles TO anon, authenticated;

-- Tutor assignment data is never writable by anonymous clients.
REVOKE ALL PRIVILEGES
ON TABLE public.academic_course_tutor_assignments
FROM PUBLIC, anon;

-- Preserve authenticated SELECT and RLS-governed INSERT/UPDATE/DELETE grants.
