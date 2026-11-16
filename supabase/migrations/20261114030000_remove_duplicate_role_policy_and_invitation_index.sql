-- Keep the existing UNIQUE constraint/index for token_hash and remove the redundant manual index.
DROP INDEX IF EXISTS public.invitations_token_hash_unique;

-- roles_select_public already grants the same SELECT predicate to anon and authenticated.
DROP POLICY IF EXISTS roles_select_authenticated ON public.roles;
