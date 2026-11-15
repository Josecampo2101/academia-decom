# Diagnóstico técnico — Academia DECOM

**Fecha:** 2026-11-15  
**Rama auditada:** `feat/escuela-comunicaciones-d34-frontend`  
**Commit auditado:** `0072fd4b659ea442a32ae9aa2ecb5d88043873a3`  
**Alcance:** inspección estática del repositorio, revisión de GitHub Actions y consultas de solo lectura al proyecto Supabase conectado. No se modificó código de aplicación, esquema, datos, permisos ni configuración.

## 1. Resumen ejecutivo

Academia DECOM ya tiene una base funcional amplia: Next.js 16, Supabase, rutas institucionales, catálogo y flujos académicos, invitaciones, tutorías, reubicaciones y una primera renovación visual. El dashboard y varias pantallas siguen concentrando presentación, estado, consultas y autorización en componentes cliente grandes. El frontend puede mejorarse por fases sin reescribir el producto, pero antes deben controlarse dos riesgos de entrega: la documentación de contexto solicitada no está en la rama y el historial de migraciones de Git no coincide con el de Supabase. El CI de GitHub del commit auditado pasó todos sus pasos; eso no sustituye la validación local ni las pruebas manuales con dos roles.

**No se verificó una vulnerabilidad crítica explotable durante esta revisión estática.** Sí hay hallazgos altos que deben resolverse antes de considerar reproducible el esquema o habilitar nuevas funcionalidades dependientes de migraciones.

## 2. Alcance, fuentes y limitaciones

Se inspeccionaron:

- `AGENTS.md`, `package.json`, `package-lock.json`, `tsconfig.json`, configuración de Next.js y ESLint.
- Árbol de `app/`, `lib/`, `tests/`, `docs/`, `.github/workflows/` y `supabase/migrations/`.
- Componentes de acceso, layout, dashboard, perfil, clientes Supabase y proxy.
- Migraciones SQL versionadas y documentación técnica existente.
- Catálogo de PostgreSQL, tablas, claves foráneas, políticas RLS, funciones `SECURITY DEFINER`, triggers, grants, buckets de Storage, historial de migraciones y asesores de Supabase.
- Estado de la PR #53 y la ejecución de GitHub Actions asociada al SHA auditado.

### Limitaciones explícitas

