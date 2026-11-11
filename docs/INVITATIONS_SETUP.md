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
- El servidor exige que Siteverify devuelva el hostname configurado y la acción `invitation_application`; el widget envía esa misma acción.
- El cuerpo HTTP se lee con un límite de 12 KB durante la lectura del stream, no después de almacenar el cuerpo completo.
- Turnstile es una barrera anti-bot; no sustituye un rate limiter persistente por IP/token. Antes de publicar el formulario ampliamente, añadir límites persistentes y alertas operativas.
- El endpoint y la página no cambian permisos, funciones ni datos de producción.

## Pendiente antes de producción

- Configurar las variables de Turnstile en todos los entornos.
- Verificar el hostname real del despliegue.
- Ejecutar pruebas con invitaciones nuevas reales: válida, vencida, revocada, usada, duplicada, distrito inactivo y ausencia de congregaciones.
- El worker de correo y la pantalla de activación ya están implementados en la rama de desarrollo. Falta configurar Resend, el programador externo y ejecutar pruebas reales de extremo a extremo.
- La activación usa la RPC `activate_approved_invitation`; su funcionamiento debe verificarse con una solicitud aprobada y un correo confirmado en un entorno de pruebas.

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


## Desarrollo local

1. Desde la raíz del proyecto, copia `.env.example` a `.env.local`:
   ```powershell
   Copy-Item .env.example .env.local
   ```
2. Completa las variables de Supabase con la URL, publishable key y secret key del proyecto. La secret key solo se usa en servidor.
3. Para probar el formulario local, configura las claves de prueba de Cloudflare Turnstile y deja `TURNSTILE_EXPECTED_HOSTNAME=localhost`. En producción, usa el hostname real exacto.
4. Mantén `APP_URL=http://localhost:3000` mientras el servidor local se ejecute en ese puerto. Si Next.js informa otro puerto, ajusta el valor.
5. Reinicia `npm run dev` después de modificar `.env.local`.

Las páginas requieren parámetros de seguridad; abrirlas sin ellos debe mostrar una explicación, no iniciar una solicitud:
- Solicitud: `/solicitud-invitacion?token=<token-de-invitacion>`
- Activación: `/activar?request_id=<uuid-de-solicitud-aprobada>`

Los mensajes de enlace faltante que aparecen al abrir las rutas sin parámetros son esperados. Para una prueba real, primero genera una invitación desde el panel administrativo y utiliza la URL completa que entrega el sistema. No inventes ni reutilices tokens.

## Corrección de recursión RLS

La política de lectura de `congregations` consultaba `memberships`, mientras que la política de lectura de `memberships` consultaba `congregations`. Se rompió el ciclo moviendo la comprobación de pertenencia activa a `private.is_active_congregation_member(uuid)`, una función `SECURITY DEFINER` acotada, con `search_path` vacío, validación de `auth.uid()` y ejecución concedida solo a `authenticated`. El esquema `private` no debe añadirse a los esquemas expuestos por la Data API.

La migración `20261111100116_break_congregations_memberships_rls_cycle` reemplaza únicamente la política SELECT de congregaciones; conserva las políticas de escritura y el control por distrito. La consulta de verificación con la cuenta nacional autenticada debe poder leer las congregaciones sin producir el error PostgreSQL `42P17`.


### Turnstile de prueba para desarrollo local

Cloudflare publica credenciales de prueba que permiten validar el formulario sin crear un widget real. Para usarlas localmente, coloca en `.env.local`:

```dotenv
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
TURNSTILE_TEST_MODE=true
TURNSTILE_EXPECTED_HOSTNAME=localhost
```

El servidor solo acepta este modo si `NODE_ENV` no es `production`, `TURNSTILE_TEST_MODE=true` y la clave secreta coincide exactamente con la credencial oficial de prueba. En producción siempre exige la verificación de hostname y acción con las claves reales. No copies las credenciales de prueba al entorno productivo.

Referencia oficial: [Cloudflare — Test your Turnstile implementation](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).


## Permisos de administración de invitaciones

La interfaz administrativa utiliza la sesión autenticada y las políticas RLS de `public.invitations`. La migración `20261111100516_grant_authenticated_invitation_management` concede únicamente `SELECT`, `INSERT` y `UPDATE` a `authenticated`; no concede acceso a `anon` ni `DELETE`. El alcance de lectura, creación y revocación continúa limitado por las políticas RLS existentes.
