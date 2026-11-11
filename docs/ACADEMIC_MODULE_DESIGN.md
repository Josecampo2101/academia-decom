# Diseño técnico del módulo académico

> Estado: propuesta técnica para revisión. Este documento no aplica migraciones ni modifica la base de datos.

## 1. Objetivo y alcance

Construir el núcleo académico de Academia DECOM para que la formación sea autogestionada, obligatoria y secuencial, con trazabilidad verificable del aprendizaje. El primer despliegue académico corresponde al Distrito 34, pero el modelo debe permitir incorporar otros distritos sin rediseñar las tablas.

El estudiante debe completar las lecciones, entregar todas las actividades prácticas obligatorias y obtener su aprobación, y finalmente aprobar el examen configurado antes de desbloquear el siguiente curso.

## 2. Roles y límites de acceso

- **Administrador nacional (national_admin)**: administra la configuración global, ve reportes globales y puede gestionar todos los distritos.
- **Director distrital (district_coordinator)**: administra la oferta académica y el seguimiento dentro de su distrito.
- **Comité distrital (area_coordinator)**: comparte las capacidades distritales que el negocio haya autorizado; no queda limitado a los estudiantes de su área.
- **Editor académico (academic_editor)**: crea y mantiene cursos, módulos, lecciones, recursos, actividades y bancos de preguntas dentro del ámbito asignado. Puede publicar sus propios cursos cuando cumpla las reglas de publicación.
- **Tutor (tutor)**: consulta únicamente cursos y estudiantes que tenga asignados; revisa entregas y preguntas abiertas.
- **Estudiante (member)**: consulta su propia matrícula, progreso, entregas, intentos, resultados y certificados.

Toda autorización se valida en servidor y en RLS. Ocultar botones en el cliente no es un control de seguridad. Los identificadores de distrito, curso, tutor y estudiante nunca se aceptan como prueba suficiente de autorización.

## 3. Modelo de dominio propuesto

Las entidades se agrupan por responsabilidad. Los nombres son orientativos y deben contrastarse con el esquema real antes de escribir migraciones.

### Catálogo y estructura académica

- academic_tracks: rutas formativas por distrito o ámbito global, nombre, descripción, estado y versión.
- courses: curso, propietario/editor, ámbito, estado (draft, review, published, archived), horas certificables y versión publicada.
- course_prerequisites: prerequisitos configurables y orden de desbloqueo. Permite una ruta lineal inicial y futuras rutas ramificadas.
- course_modules: módulos ordenados dentro de un curso.
- lessons: lecciones ordenadas, tipo de contenido, recurso asociado, duración y regla de finalización.
- lesson_resources: archivos o enlaces vinculados a una lección con tipo MIME, metadatos y política de acceso.

### Matrícula y progreso

- course_enrollments: estudiante, curso y distrito, estado, fecha de inicio/finalización y versión del curso matriculada.
- lesson_progress: estado, porcentaje, último punto de reproducción, fecha de inicio y finalización por estudiante/lección.
- activity_assignments: actividad práctica, instrucciones, rúbrica, obligatoriedad y fecha límite opcional.
- activity_submissions: versión de entrega, archivos, texto, estado, fecha y estudiante.
- activity_reviews: tutor revisor, decisión, calificación, observaciones y fecha; conservar historial de revisiones en lugar de sobrescribirlo.

### Tutoría y evaluación

- course_tutor_assignments: asignaciones explícitas de tutores por curso y ámbito.
- question_banks: banco asociado a un curso y versión.
- questions: enunciado, tipo, dificultad, explicación, puntuación y estado.
- question_options: opciones y clave de corrección para preguntas objetivas.
- exam_configs: cantidad de preguntas, puntaje mínimo, duración, intentos, reglas de recuperación y retroalimentación.
- exam_attempts: estudiante, curso/versión, número de intento, estado, fechas, puntaje y resultado.
- exam_attempt_questions: instantánea de las preguntas seleccionadas, orden y puntuación aplicada.
- exam_attempt_options: instantánea del orden de opciones mostrado al estudiante.
- exam_answers: respuestas entregadas, puntuación automática, puntuación manual y estado de revisión.

### Reconocimientos, biblioteca y comunicaciones

- certificates: estudiante, curso y versión, fecha de aprobación, horas, responsable, código público único y referencia al PDF.
- gamification_rules, student_xp_events, badges, student_badges: reglas configurables y libro de eventos de XP/insignias; no almacenar solo un total editable.
- library_resources, resource_tags, resource_favorites: biblioteca indexable por categoría, etiquetas y favoritos.
- notification_outbox: notificaciones internas y entregas a proveedores, con idempotencia, reintentos y estado.

Los nombres y columnas definitivos se ajustarán al esquema real y a las convenciones de migración del repositorio.

## 4. Reglas de negocio no negociables

1. **Secuencia**: un curso no se desbloquea porque el usuario visite una URL. El servidor evalúa prerequisitos y finalización aprobada.
2. **Lecciones**: cada lección declara una regla de finalización. Vídeo requiere completar la reproducción; texto/documentos requieren la verificación o actividad definida para esa lección.
3. **Vídeo**: registrar eventos/checkpoints de reproducción en servidor y validar continuidad, duración y finalización. Un simple evento onEnded del navegador no es evidencia suficiente.
4. **Actividades**: todas las actividades marcadas como obligatorias deben tener una revisión aprobatoria vigente. Una nueva entrega puede invalidar una aprobación anterior según la política configurada.
5. **Examen**: no se inicia si faltan lecciones o actividades obligatorias aprobadas.
6. **Banco aleatorio**: seleccionar preguntas según configuración, mezclar opciones y guardar una instantánea por intento. Evitar repetir preguntas de intentos anteriores cuando el tamaño y la distribución del banco lo permitan.
7. **Respuestas**: no enviar claves ni explicaciones al cliente antes del cierre y calificación del intento. Las preguntas abiertas quedan pendientes de tutor.
8. **Resultado**: mostrar puntaje, estado, respuestas correctas/incorrectas y explicaciones solo cuando el intento esté calificado conforme a la configuración.
9. **Certificado**: emitirlo una sola vez por aprobación/versión válida, con código único verificable y datos públicos mínimos.
10. **Tutoría**: un tutor solo puede consultar entregas, estudiantes e intentos de los cursos que tenga asignados.
11. **Edición**: los cursos publicados deben versionarse. Editar contenido no debe cambiar silenciosamente el examen ni el progreso de matrículas ya iniciadas.
12. **Auditoría**: registrar cambios de publicación, decisiones de tutor, calificaciones, intentos y emisión/revocación de certificados.

