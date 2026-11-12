-- Break the congregations <-> memberships RLS dependency cycle.
-- The helper runs as its owner so the membership lookup does not re-enter
-- memberships RLS while the congregations SELECT policy is being evaluated.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_active_congregation_member(
  p_congregation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.memberships m
      where m.congregation_id = p_congregation_id
        and m.user_id = (select auth.uid())
        and m.member_status = 'active'
    );
$function$;

revoke all on function private.is_active_congregation_member(uuid) from public;
grant execute on function private.is_active_congregation_member(uuid) to authenticated;

drop policy if exists congregations_select_scope on public.congregations;

create policy congregations_select_scope
on public.congregations
for select
to authenticated
using (
  public.can_view_district(district_id)
  or private.is_active_congregation_member(id)
);
