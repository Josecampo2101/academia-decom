# Administración del catálogo académico

> Implementación inicial persistente en Supabase. El catálogo ya no usa fixtures locales ni guarda cambios únicamente en memoria.

## Ruta y acceso

Ruta: `/dashboard/administracion/catalogo`.

La interfaz verifica sesión y asignaciones:
- `national_admin`: puede seleccionar distritos activos y administrar el catálogo.
- `academic_editor`: puede crear contenido en los distritos donde tenga una asignación explícita.
- La comprobación del cliente solo controla la experiencia. Las políticas RLS y funciones de base de datos son la autoridad.

El lanzamiento inicial utiliza Distrito 34. El modelo conserva `district_id` en todos los niveles para incorporar otros distritos sin rediseñar las relaciones.

## Jerarquía curricular

1. **Programa:** línea o itinerario formativo.
2. **Curso:** unidad formativa asociada a un programa.
3. **Módulo:** agrupación secuencial de contenidos dentro de un curso.
4. **Lección:** unidad de aprendizaje dentro de un módulo, con contenido y duración estimada.

La interfaz consulta programas, cursos, módulos y lecciones en Supabase. Permite crear borradores, navegar por la estructura y filtrar cursos por texto y estado. Los códigos de programas y cursos se generan con un identificador aleatorio para evitar colisiones entre distritos.

## Esquema persistente

| Tabla | Responsabilidad |
|---|---|
| `academic_programs` | Programas, código, descripción, estado y orden |
| `courses` | Cursos vinculados a programa, código, nivel, estado y orden |
| `course_modules` | Módulos vinculados a curso, estado y orden |
| `lessons` | Lecciones, resumen, objetivos, contenido JSON y duración |
| `curriculum_versions` | Fotografías inmutables de cursos publicados |
| `academic_catalog_events` | Auditoría de altas y cambios del catálogo |

Las relaciones compuestas incluyen `district_id`, de modo que una fila hija no puede enlazarse a un padre de otro distrito. El orden de módulos y lecciones tiene restricciones únicas diferibles para permitir reordenamientos transaccionales en una fase posterior.

## Publicación y versionado

- Los registros nuevos nacen como `draft`.
- Los editores académicos solo pueden crear y modificar borradores dentro de su distrito.
- La publicación está reservada a Administración nacional.
- Una lección requiere contenido Markdown no vacío.
- Un módulo requiere al menos una lección publicada.
- Un curso requiere al menos un módulo publicado y una lección publicada.
- Un programa requiere al menos un curso publicado.
- El curso se publica mediante `publish_academic_course`. La función crea una fila en `curriculum_versions` con una fotografía del programa, curso, módulos y lecciones publicadas, y actualiza el curso en la misma transacción.
- Una versión publicada o archivada es inmutable. Un curso publicado no se edita en el lugar; se deberá crear una nueva versión en el flujo de actualización curricular.
- El archivado es lógico. No se conceden permisos de borrado físico sobre las tablas del catálogo.

Los estudiantes solo pueden consultar filas publicadas y la política de lectura exige que también estén publicados sus elementos ancestros. Las versiones publicadas solo se muestran si el curso y el programa siguen publicados.

## Seguridad y auditoría

- RLS está habilitado en las seis tablas.
- No hay permisos de lectura para `anon`.
- `academic_catalog_events` es de solo lectura para clientes autenticados; los eventos se escriben mediante triggers de base de datos.
- Las tablas de contenido no conceden `DELETE` a clientes autenticados.
- Las funciones de autorización están en el esquema no expuesto `private`, son `SECURITY DEFINER`, usan `search_path = ''` y tienen EXECUTE limitado a usuarios autenticados.
- El frontend nunca decide por sí solo si un usuario puede publicar o consultar contenido.

## Migraciones aplicadas en producción

Los archivos del repositorio usan exactamente las versiones registradas en `supabase_migrations.schema_migrations`:

- `20261111182603_create_academic_catalog_core.sql`
- `20261111182634_restrict_academic_catalog_audit_writes.sql`
- `20261111182700_revoke_academic_catalog_deletes.sql`
- `20261111183047_validate_academic_publication.sql`
- `20261111183220_publish_academic_course_version.sql`
- `20261111183747_enforce_academic_publication_hierarchy.sql`

La migración `20261111024732_allow_committee_create_congregations.sql` también permanece versionada porque ya estaba aplicada antes de recuperarse al repositorio.

## Estado y límites de esta entrega

- La interfaz administrativa ya consulta y crea registros reales del catálogo.
- El esquema y las políticas RLS están instalados en Supabase.
- No se han sembrado programas, cursos ni lecciones ficticios en producción.
- El formulario actual cubre altas y publicación/archivo; la edición de contenido existente y el reordenamiento visual quedan pendientes.
- Matrículas, progreso por lección, biblioteca vinculada, actividades, evaluaciones y tutorías aún requieren sus propias tablas, RPC y políticas.
- El panel del estudiante todavía no consume las versiones publicadas.
- No se ha desplegado a Vercel.
