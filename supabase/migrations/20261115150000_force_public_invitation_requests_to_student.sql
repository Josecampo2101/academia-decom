-- Separate students from DECOM members; preserve existing member assignments.
INSERT INTO public.roles (role_key, name, description)
VALUES ('student', 'Estudiante', 'Rol base para las personas que ingresan a Academia DECOM como estudiantes.')
ON CONFLICT (role_key) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

UPDATE public.roles
SET name = 'Miembro de DECOM',
    description = COALESCE(description, 'Rol institucional para integrantes de DECOM.')
WHERE role_key = 'member';

CREATE OR REPLACE FUNCTION public.submit_invitation_request_v2(p_token_hash text, p_full_name text, p_email text, p_phone text, p_date_of_birth date, p_requested_congregation_id uuid, p_requested_role_id uuid DEFAULT NULL::uuid)
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
    student_role_id uuid;
    congregation_record public.congregations%ROWTYPE;
BEGIN
    -- Validaciones básicas.
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

    IF p_date_of_birth IS NULL
       OR p_date_of_birth > CURRENT_DATE THEN
        RAISE EXCEPTION 'Ingresa una fecha de nacimiento válida.';
    END IF;

    IF p_requested_congregation_id IS NULL THEN
        RAISE EXCEPTION 'Selecciona tu congregación.';
    END IF;

    -- Buscar y bloquear la invitación.
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

    IF invitation_record.invitation_type NOT IN ('guest', 'decom_member') THEN
        RAISE EXCEPTION 'Este enlace no admite este tipo de solicitud.';
    END IF;

    -- Verificar que el distrito esté activo.
    IF NOT EXISTS (
        SELECT 1
        FROM public.districts d
        WHERE d.id = invitation_record.district_id
          AND d.status = 'active'
    ) THEN
        RAISE EXCEPTION 'El distrito de esta invitación no está disponible.';
    END IF;

    -- Verificar congregación activa y perteneciente al distrito.
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

    -- El enlace público siempre registra inicialmente a la persona como estudiante.
    IF p_requested_role_id IS NOT NULL THEN
        RAISE EXCEPTION
            'Los roles institucionales se asignan posteriormente por la administración.';
    END IF;

    SELECT r.id
    INTO student_role_id
    FROM public.roles r
    WHERE r.role_key = 'student';

    IF student_role_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el rol base de estudiante.';
    END IF;

    -- Evitar solicitudes duplicadas.
    IF EXISTS (
        SELECT 1
        FROM public.invitation_requests ir
        WHERE ir.invitation_id = invitation_record.id
          AND lower(trim(ir.email)) = normalized_email
    ) THEN
        RAISE EXCEPTION
            'Ya existe una solicitud con este correo para esta invitación.';
    END IF;

    -- Registrar solicitud completa.
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
        student_role_id,
        'pending'
    )
    RETURNING id INTO request_id;

    -- Registrar notificación de recepción en la misma transacción.
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
$function$


