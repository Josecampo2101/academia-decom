# Diseño funcional de los paneles de estudiante y tutor

> Estado: especificación UX y funcional para revisión. No implementa componentes, rutas, consultas, tablas, migraciones ni cambios de producción.
>
> Depende de la arquitectura conceptual de `docs/ACADEMIC_CORE_ARCHITECTURE.md`.

## 1. Objetivo de experiencia

La plataforma debe orientar al usuario hacia la siguiente acción formativa sin convertir el panel en un tablero administrativo saturado.

- El estudiante debe identificar qué estudiar, qué entregar, qué corregir y cuánto ha avanzado.
- El tutor debe identificar qué entregas requieren atención, cuáles están vencidas y qué estudiantes necesitan acompañamiento.
- La coordinación debe consultar indicadores dentro de su ámbito sin recibir permisos implícitos sobre archivos, respuestas o notas privadas.
- La interfaz debe reflejar estados reales del servidor; nunca simular progreso, calificaciones o aprobaciones.

## 2. Principios visuales y de interacción

### Identidad visual

Usar la identidad ya definida para Academia DECOM:
- Azul principal: `#087DB5`.
- Turquesa: `#19A7A0`.
- Azul profundo: `#102D4D`.
- Fondo claro: `#F4F7FA`.
- En tema oscuro, conservar contraste sobre los fondos `#101B2A` y `#1C2B3D`.

La marca y la frase **“Formación para comunicar con propósito.”** deben aparecer en el acceso y en el encabezado institucional, sin competir con la tarea principal de cada pantalla.

### Reglas de interfaz

1. Una acción principal por pantalla; acciones secundarias en menús o enlaces contextuales.
2. Estados visibles y textuales: borrador, publicado, bloqueado, pendiente, en revisión, aprobado, cambios solicitados, completado y vencido.
3. No usar solo color para comunicar estados; combinar etiqueta, texto e icono.
4. Confirmar acciones irreversibles o de impacto académico, como retirar una publicación o revocar un certificado.
5. Guardar borradores de formularios cuando sea posible; indicar claramente si el guardado fue local o confirmado por el servidor.
6. En cargas, mostrar progreso real si se conoce; nunca inventar porcentajes.
7. Mantener la preferencia de tema claro/oscuro/sistema existente.
8. En móvil, priorizar contenido y acciones; tablas amplias se convierten en tarjetas o listas con filtros.

## 3. Navegación por perfil

La navegación se determina en servidor según los permisos efectivos, no mediante una lista de roles enviada por el navegador.

### Estudiante

- Inicio
- Mi formación
- Actividades
- Evaluaciones
- Tutoría
- Reconocimientos
- Certificados
- Biblioteca
- Mi perfil

### Tutor

- Inicio
- Bandeja de revisión
- Mis estudiantes
- Seguimiento
- Historial de revisiones
- Biblioteca
- Mi perfil

### Editor académico

- Panel editorial
- Programas y cursos
- Módulos y lecciones
- Actividades y rúbricas
- Banco de preguntas
- Evaluaciones
- Vista previa
- Publicaciones

El editor no debe recibir automáticamente acceso a información privada del estudiante.

### Coordinación distrital / comité

- Resumen distrital
- Participación
- Avance por curso
- Alertas de acompañamiento
- Reportes

El detalle individual, las entregas y las respuestas requieren permisos específicos y auditables. La navegación no debe mostrar una opción que el servidor no autorice, pero ocultarla no sustituye la validación del servidor.

## 4. Panel de inicio del estudiante

### 4.1 Estructura de escritorio

Orden de lectura:

1. Encabezado: saludo, nombre visible, congregación de referencia y notificaciones.
2. Tarjeta principal **Continuar mi formación**:
   - curso activo;
   - módulo y lección siguiente;
   - estado de prerrequisitos;
   - acción “Continuar”.
3. Resumen de ruta:
   - cursos completados;
   - curso actual;
   - cursos pendientes/bloqueados;
   - progreso calculado.
4. Pendientes prioritarios:
   - actividades por entregar;
   - entregas con cambios solicitados;
   - evaluaciones disponibles;
   - fechas límite próximas.
5. Seguimiento tutorial:
   - tutor asignado, si existe;
   - última retroalimentación;
   - estado de solicitudes.
6. Reconocimientos recientes:
   - XP confirmado;
   - insignias concedidas;
   - certificados emitidos.

### 4.2 Orden móvil

1. Continuar formación.
2. Pendientes urgentes.
3. Mi ruta.
4. Tutoría.
5. Reconocimientos.

