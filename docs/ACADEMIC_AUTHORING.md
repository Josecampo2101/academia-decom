# Autoría de actividades y evaluaciones

> Interfaz de prototipo con datos ficticios y estado local. No registra entregas, intentos ni calificaciones reales.

## Ruta y permisos

Ruta: `/dashboard/administracion/actividades`.

Acceso de interfaz para `national_admin` y `academic_editor`, con verificación de sesión y asignaciones de rol en cliente. Esta comprobación no reemplaza las políticas de servidor/RLS que deberán proteger cada consulta y mutación.

## Capacidades de la interfaz

- Catálogo unificado de actividades y evaluaciones.
- Búsqueda por título, curso y módulo.
- Filtros por tipo de contenido y estado editorial.
- Alta y edición de instrucciones, curso, módulo, formato de respuesta y fecha límite opcional.
- Actividades: respuesta escrita, archivo adjunto, enlace externo o evidencia audiovisual.
- Evaluaciones: selección única, selección múltiple, verdadero/falso y respuesta corta.
- Constructor local de preguntas y opciones.
- Estados borrador, publicado y archivado.
- Acciones de publicación, archivado y restauración simuladas.

Los cursos y módulos se escriben como texto en esta fase; la integración posterior debe reemplazarlos por relaciones a identificadores estables del catálogo académico.

## Reglas funcionales propuestas

### Actividades
- Deben tener instrucciones, formato de entrega, fecha de apertura/cierre opcional y criterios de evaluación.
- Deben definir tamaño y tipos MIME permitidos si reciben archivos.
- Las entregas deben quedar asociadas a estudiante, actividad y versión publicada.
- La reentrega debe seguir una política explícita y conservar historial.
- Los comentarios y rúbricas de tutoría deben tener estados y trazabilidad.

### Evaluaciones
- Cada pregunta debe tener tipo, enunciado, orden, puntaje y configuración de respuesta.
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

- Nunca enviar claves correctas ni rúbricas privadas en respuestas de lectura del estudiante.
- Validar acceso a curso y matrícula en servidor, no mediante IDs ocultos en el frontend.
- Guardar archivos de entrega en Storage privado y emitir URLs firmadas tras autorización.
- Separar borrador editorial de versión publicada.
- Registrar actor, fecha, cambios y motivo en operaciones editoriales y de calificación.
- Proteger las calificaciones y retroalimentación por RLS y funciones transaccionales.
- No permitir que el estudiante cambie puntajes, estado de entrega ni identidad del autor.
- Definir retención y trazabilidad de intentos, entregas y revisiones.

## Límites de esta entrega

- No hay persistencia, envío de actividades ni calificación real.
- No se conectan preguntas al catálogo curricular ni a la Biblioteca.
- No se crea esquema, RPC, Storage, RLS ni migración.
- No se envían notificaciones ni se programan fechas de vencimiento.
- No se modifica producción ni se despliega a Vercel.
