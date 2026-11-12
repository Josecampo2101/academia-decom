# Espacios académicos y flujo de planificación

## Rutas por perfil

| Ruta | Perfil | Responsabilidad |
|---|---|---|
| `/dashboard/espacio` | Todos los perfiles activos | Accesos e indicadores limitados por rol y distrito |
| `/dashboard/estudiante` | Estudiante (`member`) | Acceso al espacio de trabajo conectado por perfil |
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

## Evaluaciones y progresión curricular

- `academic_assessments` configura evaluaciones de lección, prácticas y examen final por curso.
- `academic_assessment_questions` almacena enunciados y opciones; las claves de respuesta viven en `private.academic_assessment_answer_keys` y no se exponen al estudiante.
- `save_academic_assessment_question` guarda preguntas y claves mediante una función autorizada; `publish_academic_assessment` valida que el instrumento tenga preguntas y claves compatibles.
- `submit_academic_assessment` valida matrícula activa, respuestas completas, máximo de intentos y prerrequisitos del examen final; calcula la nota objetiva en PostgreSQL.
- `academic_assessment_attempts` y `academic_assessment_responses` conservan intentos, respuestas, puntajes y retroalimentación.
- `review_academic_assessment_response` permite al tutor calificar respuestas abiertas; la nota definitiva solo se cierra cuando no quedan respuestas pendientes.
- Aprobar el examen final completa la matrícula y crea la matrícula activa del siguiente curso publicado del mismo programa. La lectura del historial sigue disponible para matrículas completadas.

Las rutas `/dashboard/tutor/evaluaciones/crear`, `/dashboard/tutor/evaluaciones` (bandeja de revisión), `/dashboard/estudiante/evaluaciones` y `/dashboard/estudiante/evaluaciones/[assessmentId]` consumen el backend real. El antiguo recorrido `/practica` permanece como demostración heredada y no genera calificaciones oficiales. El panel `/dashboard/estudiante` reutiliza el espacio por perfil y ya no presenta cursos, tareas ni reconocimientos ficticios.

## Pendientes

- Añadir paginación y filtros por curso/estado a la bandeja de revisión cuando haya volumen real de intentos.
- Asignación formal de tutorías y seguimiento individual.
- Pruebas de integración con cuentas reales de cada perfil.
- Verificación final de lint, TypeScript y build en CI antes de integrar a `main`.
