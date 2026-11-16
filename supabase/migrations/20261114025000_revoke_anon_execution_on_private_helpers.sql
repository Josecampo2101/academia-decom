-- Anonymous API callers must not receive EXECUTE on internal helper/trigger functions.
-- The private schema is not exposed to PostgREST, but removing the grant is defense in depth.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM anon;
