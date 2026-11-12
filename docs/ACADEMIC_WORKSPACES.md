# Espacios académicos y flujo de planificación

## Rutas por perfil

| Ruta | Perfil | Responsabilidad |
|---|---|---|
| `/dashboard/espacio` | Todos los perfiles activos | Accesos e indicadores limitados por rol y distrito |
| `/dashboard/formacion` | Estudiante (`member`) | Cursos matriculados, lecciones publicadas y avance |
| `/dashboard/tutor` | Tutor | Seguimiento de sus planificaciones y observaciones |
| `/dashboard/planificador` | Tutor, editor académico, dirección, comité y administración nacional | Preparación de sesiones y materiales |
| `/dashboard/revision-academica` | Editor académico y administración nacional | Aprobar o devolver planificaciones |
| `/dashboard/matriculas` | Dirección distrital, comité distrital y administración nacional | Asignar cursos publicados a integrantes activos |

Los permisos de interfaz no sustituyen RLS. Las políticas y triggers de Supabase son la autoridad final.

## Flujo del planner

1. Seleccionar distrito, programa, curso, módulo y lección.
2. Definir título, tema, descripción, público, resultados de aprendizaje, metodología y duración.
3. Organizar apertura, desarrollo, cierre, evaluación y tarea.
4. Adjuntar recursos de clase.
5. Guardar como borrador o enviar a revisión.
6. El editor académico o administrador nacional aprueba o devuelve con observaciones.
7. El tutor consulta las observaciones y corrige la planificación.

Estados de planificación: `draft`, `review`, `approved`, `changes_requested`.

Los materiales admiten texto/guía, PDF, Word, presentaciones, imágenes, audio, video, talleres, enlaces y otros recursos permitidos por el bucket privado `academic-lesson-materials`. Límite actual: 50 MB por archivo.

## Matrículas y avance

- `course_enrollments` relaciona estudiante, curso y distrito.
- `lesson_progress` registra el estado por lección.
- La inserción de matrículas exige programa y curso publicados, perfil con membresía activa y congregación activa en el mismo distrito.
- Los identificadores de estudiante, curso y distrito de una matrícula no se pueden reasignar después de crearla.
- El estudiante solo consulta sus matrículas y su avance; dirección, comité y administración nacional consultan los datos de su ámbito autorizado.

## Seguridad de revisión

Los campos `review_feedback`, `reviewed_by` y `reviewed_at` son metadatos de revisión. Un trigger de base de datos impide que tutores y otros perfiles no revisores aprueben o devuelvan planificaciones, o modifiquen esos metadatos.

## Pendientes

- Evaluaciones finales, calificaciones y desbloqueo secuencial de cursos.
- Asignación formal de tutorías y seguimiento individual.
- Pruebas de integración con cuentas reales de cada perfil.
- Verificación final de lint, TypeScript y build en CI antes de integrar a `main`.