CREATE OR REPLACE FUNCTION public.activate_approved_invitation(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    current_user_id uuid;
    current_email text;
    profile_status text;

    request_record public.invitation_requests%ROWTYPE;
    invitation_record public.invitations%ROWTYPE;

    target_role text;
    target_role_id uuid;
    target_district uuid;
    target_congregation uuid;
    membership_congregation uuid;

    membership_record_id uuid;
BEGIN
    -- 1. Identificar al usuario autenticado.
    current_user_id := (SELECT auth.uid());

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION
            'Debes iniciar sesión para activar tu cuenta.';
    END IF;

    -- Evitar activaciones simultáneas del mismo usuario.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext(current_user_id::text)
    );

    -- 2. Obtener el correo verificado.
    SELECT lower(trim(u.email))
    INTO current_email
    FROM auth.users u
    WHERE u.id = current_user_id
      AND u.email_confirmed_at IS NOT NULL;

    IF current_email IS NULL THEN
        RAISE EXCEPTION
            'Debes confirmar tu correo electrónico antes de activar tu cuenta.';
    END IF;

    -- 3. Buscar y bloquear la solicitud.
    SELECT *
    INTO request_record
    FROM public.invitation_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud no existe.';
    END IF;

    IF request_record.status <> 'approved' THEN
        RAISE EXCEPTION
            'La solicitud todavía no ha sido aprobada.';
    END IF;

    IF lower(trim(request_record.email)) <> current_email THEN
        RAISE EXCEPTION
            'El correo de tu cuenta no coincide con el de la solicitud.';
    END IF;

    IF request_record.user_id IS NOT NULL
       AND request_record.user_id <> current_user_id THEN
        RAISE EXCEPTION
            'Esta solicitud ya está vinculada a otra cuenta.';
    END IF;

    -- 4. Obtener y bloquear la invitación.
    SELECT *
    INTO invitation_record
    FROM public.invitations
    WHERE id = request_record.invitation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'La invitación relacionada no existe.';
    END IF;

    -- 5. Determinar el rol según el tipo de invitación.
    target_district := invitation_record.district_id;
    target_congregation := invitation_record.congregation_id;
    membership_congregation := invitation_record.congregation_id;

    IF invitation_record.invitation_type IN ('guest', 'decom_member') THEN

        -- Las invitaciones nuevas no deben tener congregación ni área
        -- preasignadas. La congregación la selecciona el solicitante.
        IF invitation_record.district_id IS NULL
           OR invitation_record.congregation_id IS NOT NULL
           OR invitation_record.area_id IS NOT NULL THEN
            RAISE EXCEPTION
                'La configuración de la invitación nueva tiene un alcance incorrecto.';
        END IF;

        -- El rol base de estas invitaciones debe ser member.
        IF NOT EXISTS (
            SELECT 1
            FROM public.roles r
            WHERE r.id = invitation_record.role_id
              AND r.role_key IN ('student', 'member')
        ) THEN
            RAISE EXCEPTION
                'La invitación no tiene configurado el rol base Integrante.';
        END IF;

        -- La congregación procede de la solicitud.
        membership_congregation :=
            request_record.requested_congregation_id;

        IF membership_congregation IS NULL THEN
            RAISE EXCEPTION
                'La solicitud no tiene una congregación seleccionada.';
        END IF;

        -- Todas las invitaciones públicas se activan como estudiantes.
        -- Se ignora cualquier rol solicitado por registros históricos.
        SELECT r.id, r.role_key
        INTO target_role_id, target_role
        FROM public.roles r
        WHERE r.role_key = 'student';

        IF target_role_id IS NULL THEN
            RAISE EXCEPTION 'No se encontró el rol base de estudiante.';
        END IF;

        target_congregation := membership_congregation;

    ELSIF invitation_record.invitation_type = 'national_admin' THEN

        -- El administrador nacional debe proceder de una invitación especial.
        SELECT r.id, r.role_key
        INTO target_role_id, target_role
        FROM public.roles r
        WHERE r.id = invitation_record.role_id;

        IF target_role <> 'national_admin'
           OR invitation_record.district_id IS NOT NULL
           OR invitation_record.congregation_id IS NOT NULL
           OR invitation_record.area_id IS NOT NULL THEN
            RAISE EXCEPTION
                'La invitación de administrador nacional tiene un alcance incorrecto.';
        END IF;

        target_district := NULL;
        target_congregation := NULL;
        membership_congregation := NULL;

    ELSIF invitation_record.invitation_type = 'legacy' THEN

        -- Compatibilidad con invitaciones del sistema anterior.
        SELECT r.id, r.role_key
        INTO target_role_id, target_role
        FROM public.roles r
        WHERE r.id = invitation_record.role_id;

        IF target_role IS NULL THEN
            RAISE EXCEPTION
                'El rol de la invitación no existe.';
        END IF;

        IF target_role NOT IN (
            'national_admin',
            'district_coordinator',
            'area_coordinator',
            'academic_editor',
            'member',
            'student',
            'local_responsible',
            'tutor'
        ) THEN
            RAISE EXCEPTION
                'Este rol no puede activarse mediante invitación.';
        END IF;

        IF target_role = 'national_admin' THEN

            IF target_district IS NOT NULL
               OR target_congregation IS NOT NULL
               OR invitation_record.area_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'La invitación nacional no debe tener distrito, congregación ni área.';
            END IF;

            target_district := NULL;
            target_congregation := NULL;
            membership_congregation := NULL;

        ELSIF target_role = 'district_coordinator' THEN

            IF target_district IS NULL
               OR target_congregation IS NOT NULL
               OR invitation_record.area_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'La invitación del coordinador distrital tiene un alcance incorrecto.';
            END IF;

            target_congregation := NULL;
            membership_congregation := NULL;

        ELSIF target_role = 'area_coordinator' THEN

            IF target_district IS NULL
               OR target_congregation IS NULL
               OR invitation_record.area_id IS NULL THEN
                RAISE EXCEPTION
                    'La invitación del coordinador de área tiene un alcance incorrecto.';
            END IF;

            -- Se conserva el comportamiento anterior para invitaciones legacy.
            target_congregation := NULL;

        ELSIF target_role IN ('student', 'member', 'local_responsible') THEN

            IF target_district IS NULL
               OR target_congregation IS NULL
               OR invitation_record.area_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'La invitación requiere distrito y congregación, sin área.';
            END IF;

        END IF;

        IF target_role IN ('academic_editor', 'tutor')
           AND invitation_record.area_id IS NOT NULL THEN
            RAISE EXCEPTION
                'Esta invitación no puede tener un área asignada.';
        END IF;

    ELSE
        RAISE EXCEPTION
            'El tipo de invitación no está permitido para activar cuentas.';
    END IF;

    -- 6. Gestionar reintentos de una activación completada.
    IF invitation_record.accepted_at IS NOT NULL THEN

        IF request_record.user_id = current_user_id THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'user_id', current_user_id,
                'role', target_role,
                'district_id', target_district,
                'congregation_id', membership_congregation,
                'area_id',
                    CASE
                        WHEN invitation_record.invitation_type = 'legacy'
                        THEN invitation_record.area_id
                        ELSE NULL
                    END,
                'message',
                    'Tu cuenta ya había sido activada correctamente.'
            );
        END IF;

        RAISE EXCEPTION
            'Esta invitación ya fue utilizada.';
    END IF;

    -- 7. Comprobar vigencia y revocación.
    IF invitation_record.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION
            'Esta invitación fue revocada.';
    END IF;

    IF invitation_record.expires_at <= pg_catalog.now() THEN
        RAISE EXCEPTION
            'Esta invitación ha vencido.';
    END IF;

    -- 8. Verificar perfil activo.
    SELECT p.status
    INTO profile_status
    FROM public.profiles p
    WHERE p.id = current_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No se encontró el perfil de usuario.';
    END IF;

    IF profile_status <> 'active' THEN
        RAISE EXCEPTION
            'Tu perfil no está activo. Contacta al administrador.';
    END IF;

    -- 9. Verificar distrito activo.
    IF target_district IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.districts d
           WHERE d.id = target_district
             AND d.status = 'active'
       ) THEN
        RAISE EXCEPTION
            'El distrito de la invitación no está activo.';
    END IF;

    -- 10. Verificar congregación de membresía.
    IF membership_congregation IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.congregations c
           WHERE c.id = membership_congregation
             AND c.district_id = target_district
             AND c.status = 'active'
       ) THEN
        RAISE EXCEPTION
            'La congregación no está activa o no pertenece al distrito indicado.';
    END IF;

    -- 11. Verificar área únicamente para invitaciones legacy.
    IF invitation_record.invitation_type = 'legacy'
       AND invitation_record.area_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM public.areas a
           WHERE a.id = invitation_record.area_id
             AND a.status = 'active'
       ) THEN
        RAISE EXCEPTION
            'El área asignada a la invitación no está activa.';
    END IF;

    -- 12. Actualizar datos básicos del perfil.
    UPDATE public.profiles
    SET
        full_name = trim(request_record.full_name),
        phone = request_record.phone,
        updated_at = pg_catalog.now()
    WHERE id = current_user_id;

    -- 13. Crear asignación del rol.
    INSERT INTO public.user_role_assignments (
        user_id,
        role_id,
        district_id,
        congregation_id,
        assigned_by
    )
    VALUES (
        current_user_id,
        target_role_id,
        target_district,
        target_congregation,
        request_record.reviewed_by
    )
    ON CONFLICT DO NOTHING;

    -- 14. Crear o reactivar membresía congregacional.
    IF membership_congregation IS NOT NULL THEN

        INSERT INTO public.memberships (
            user_id,
            congregation_id,
            member_status
        )
        VALUES (
            current_user_id,
            membership_congregation,
            'active'
        )
        ON CONFLICT (user_id, congregation_id)
        DO UPDATE SET
            member_status = 'active'
        RETURNING id INTO membership_record_id;

    END IF;

    -- 15. Pertenencia a área solamente para invitaciones legacy.
    IF invitation_record.invitation_type = 'legacy'
       AND target_role = 'area_coordinator' THEN

        IF membership_record_id IS NULL THEN
            RAISE EXCEPTION
                'No se pudo obtener la membresía congregacional.';
        END IF;

        INSERT INTO public.area_memberships (
            membership_id,
            area_id,
            position,
            status,
            district_id
        )
        VALUES (
            membership_record_id,
            invitation_record.area_id,
            'coordinator',
            'active',
            invitation_record.district_id
        )
        ON CONFLICT (
            membership_id,
            area_id,
            district_id
        )
        DO UPDATE SET
            position = 'coordinator',
            status = 'active';

    END IF;

    -- 16. Vincular solicitud con el usuario.
    UPDATE public.invitation_requests
    SET user_id = current_user_id
    WHERE id = p_request_id;

    -- 17. Marcar invitación como utilizada.
    UPDATE public.invitations
    SET accepted_at = pg_catalog.now()
    WHERE id = invitation_record.id
      AND accepted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No se pudo registrar la utilización de la invitación.';
    END IF;

    -- 18. Respuesta.
    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'user_id', current_user_id,
        'role', target_role,
        'district_id', target_district,
        'congregation_id', membership_congregation,
        'area_id',
            CASE
                WHEN invitation_record.invitation_type = 'legacy'
                THEN invitation_record.area_id
                ELSE NULL
            END,
        'message',
            'Tu cuenta ha sido activada correctamente.'
    );

