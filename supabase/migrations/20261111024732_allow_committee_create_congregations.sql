-- Allow district directors and committee members to create congregations
-- within the district scope enforced by can_manage_district().
drop policy if exists congregations_insert_admin_scope on public.congregations;

create policy congregations_insert_admin_scope
on public.congregations
for insert
to authenticated
with check (public.can_manage_district(district_id));
