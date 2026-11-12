# Academia DECOM

**Formación para comunicar con propósito.**

Academia DECOM es una plataforma de formación institucional para fortalecer las capacidades de comunicación de pastores, líderes, integrantes de DECOM y aspirantes. La primera etapa está enfocada en el Distrito 34, con una arquitectura preparada para incorporar otros distritos posteriormente.

> Este repositorio refleja el estado del código publicado en GitHub. Las funcionalidades descritas como planificadas no deben considerarse implementadas hasta que exista su correspondiente código, pruebas y despliegue.

## Estado actual

La rama principal contiene actualmente:

- Inicio de sesión y gestión de sesión con Supabase Auth.
- Protección de rutas del dashboard y validación del estado del perfil.
- Dashboard institucional.
- Administración de congregaciones por ámbito distrital.
- Módulo de reubicación de creyentes, con búsqueda, historial y revisión de responsabilidades de áreas.
- Funciones y tablas de base de datos para invitaciones y solicitudes de acceso.

La auditoría del repositorio identificó trabajo pendiente antes de considerar completo el flujo de invitaciones: formulario público conectado al procedimiento nuevo, activación de cuenta, procesamiento de correos y cierre del flujo de compatibilidad anterior.

## Funcionalidades académicas previstas

La hoja de ruta académica contempla:

1. Formación secuencial y obligatoria, comenzando por Identidad corporativa DECOM.
2. Cursos por áreas: Radio, Audiovisuales, Medios Digitales y Medios Escritos.
3. Cursos avanzados en fotografía, edición de video, diseño, sonido e inteligencia artificial.
4. Lecciones multimedia, actividades prácticas y evaluación final obligatoria.
5. Banco de preguntas con exámenes aleatorios y diferentes por estudiante.
6. Seguimiento de progreso, tutores, certificados verificables y reconocimientos.

Estas capacidades son parte del alcance del producto, pero no se presentan aquí como disponibles en la versión actual del repositorio.

## Tecnologías

- Next.js 16.4.5 (App Router y Turbopack).
- React 19.
- TypeScript.
- Supabase: PostgreSQL, Auth y Row Level Security (RLS).
- Tailwind CSS 4.
- GitHub Actions para lint y compilación.

## Estructura del proyecto

```text
app/
  acceso-denegado/
  conexion/
  dashboard/
    congregaciones/
    reubicaciones/
  page.tsx
lib/
  supabase/
    admin.ts
    client.ts
    server.ts
proxy.ts
public/
```

- `app/`: páginas y rutas de la aplicación.
- `lib/supabase/client.ts`: cliente Supabase para componentes de navegador.
- `lib/supabase/server.ts`: cliente Supabase para componentes y rutas de servidor.
- `lib/supabase/admin.ts`: cliente administrativo exclusivo del servidor.
- `proxy.ts`: renovación de sesión y protección de rutas.

## Requisitos

- Node.js 22 recomendado.
- npm.
- Proyecto Supabase configurado.

## Configuración local

1. Clona el repositorio.
2. Instala dependencias:

   ```bash
   npm ci
   ```

3. Crea un archivo `.env.local` en la raíz con las variables requeridas:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
   SUPABASE_SECRET_KEY=TU_CLAVE_SECRETA
   ```

   `SUPABASE_SECRET_KEY` es exclusivamente para código del servidor. Nunca debe llevar el prefijo `NEXT_PUBLIC_`, enviarse al navegador ni incluirse en el repositorio.

4. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000).

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Next.js en desarrollo. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run build` | Genera la compilación de producción. |
| `npm run start` | Inicia la aplicación compilada. |

## Seguridad y datos

- Las decisiones de autorización deben validarse en Supabase, no únicamente ocultando botones en la interfaz.
- Las tablas del esquema expuesto deben conservar RLS y políticas limitadas por usuario y ámbito territorial.
- Las funciones `SECURITY DEFINER` deben validar identidad, estado de perfil y permisos dentro de la propia función.
- Las claves secretas y credenciales nunca deben publicarse en el repositorio.
- Los cambios de esquema deben quedar documentados en migraciones versionadas y probarse antes de aplicarse a producción.
- No se deben conceder permisos generales a `anon` o `authenticated` para resolver errores de acceso sin revisar primero la autorización real.

## Verificación continua

GitHub Actions ejecuta instalación, ESLint y compilación en las ramas de trabajo y en las solicitudes de integración hacia `main`. Una ejecución correcta confirma lint y build; no sustituye las pruebas funcionales con cuentas y roles reales ni la validación de políticas RLS.

## Convenciones de trabajo

- Desarrollar en ramas de funcionalidad o corrección.
- Abrir Pull Requests hacia `main`.
- Mantener los cambios de base de datos y de aplicación coordinados.
- No fusionar cambios de permisos hasta validar el comportamiento con roles de prueba.
- Documentar las funcionalidades pendientes sin presentarlas como terminadas.