END;
$function$


CREATE OR REPLACE FUNCTION public.validate_invitation_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    target_role text;
    congregation_district uuid;
    target_area uuid;
    base_student_role_id uuid;
    national_admin_role_id uuid;
BEGIN
    SELECT r.role_key
    INTO target_role
    FROM public.roles r
    WHERE r.id = NEW.role_id;

    IF target_role IS NULL THEN
        RAISE EXCEPTION 'El rol indicado no existe.';
    END IF;

    -- Obtener roles base.
    SELECT r.id
    INTO base_student_role_id
    FROM public.roles r
    WHERE r.role_key = 'student';

    SELECT r.id
    INTO national_admin_role_id
    FROM public.roles r
    WHERE r.role_key = 'national_admin';

    IF base_student_role_id IS NULL
       OR national_admin_role_id IS NULL THEN
        RAISE EXCEPTION
            'No se encontraron los roles base requeridos.';
    END IF;

    -- NUEVO MODELO: invitados y miembros de DECOM.
    IF NEW.invitation_type IN ('guest', 'decom_member') THEN

        IF NEW.district_id IS NULL
           OR NEW.congregation_id IS NOT NULL
           OR NEW.area_id IS NOT NULL THEN
            RAISE EXCEPTION
                'Las invitaciones generales requieren únicamente un distrito.';
        END IF;

        IF NEW.role_id IS DISTINCT FROM base_student_role_id THEN
            RAISE EXCEPTION
                'Las invitaciones generales deben utilizar el rol base student.';
        END IF;

        RETURN NEW;
    END IF;

    -- NUEVO MODELO: administración nacional.
    IF NEW.invitation_type = 'national_admin' THEN

        IF NEW.role_id IS DISTINCT FROM national_admin_role_id THEN
            RAISE EXCEPTION
                'La invitación nacional requiere el rol national_admin.';
        END IF;

        IF NEW.district_id IS NOT NULL
           OR NEW.congregation_id IS NOT NULL
           OR NEW.area_id IS NOT NULL THEN
            RAISE EXCEPTION
                'El administrador nacional no debe tener alcance territorial.';
        END IF;

        RETURN NEW;
    END IF;

    -- MODELO ANTERIOR: conservar compatibilidad.
    IF NEW.invitation_type = 'legacy' THEN

        IF target_role = 'national_admin' THEN
            IF NEW.district_id IS NOT NULL
               OR NEW.congregation_id IS NOT NULL
               OR NEW.area_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'El administrador nacional no debe tener distrito, congregación ni área.';
            END IF;

            RETURN NEW;
        END IF;

        IF target_role = 'district_coordinator' THEN
            IF NEW.district_id IS NULL
               OR NEW.congregation_id IS NOT NULL
               OR NEW.area_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'El coordinador distrital requiere únicamente un distrito.';
            END IF;
        END IF;

        IF target_role = 'area_coordinator' THEN
            IF NEW.district_id IS NULL
               OR NEW.congregation_id IS NULL
               OR NEW.area_id IS NULL THEN
                RAISE EXCEPTION
                    'El miembro del comité requiere distrito, congregación y área.';
            END IF;

            SELECT a.id
            INTO target_area
            FROM public.areas a
            WHERE a.id = NEW.area_id;

            IF target_area IS NULL THEN
                RAISE EXCEPTION 'El área indicada no existe.';
            END IF;
        END IF;

        IF target_role IN ('student', 'member', 'local_responsible') THEN
            IF NEW.district_id IS NULL
               OR NEW.congregation_id IS NULL
               OR NEW.area_id IS NOT NULL THEN
                RAISE EXCEPTION
                    'Este rol requiere distrito y congregación, sin área.';
            END IF;
        END IF;

        IF target_role IN ('academic_editor', 'tutor')
           AND NEW.area_id IS NOT NULL THEN
            RAISE EXCEPTION
                'Este rol no admite asignación de área.';
        END IF;

        IF NEW.congregation_id IS NOT NULL THEN
            SELECT c.district_id
            INTO congregation_district
            FROM public.congregations c
            WHERE c.id = NEW.congregation_id;

            IF congregation_district IS NULL
               OR congregation_district IS DISTINCT FROM NEW.district_id THEN
                RAISE EXCEPTION
                    'La congregación no pertenece al distrito indicado.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'El tipo de invitación indicado no es válido: %',
        NEW.invitation_type;