1. `docs/CONTEXTO.md` no existe en la rama auditada. Tampoco existen `docs/PROGRESS.md` ni `docs/DECISIONS.md` antes de esta entrega.
2. El `AGENTS.md` almacenado en Git solo contiene el bloque de reglas generado por Next.js; no contiene las reglas completas de trabajo incluidas en la solicitud de esta sesión.
3. Este entorno no pudo clonar el repositorio: la resolución de `github.com` falló. Node 22.16.0 y npm 10.9.2 están disponibles, pero no se dispone de un checkout local.
4. Supabase CLI y Docker no están instalados en este entorno. No fue posible levantar Supabase local ni probar migraciones allí.
5. No se ejecutaron aquí `npm install`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`, pruebas de navegador ni el flujo manual de login → dashboard → logout con dos roles.
6. La revisión de Supabase fue de solo lectura sobre el proyecto conectado. No se aplicó ninguna migración ni se modificaron datos.

## 3. Arquitectura actual

### Stack y estructura

- Next.js **16.4.5**, App Router, React **19.3.0**, TypeScript y CSS con Tailwind CSS 4.
- Supabase: `@supabase/ssr` **0.12.7** y `@supabase/supabase-js` **2.119.0**.
- Iconografía: `lucide-react` **0.555.0**.
- Rutas y páginas en `app/`; utilidades y clientes en `lib/`; migraciones en `supabase/migrations/`; pruebas Node en `tests/`.
- No se observa una carpeta compartida `components/` en el árbol auditado. Existen componentes cliente específicos dentro de algunos módulos.
- `app/dashboard/page.tsx` tiene aproximadamente **1.387 líneas** y reúne estado de usuario, roles, consultas, acciones, navegación, sidebar y contenido del dashboard.

### Módulos y estado real

El estado “parcial” significa que existe implementación visible y/o soporte en base de datos, pero no se confirmó su funcionamiento integral con pruebas de usuario y datos de prueba aislados. Ningún módulo se marca como completo únicamente por la existencia de una ruta.

| Módulo | Evidencia encontrada | Estado |
|---|---|---|
| Acceso y recuperación | `app/page.tsx`; Supabase Auth desde cliente | Parcial |
| Proxy y control de perfil activo | `proxy.ts`; consulta de `profiles.status` | Parcial; flujo manual no verificado |
| Dashboard y navegación | `app/dashboard/page.tsx`; sidebar colapsable y drawer móvil | Parcial |
| Perfil y fotografía | `app/dashboard/perfil/page.tsx`; migración de avatar versionada | Parcial; bucket aún no existe en el proyecto conectado |
| Distritos y congregaciones | Rutas administrativas y tablas `districts`, `congregations` | Parcial |
| Invitaciones y solicitudes | Rutas, RPC, notificaciones y pruebas unitarias | Parcial |
| Reubicación de creyentes | Ruta, historial y RPC de traslado/revisión | Parcial |
| Catálogo académico | Programas, cursos, módulos, lecciones y versiones | Parcial |
| Formación del estudiante | Rutas de formación, lecciones y progreso | Parcial |
| Evaluaciones | Rutas, intentos, preguntas, respuestas y RPC | Parcial |
| Actividades y entregas | Rutas de estudiante/tutor, asignaciones, entregas y revisiones | Parcial |
| Biblioteca académica | Rutas y Storage privado para recursos | Parcial |
| Tutorías y seguimiento | Rutas de tutor, asignaciones por curso y notas | Parcial |
| Reconocimientos | Ruta de estudiante presente; flujo completo no verificado | Parcial |
| Planificación y revisión académica | Rutas de planificación, revisión y materiales | Parcial |

### Base de datos observada

En la consulta de solo lectura del 15 de noviembre:

- **37 tablas** en el esquema `public`; las 37 tienen RLS habilitado.
- Se observaron relaciones mediante claves foráneas entre perfiles, roles, distritos, congregaciones, membresías, áreas, invitaciones y entidades académicas.
- **61 triggers** en `public`, según `information_schema.triggers`.
- Se observaron funciones en los esquemas `public` y `private`, incluidas funciones de autorización, publicación académica, evaluaciones, invitaciones, tutorías y reubicaciones.
- Hay **3 buckets de Storage** y los tres son privados: `academic-activity-submissions`, `academic-lesson-materials` y `academic-library-resources`.
- No hay vistas en el esquema `public` en la consulta realizada.

El documento existente `docs/SUPABASE_SCHEMA_BASELINE_AUDIT.md` registra una fotografía anterior de 13 tablas públicas. Ya no representa el tamaño actual del esquema y debe actualizarse cuando se aborde la reconciliación de migraciones.

## 4. Hallazgos por prioridad

### Crítica

**No se confirmó un hallazgo crítico explotable** con la evidencia estática y las consultas realizadas. Esto no equivale a una certificación de seguridad ni a una prueba de penetración.

### Alta

#### H-01 — Divergencia entre migraciones versionadas y migraciones registradas en Supabase

- **Evidencia:** `supabase/migrations/` contiene 54 archivos; el historial de migraciones del proyecto Supabase conectado contiene 65 versiones.
- **Versiones registradas en Supabase que no tienen archivo correspondiente en la rama auditada:**
  - `20261114024357_revoke_anon_execution_on_private_helpers`
  - `20261114024429_revoke_public_execution_on_private_helpers`
  - `20261114024510_remove_duplicate_role_policy_and_invitation_index`
  - `20261114114354` — `20261114040000_enforce_assessment_attempt_timing_and_validation`
  - `20261114114554` — `20261114041500_validate_assessment_options_and_answer_keys`
  - `20261114115504_persist_expired_assessment_attempts`
  - `20261114115614_handle_expired_assessment_attempt_limit`
  - `20261114122257_prevent_course_unlock_after_withdrawal`
  - `20261114141624_add_scoped_tutor_student_academic_detail`
  - `20261114141654_fix_scoped_tutor_student_detail_queries`
  - `20261114142250_create_scoped_tutor_student_notes`
  - `20261114144501_scope_tutor_notes_to_eligible_enrollments`
- **Diferencia adicional:** `20261115193000_create_private_profile_avatars.sql` sí está en Git, pero no figura en el historial de migraciones de Supabase.
- **Riesgo:** no se puede reconstruir ni reproducir con confianza el esquema actual desde esta rama. Un reset, baseline improvisada o despliegue de migraciones podría perder protecciones o generar divergencia.
- **Recomendación:** detener cualquier intento de reset o reconciliación automática. Hacer inventario DDL y reconciliación controlada en una rama aislada, preservando producción.

#### H-02 — La funcionalidad de avatar no está habilitada en el proyecto Supabase conectado

- **Evidencia:** la migración `supabase/migrations/20261115193000_create_private_profile_avatars.sql` crea el bucket privado `decom-profile-avatars`, sus políticas de Storage y grants de columnas. La consulta a `storage.buckets` devolvió cero filas para ese bucket.
- **Riesgo:** la carga/lectura de fotografías del perfil no funcionará contra el proyecto conectado mientras la migración no se pruebe y aplique en un entorno autorizado. El código no debe dar por disponible ese almacenamiento.
- **Recomendación:** probar esa migración en Supabase local cuando exista el entorno; después solicitar autorización específica antes de aplicarla en cualquier base remota. No se aplicó en esta auditoría.

### Media

#### M-01 — Funciones `SECURITY DEFINER` expuestas mediante el esquema `public`

- **Evidencia:** el catálogo registra 34 funciones `SECURITY DEFINER` en `public`. El asesor de seguridad de Supabase marca 29 como ejecutables por `authenticated`.
- **Mitigaciones observadas:** las funciones consultadas fijan `search_path` vacío; varias operaciones sensibles validan `auth.uid()`, perfil activo y alcance por distrito/curso. Otras funciones son helpers que delegan la comprobación a funciones internas.
- **Riesgo:** `SECURITY DEFINER` ejecuta con privilegios del propietario. Cada RPC expuesto debe revisarse individualmente para comprobar autenticación, autorización, alcance, validación de argumentos y privilegios `EXECUTE`.
- **Recomendación:** mantener una matriz función → consumidores → roles → ámbito → validaciones. No revocar indiscriminadamente funciones que la aplicación necesita; trasladar a `private` o limitar `EXECUTE` solo tras verificar dependencias.

#### M-02 — Seis tablas con RLS habilitado y sin políticas directas

El asesor de Supabase reporta:

- `public.academic_tutor_student_notes`
- `public.invitation_notifications`
- `public.invitation_requests`
- `public.membership_transfer_area_reviews`
- `public.membership_transfers`
- `private.academic_assessment_answer_keys`

RLS sin políticas produce denegación por defecto para accesos directos. Puede ser intencional si las operaciones pasan por RPCs o por servicio privilegiado. Se debe documentar el contrato de acceso y verificar que cada ruta legítima funcione sin exponer acceso directo.

#### M-03 — Privilegios de tabla excesivos para `anon`

- **Evidencia:** `anon` tiene grants de `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` y otros sobre `public.academic_course_tutor_assignments` y `public.roles`.
- Las políticas RLS observadas para asignaciones de tutores están dirigidas a `authenticated`; la tabla `roles` tiene una política de lectura pública, no políticas públicas de escritura.
- **Riesgo:** los grants exceden la necesidad aparente y dependen de RLS para bloquear operaciones anónimas.
- **Recomendación:** revisar y reducir privilegios a mínimo necesario en una fase de seguridad autorizada. No cambiar grants/RLS durante la renovación visual.

#### M-04 — Protección de contraseñas filtradas deshabilitada

- **Evidencia:** asesor de seguridad de Supabase `auth_leaked_password_protection` nivel `WARN`.
- **Riesgo:** Auth no está comprobando contraseñas contra el conjunto de credenciales comprometidas de HaveIBeenPwned.
- **Recomendación:** habilitar la protección desde la configuración de Auth después de evaluar el impacto en el registro y recuperación. Requiere autorización porque modifica configuración de autenticación.

#### M-05 — Documentación operativa incompleta y desactualizada

- `docs/CONTEXTO.md`, `docs/PROGRESS.md` y `docs/DECISIONS.md` no estaban presentes.
- El `AGENTS.md` versionado no refleja las reglas completas proporcionadas para el proyecto.
- `docs/SUPABASE_SCHEMA_BASELINE_AUDIT.md` describe 13 tablas, frente a las 37 observadas ahora.
- **Riesgo:** los agentes y colaboradores pueden tomar decisiones con contexto incompleto o con un inventario obsoleto.

#### M-06 — Deuda de dependencias moderadas

- **Evidencia de la auditoría de dependencias asociada al trabajo reciente:** 8 alertas moderadas agrupadas alrededor de `minimatch`, transitiva de herramientas ESLint/TypeScript. El workflow usa `npm audit --audit-level=high`, por lo que alertas moderadas no hacen fallar ese paso.
- La reparación automática previamente sugerida por npm implicaba bajar `eslint-config-next` a una versión 15, incompatible con Next.js 16.
- **Recomendación:** resolver mediante versiones compatibles/override revisado y pruebas completas. No ejecutar `npm audit fix --force` ni degradar Next.js/ESLint de forma automática.

### Baja

#### B-01 — Índices y claves foráneas

El asesor de rendimiento informa **33 claves foráneas sin índice de cobertura** y **67 índices no utilizados** en la fotografía consultada. Es una señal de optimización, no prueba de un fallo funcional. Antes de crear o borrar índices se deben revisar planes de consulta y carga real; no eliminar índices solo porque aún no tengan uso.

## 5. Seguridad: RLS, funciones y separación por distrito

### RLS y grants

- Las 37 tablas públicas consultadas tienen RLS habilitado.
- Las políticas de distritos, congregaciones, membresías, perfiles, invitaciones y asignaciones usan funciones de ámbito como `can_view_district`, `can_manage_district`, `can_manage_congregation` y `can_manage_area`.
- Se observan políticas con comprobaciones `USING` y `WITH CHECK` para operaciones de escritura y restricciones por distrito.
- Las seis tablas sin políticas directas requieren una ruta de acceso documentada y pruebas específicas.
- No se recomienda interpretar un grant a `authenticated` como autorización: el aislamiento depende de RLS y de las validaciones de cada RPC.

### Funciones privilegiadas

- Las funciones `SECURITY DEFINER` observadas usan `SET search_path TO ''`, lo cual reduce el riesgo de secuestro del search path.
- Las operaciones críticas consultadas incluyen comprobaciones explícitas de usuario y rol. Esto debe verificarse función por función, no generalizarse a todas.
- El asesor de Supabase marca 29 funciones ejecutables por usuarios autenticados. El hallazgo exige revisión, pero no significa que las 29 sean vulnerables.

### Separación entre distritos

- La estructura contiene `district_id` en las entidades de negocio y académicas relevantes y relaciones hacia `districts`.
- Las políticas observadas delegan autorización a helpers de ámbito distrital y de curso.
- La existencia de estas restricciones es positiva, pero no se ejecutaron pruebas negativas con usuarios de dos distritos. La separación no queda certificada hasta probar acceso cruzado (lectura, inserción, actualización, eliminación y RPC).

### Archivos y fotografías

- Los tres buckets académicos observados son privados y limitan tipos MIME y tamaño.
- El bucket `decom-profile-avatars` no está creado en el proyecto conectado.
- La migración de avatar restringe las rutas por `auth.uid()` y limita la actualización de columnas del perfil. Debe validarse en local antes de cualquier aplicación remota.
- Las políticas de Storage deben probarse tanto para lectura como para escritura, borrado y sustitución de archivos.

## 6. Autenticación, autorización y zona de riesgo frontend

| Archivo | Responsabilidad observada | Riesgo al rediseñar |
|---|---|---|
| `app/page.tsx` | UI de acceso, estado del formulario, `signInWithPassword`, recuperación, selector de tema y almacenamiento de correo recordado | Alto: separar presentación sin alterar autenticación, recuperación, mensajes ni redirección |
| `app/dashboard/page.tsx` | Carga de usuario/perfil/roles, estado del dashboard, administración de áreas, logout, navegación y sidebar | Alto: componente cliente de ~1.387 líneas con presentación y lógica mezcladas |
| `app/dashboard/perfil/page.tsx` | Lectura/actualización de perfil y carga de avatar | Alto: depende de columnas, permisos y bucket |
| `proxy.ts` | Actualiza sesión Supabase, consulta usuario y estado de perfil; bloquea dashboard sin sesión o perfil activo | Crítico para el control de acceso; fuera del alcance de las fases visuales |
| `lib/supabase/client.ts` | Cliente Supabase de navegador | Crítico; no modificar en fases de presentación |
| `lib/supabase/server.ts` | Cliente Supabase de servidor y cookies | Crítico; no modificar en fases de presentación |
| `lib/supabase/admin.ts` | Cliente privilegiado de servidor usando `SUPABASE_SECRET_KEY` | Crítico; nunca importar en cliente ni exponer secretos |

El proxy bloquea las rutas `/dashboard/:path*` cuando no hay usuario autenticado y redirige perfiles inexistentes/inactivos. El proxy no es un sustituto de las políticas RLS ni de la autorización por rol en la base de datos. La UI contiene comprobaciones de rol para mostrar módulos; estas no deben considerarse controles de seguridad.

## 7. Inventario visual y frontend

### Sistema actual

- Tokens CSS definidos en `app/globals.css`, con variantes clara y oscura.
- Inter cargada mediante `next/font/google` en `app/layout.tsx`.
- Iconos Lucide importados directamente en páginas.
- Preferencia `light | dark | system` almacenada en `localStorage` con clave `academia-theme`.
- Script `beforeInteractive` en el layout para aplicar el tema antes del primer pintado.
- Foco visible global y reglas de movimiento reducido.
- Sidebar con colapso persistente y drawer móvil dentro de `app/dashboard/page.tsx`.

### Inconsistencias con la guía de marca

La paleta requerida es azul `#087DB5`, turquesa `#19A7A0`, azul oscuro `#102D4D` y fondo claro `#F4F7FA`. Los tokens actuales incluyen, entre otros:

