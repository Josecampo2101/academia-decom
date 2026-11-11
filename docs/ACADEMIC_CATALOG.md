# Administración del catálogo académico

> Prototipo funcional de interfaz. Los datos son sintéticos y locales; no existe persistencia ni escritura en Supabase.

## Ruta y acceso

Ruta: `/dashboard/administracion/catalogo`.

Acceso visual disponible para `national_admin` y `academic_editor`. La ruta verifica sesión y asignaciones de rol en el cliente, siguiendo el patrón del módulo de Biblioteca. Esta comprobación mejora la experiencia, pero **no sustituye** autorización en servidor, RPC ni políticas RLS.

## Jerarquía curricular

La estructura propuesta es:

1. **Programa:** agrupa una línea o itinerario de formación.
2. **Curso:** unidad formativa con descripción y estado editorial.
3. **Módulo:** agrupación secuencial de contenidos dentro de un curso.
4. **Lección:** unidad de aprendizaje dentro de un módulo, con duración estimada y estado.

El prototipo permite crear elementos en cada nivel, navegar entre programas y cursos, seleccionar módulos, filtrar cursos por texto/estado y simular publicación/archivo de cursos. Las altas se conservan solo en memoria durante la sesión.

## Reglas funcionales propuestas

- Un curso pertenece a un programa; un módulo pertenece a un curso; una lección pertenece a un módulo.
- El orden curricular debe ser explícito y editable, no depender del orden alfabético.
- La publicación de una lección debe considerar prerrequisitos y recursos asociados.
- Un curso publicado no debe cambiar silenciosamente cuando se edita su contenido: se debe versionar la estructura curricular o establecer una política de actualización con trazabilidad.
- El archivado debe impedir nuevas matrículas sin borrar historial académico.
- Los cambios de estado deben generar auditoría con actor, fecha, estado anterior, estado nuevo y motivo.
- La duración de una lección es una estimación pedagógica; no equivale a tiempo efectivo de conexión.

## Modelo lógico conceptual (no es DDL aprobado)

- `academic_programs`: identidad, nombre, descripción, estado y orden.
- `courses`: programa, código institucional, nombre, descripción, nivel, estado y versión curricular.
- `course_modules`: curso, nombre, descripción, orden y estado.
- `lessons`: módulo, nombre, objetivos, contenido, duración, orden y estado.
- `curriculum_versions`: versión publicada e historial de cambios.
- `academic_catalog_events`: actor, entidad, acción, cambios y fecha.

Las relaciones, claves, restricciones, borrado lógico, alcance distrital y compatibilidad con el modelo académico existente deben validarse antes de diseñar migraciones.

## Permisos propuestos

| Acción | Administración nacional | Editor académico |
|---|---:|---:|
| Consultar catálogo | Sí | Sí |
| Crear programas/cursos/módulos/lecciones | Sí | Según ámbito asignado |
| Editar borradores | Sí | Según ámbito asignado |
| Publicar | Sí | Permiso explícito |
| Archivar | Sí | Permiso explícito |
| Consultar auditoría | Completa | Limitada al ámbito |

El rol no debe inferirse solo desde el frontend. Toda mutación debe comprobar permisos y ámbito en servidor y/o políticas RLS. Para el lanzamiento inicial, el ámbito institucional debe contemplar Distrito 34 sin bloquear la futura incorporación de otros distritos.

## Integración futura con Biblioteca y experiencia estudiantil

- El catálogo curricular debe ser la fuente canónica de programas, cursos, módulos y lecciones.
- Los recursos de Biblioteca se vincularán mediante identificadores estables a cursos, módulos o lecciones; no mediante nombres escritos libremente.
- El panel del estudiante mostrará únicamente versiones publicadas y aplicables a su asignación académica.
- El progreso debe registrar avance por lección y versión curricular, evitando que cambios editoriales alteren retroactivamente resultados.
- Las evaluaciones y actividades deben asociarse a curso/módulo/lección y conservar su propia versión.

## Criterios de aceptación para una integración real

- Ningún usuario no autorizado puede consultar o mutar el catálogo.
- Los editores solo operan dentro de su ámbito asignado.
- No se publica un curso que contenga módulos o lecciones incompletos según las reglas aprobadas.
- El orden de módulos y lecciones es persistente y auditable.
- El estudiante no ve borradores ni cursos archivados.
- Las versiones publicadas mantienen integridad histórica para matrículas, calificaciones y reconocimientos.
- Las operaciones críticas son transaccionales e idempotentes.
- Las pruebas de permisos se ejecutan en un entorno aislado antes de aprobar migraciones.

## Límites de esta entrega

- No crea tablas, RPC, migraciones ni políticas RLS.
- No modifica datos ni configuración de Supabase.
- No implementa matrícula, seguimiento real ni publicación persistente.
- No carga contenido ni archivos.
- No despliega a Vercel.