END;
$function$


CREATE OR REPLACE FUNCTION public.validate_user_role_assignment_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_role_key text;
    v_congregation_district uuid;
BEGIN
    -- Obtener el tipo de rol
    SELECT r.role_key
    INTO v_role_key
    FROM public.roles r
    WHERE r.id = NEW.role_id;

    IF v_role_key IS NULL THEN
        RAISE EXCEPTION 'El rol indicado no existe.';
    END IF;

    -- Administración nacional: ámbito global
    IF v_role_key = 'national_admin' THEN

        IF NEW.district_id IS NOT NULL
           OR NEW.congregation_id IS NOT NULL THEN
            RAISE EXCEPTION
                'national_admin debe tener ámbito global.';
        END IF;

    -- Roles de ámbito distrital
    ELSIF v_role_key IN (
        'district_coordinator',
        'area_coordinator'
    ) THEN

        IF NEW.district_id IS NULL
           OR NEW.congregation_id IS NOT NULL THEN
            RAISE EXCEPTION
                'El rol % requiere ámbito distrital.',
                v_role_key;
        END IF;

    -- Roles de ámbito congregacional
    ELSIF v_role_key IN (
        'student',
        'member',
        'local_responsible'
    ) THEN

        IF NEW.district_id IS NULL
           OR NEW.congregation_id IS NULL THEN
            RAISE EXCEPTION
                'El rol % requiere ámbito congregacional.',
                v_role_key;
        END IF;

        -- Verificar que la congregación pertenezca al distrito
        SELECT c.district_id
        INTO v_congregation_district
        FROM public.congregations c
        WHERE c.id = NEW.congregation_id;

        IF v_congregation_district IS NULL
           OR v_congregation_district <> NEW.district_id THEN
            RAISE EXCEPTION
                'La congregación no pertenece al distrito indicado.';
        END IF;

    -- Roles pendientes de definición
    ELSIF v_role_key IN (
        'academic_editor',
        'tutor'
    ) THEN

        NULL;

    ELSE
        RAISE EXCEPTION
            'No existe una definición de ámbito para el rol %.',
            v_role_key;
    END IF;

    RETURN NEW;
