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
- Puntaje entero configurable por pregunta; cada pregunta debe valer al menos un punto y la suma de una evaluación no puede superar 100 puntos.
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
- Cada pregunta debe tener tipo, enunciado, orden, puntaje, opciones y configuración de respuesta. El editor exige clave correcta para preguntas objetivas; selección única y verdadero/falso deben tener exactamente una. Los puntajes por pregunta deben ser enteros positivos y el total de la evaluación no puede superar 100 puntos.
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


## Flujo de revisión y calificación del tutor (prototipo)

Ruta: `/dashboard/tutor/calificaciones`.

- Bandeja local de entregas con búsqueda y filtros por estado.
- Detalle de cada entrega con número de intento y descripción del trabajo.
- Calificación por criterio con puntajes enteros entre cero y el máximo definido en la rúbrica.
- Cálculo automático del total y del porcentaje obtenido.
- Retroalimentación de hasta 2.000 caracteres.
- Decisiones de demostración: aprobar, solicitar ajustes o rechazar. Las decisiones distintas de aprobar requieren observaciones.
- Historial ilustrativo de intentos y eventos para mostrar la trazabilidad esperada.
- Acceso desde el panel del tutor mediante el botón “Abrir espacio de calificación”.

Los puntajes y observaciones permanecen en estado local de la sesión. La acción disponible solo prepara una vista previa; no persiste la calificación, no cambia el estado de una entrega y no envía notificaciones. Los datos son ficticios. La autorización de la ruta repite la comprobación visual de roles del panel, pero no sustituye RLS ni autorización de servidor.

### Reglas que deberá cumplir la implementación persistente

- La rúbrica aplicada debe ser una versión inmutable vinculada a la actividad publicada y al intento entregado.
- Cada puntaje debe estar dentro del rango del criterio; el total debe calcularse y validarse en servidor.
- Una solicitud de ajustes debe incluir retroalimentación concreta y conservar la entrega previa.
- Cada revisión debe registrar tutor, fecha, puntajes, decisión y versión de rúbrica.
- El estudiante solo podrá consultar sus propias entregas y la retroalimentación autorizada.
- La transición de estado y la creación del evento de auditoría deberán ejecutarse de forma transaccional.


## Trabajo y entregas del estudiante (prototipo local)

Rutas:
- `/dashboard/estudiante/actividades`: bandeja con filtros por estado y contadores derivados de los registros locales.
- `/dashboard/estudiante/actividades/[activityId]`: instrucciones, respuesta, referencia externa, borrador e intentos.

Comportamiento de demostración:
- El estudiante puede guardar un borrador y recuperarlo en el mismo navegador.
- La validación exige al menos 40 caracteres, comprueba que el enlace opcional use HTTP(S) y requiere confirmar autoría/revisión.
- El envío simulado crea un intento con fecha, contenido y estado “En revisión”.
- Los envíos en revisión o calificados quedan bloqueados para edición en la interfaz.
- Se conserva un historial local de intentos y se muestran los estados en la bandeja.
- El almacenamiento usa una clave separada por usuario autenticado y actividad.

Límites:
- Los datos se almacenan en `localStorage` del navegador; no son evidencia académica oficial ni se comparten con el tutor o con otros dispositivos.
- No hay carga de archivos, transmisión, persistencia remota, notificaciones, fechas límite efectivas ni reentrega real desde una decisión del tutor.
- Borrar los datos del navegador elimina los borradores y el historial de demostración.
- La verificación de rol en cliente es únicamente de interfaz; el backend deberá autorizar cada lectura y escritura mediante RLS y operaciones transaccionales.


## Puente local estudiante–tutor (prototipo)

