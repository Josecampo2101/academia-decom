## Revisión actualizada — 22 de noviembre de 2026

Esta sección reemplaza como referencia operativa las cifras preliminares del inventario del 11 de noviembre. La sección histórica se conserva debajo para trazabilidad.

### Estado del proyecto y migraciones

- Proyecto de producción inspeccionado en modo de solo lectura.
- Producción registra **66 migraciones**; la rama de trabajo conserva **54 archivos SQL**.
- Hay **12 versiones registradas en producción que no tienen archivo correspondiente en el repositorio**:
  - `20261114024357_revoke_anon_execution_on_private_helpers`
  - `20261114024429_revoke_public_execution_on_private_helpers`
  - `20261114024510_remove_duplicate_role_policy_and_invitation_index`
  - `20261114114354_20261114040000_enforce_assessment_attempt_timing_and_validation`
  - `20261114114554_20261114041500_validate_assessment_options_and_answer_keys`
  - `20261114115504_persist_expired_assessment_attempts`
  - `20261114115614_handle_expired_assessment_attempt_limit`
  - `20261114122257_prevent_course_unlock_after_withdrawal`
  - `20261114141624_add_scoped_tutor_student_academic_detail`
  - `20261114141654_fix_scoped_tutor_student_detail_queries`
  - `20261114142250_create_scoped_tutor_student_notes`
  - `20261114144501_scope_tutor_notes_to_eligible_enrollments`
- La migración de avatares tiene una discrepancia de versión: producción registra `20261116020237_create_private_profile_avatars`; el repositorio contiene `20261115193000_create_private_profile_avatars`. No deben marcarse versiones como aplicadas ni renombrarse sin reconciliar su contenido.

**Conclusión:** no ejecutar las 54 migraciones directamente sobre una base vacía. Varias presuponen tablas, funciones y permisos que no forman parte de una baseline versionada. Hace falta una extracción DDL completa y una baseline probada antes de reconstruir Staging.

### Inventario de producción verificado

| Elemento | Estado actual |
|---|---:|
| Tablas en `public` | 37 |
| Tablas públicas con RLS | 37 |
| Tablas públicas con RLS y sin políticas directas | 5 |
| Políticas RLS en `public` | 98 |
| Políticas en `storage` | 14 |
| Buckets privados | 4 |

Las cinco tablas públicas con RLS y sin políticas directas son `academic_tutor_student_notes`, `invitation_notifications`, `invitation_requests`, `membership_transfer_area_reviews` y `membership_transfers`. También existe `private.academic_assessment_answer_keys` con RLS y sin políticas directas. Esto no prueba una exposición: el acceso debe evaluarse junto con grants y RPC/funciones servidor. `invitation_requests` tiene un grant SELECT para `authenticated`, pero sin política RLS no permite leer filas directamente.

Los cuatro buckets existen y son privados:
- `academic-activity-submissions` — 50 MiB.
- `academic-lesson-materials` — 50 MiB.
- `academic-library-resources` — 50 MiB.
- `decom-profile-avatars` — 5 MiB.

El bucket de avatares sí existe en producción. La consulta actual confirma políticas de lectura, inserción y eliminación propias limitadas a la carpeta del usuario autenticado. La afirmación histórica de que no existía el bucket quedó obsoleta.

### Funciones privilegiadas y permisos

Inventario de `SECURITY DEFINER`:
- `public`: 34 funciones; 0 ejecutables por `anon`, 29 ejecutables por `authenticated`.
- `private`: 44 funciones; 0 ejecutables por `anon`, 30 ejecutables por `authenticated`.
- Las 78 funciones observadas tienen `search_path` explícito.

No deben contarse las funciones ejecutables por `authenticated` como vulnerabilidades automáticamente. Hay que revisar la autorización de cada función y sus helpers. Las funciones públicas inspeccionadas delegan varias comprobaciones a helpers de rol y ámbito; los helpers privados deben mantenerse fuera de los esquemas expuestos por la API y sus permisos deben seguir siendo intencionales. No se modificaron grants ni funciones.

### Datos operativos de producción — 22 de noviembre

