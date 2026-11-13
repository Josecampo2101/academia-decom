# Academia DECOM

**Formación para comunicar con propósito.**

Academia DECOM es una plataforma de formación institucional para fortalecer las capacidades de comunicación de pastores, líderes, integrantes de DECOM y aspirantes. La primera etapa está enfocada en el Distrito 34, con una arquitectura preparada para incorporar otros distritos posteriormente.

> Este repositorio refleja el estado del código en `main`. La presencia de una pantalla o una estructura de base de datos no equivale, por sí sola, a una funcionalidad validada de extremo a extremo. Consulta [el estado técnico](docs/estado-tecnico.md) para conocer las verificaciones y pendientes.

## Capacidades presentes en `main`

### Acceso y administración institucional
- Inicio de sesión y gestión de sesión con Supabase Auth.
- Protección de rutas del dashboard y validación del estado del perfil.
- Dashboard institucional con navegación condicionada por roles.
- Administración de congregaciones por ámbito distrital.
- Reubicación de creyentes, historial de traslados y revisión de responsabilidades de áreas.
- Invitaciones y solicitudes de acceso con procedimientos de base de datos para su gestión.

### Formación académica
- Catálogo académico: programas, cursos, módulos y lecciones.
- Matrículas e inscripciones a cursos, con seguimiento de progreso.
- Planificador académico para la preparación y revisión de planes de lección.
- Biblioteca de recursos académicos y almacenamiento privado.
- Creación y publicación transaccional de actividades.
- Asignación de actividades, entregas de estudiantes, intentos y revisiones con historial.
- Evaluaciones y banco de preguntas.
- Asignación de tutores a cursos con alcance por curso.
- Rutas de trabajo para estudiantes y tutores.

Estas capacidades están representadas en código y/o esquema de base de datos. Su disponibilidad real depende de las políticas RLS, los datos existentes, la configuración del proyecto y las pruebas funcionales con cuentas de cada rol.

## Arquitectura de autorización

- La primera etapa se dirige al Distrito 34.
- `national_admin` conserva alcance global.
- Los roles distritales operan dentro de su ámbito autorizado.
- Los tutores deben gestionar recursos académicos únicamente en cursos con asignación activa.
- Los estudiantes acceden a los recursos y actividades que les corresponden por matrícula y asignación.
- La autorización debe validarse en Supabase mediante RLS y funciones controladas; ocultar una opción en la interfaz no constituye una medida de seguridad.

Los cambios de permisos deben revisarse junto con sus funciones, políticas, triggers y RPC relacionadas. No se deben ampliar privilegios para resolver errores de interfaz.

## Tecnologías

- Next.js 16.4.5 (App Router y Turbopack).
- React 19.
- TypeScript.
- Supabase: PostgreSQL, Auth, Row Level Security y Storage.
- Tailwind CSS 4.
- GitHub Actions para lint, verificación de tipos y compilación.

## Estructura del proyecto

```text
app/
  acceso-denegado/
  conexion/
  dashboard/
    administracion/
      actividades/
      biblioteca/
      catalogo/
      tutores/
    biblioteca/
    congregaciones/
    estudiante/
      actividades/
      biblioteca/
      evaluaciones/
      formacion/
      leccion/
      reconocimientos/
      seguimiento/
    formacion/
    invitaciones/
    matriculas/
    planificador/
    reubicaciones/
    revision-academica/
    tutor/
      calificaciones/
      estudiantes/
      evaluaciones/
      planificaciones/
  page.tsx
lib/
  supabase/
    admin.ts
    client.ts
    server.ts
supabase/
  migrations/
  ...
public/
proxy.ts
```

- `app/`: páginas y rutas de la aplicación.
- `lib/supabase/client.ts`: cliente Supabase para componentes de navegador.
- `lib/supabase/server.ts`: cliente Supabase para componentes y rutas de servidor.
- `lib/supabase/admin.ts`: cliente administrativo exclusivo del servidor.
- `proxy.ts`: renovación de sesión y protección de rutas.
- `supabase/migrations/`: historial versionado de cambios de esquema y seguridad.

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

3. Crea un archivo `.env.local` en la raíz:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
   SUPABASE_SECRET_KEY=TU_CLAVE_SECRETA
   ```

   `SUPABASE_SECRET_KEY` es exclusivamente para código del servidor. Nunca debe llevar el prefijo `NEXT_PUBLIC_`, enviarse al navegador ni incluirse en el repositorio.

4. Inicia el servidor:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000).

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run typecheck` | Verifica tipos TypeScript. |
| `npm test` | Ejecuta las pruebas automatizadas Node.js disponibles. |
| `npm run build` | Genera la compilación de producción. |
| `npm run start` | Inicia la aplicación compilada. |

## Verificación continua

GitHub Actions ejecuta instalación, ESLint, verificación de tipos y compilación en las ramas `feature/**`, `fix/**`, en `main` y en solicitudes de integración. La compilación usa valores de entorno de ejemplo; no valida la conexión a un proyecto Supabase real.

Una ejecución correcta confirma controles estáticos y compilación. No sustituye las pruebas funcionales con cuentas reales, la comprobación de RLS ni la validación de flujos de correo y almacenamiento.

## Seguridad y datos

- Las tablas del esquema expuesto deben conservar RLS y políticas limitadas por usuario y ámbito.
- Las funciones `SECURITY DEFINER` deben validar identidad y permisos internamente, tener `search_path` controlado y privilegios de ejecución mínimos.
- Las claves secretas y credenciales nunca deben publicarse en el repositorio.
- Las vistas deben evaluarse por su interacción con RLS.
- Los cambios de esquema deben quedar documentados en migraciones versionadas y probarse antes de aplicarse a producción.
- No se deben conceder permisos generales a `anon` o `authenticated` para resolver errores de acceso sin revisar primero la autorización real.

## Convenciones de trabajo

- Desarrollar en ramas de funcionalidad o corrección cuando sea posible.
- Revisar cambios de permisos antes de integrarlos.
- Mantener coordinados el código de aplicación, los tipos y las migraciones.
- Documentar los pendientes sin presentarlos como funcionalidades terminadas.
- No desplegar a producción hasta completar las verificaciones funcionales y la aprobación manual correspondiente.