No comprimir el tablero de escritorio en columnas diminutas. Convertir bloques en tarjetas verticales y mantener una acción principal accesible.

### 4.3 Estados del inicio

| Estado | Presentación |
|---|---|
| Sin inscripción | Explicar la ruta disponible y mostrar “Explorar formación” o “Solicitar inscripción”, según la política configurada. |
| Inscripción pendiente | Mostrar que aún no está habilitado el curso y explicar el siguiente paso. |
| Curso en progreso | Mostrar curso, siguiente lección y pendientes reales. |
| Bloqueado | Explicar el requisito exacto pendiente; no mostrar un botón que prometa acceso. |
| Todo completado | Mostrar cierre de ruta, certificados y siguiente ruta si existe. |
| Error de consulta | Mensaje recuperable y acción para reintentar; no reemplazar el error por métricas cero. |

## 5. Pantalla “Mi formación”

### 5.1 Vista de ruta

Cada curso se representa con:
- título e imagen;
- nivel y duración estimada;
- estado;
- requisito previo;
- progreso calculado;
- fecha de inicio o finalización, cuando exista;
- acción contextual: comenzar, continuar, revisar o consultar certificado.

Filtros: todos, pendientes, en curso y completados. El filtro no modifica la elegibilidad.

### 5.2 Detalle de curso

Cabecera:
- nombre y descripción;
- objetivos de aprendizaje;
- nivel y duración;
- versión del curso;
- estado de inscripción;
- tutor, si aplica.

Contenido:
- módulos en orden;
- lecciones con tipo de recurso y estado;
- actividades requeridas;
- evaluaciones y condiciones de desbloqueo.

La pantalla explica por qué un módulo está bloqueado. Si un requisito es una actividad pendiente de revisión, indicar “En revisión” y no “No iniciado”.

### 5.3 Reproductor de lección

- Contenido principal: texto, video, audio, documento o recurso mixto.
- Panel contextual: objetivo, duración estimada y recursos relacionados.
- Navegación: anterior y siguiente, respetando bloqueos.
- Acción de finalización: solo cuando la regla de la lección se cumpla.
- Guardado de avance: indicar última sincronización confirmada.
- Enlaces y archivos externos se abren de forma segura y con indicación de destino.

La finalización no se obtiene por abrir la lección. El servidor valida el criterio configurado: lectura confirmada, reproducción o actividad asociada, según el tipo de contenido.

## 6. Pantalla “Actividades”

### 6.1 Bandeja del estudiante

Columnas de escritorio:
- Actividad;
- curso/módulo;
- fecha límite;
- estado;
- última entrega;
- acción.

Filtros: todas, por entregar, en revisión, cambios solicitados, aprobadas y vencidas.

### 6.2 Detalle y entrega

Mostrar:
- instrucciones completas;
- criterios de evaluación y rúbrica visible;
- formatos y límites permitidos;
- fecha límite y zona horaria;
- intentos o reenvíos disponibles, si se han configurado;
- historial de entregas.

Formulario:
- editor de texto cuando aplique;
- carga de archivos permitidos;
- enlaces;
- confirmación de autoría y envío.

Al enviar:
1. Validar tamaño, tipo de archivo y campos en cliente para orientar.
2. Validar nuevamente en servidor.
3. Crear una nueva entrega, sin sobrescribir anteriores.
4. Confirmar el identificador y fecha del envío.
5. Mostrar estado “En revisión” cuando la entrega quede en cola.

Si la red falla, no afirmar que la entrega fue enviada. Permitir reintento seguro y comprobar primero si la operación anterior llegó al servidor.

### 6.3 Retroalimentación

La revisión muestra:
- decisión;
- puntuación, si aplica;
- criterios y observaciones;
- tutor y fecha;
- cambios solicitados;
- acción para reenviar cuando esté permitido.

No exponer notas internas del tutor ni comentarios de coordinación.

## 7. Pantalla “Evaluaciones”

### 7.1 Lista

Por evaluación:
- título y curso;
- estado (bloqueada, disponible, en curso, enviada, calificada);
- umbral de aprobación;
- duración;
- intentos permitidos y restantes;
- mejor resultado o último resultado según política.

No mostrar preguntas ni respuestas correctas antes de la entrega.

### 7.2 Instrucciones y confirmación

Antes de comenzar:
- explicar duración y reglas;
- informar si el intento se puede pausar;
- informar qué ocurre si se pierde conexión;
- mostrar intentos restantes;
- solicitar confirmación explícita.

### 7.3 Ejecución

