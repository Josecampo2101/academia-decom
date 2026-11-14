-- Preserve effective authenticated access before removing the inherited PUBLIC grant.
-- Anonymous callers must not inherit EXECUTE on internal helpers through PUBLIC.
DO $$
DECLARE
  function_row record;
BEGIN
  FOR function_row IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', function_row.signature);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
