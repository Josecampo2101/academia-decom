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
| `TURNSTILE_EXPECTED_HOSTNAME` | Solo servidor, recomendada | Rechazar verificaciones de un hostname distinto |

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
- Turnstile es una barrera anti-bot; no sustituye un rate limiter persistente por IP/token. Antes de publicar el formulario ampliamente, añadir límites persistentes y alertas operativas.
- El endpoint y la página no cambian permisos, funciones ni datos de producción.

## Pendiente antes de producción

- Configurar las variables de Turnstile en todos los entornos.
- Verificar el hostname real del despliegue.
- Ejecutar pruebas con invitaciones nuevas reales: válida, vencida, revocada, usada, duplicada, distrito inactivo y ausencia de congregaciones.
- Implementar el worker de correo para procesar `invitation_notifications`; el formulario solo deja la notificación en cola.
- Completar la activación posterior a la aprobación usando la ruta segura y el flujo `activate_approved_invitation`.

## Procesador de correos

La ruta protegida `/api/cron/invitation-notifications` reclama hasta 10 notificaciones por ejecución mediante `claim_invitation_notifications`, envía los tres tipos de correo con Resend y actualiza el estado de la cola.

Añadir estas variables de entorno:

| Variable | Exposición | Uso |
|---|---|---|
| `CRON_SECRET` | Solo servidor | Autorización Bearer para el worker |
| `RESEND_API_KEY` | Solo servidor | Envío por Resend |
| `RESEND_FROM_EMAIL` | Solo servidor | Remitente verificado, por ejemplo `Academia DECOM <notificaciones@tu-dominio>` |
| `APP_URL` | Solo servidor | URL HTTPS pública para construir el enlace de activación |

El worker admite GET (para programadores tipo cron) y POST (para ejecución manual protegida). Ambos requieren `Authorization: Bearer <CRON_SECRET>`. Configura un programador externo para llamar la ruta periódicamente; no se activa ningún cron ni se modifica el proyecto de producción desde este PR.

Los correos usan una clave idempotente por ID de notificación. Resend conserva sus claves de idempotencia durante 24 horas; los reintentos de la cola usan el mismo payload y la misma clave. La cola incrementa intentos y aplica espera progresiva, con un máximo de cinco intentos conforme a la función de reclamación existente.

## Activación después de la aprobación

El correo de aprobación enlaza a `/activar?request_id=...`. La página permite crear una cuenta o iniciar sesión. La RPC `activate_approved_invitation` comprueba que:
- la solicitud está aprobada;
- el correo de la cuenta está confirmado y coincide con el de la solicitud;
- la solicitud no esté vinculada a otra cuenta;
- el perfil y el distrito estén activos;
- la congregación y el rol correspondan a la solicitud aprobada.

La URL de confirmación de Supabase Auth debe permitir `/activar` como redirect URL. Si el correo ya tiene una cuenta, la persona debe iniciar sesión con esa misma dirección.

## Comprobación operativa antes de activar el worker

1. Configurar y verificar el dominio remitente en Resend.
2. Cargar las variables de entorno anteriores en el entorno de despliegue.
3. Configurar el programador externo con el secreto Bearer.
4. Ejecutar una solicitud de prueba y verificar que se envíe el correo de recepción.
5. Aprobar y rechazar solicitudes de prueba para verificar ambos mensajes y el enlace de activación.
6. Confirmar en `invitation_notifications` los estados, intentos, marcas de tiempo y `provider_message_id`.
