-- Harden the remaining legacy invitation acceptance path.
-- Keep legacy links operational, but require a verified email, active profile,
-- and a role/scope combination consistent with the invitation.

create or replace function public.accept_invitation(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
    v_user_id uuid;
    v_email text;
    v_profile_status text;
    v_invitation public.invitations%rowtype;
    v_role_key text;
    v_membership_id uuid;
    v_assignment_congregation uuid;
begin
    v_user_id := (select auth.uid());

    if v_user_id is null then
        raise exception 'Debes iniciar sesión para aceptar una invitación.'
            using errcode = '42501';
    end if;

    select p.status
    into v_profile_status
    from public.profiles p
    where p.id = v_user_id
    for share;

    if not found or v_profile_status <> 'active' then
        raise exception 'El perfil no existe o está inactivo.'
            using errcode = '42501';
    end if;

    select lower(btrim(u.email))
    into v_email
    from auth.users u
    where u.id = v_user_id
      and u.email_confirmed_at is not null;

    if v_email is null then
        raise exception 'Debes confirmar tu correo electrónico antes de aceptar la invitación.'
            using errcode = '42501';
    end if;

    if p_token_hash is null or btrim(p_token_hash) = '' then
        raise exception 'El token de invitación no es válido.';
    end if;

    select i.*
    into v_invitation
    from public.invitations i
    where i.token_hash = p_token_hash
    for update;

    if not found then
        raise exception 'La invitación no existe o el enlace no es válido.';
    end if;

    if v_invitation.invitation_type is distinct from 'legacy' then
        raise exception 'Esta invitación requiere una solicitud y aprobación administrativa.';
    end if;

    if lower(btrim(v_invitation.email)) is distinct from v_email then
        raise exception 'El correo de tu cuenta no coincide con el de la invitación.';
    end if;

    if v_invitation.accepted_at is not null then
        raise exception 'Esta invitación ya fue aceptada.';
    end if;

    if v_invitation.revoked_at is not null then
        raise exception 'Esta invitación fue revocada.';
    end if;

    if v_invitation.expires_at <= pg_catalog.now() then
        raise exception 'Esta invitación ha vencido.';
    end if;

    select r.role_key
    into v_role_key
    from public.roles r
    where r.id = v_invitation.role_id;

    if v_role_key is null or v_role_key = 'national_admin' then
        raise exception 'El rol de la invitación no está permitido.';
    end if;

    -- Validate the role's exact territorial scope before creating any records.
    if v_role_key = 'district_coordinator' then
        if v_invitation.district_id is null
           or v_invitation.congregation_id is not null
           or v_invitation.area_id is not null then
            raise exception 'La invitación del coordinador distrital tiene un alcance incorrecto.';
        end if;

        if not exists (
            select 1 from public.districts d
            where d.id = v_invitation.district_id and d.status = 'active'
        ) then
            raise exception 'El distrito de la invitación no existe o está inactivo.';
        end if;

        v_assignment_congregation := null;

    elsif v_role_key = 'area_coordinator' then
        if v_invitation.district_id is null
           or v_invitation.congregation_id is null
           or v_invitation.area_id is null then
            raise exception 'La invitación del coordinador de área requiere distrito, congregación y área.';
        end if;

        if not exists (
            select 1
            from public.districts d
            join public.congregations c
              on c.district_id = d.id
            join public.areas a
              on a.id = v_invitation.area_id
            where d.id = v_invitation.district_id
              and d.status = 'active'
              and c.id = v_invitation.congregation_id
              and c.status = 'active'
              and a.status = 'active'
        ) then
            raise exception 'El distrito, la congregación o el área de la invitación no están activos o no coinciden.';
        end if;

        v_assignment_congregation := null;

    elsif v_role_key in ('member', 'local_responsible') then
        if v_invitation.district_id is null
           or v_invitation.congregation_id is null
           or v_invitation.area_id is not null then
            raise exception 'La invitación requiere distrito y congregación, sin área.';
        end if;

        if not exists (
            select 1
            from public.districts d
            join public.congregations c on c.district_id = d.id
            where d.id = v_invitation.district_id
              and d.status = 'active'
              and c.id = v_invitation.congregation_id
              and c.status = 'active'
        ) then
            raise exception 'La congregación no pertenece al distrito activo de la invitación.';
        end if;

        v_assignment_congregation := v_invitation.congregation_id;

    elsif v_role_key in ('academic_editor', 'tutor') then
        if v_invitation.district_id is null
           or v_invitation.congregation_id is not null
           or v_invitation.area_id is not null then
            raise exception 'La invitación académica requiere únicamente un distrito.';
        end if;

        if not exists (
            select 1 from public.districts d
            where d.id = v_invitation.district_id and d.status = 'active'
        ) then
            raise exception 'El distrito de la invitación no existe o está inactivo.';
        end if;

        v_assignment_congregation := null;

    else
        raise exception 'Este rol no puede activarse mediante una invitación heredada.';
    end if;

    if v_invitation.congregation_id is not null then
        insert into public.memberships (
            user_id,
            congregation_id,
            member_status
        )
        values (
            v_user_id,
            v_invitation.congregation_id,
            'active'
        )
        on conflict (user_id, congregation_id)
        do update set member_status = 'active'
        returning id into v_membership_id;
    end if;

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            v_user_id::text || ':' ||
            v_invitation.role_id::text || ':' ||
            coalesce(v_invitation.district_id::text, '') || ':' ||
            coalesce(v_assignment_congregation::text, ''),
            0
        )
    );

    if not exists (
        select 1
        from public.user_role_assignments ura
        where ura.user_id = v_user_id
          and ura.role_id = v_invitation.role_id
          and ura.district_id is not distinct from v_invitation.district_id
          and ura.congregation_id is not distinct from v_assignment_congregation
    ) then
        insert into public.user_role_assignments (
            user_id,
            role_id,
            district_id,
            congregation_id,
            assigned_by
        )
        values (
            v_user_id,
            v_invitation.role_id,
            v_invitation.district_id,
            v_assignment_congregation,
            v_invitation.invited_by
        );
    end if;

    if v_role_key = 'area_coordinator' then
        if v_membership_id is null then
            raise exception 'No se pudo establecer la membresía congregacional del coordinador.';
        end if;

        insert into public.area_memberships (
            membership_id,
            area_id,
            district_id,
            position,
            status
        )
        values (
            v_membership_id,
            v_invitation.area_id,
            v_invitation.district_id,
            'coordinator',
            'active'
        )
        on conflict (membership_id, area_id, district_id)
        do update set
            position = 'coordinator',
            status = 'active';
    end if;

    update public.invitations
    set accepted_at = pg_catalog.now()
    where id = v_invitation.id;

    return pg_catalog.jsonb_build_object(
        'success', true,
        'role', v_role_key,
        'message', 'Invitación aceptada correctamente.'
    );
end;
$function$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated, service_role;
