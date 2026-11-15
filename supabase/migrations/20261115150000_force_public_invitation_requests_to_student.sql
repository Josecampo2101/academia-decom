CREATE OR REPLACE FUNCTION public.submit_invitation_request_v2(
    p_token_hash text,
    p_full_name text,
    p_email text,
    p_phone text,
    p_date_of_birth date,
    p_requested_congregation_id uuid,
    p_requested_role_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    invitation_record public.invitations%ROWTYPE;
    request_id uuid;
    normalized_email text;
    normalized_phone text;
    member_role_id uuid;
    congregation_record public.congregations%ROWTYPE;
BEGIN
    IF p_token_hash IS NULL OR length(p_token_hash) < 32 THEN
        RAISE EXCEPTION 'Enlace de invitación inválido.';
    END IF;

    IF p_full_name IS NULL OR length(trim(p_full_name)) < 2 THEN
        RAISE EXCEPTION 'Ingresa tu nombre completo.';
    END IF;

    normalized_email := lower(trim(p_email));

    IF normalized_email IS NULL
       OR normalized_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' THEN
        RAISE EXCEPTION 'Ingresa un correo electrónico válido.';
    END IF;

    normalized_phone := nullif(trim(p_phone), '');

    IF normalized_phone IS NULL
       OR length(regexp_replace(normalized_phone, '[^0-9]', '', 'g')) < 7
       OR length(regexp_replace(normalized_phone, '[^0-9]', '', 'g')) > 20 THEN
        RAISE EXCEPTION 'Ingresa un número de WhatsApp válido.';
    END IF;

    IF p_date_of_birth IS NULL OR p_date_of_birth > CURRENT_DATE THEN
        RAISE EXCEPTION 'Ingresa una fecha de nacimiento válida.';
    END IF;

    IF p_requested_congregation_id IS NULL THEN
        RAISE EXCEPTION 'Selecciona tu congregación.';
    END IF;

    -- El registro público nunca puede solicitar cargos institucionales.
    IF p_requested_role_id IS NOT NULL THEN
        RAISE EXCEPTION
            'Los roles institucionales se asignan posteriormente por la administración.';
    END IF;

    SELECT *
    INTO invitation_record
    FROM public.invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El enlace de invitación no existe.';
    END IF;

    IF invitation_record.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Esta invitación fue revocada.';
    END IF;

    IF invitation_record.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Esta invitación ya fue utilizada.';
    END IF;

    IF invitation_record.expires_at <= now() THEN
        RAISE EXCEPTION 'Esta invitación ha vencido.';
    END IF;

    -- Se aceptan enlaces generales nuevos y enlaces DECOM históricos,
    -- pero ambos siguen el mismo flujo de ingreso como estudiante.
    IF invitation_record.invitation_type NOT IN ('guest', 'decom_member') THEN
        RAISE EXCEPTION 'Este enlace no admite este tipo de solicitud.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.districts d
        WHERE d.id = invitation_record.district_id
          AND d.status = 'active'
    ) THEN
        RAISE EXCEPTION 'El distrito de esta invitación no está disponible.';
    END IF;

    SELECT *
    INTO congregation_record
    FROM public.congregations c
    WHERE c.id = p_requested_congregation_id
      AND c.district_id = invitation_record.district_id
      AND c.status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La congregación seleccionada no está activa o no pertenece al distrito de la invitación.';
    END IF;

    SELECT r.id
    INTO member_role_id
    FROM public.roles r
    WHERE r.role_key = 'member';

    IF member_role_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el rol base de estudiante.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.invitation_requests ir
        WHERE ir.invitation_id = invitation_record.id
          AND lower(trim(ir.email)) = normalized_email
    ) THEN
        RAISE EXCEPTION
            'Ya existe una solicitud con este correo para esta invitación.';
    END IF;

    INSERT INTO public.invitation_requests (
        invitation_id,
        full_name,
        email,
        phone,
        date_of_birth,
        requested_congregation_id,
        requested_role_id,
        status
    )
    VALUES (
        invitation_record.id,
        trim(p_full_name),
        normalized_email,
        normalized_phone,
        p_date_of_birth,
        p_requested_congregation_id,
        member_role_id,
        'pending'
    )
    RETURNING id INTO request_id;

    INSERT INTO public.invitation_notifications (
        invitation_request_id,
        notification_type,
        recipient_email,
        status
    )
    VALUES (
        request_id,
        'request_received',
        normalized_email,
        'pending'
    )
    ON CONFLICT (
        invitation_request_id,
        notification_type
    )
    DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'request_id', request_id,
        'status', 'pending',
        'notification', 'request_received',
        'message',
        'Tu solicitud fue registrada y está pendiente de revisión.'
    );
END;
$function$;