- Una pregunta por pantalla en móvil; paginación o navegación lateral en escritorio.
- Indicador de pregunta actual y respondidas, sin revelar la calificación.
- Guardado de respuestas con confirmación del servidor.
- Temporizador basado en hora del servidor y hora de inicio registrada; no confiar en el reloj del dispositivo.
- Advertencia antes de salir si hay respuestas sin sincronizar.
- Entrega explícita con resumen de preguntas sin responder.
- Tras enviar, bloquear cambios al intento.

### 7.4 Resultado

Mostrar:
- puntuación y condición de aprobación;
- fecha;
- retroalimentación permitida;
- disponibilidad de otro intento;
- siguiente paso.

La revisión de preguntas y respuestas depende de la política del examen; no se asume que la clave correcta se revela inmediatamente.

## 8. Pantalla “Tutoría”

### Para el estudiante

- Tutor asignado y canal institucional de contacto, si existe.
- Estado de acompañamiento.
- Última retroalimentación académica.
- Solicitud de acompañamiento o ayuda, si el programa habilita esa función.
- Historial de orientaciones visibles para el estudiante.

No mostrar información personal del tutor que no sea necesaria.

## 9. Reconocimientos y certificados

### Reconocimientos

- XP total confirmado y movimientos recientes.
- Insignias obtenidas y condición para las próximas.
- Fecha y evidencia del logro.
- No sumar puntos en cliente ni premiar eventos duplicados.

### Certificados

- Curso o ruta acreditada;
- nombre visible autorizado;
- fecha de emisión;
- código y QR de verificación;
- descarga en formato disponible.

La pantalla diferencia certificado vigente, revocado y reemplazado. La verificación pública revela solo los datos aprobados para publicación.

## 10. Panel de inicio del tutor

### 10.1 Prioridades

La pantalla inicial responde cuatro preguntas:
1. ¿Cuántas entregas requieren revisión?
2. ¿Cuáles están próximas a vencer o llevan más tiempo esperando?
3. ¿Qué estudiantes necesitan seguimiento?
4. ¿Qué revisiones recientes requieren una acción?

### 10.2 Componentes

- Resumen: pendientes, en revisión, revisadas esta semana y estudiantes asignados.
- Bandeja priorizada por antigüedad y fecha límite.
- Alertas: entregas vencidas, solicitudes de reenvío, estudiantes sin actividad y asignaciones por vencer.
- Actividad reciente.
- Acceso a mis estudiantes.

Las métricas deben incluir el periodo y el ámbito. No presentar porcentajes sin denominador.

### 10.3 Estados

| Estado | Comportamiento |
|---|---|
| Sin asignaciones | Explicar que aún no hay estudiantes asignados. |
| Sin entregas pendientes | Mostrar bandeja vacía; conservar acceso al historial. |
| Cola activa | Priorizar antigüedad y fecha límite; filtros por curso y estado. |
| Asignación finalizada | Mantener historial de revisiones, sin permitir nuevas decisiones. |
| Error | Mostrar error y reintento; no interpretar como cola vacía. |

## 11. Bandeja de revisión del tutor

### Lista

Cada fila/tarjeta:
- estudiante;
- actividad y curso;
- fecha de envío;
- tiempo transcurrido;
- estado;
- prioridad;
- acción “Revisar”.

Filtros:
- pendientes;
- en revisión;
- cambios solicitados;
- revisadas;
- por curso;
- por antigüedad.

La lista contiene exclusivamente entregas autorizadas para ese tutor. La consulta debe validar la asignación en servidor incluso si el usuario modifica parámetros o UUID.

### Vista de revisión

Panel dividido en escritorio:
- izquierda: entrega y archivos;
- derecha: rúbrica, criterios y decisión.

En móvil, apilar entrega y formulario de evaluación.

El tutor puede:
- asignar puntuación según rúbrica;
- escribir observaciones para el estudiante;
- solicitar cambios;
- aprobar;
- rechazar cuando la política lo permita.

Antes de confirmar, mostrar resumen de decisión. Tras confirmar, mostrar resultado y registrar tutor, fecha, criterio y versión de rúbrica.

No permitir editar una revisión ya finalizada de forma silenciosa. Si se necesita corregir, crear una rectificación auditada.

## 12. Seguimiento de estudiantes

Lista de estudiantes asignados:
- nombre visible;
- curso/inscripción;
- último avance;
- actividad pendiente;
- última interacción;
- indicador de atención.

El indicador de atención se deriva de reglas transparentes (por ejemplo, inactividad durante un umbral configurado o entrega vencida), no de juicios subjetivos.

Detalle:
- progreso por módulo;
- entregas y revisiones visibles al tutor;
- resultados que necesita para acompañar;
- notas tutoriales privadas;
- historial de asignación.

