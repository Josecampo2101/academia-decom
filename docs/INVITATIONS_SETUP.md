# Configuración del flujo de solicitudes de invitación

La página pública está disponible en `/solicitud-invitacion?token=...`. El token recibido por correo/enlace se conserva en el navegador y el servidor calcula su SHA-256 antes de consultar la invitación. La clave secreta de Supabase nunca se envía al cliente.

## Variables de entorno

Configurar en desarrollo local y en el entorno de despliegue:

| Variable | Exposición | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase |
| `SUPABASE_SECRET_KEY` | Solo servidor | Consultar la invitación y ejecutar la RPC protegida |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Pública | Renderizar el widget Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | Solo servidor | Validar el token Turnstile con Cloudflare |
| `TURNSTILE_EXPECTED_HOSTNAME` | Solo servidor | Hostname exacto autorizado para la verificación; obligatorio |

No usar el prefijo `NEXT_PUBLIC_` en la clave secreta de Turnstile ni en la clave secreta de Supabase.

## Flujo implementado

1. El solicitante abre el enlace con su token.
2. Completa Turnstile y solicita validar el enlace.
3. El servidor calcula SHA-256, comprueba vigencia, revocación, uso, tipo de invitación y estado del distrito.
4. Solo se devuelven congregaciones activas del distrito de la invitación.
5. En invitaciones `decom_member`, se ofrecen únicamente los roles `district_coordinator` y `area_coordinator`; la selección queda sujeta a aprobación.
6. El envío vuelve a exigir un token Turnstile nuevo y llama a `submit_invitation_request_v2` con la clave secreta desde el servidor.
7. La RPC registra la solicitud y `request_received` en la cola de notificaciones dentro de la misma transacción.

## Protección y límites

- No se habilita EXECUTE público para `submit_invitation_request_v2`.
- El endpoint no permite invitaciones `legacy` ni `national_admin`.
- No se activa una cuenta al enviar la solicitud.
- Los errores internos de Supabase no se devuelven al navegador.
- La validación falla de forma cerrada si Turnstile no está configurado o no responde.
- El servidor exige que Siteverify devuelva el hostname configurado y la acción `invitation_application`.
- El cuerpo JSON se limita a 12 KB durante la lectura del stream; se rechazan tipos de contenido distintos de JSON.
- Las validaciones puras de UUID, correo y fecha de nacimiento tienen pruebas unitarias ejecutadas en CI.
- Turnstile es una barrera anti-bot; no sustituye un rate limiter persistente por IP/token. Antes de publicar el formulario ampliamente, añadir límites persistentes y alertas operativas.
- El endpoint y la página no cambian permisos, funciones ni datos de producción.

## Pendiente antes de producción

- Configurar las variables de Turnstile en todos los entornos.
- Verificar el hostname real del despliegue.
- Ejecutar pruebas con invitaciones nuevas reales: válida, vencida, revocada, usada, duplicada, distrito inactivo y ausencia de congregaciones.
- Implementar el worker de correo para procesar `invitation_notifications`; el formulario solo deja la notificación en cola.
- Completar la activación posterior a la aprobación usando la ruta segura y el flujo `activate_approved_invitation`.