END;
$function$


ALTER POLICY invitations_insert_admin_scope ON public.invitations
WITH CHECK (
    (has_role('national_admin'::text) OR can_manage_district(district_id))
    AND EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.id = invitations.role_id
          AND r.role_key = ANY (ARRAY[
                  'district_coordinator'::text,
                  'area_coordinator'::text,
                  'academic_editor'::text,
                  'member'::text,
                  'student'::text,
                  'local_responsible'::text,
                  'tutor'::text
              ])
    )
);

ALTER POLICY invitations_delete_admin_scope ON public.invitations
USING (
    (has_role('national_admin'::text) OR can_manage_district(district_id))
    AND EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.id = invitations.role_id
          AND r.role_key = ANY (ARRAY[
                  'district_coordinator'::text,
                  'area_coordinator'::text,
                  'academic_editor'::text,
                  'member'::text,
                  'student'::text,
                  'local_responsible'::text,
                  'tutor'::text
              ])
    )
);

ALTER POLICY invitations_update_admin_scope ON public.invitations
USING (has_role('national_admin'::text) OR can_manage_district(district_id))
WITH CHECK (
    (has_role('national_admin'::text) OR can_manage_district(district_id))
    AND EXISTS (
        SELECT 1 FROM public.roles r
        WHERE r.id = invitations.role_id
          AND r.role_key = ANY (ARRAY[
                  'district_coordinator'::text,
                  'area_coordinator'::text,
                  'academic_editor'::text,
                  'member'::text,
                  'student'::text,
                  'local_responsible'::text,
                  'tutor'::text
              ])
    )
);