Consulta de solo lectura, sin exponer datos personales:

| Distrito | Estado | Congregaciones activas | Membresías activas |
|---|---|---:|---:|
| `34` (código `34`) | Activo | 138 | 0 |
| `7` (código `07`) | Activo | 1 | 1 |

Además, existen 2 solicitudes de invitación en estado `approved` y 0 filas en la cola `invitation_notifications`. Este snapshot no demuestra que el nuevo flujo esté roto —las solicitudes pueden ser históricas—, pero obliga a probar una solicitud nueva, su aprobación/rechazo y el encolado de notificaciones en Staging antes del uso real.

Los nombres actuales de los distritos están almacenados como `34` y `7`, no como `Distrito 34` y `Distrito 7`. No se modificaron datos para normalizarlos.

### Staging y Vercel — 22 de noviembre

- El proyecto Supabase `Academia DECOM Staging` fue restaurado.
- Staging está vacío: no tiene tablas ni migraciones. No se copiaron datos de producción.
- El entorno Preview de Vercel quedó separado de Production/Development y apunta al proyecto Staging.
- Se verificó el bundle del Preview: contiene la referencia de Staging y no la referencia de producción.
- Se verificó el bundle del dominio de producción: contiene la referencia de producción y no la de Staging.
- Preview está en estado READY. Las rutas públicas `/`, `/actualizar-contrasena` y `/solicitud-invitacion` respondieron HTTP 200.
- No se ejecutaron pruebas autenticadas porque Staging aún no tiene esquema ni cuentas de prueba.
- La rama Preview tiene un `CRON_SECRET` independiente y URLs propias. El dominio de producción conserva sus variables separadas.

La creación de una rama de base de datos a partir de producción fue cotizada por Supabase en **USD 0,01344 por hora** y requiere confirmación explícita del coste. No se creó esa rama.

### Bloqueos de configuración para el uso real

