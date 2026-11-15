-- Harden the legacy invitation acceptance RPC.
-- Require a verified email and active profile before any role or membership write.
-- Also reject invitations whose territorial scope has since been deactivated.

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token_hash text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_email text;
    v_profile_status text;
    v_invitation public.invitations%ROWTYPE;
    v_role_key text;
    v_membership_id uuid;
    v_assignment_congregation uuid;
BEGIN
    -- 1. Identify the authenticated user.
    v_user_id := (SELECT auth.uid());

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión para aceptar una invitación.'
            USING ERRCODE = '42501';
    END IF;

    IF p_token_hash IS NULL OR btrim(p_token_hash) = '' THEN
        RAISE EXCEPTION 'El token de invitación no es válido.';
    END IF;

    -- 2. Require an email address confirmed by Supabase Auth.
    SELECT lower(btrim(u.email))
    INTO v_email
    FROM auth.users u
    WHERE u.id = v_user_id
      AND u.email_confirmed_at IS NOT NULL;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Debes confirmar tu correo electrónico antes de aceptar la invitación.'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Require an active profile and lock it against concurrent suspension.
    SELECT p.status
    INTO v_profile_status
    FROM public.profiles p
    WHERE p.id = v_user_id
    FOR SHARE;

    IF NOT FOUND OR v_profile_status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'Tu perfil no está activo. Contacta al administrador.'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Find and lock the invitation.
    SELECT i.*
    INTO v_invitation
    FROM public.invitations i
    WHERE i.token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La invitación no existe o el enlace no es válido.';
    END IF;

    -- This RPC is retained only for legacy invitations.
    IF v_invitation.invitation_type IS DISTINCT FROM 'legacy' THEN
        RAISE EXCEPTION 'Esta invitación requiere una solicitud y aprobación administrativa.';
    END IF;

    IF lower(btrim(v_invitation.email)) IS DISTINCT FROM v_email THEN
        RAISE EXCEPTION 'El correo de tu cuenta no coincide con el de la invitación.'
            USING ERRCODE = '42501';
    END IF;

    IF v_invitation.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Esta invitación ya fue aceptada.';
    END IF;

    IF v_invitation.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Esta invitación fue revocada.';
    END IF;

    IF v_invitation.expires_at <= pg_catalog.now() THEN
        RAISE EXCEPTION 'Esta invitación ha vencido.';
    END IF;

    -- 5. Validate the assigned role and its territorial scope.
    SELECT r.role_key
    INTO v_role_key
    FROM public.roles r
    WHERE r.id = v_invitation.role_id;

    IF v_role_key IS NULL OR v_role_key = 'national_admin' THEN
        RAISE EXCEPTION 'El rol de la invitación no está permitido.';
    END IF;

    IF v_role_key NOT IN (
        'district_coordinator',
        'area_coordinator',
        'academic_editor',
        'member',
        'student',
        'local_responsible',
        'tutor'
    ) THEN
        RAISE EXCEPTION 'El rol de la invitación no está permitido.';
    END IF;

    IF v_invitation.district_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.districts d
           WHERE d.id = v_invitation.district_id
             AND d.status = 'active'
       ) THEN
        RAISE EXCEPTION 'El distrito de la invitación no está activo.';
    END IF;

    IF v_invitation.congregation_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.congregations c
           WHERE c.id = v_invitation.congregation_id
             AND c.district_id = v_invitation.district_id
             AND c.status = 'active'
       ) THEN
        RAISE EXCEPTION 'La congregación de la invitación no está activa o no pertenece al distrito indicado.';
    END IF;

    IF v_invitation.area_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.areas a
           WHERE a.id = v_invitation.area_id
             AND a.status = 'active'
       ) THEN
        RAISE EXCEPTION 'El área asignada a la invitación no está activa.';
    END IF;

    -- District roles have no congregation assignment; congregational roles retain it.
    IF v_role_key IN ('district_coordinator', 'area_coordinator') THEN
        v_assignment_congregation := NULL;
    ELSE
        v_assignment_congregation := v_invitation.congregation_id;
    END IF;

    -- Area coordinators require a valid congregation to establish membership.
    IF v_role_key = 'area_coordinator'
       AND v_invitation.congregation_id IS NULL THEN
        RAISE EXCEPTION 'La invitación del coordinador de área requiere una congregación.';
    END IF;

    -- 6. Create or recover the congregational membership.
    IF v_invitation.congregation_id IS NOT NULL THEN
        INSERT INTO public.memberships (
            user_id,
            congregation_id,
            member_status
        )
        VALUES (
            v_user_id,
            v_invitation.congregation_id,
            'active'
        )
        ON CONFLICT (user_id, congregation_id)
        DO UPDATE SET member_status = 'active'
        RETURNING id INTO v_membership_id;
    END IF;

    -- 7. Serialize duplicate role assignment checks.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            v_user_id::text || ':' ||
            v_invitation.role_id::text || ':' ||
            COALESCE(v_invitation.district_id::text, '') || ':' ||
            COALESCE(v_assignment_congregation::text, ''),
            0
        )
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_role_assignments ura
        WHERE ura.user_id = v_user_id
          AND ura.role_id = v_invitation.role_id
          AND ura.district_id IS NOT DISTINCT FROM v_invitation.district_id
          AND ura.congregation_id IS NOT DISTINCT FROM v_assignment_congregation
    ) THEN
        INSERT INTO public.user_role_assignments (
            user_id,
            role_id,
            district_id,
            congregation_id,
            assigned_by
        )
        VALUES (
            v_user_id,
            v_invitation.role_id,
            v_invitation.district_id,
            v_assignment_congregation,
            v_invitation.invited_by
        );
    END IF;

    -- 8. Restore the legacy area assignment only for a valid area coordinator.
    IF v_role_key = 'area_coordinator' THEN
        IF v_membership_id IS NULL THEN
            RAISE EXCEPTION 'No se pudo establecer la membresía congregacional del coordinador.';
        END IF;

        INSERT INTO public.area_memberships (
            membership_id,
            area_id,
            district_id,
            position,
            status
        )
        VALUES (
            v_membership_id,
            v_invitation.area_id,
            v_invitation.district_id,
            'coordinator',
            'active'
        )
        ON CONFLICT (membership_id, area_id, district_id)
        DO UPDATE SET
            position = 'coordinator',
            status = 'active';
    END IF;

    -- 9. Mark the invitation as consumed atomically.
    UPDATE public.invitations
    SET accepted_at = pg_catalog.now()
    WHERE id = v_invitation.id
      AND accepted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo registrar la utilización de la invitación.';
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'role', v_role_key,
        'message', 'Invitación aceptada correctamente.'
    );
END;
$function$;

-- This RPC is an authenticated legacy flow, never an anonymous endpoint.
REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated, service_role;
