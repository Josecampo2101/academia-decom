# Autoría de actividades y evaluaciones

> Interfaz de prototipo con datos ficticios y estado local. No registra entregas, intentos ni calificaciones reales.

## Ruta y permisos

Ruta: `/dashboard/administracion/actividades`.

Acceso de interfaz para `national_admin` y `academic_editor`, con verificación de sesión y asignaciones de rol en cliente. Esta comprobación no reemplaza las políticas de servidor/RLS que deberán proteger cada consulta y mutación.

## Capacidades de la interfaz

- Catálogo unificado de actividades y evaluaciones.
- Búsqueda por título, curso y módulo.
- Filtros por tipo de contenido y estado editorial.
- Alta y edición de instrucciones, programa, curso, módulo, formato de respuesta y fecha límite opcional.
- Selección curricular jerárquica mediante IDs estables de programa, curso y módulo; las opciones de curso y módulo dependen de la selección superior.
- Actividades: respuesta escrita, archivo adjunto, enlace externo o evidencia audiovisual.
- Rúbricas opcionales para actividades, con criterios, descripciones observables y puntajes enteros; el total no puede superar 100 puntos.
- Evaluaciones: selección única, selección múltiple, verdadero/falso y respuesta corta.
- Constructor local de preguntas y opciones, con selección explícita de claves correctas para preguntas objetivas.
- Estados borrador, publicado y archivado.
- Acciones de publicación, archivado y restauración simuladas.

La interfaz usa un conjunto local de programas, cursos y módulos con los mismos identificadores de referencia del prototipo del catálogo académico. Los nombres se presentan al usuario, pero el contenido conserva `programId`, `courseId` y `moduleId`; cambiar de programa reinicia curso y módulo, y cambiar de curso reinicia módulo. Estos fixtures están duplicados entre prototipos y deberán sustituirse por una fuente compartida/API cuando exista persistencia.

## Reglas funcionales propuestas

### Actividades
- Deben tener instrucciones, formato de entrega, fecha de apertura/cierre opcional y criterios de evaluación.
- Deben definir tamaño y tipos MIME permitidos si reciben archivos.
- Las entregas deben quedar asociadas a estudiante, actividad y versión publicada.
- La reentrega debe seguir una política explícita y conservar historial.
- Los comentarios y rúbricas de tutoría deben tener estados y trazabilidad.

### Evaluaciones
- Cada pregunta debe tener tipo, enunciado, orden, puntaje, opciones y configuración de respuesta. El editor exige clave correcta para preguntas objetivas; selección única y verdadero/falso deben tener exactamente una.
- Las preguntas objetivas deben almacenar claves correctas fuera de cualquier payload visible al estudiante.
- La selección múltiple debe definir si exige coincidencia exacta o admite crédito parcial.
- Las preguntas de respuesta corta requieren calificación manual o criterios/rúbrica aprobados.
- Intentos, duración, aleatorización, retroalimentación y ventanas de disponibilidad deben configurarse por evaluación.
- El envío debe ser transaccional e idempotente; no confiar en temporizadores ni cálculos del navegador.
- Una evaluación publicada debe conservar versión para que cambios posteriores no alteren intentos existentes.

## Modelo lógico conceptual (no es DDL aprobado)

- `learning_activities`: curso/lección, instrucciones, formato de entrega, fechas, estado y versión.
- `activity_submissions`: estudiante, actividad/versión, contenido o referencia de archivo, estado y fechas.
- `assessments`: curso/lección, configuración de intentos, duración, fechas, estado y versión.
- `assessment_questions`: evaluación/versión, tipo, enunciado, orden, puntaje y configuración privada.
- `assessment_options`: pregunta, texto, orden y clave correcta protegida.
- `assessment_attempts`: estudiante, evaluación/versión, inicio, envío, estado y puntaje.
- `assessment_answers`: intento, pregunta/versión, respuesta y resultado.
- `tutor_reviews`: entrega, tutor, rúbrica, observaciones, calificación y fechas.
- `academic_content_events`: actor, acción, entidad, versión, resultado y fecha.

Las entidades deben vincularse con IDs de programa/curso/módulo/lección del catálogo académico y con el ámbito autorizado del usuario.

## Matriz de permisos propuesta

| Acción | Administración nacional | Editor académico | Tutor | Estudiante |
|---|---:|---:|---:|---:|
| Crear/editar borradores | Sí | Según ámbito | No | No |
| Publicar/archivar | Sí | Permiso explícito | No | No |
| Consultar contenido publicado | Sí | Sí | Sí | Según matrícula |
| Ver entregas | Según permiso | Según permiso | Estudiantes asignados | Solo propias |
| Calificar entregas | Según permiso | No por defecto | Estudiantes asignados | No |
| Ver respuestas correctas | Sí, restringido | Según permiso | Según permiso | Solo tras política de revisión |

## Seguridad e integridad

- Nunca enviar claves correctas ni rúbricas privadas en respuestas de lectura del estudiante. La clave configurada en esta interfaz es solo estado local y no representa una implementación segura de backend.
- Validar acceso a curso y matrícula en servidor, no mediante IDs ocultos en el frontend.
- Guardar archivos de entrega en Storage privado y emitir URLs firmadas tras autorización.
- Separar borrador editorial de versión publicada.
- Registrar actor, fecha, cambios y motivo en operaciones editoriales y de calificación.
- Proteger las calificaciones y retroalimentación por RLS y funciones transaccionales.
- No permitir que el estudiante cambie puntajes, estado de entrega ni identidad del autor.
- Definir retención y trazabilidad de intentos, entregas y revisiones.

## Vista previa del estudiante

El editor ofrece una vista previa del contenido sin guardar. Presenta título, curso, módulo, instrucciones, fecha límite y formato de entrega. Para evaluaciones muestra enunciados y opciones de respuesta; para actividades representa el área de entrega correspondiente.

La vista previa no incluye las claves correctas, puntajes, rúbricas privadas ni retroalimentación del tutor. Las rúbricas se editan en el área docente y no se presentan al estudiante en esta fase. Sus controles son ilustrativos y no envían respuestas, archivos ni intentos. Esta separación es obligatoria también en la futura API de lectura del estudiante: los datos sensibles de evaluación deben permanecer en el servidor y solo exponerse después de aplicar la política de revisión aprobada.

## Límites de esta entrega

- No hay persistencia, envío de actividades ni calificación real.
- Las rúbricas son estado local de demostración; no se asignan a tutores ni se aplican a entregas.
- La selección curricular utiliza fixtures locales; todavía no consulta el catálogo persistido ni se conecta a la Biblioteca.
- No se crea esquema, RPC, Storage, RLS ni migración.
- No se envían notificaciones ni se programan fechas de vencimiento.
- No se modifica producción ni se despliega a Vercel.