No aparecen configuradas en Vercel las siguientes credenciales necesarias para completar los flujos:
- `SUPABASE_SECRET_KEY` — operaciones privilegiadas del servidor.
- `RESEND_API_KEY` y `RESEND_FROM_EMAIL` — notificaciones de invitación.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` — protección del formulario público.

El hostname esperado de Turnstile quedó configurado por separado para Preview y Production, pero eso no sustituye las claves reales. La protección de contraseñas filtradas de Supabase Auth continúa deshabilitada y debe activarse antes de abrir el registro al distrito.

Tampoco hay un programador configurado para invocar `/api/cron/invitation-notifications`: no existe `vercel.json` con Cron ni un programador externo documentado como activo. El worker no enviará automáticamente la cola hasta configurar el programador. En Vercel Hobby la cadencia mínima admitida es cada 15 minutos; se debe habilitar después de configurar y probar las claves de servidor y Resend. El formulario público también necesita un rate limiter persistente por IP/token antes de una difusión amplia.

### Validación de código

En el commit `79436f8a18bdac9d42cf3ea5b49a52a8ce5514de`:
- GitHub Actions: `success`.
- Prettier, ESLint, TypeScript, pruebas y build: correctos.
- `npm audit --audit-level=moderate`: 0 vulnerabilidades, después de fijar `minimatch@11.0.9` para `@typescript-eslint/typescript-estree`.
- Vercel Preview: `READY`.

### Siguientes pasos seguros

1. Obtener una línea base DDL completa de producción, sin datos ni secretos.
2. Reconciliar las 12 migraciones ausentes y la versión de la migración de avatares.
3. Crear y validar la baseline en Staging; aplicar después las migraciones incrementales.
4. Configurar las claves reales de Supabase, Resend y Turnstile en los entornos correspondientes.
5. Activar protección de contraseñas filtradas.
6. Crear cuentas de prueba y recorrer los flujos de los siete roles, invitaciones, perfiles, formación, biblioteca, evaluaciones, seguimiento, reconocimientos y traslados.
7. Resolver la cadena de PRs apiladas antes de integrar a `main`.

**Regla de seguridad:** producción permanece intacta. No se debe promover a producción mientras Staging no sea reproducible y las pruebas autenticadas no hayan pasado.

---

# Auditoría inicial de línea base de Supabase

> Estado: inventario preliminar de solo lectura. No es una migración baseline ni declara que el esquema sea reproducible todavía.

- Proyecto inspeccionado: Academia DECOM (`mfnavhfgjqlscjhuxgkj`).
- Fecha de inspección: 2026-11-11.
- Rama de trabajo: `docs/supabase-schema-baseline-audit`.
- Alcance: consultas de catálogo y metadatos; no se ejecutó DDL ni se modificaron datos, permisos o configuración.

## 1. Hallazgo principal

El historial de migraciones registrado actualmente en producción contiene cinco versiones:

| Versión | Nombre |
|---|---|
| `20261111024732` | `allow_committee_create_congregations` |
| `20261111100116` | `break_congregations_memberships_rls_cycle` |
| `20261111100516` | `grant_authenticated_invitation_management` |
| `20261111100627` | `restrict_legacy_invitation_rpc_access` |
| `20261111100827` | `add_scoped_invitation_request_listing` |

El inventario de objetos existentes es considerablemente más amplio que esas cinco entradas. Por tanto, **no se debe ejecutar un reset, reconstruir producción desde cero ni asumir que el historial actual permite crear una base equivalente**.

## 2. Inventario confirmado

Consultas de catálogo de solo lectura sobre los esquemas indicados:

| Objeto | Cantidad |
|---|---:|
| Tablas del esquema `public` | 13 |
| Funciones en `public` y `private` | 30 |
| Triggers no internos en `public`, `auth` y `storage` | 17 |
| Políticas RLS en `public` y `storage` | 32 |
| Índices en `public` y `storage` | 70 |

### Tablas públicas observadas

- `area_memberships`
- `areas`
- `congregations`
- `districts`
- `invitation_notifications`
- `invitation_requests`
- `invitations`
- `membership_transfer_area_reviews`
- `membership_transfers`
- `memberships`
- `profiles`
- `roles`
- `user_role_assignments`

Las 13 tablas observadas tienen RLS habilitado en el inventario de tablas consultado.

### Observaciones de Storage

La consulta de inventario a `storage.buckets` no devolvió filas agregadas. Se debe confirmar el estado de Storage y sus políticas con una consulta específica antes de diseñar la baseline. No se debe interpretar la ausencia de buckets como prueba de que toda la configuración de Storage sea inexistente.

## 3. Riesgos y límites de esta inspección

Este documento todavía no contiene una extracción completa de:

- Definiciones de todas las tablas, constraints, secuencias y tipos.
- Definiciones completas de vistas y materialized views.
- Todas las funciones, triggers y dependencias en formato reproducible.
- Grants de esquemas, tablas, secuencias y funciones, incluidos privilegios por defecto.
- Políticas y configuración de Storage, buckets y objetos.
- Extensiones instaladas y sus esquemas, versiones y dependencias.
- Configuración de Auth, Realtime, cron, Vault y otros componentes gestionados.
- Comparación objeto por objeto entre producción, migraciones del repositorio y ramas abiertas.

Los conteos son una fotografía del catálogo consultado; no sustituyen la extracción DDL ni la validación en una base aislada.

## 4. Procedimiento seguro propuesto

1. Congelar una referencia del estado actual de producción y registrar fecha/hora de extracción.
2. Inventariar por separado objetos administrados por Supabase y objetos propios de la aplicación.
3. Descargar el contenido de las migraciones versionadas en todas las ramas relevantes y compararlo con las cinco versiones registradas.
4. Obtener el DDL del esquema propio sin incluir datos de usuarios ni secretos.
5. Clasificar cada objeto como cubierto, faltante, divergente o administrado por Supabase.
6. Construir una baseline para instalaciones nuevas, separada de las migraciones incrementales existentes.
7. Probar la baseline en una base de desarrollo aislada y vacía; verificar tablas, constraints, índices, funciones, triggers, políticas y grants.
8. Aplicar las migraciones incrementales posteriores y comparar el esquema resultante con el inventario de origen.
9. Añadir CI para detectar drift y validar migraciones en cada PR.
10. Documentar el procedimiento de restauración y rollback.

## 5. Reglas de seguridad

- No ejecutar `db reset`, DROP, TRUNCATE ni recreación de objetos en producción.
- No marcar migraciones como aplicadas para ocultar diferencias.
- No copiar datos reales de perfiles, membresías, invitaciones ni tokens a una base de prueba.
- No incluir secretos, claves API, contraseñas ni valores de Vault en Git.
- No generar una baseline a partir de un inventario parcial.
- No aplicar una baseline a producción. La baseline es para instalaciones nuevas; producción conserva su historial y requiere un plan de reconciliación separado.
- Todo cambio de esquema posterior debe llegar como migración revisable y probarse fuera de producción.

## 6. Próximos entregables

- [ ] Extracción DDL completa y sanitizada.
- [ ] Matriz de cobertura entre catálogo de producción y migraciones del repositorio.
- [ ] Baseline reproducible para bases nuevas.
- [ ] Prueba de reconstrucción en entorno aislado.
- [ ] Validación automática de migraciones y tipos.
- [ ] Guía de operación, restauración y rollback.

**Conclusión:** la auditoría confirma que la línea base de migraciones es una prioridad real. El trabajo realizado aquí es únicamente el primer inventario; no se ha creado ni aplicado una migración baseline.


## 7. Inventario estructural por tabla

Consulta de solo lectura del catálogo, agrupada por tabla. Los conteos incluyen constraints declaradas y políticas visibles en `pg_policies`.

| Tabla | Columnas | Constraints | Índices | Políticas | RLS |
|---|---:|---:|---:|---:|---|
| `area_memberships` | 7 | 12 | 4 | 4 | Sí |
| `areas` | 5 | 7 | 2 | 4 | Sí |
| `congregations` | 9 | 10 | 3 | 4 | Sí |
| `districts` | 7 | 9 | 2 | 4 | Sí |
| `invitation_notifications` | 14 | 15 | 4 | 0 | Sí |
| `invitation_requests` | 14 | 15 | 5 | 0 | Sí |
| `invitations` | 13 | 15 | 4 | 4 | Sí |
| `membership_transfer_area_reviews` | 10 | 14 | 4 | 0 | Sí |
| `membership_transfers` | 9 | 15 | 5 | 0 | Sí |
| `memberships` | 6 | 11 | 4 | 4 | Sí |
| `profiles` | 7 | 7 | 1 | 2 | Sí |
| `roles` | 5 | 6 | 2 | 2 | Sí |
| `user_role_assignments` | 7 | 11 | 4 | 4 | Sí |

**Importante:** cero políticas directas no equivale a acceso público. En las tablas de solicitudes, notificaciones y traslados se observó RLS habilitado y ninguna política directa; hay que preservar y verificar sus rutas de acceso por RPC/servidor durante la extracción completa.

## 8. Extensiones observadas

| Extensión | Versión | Esquema |
|---|---|---|
| `pg_stat_statements` | 1.11 | `extensions` |
| `pgcrypto` | 1.3 | `extensions` |
| `plpgsql` | 1.0 | `pg_catalog` |
| `supabase_vault` | 0.3.1 | `vault` |
| `uuid-ossp` | 1.1 | `extensions` |

Las extensiones gestionadas por Supabase deben distinguirse de las dependencias instaladas explícitamente por la aplicación. No se deben recrear ciegamente en una baseline ni copiar contenidos de Vault.

## 9. Riesgo de interpretación del catálogo

La inspección confirmó 32 políticas en `public` y `storage`, pero la consulta por tabla pública suma 32 políticas públicas. Las tablas de solicitudes, notificaciones y transferencias tienen RLS activo y cero políticas listadas, una decisión de aislamiento que no debe alterarse por simplificar la baseline. La extracción final debe incluir también ACL, funciones SECURITY DEFINER, propietarios y dependencias de RPC, y comprobar que no se introduzcan grants accidentales a `anon` o `authenticated`.
