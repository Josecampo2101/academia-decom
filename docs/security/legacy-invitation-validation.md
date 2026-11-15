# Hardening de aceptación de invitaciones heredadas

## Hallazgo

La función `public.accept_invitation(text)` seguía expuesta a usuarios autenticados y permitía aceptar invitaciones de tipo `legacy` comparando el correo de la cuenta, pero sin exigir `auth.users.email_confirmed_at` ni comprobar que el perfil estuviera activo.

La auditoría de solo lectura encontró una invitación heredada vigente y sin aceptar. Por eso no se revoca la función ni se elimina el flujo.

## Cambio propuesto

La migración `20261115110000_harden_legacy_invitation_acceptance.sql` conserva el contrato de la función y añade:

- Perfil existente y activo.
- Correo electrónico confirmado en Supabase Auth.
- Coincidencia exacta del correo normalizado con la invitación.
- Bloqueo transaccional de la invitación y controles de expiración, revocación y uso previo.
- Validación de la combinación rol/distrito/congregación/área.
- Distrito y congregación activos y consistentes; área activa para coordinadores de área.
- Lista permitida explícita de roles heredados. El rol `national_admin` sigue excluido de esta función.
- Permisos de ejecución explícitos para `authenticated` y `service_role`; no para `anon` ni `public`.

## Matriz de pruebas en staging

| Caso | Resultado esperado |
|---|---|
| Usuario anónimo | Denegado |
| Usuario autenticado con correo no confirmado | Denegado |
| Perfil inexistente o inactivo | Denegado |
| Correo distinto al de la invitación | Denegado |
| Invitación no heredada | Denegado; debe usar solicitud y aprobación |
| Invitación expirada, revocada o ya aceptada | Denegado |
| Invitación de integrante con distrito y congregación activos y coincidentes | Permitido |
| Invitación de integrante con congregación de otro distrito | Denegado |
| Coordinador distrital con congregación o área asignada | Denegado |
| Coordinador de área sin área activa o congregación del mismo distrito | Denegado |
| Editor académico/tutor con congregación preasignada | Denegado |
| Invitación heredada con rol `national_admin` | Denegado |
| Reintento simultáneo con el mismo token | Solo una aceptación exitosa |

## Despliegue

- Aplicar primero en staging.
- Probar la invitación heredada vigente con una cuenta cuyo correo esté confirmado.
- Probar los casos negativos sin usar datos reales de usuarios.
- Verificar que el flujo moderno `activate_approved_invitation` no cambió.
- Revisar el ACL de `accept_invitation(text)` después de aplicar la migración.
- No aplicar directamente en producción hasta completar estas pruebas.

## Límite

El proyecto Supabase auditado no tenía una rama de staging disponible. Esta migración no ha sido aplicada ni probada contra identidades reales.