El tutor no puede:
- consultar estudiantes fuera de sus asignaciones;
- reasignarse a sí mismo;
- cambiar respuestas o entregas;
- alterar resultados automáticos;
- modificar el contenido publicado;
- emitir certificados.

## 13. Notificaciones

Notificaciones internas sugeridas:
- nueva actividad disponible;
- fecha límite próxima;
- entrega recibida;
- entrega aprobada o cambios solicitados;
- evaluación habilitada;
- evaluación calificada;
- nuevo tutor asignado;
- certificado emitido;
- tutor con nueva entrega por revisar;
- asignación tutorial por finalizar.

Reglas:
- Se generan después de confirmar la operación principal.
- La entrega, revisión o calificación no se revierte si falla el correo.
- Evitar duplicados mediante clave idempotente.
- La notificación debe enlazar a una ruta que vuelva a validar permisos.
- No incluir archivos, respuestas ni información sensible en el correo.

## 14. Contrato de datos de interfaz

Los componentes deben consumir modelos de presentación explícitos, no filas completas de tablas.

### StudentDashboardSummary

- `displayName`
- `referenceCongregation` (opcional)
- `activeEnrollment` (opcional)
- `nextLearningItem` (opcional)
- `courseProgress[]`
- `pendingItems[]`
- `tutorSummary` (opcional)
- `recentAchievements[]`
- `updatedAt`

### StudentPendingItem

- `id`
- `kind`: activity | assessment
- `title`
- `courseTitle`
- `status`
- `dueAt` (opcional)
- `actionHref` generado por el servidor o por rutas internas conocidas

### TutorDashboardSummary

- `assignedStudentCount`
- `pendingReviewCount`
- `overdueReviewCount`
- `recentlyReviewedCount`
- `priorityQueue[]`
- `attentionAlerts[]`
- `updatedAt`

### TutorReviewQueueItem

- `submissionId`
- `studentDisplayName`
- `activityTitle`
- `courseTitle`
- `submittedAt`
- `dueAt` (opcional)
- `reviewStatus`
- `priorityReason`

Todos los modelos deben excluir:
- tokens de sesión;
- claves de servicio;
- rutas internas no autorizadas;
- respuestas correctas antes de la entrega;
- notas privadas ajenas;
- correos/teléfonos salvo necesidad funcional y permiso específico.

Los tipos definitivos se implementarán en TypeScript después de acordar el esquema físico. No se duplicarán datos derivados como autoridad de negocio.

## 15. Rutas de aplicación sugeridas

Los segmentos son propuestas y deben reconciliarse con el árbol actual antes de crear archivos:

| Perfil | Ruta propuesta | Propósito |
|---|---|---|
| Estudiante | `/dashboard/estudiante` | Inicio personalizado. |
| Estudiante | `/dashboard/estudiante/formacion` | Ruta y cursos. |
| Estudiante | `/dashboard/estudiante/cursos/[enrollmentId]` | Detalle de inscripción. |
| Estudiante | `/dashboard/estudiante/lecciones/[lessonId]` | Lección. |
| Estudiante | `/dashboard/estudiante/actividades` | Bandeja de actividades. |
| Estudiante | `/dashboard/estudiante/evaluaciones` | Evaluaciones. |
| Estudiante | `/dashboard/estudiante/tutoria` | Acompañamiento. |
| Estudiante | `/dashboard/estudiante/reconocimientos` | XP e insignias. |
| Estudiante | `/dashboard/estudiante/certificados` | Certificados. |
| Tutor | `/dashboard/tutor` | Inicio. |
| Tutor | `/dashboard/tutor/revisiones` | Bandeja de revisión. |
| Tutor | `/dashboard/tutor/revisiones/[submissionId]` | Revisar entrega. |
| Tutor | `/dashboard/tutor/estudiantes` | Estudiantes asignados. |
| Tutor | `/dashboard/tutor/estudiantes/[enrollmentId]` | Seguimiento individual. |
| Público | `/certificados/verificar/[code]` | Verificación mínima de certificado. |

No crear rutas duplicadas si el árbol actual ya contiene equivalentes. Los identificadores de ruta no son autorización: cada carga y mutación valida sesión, rol y ámbito.

## 16. Componentes reutilizables propuestos

