-- Expose invitation requests only through a scoped SECURITY DEFINER RPC.
-- invitation_requests keeps RLS enabled with no direct client policies.

create or replace function public.get_invitation_requests(
  p_status text default 'pending'
)
returns table (
  request_id uuid,
  full_name text,
  email text,
  phone text,
  date_of_birth date,
  request_status text,
  decision_note text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  invitation_type text,
  district_id uuid,
  district_name text,
  requested_congregation_id uuid,
  congregation_name text,
  requested_role_id uuid,
  requested_role_name text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para consultar solicitudes.';
  end if;

  if p_status is not null
     and p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'El filtro de estado no es válido.';
  end if;

  return query
  select
    ir.id,
    ir.full_name,
    ir.email,
    ir.phone,
    ir.date_of_birth,
    ir.status,
    ir.decision_note,
    ir.requested_at,
    ir.reviewed_at,
    i.invitation_type,
    i.district_id,
    d.name,
    ir.requested_congregation_id,
    c.name,
    ir.requested_role_id,
    r.name
  from public.invitation_requests ir
  join public.invitations i on i.id = ir.invitation_id
  left join public.districts d on d.id = i.district_id
  left join public.congregations c on c.id = ir.requested_congregation_id
  left join public.roles r on r.id = ir.requested_role_id
  where (p_status is null or ir.status = p_status)
    and (
      public.has_role('national_admin', null)
      or public.can_manage_district(i.district_id)
    )
  order by ir.requested_at desc;
end;
$function$;

revoke all on function public.get_invitation_requests(text)
from public, anon;

grant execute on function public.get_invitation_requests(text)
to authenticated;
