-- Allow district committee members to create congregations
-- under the same district scope already used by UPDATE and DELETE.
DROP POLICY IF EXISTS congregations_insert_admin_scope
ON public.congregations;

CREATE POLICY congregations_insert_admin_scope
ON public.congregations
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_district(district_id));