- La ruta del estudiante registra los intentos enviados en un almacén de demostración compartido por las vistas de estudiante y tutor dentro del mismo navegador.
- La bandeja adicional en `/dashboard/tutor/calificaciones` lista los intentos recibidos, permite consultar cada versión y guardar una decisión demo con retroalimentación.
- Las decisiones `Solicitar ajustes`, `Aprobar` y `Rechazar` actualizan el estado de demostración; cuando se solicitan ajustes, el estudiante puede preparar y enviar un nuevo intento conservando el historial anterior.
- La vista del estudiante muestra la retroalimentación de tutoría cuando vuelve a la actividad o cuando la vista recibe la actualización local.
- Los cambios se notifican entre componentes mediante eventos del navegador y se guardan en `localStorage`; no existe comunicación de red.

### Límites y precauciones

- El puente funciona únicamente en el mismo perfil de navegador y origen. No sincroniza sesiones entre dispositivos, navegadores ni cuentas independientes.
- El contenido es demostrativo y no constituye entrega oficial, calificación institucional, auditoría ni notificación.
- El panel de calificaciones conserva sus fixtures de ejemplo separados; esta bandeja es una sección adicional para validar el recorrido funcional local.
- Antes de producción, sustituir este adaptador por tablas/RPC transaccionales, RLS por matrícula y asignación tutor-estudiante, versiones inmutables, almacenamiento privado y eventos de auditoría.
- No se han modificado Supabase, sus datos, políticas, funciones, Storage ni Vercel.


## Intentos de evaluaciones del estudiante (prototipo local)

Ruta: `/dashboard/estudiante/evaluaciones/practica`.

- Cada envío crea un intento con identificador, fecha/hora, respuestas y resultado por pregunta.
- Los intentos se almacenan en `localStorage`, separados por usuario y evaluación; se recuperan al volver a abrir la práctica.
- El estudiante puede consultar resultados de intentos anteriores e iniciar un nuevo intento.
- La selección única, selección múltiple y verdadero/falso se corrigen por coincidencia exacta contra la clave configurada.
- Las respuestas cortas se marcan como `revision_manual`, no reciben puntaje automático y se contabilizan como pendientes.
- El resultado distingue puntaje objetivo posible/obtenido y cantidad de preguntas pendientes de revisión.

### Seguridad y límites

- La práctica utiliza preguntas y una clave ficticia de demostración. Aunque la clave no se presenta en la interfaz, está importada por código cliente y puede inspeccionarse en el bundle; **no es un mecanismo seguro ni debe reutilizarse para evaluaciones reales**.
- El historial existe solo en el navegador actual. No se transmite al tutor, no sincroniza dispositivos y puede perderse al borrar los datos del sitio.
- No hay límite de intentos, temporizador vinculante, matrícula validada por servidor, calificación manual real ni auditoría.
- En la implementación persistente, el servidor debe entregar al estudiante únicamente el payload público de preguntas, recibir respuestas mediante una operación transaccional, recuperar la clave privada en servidor y calcular allí el resultado. Las respuestas cortas deben quedar pendientes hasta que un tutor autorizado las revise.
- Cada intento real debe referenciar una versión inmutable de la evaluación y registrar inicio, envío, estudiante, respuestas, resultado, política de intentos y eventos de auditoría.


## Historial y consulta de intentos (mejora de interfaz)

La práctica de evaluaciones incorpora un panel de historial con:

- Resumen de intentos registrados, rendimiento objetivo acumulado y cantidad de respuestas que siguen pendientes de revisión manual.
- Filtros por todos los intentos, intentos con revisión manual pendiente, intentos con respuestas incorrectas e intentos sin respuestas incorrectas.
- Selección de un intento anterior para consultar nuevamente el detalle de respuestas y resultados.
- Identificación visual del intento seleccionado y de los intentos que contienen respuestas incorrectas.
- Orden cronológico descendente conservado desde el almacenamiento local.

El rendimiento acumulado se calcula como la suma de puntos objetivos obtenidos dividida por la suma de puntos objetivos posibles de los intentos guardados. Las preguntas de respuesta corta no entran en ese porcentaje hasta que exista una revisión real. Este panel sigue dependiendo del historial local de `localStorage`; no representa progreso institucional, no sincroniza entre dispositivos y no modifica intentos existentes.