- `--background: #f4f7fb`
- `--brand: #0756a0`
- `--brand-strong: #0b3970`
- `--accent: #39a9dc`

Además, `app/globals.css` aplica fondos con `radial-gradient` y la página de acceso contiene gradientes decorativos y colores hardcodeados. Esto se aparta de la guía de marca y de la indicación de evitar gradientes decorativos. Debe corregirse en la fase 0/2 mediante tokens y estilos, no mediante cambios a la lógica de autenticación.

### Componentes y duplicación

- No se encontró una carpeta de componentes compartidos de primer nivel.
- El dashboard incluye sidebar, navegación, tarjetas y estados en la misma página.
- Las páginas de módulos importan iconos y definen estilos/estructuras localmente. La duplicación exacta debe confirmarse con una comparación visual y de código durante la fase 4.
- No debe hacerse una extracción masiva de componentes junto con cambios de comportamiento. Primero se estabilizan tokens y shell; luego se extraen componentes presentacionales pequeños.

### Login

La página actual contiene selector de tres temas, mostrar/ocultar contraseña, recuperación y estados de carga. La referencia solicitada (banner institucional con máscara, tarjeta angosta superpuesta, marca propia, ojo flotante y pie institucional) debe aplicarse en fase 2, conservando textos y handlers actuales. No copiar imágenes ni logotipos de Templum IPUC.