- `AcademicPageHeader`: título, descripción y acción principal.
- `LearningContinueCard`: siguiente paso formativo.
- `CourseProgressCard`: estado y avance de curso.
- `LearningPathList`: secuencia de cursos.
- `ModuleAccordion`: módulos, lecciones y bloqueos.
- `LearningResourceViewer`: contenido de lección.
- `SubmissionStatusBadge`: estado de entrega con texto accesible.
- `ActivitySubmissionForm`: texto y archivos.
- `SubmissionHistory`: entregas inmutables.
- `AssessmentInstructions`: reglas antes de comenzar.
- `AssessmentRunner`: ejecución de intento.
- `AssessmentResultSummary`: resultado autorizado.
- `TutorReviewQueue`: cola de revisiones.
- `SubmissionReviewWorkspace`: entrega y rúbrica.
- `StudentAttentionList`: seguimiento de asignados.
- `AchievementGrid`: logros.
- `CertificateCard`: certificado y verificación.

Los componentes visuales no contienen reglas de autorización ni calculan resultados oficiales.

## 17. Accesibilidad, responsive y calidad

- Navegación completa por teclado y foco visible.
- Etiquetas explícitas para campos, carga de archivos y controles.
- Contraste suficiente en ambos temas.
- Estados anunciados para lectores de pantalla al enviar, guardar o cambiar una revisión.
- No usar temporizador como único indicador de tiempo restante; incluir texto.
- No depender de arrastrar y soltar para responder o cargar.
- Objetivo táctil suficiente en móvil.
- No forzar desplazamiento horizontal en pantallas pequeñas, excepto contenido especializado con alternativa accesible.
- Formularios con errores asociados al campo y resumen de errores.
- Fechas presentadas en zona horaria institucional configurada; persistencia en UTC.

## 18. Pruebas de aceptación de interfaz

### Estudiante
- Sin inscripción, el panel ofrece un siguiente paso real sin inventar porcentajes.
- El curso inicial se presenta según la secuencia institucional configurada.
- Un módulo bloqueado explica el prerrequisito faltante.
- Una actividad enviada aparece como en revisión solo tras confirmación del servidor.
- Un reenvío conserva historial anterior.
- La pérdida de red no muestra una confirmación falsa.
- Un intento enviado no permite cambiar respuestas.
- El certificado solo aparece después de cumplir requisitos y confirmación del servidor.

### Tutor
- La bandeja solo contiene entregas de asignaciones vigentes.
- Cambiar un UUID no permite abrir la entrega de otro tutor.
- Una revisión registra rúbrica, decisión, autor y fecha.
- No se permite doble envío de una revisión ni duplicar eventos por reintento.
- Un tutor sin asignaciones ve estado vacío y no datos de otros tutores.
- Finalizar una asignación elimina acceso operativo, no historial autorizado.

### Responsive y accesibilidad
- Las tareas principales se completan en móvil sin desplazamiento horizontal.
- Los estados son comprensibles sin color.
- Formularios y bandejas se pueden usar con teclado.
- Cargas, errores y confirmaciones se comunican de forma accesible.

## 19. Orden de construcción recomendado

1. Auditar el árbol actual y los componentes de layout existentes; reutilizar navegación y tema.
2. Crear modelos de presentación y estados vacíos con datos de prueba locales, sin conectarlos aún a producción.
3. Construir el panel del estudiante y la ruta de cursos con componentes reutilizables.
4. Construir actividades y el historial de entregas.
5. Construir panel del tutor y bandeja con fixtures sintéticos.
6. Añadir evaluación interactiva y resultados.
7. Conectar lecturas y comandos a servicios de servidor tras cerrar el esquema y políticas.
8. Probar permisos negativos con usuarios de prueba de distintos ámbitos.
9. Activar notificaciones y Storage solo después de validar permisos y configuración.
10. Ejecutar typecheck, lint, pruebas, build y revisión visual en entorno de preview autorizado.

## 20. Decisiones funcionales que deben confirmarse

1. ¿El estudiante se inscribe por sí mismo o la inscripción se crea automáticamente al activar su cuenta?
2. ¿Las entregas se asignan a un tutor individual o a una bandeja compartida de tutores del distrito?
3. ¿Qué periodo de inactividad debe generar una alerta de acompañamiento?
4. ¿El estudiante podrá pausar y continuar una evaluación, o el intento será continuo una vez iniciado?
5. ¿El panel de coordinación mostrará nombres individuales por defecto o solo agregados y alertas autorizadas?

Hasta resolver estas decisiones, deben permanecer configurables; no se fijarán valores arbitrarios en la interfaz ni en el esquema.

## 21. Límites de este entregable

- Solo especificación UX/funcional.
- No se crearon rutas ni componentes ejecutables.
- No se hicieron cambios de Supabase, Auth, Storage, RLS o datos.
- No se desplegó a Vercel.
- Los nombres de rutas y componentes son propuestas sujetas a auditoría del árbol existente.
