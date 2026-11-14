# Configuración de servicios para Academia DECOM

## Estado conocido de Vercel

Proyecto: `academia-decom`.

Las siguientes variables están registradas en los entornos Production, Preview y Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `APP_URL` — URL canónica `https://academia-decom.vercel.app`.
- `CRON_SECRET` — secreto generado y almacenado como variable cifrada. No copiarlo a repositorios, logs ni mensajes.

La existencia de una variable no garantiza por sí sola que un despliegue ya la esté utilizando; Vercel las incorpora al siguiente deployment de cada entorno.

## Variables pendientes

Antes de habilitar los flujos de invitación y correo en producción, completar:

| Variable | Uso | Responsable / origen |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Operaciones administrativas del servidor y worker de invitaciones | Generar/consultar desde API Keys del proyecto Supabase; nunca usar en el navegador |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Widget anti-bots en el formulario público | Cloudflare Turnstile |
| `TURNSTILE_SECRET_KEY` | Validación server-side de Turnstile | Cloudflare Turnstile |
| `TURNSTILE_EXPECTED_HOSTNAME` | Verificar el hostname de los tokens | Dominio real que recibe el formulario |
| `RESEND_API_KEY` | Envío de notificaciones por correo | Resend |
| `RESEND_FROM_EMAIL` | Remitente autorizado y verificado | Dominio verificado en Resend |

No activar `TURNSTILE_TEST_MODE` en producción. El formulario público debe fallar de forma cerrada si la verificación no está configurada o no está disponible.

## Worker de notificaciones

Endpoint: `POST /api/cron/invitation-notifications` (también acepta GET).

Autenticación: cabecera `Authorization: Bearer <CRON_SECRET>`.

El worker reclama lotes pequeños de notificaciones pendientes, valida que el estado de la solicitud coincida con el tipo de correo, envía con clave de idempotencia de Resend y registra el resultado para reintentos.

Pendiente de operación:

1. Configurar un programador externo o Vercel Cron compatible con el plan contratado.
2. Ejecutar el endpoint con el secreto configurado.
3. Comprobar los tres eventos: recepción, aprobación y rechazo.
4. Verificar reintentos y ausencia de duplicados.
5. Confirmar que el correo de aprobación apunta al dominio canónico y que el dominio remitente está verificado.

No se ha creado un cron schedule ni se ha enviado un correo real.

## Orden recomendado para habilitar producción

1. Completar las variables secretas faltantes en Vercel sin compartirlas en el repositorio.
2. Confirmar dominio de Turnstile y remitente verificado en Resend.
3. Integrar la rama validada en `main`.
4. Desplegar solo con autorización expresa.
5. Ejecutar pruebas funcionales autenticadas de invitaciones, biblioteca, tutor y estudiante.