## 8. CI y verificación

### Workflow

Archivo: `.github/workflows/quality.yml`.

El workflow ejecuta:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm audit --audit-level=high`
5. `npm run typecheck`
6. `npm run build`

Node configurado en CI: 22. El build usa valores placeholder de Supabase definidos en el propio workflow; no se leyeron secretos ni archivos `.env*`.

### Ejecución real encontrada

- Run: **43752796060** — workflow “Verificación de calidad”.
- Job: **132930276035** — “Lint, tipos y compilación”.
- SHA: `0072fd4b659ea442a32ae9aa2ecb5d88043873a3`.
- Resultado: **success**.
- Instalación, ESLint, pruebas, auditoría configurada, TypeScript y build: todos los pasos reportan `success`.

Esto acredita la ejecución de CI para ese SHA, no la ejecución local de los comandos solicitados ni el flujo manual con dos roles.

### Resultado de comandos en este entorno

| Comando / prueba | Resultado |
|---|---|
| `npm install` | No ejecutado: no había checkout local y no fue posible clonar el repositorio por fallo de resolución DNS |
| `npm run build` | No ejecutado localmente; CI del SHA auditado pasó el paso de build |
| `npm run lint` | No ejecutado localmente; CI pasó ESLint |
| `npm run typecheck` | No ejecutado localmente; CI pasó TypeScript |
| `npm test` | No ejecutado localmente; CI pasó las pruebas |
| Login → dashboard → logout con dos roles | No ejecutado |
| Supabase local | No levantado: CLI y Docker no están instalados |
| Consultas de catálogo Supabase | Ejecutadas en solo lectura |
| Cambios en aplicación/base de datos | Ninguno |

## 9. Dependencias y scripts

`package.json` declara:

- `next: 16.4.5`
- `react: 19.3.0`, `react-dom: 19.3.0`
- `@supabase/ssr: ^0.12.7`
- `@supabase/supabase-js: ^2.119.0`
- `lucide-react: 0.555.0`
- ESLint 9, `eslint-config-next: 16.4.5`, TypeScript 5 y Tailwind CSS 4.

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`. No existe script de prueba E2E declarado en `package.json`.

## 10. Conclusión y condiciones previas a fase 0

El proyecto está en condiciones de iniciar una mejora visual incremental después de aprobar el plan. La fase 0 debe ser exclusivamente de presentación y tema, con pruebas de no regresión. No debe modificar `proxy.ts`, clientes Supabase, guards, RPCs, políticas RLS, grants ni migraciones.

Antes de dar por terminada la renovación completa deben abordarse por separado la divergencia de migraciones, la validación del bucket de avatar y los avisos de seguridad de Supabase. Esta auditoría no aplicó correcciones.

**Estado de esta sesión:** documentación de diagnóstico y planificación; cero cambios en código de aplicación, Supabase o datos.