## 5. Máquina de estados

### Curso
draft → review → published → archived

La publicación valida estructura, contenido, actividades, banco y configuración de examen. Un curso publicado se modifica mediante una nueva versión.

### Lección
locked → available → in_progress → completed

La disponibilidad depende del orden del módulo y de prerequisitos. El estado completed se calcula/valida en servidor según la regla de finalización.

### Actividad práctica
not_submitted → submitted → under_review → approved | changes_requested

Una nueva entrega crea una versión nueva. El tutor deja observación y decisión trazable.

### Examen
not_started → in_progress → submitted → pending_review | graded → passed | failed

Las preguntas abiertas mantienen el intento en revisión hasta que se complete la calificación manual.

## 6. Contratos de servicio sugeridos

Los nombres finales se definirán durante la implementación; la interfaz no debe ejecutar SQL ni decidir permisos.

- get_student_learning_overview(): resumen de cursos, próximo paso, avance, pendientes y reconocimientos del usuario autenticado.
- get_course_learning_path(course_id): estructura y estados visibles para el estudiante autorizado.
- start_lesson(lesson_id) / record_lesson_progress(...) / complete_lesson(lesson_id): control de progreso y finalización.
- submit_activity(activity_id, ...): registra una entrega y sus metadatos.
- review_activity(submission_id, decision, feedback, score): decisión de tutor asignado.
- start_exam(course_id): valida requisitos y crea la instantánea aleatoria del intento.
- submit_exam(attempt_id, answers): cierra el intento y calcula únicamente lo calificable automáticamente.
- grade_open_answers(attempt_id, ...): revisión manual restringida al tutor asignado.
- get_exam_result(attempt_id): entrega retroalimentación después de calificar.
- issue_course_certificate(enrollment_id): operación idempotente que emite certificado si se cumplen requisitos.

Cada operación sensible valida identidad, ámbito, estado y permisos en servidor. Las funciones privilegiadas deben usar SECURITY DEFINER solo cuando sea necesario, con search_path vacío/fijo y validación explícita del actor.

## 7. Archivos y biblioteca

- Usar buckets privados para entregas y recursos restringidos.
- Entregar archivos mediante URLs firmadas de corta duración después de validar acceso.
- Validar tamaño, extensión y MIME real; normalizar nombres y evitar rutas controladas por el usuario.
- No exponer documentos privados mediante URLs públicas.
- La biblioteca filtra recursos por curso, etiquetas, categoría, favoritos y prerequisitos de acceso.

## 8. Reportes y experiencia del estudiante

El panel debe presentar: curso actual y siguiente paso, avance real calculado, lecciones pendientes, entregas por estado, evaluaciones, XP/insignias, certificados y notificaciones. Los valores vacíos se muestran como “Sin datos” y nunca como métricas inventadas.

Los reportes administrativos incluyen estudiantes activos/inactivos, avance, pendientes, calificaciones, intentos, historial, tutores, XP, insignias y certificados; exportación a Excel/PDF debe respetar el ámbito del rol que solicita el informe.

## 9. Orden de implementación

1. **Base reproducible**: consolidar baseline de migraciones y tipos; no reiniciar ni alterar producción.
2. **Catálogo**: cursos, versiones, módulos, lecciones, prerequisitos y publicación.
3. **Matrícula y progreso**: inscripción, secuencia, reanudación y finalización verificable.
4. **Actividades y tutoría**: almacenamiento privado, entregas, asignaciones y revisión.
5. **Exámenes**: banco, configuración, instantáneas aleatorias, intentos y revisión manual.
6. **Certificados y gamificación**: PDF, QR, validación pública mínima, XP e insignias.
7. **Biblioteca y notificaciones**: filtros, acceso por progreso y outbox multicanal.
8. **Reportes y endurecimiento**: pruebas RLS por rol, auditoría, carga y accesibilidad.

## 10. Criterios de aceptación mínimos

- Un estudiante no puede abrir un curso bloqueado alterando la URL o llamando directamente a una función.
- Dos estudiantes pueden recibir exámenes diferentes del mismo banco; cada intento conserva exactamente las preguntas y el orden que vio.
- Una actividad obligatoria sin aprobación bloquea el examen.
- Una pregunta abierta no se considera aprobada antes de la revisión autorizada.
- Un tutor no puede leer entregas ni resultados de un curso no asignado.
- Una actualización del curso no altera matrículas de una versión anterior.
- La emisión repetida no duplica certificados ni eventos de XP.
- Los datos de reportes y certificados respetan el ámbito del distrito y minimizan información personal.

## 11. Fuera de esta entrega

Este documento no crea tablas, políticas RLS, buckets, funciones RPC, cron jobs ni proveedores de correo/WhatsApp. Tampoco declara que el módulo académico esté conectado a datos reales. Cada cambio de base de datos se presentará como migración revisable y requerirá autorización antes de aplicarse a producción.
