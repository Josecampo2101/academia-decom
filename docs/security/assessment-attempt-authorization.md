# Autorización de intentos y revisión de evaluaciones

## Hallazgos

La auditoría estática encontró que `start_academic_assessment_attempt` y `submit_academic_assessment` comprobaban sesión y matrícula activa, pero no el estado activo del perfil. Al ser funciones `SECURITY DEFINER`, no deben depender de que una ruta de interfaz bloquee a perfiles suspendidos.

También se encontró que `review_academic_assessment_response` verificaba el permiso de gestión del curso, pero no impedía explícitamente que un tutor/administrador con matrícula revisara su propio intento.

## Cambio propuesto

La migración `20261115113000_harden_academic_assessment_actor_scope.sql`:

- Exige un perfil `active` y lo bloquea con `FOR SHARE` durante el inicio y envío del intento.
- Conserva la validación existente de matrícula activa, estado publicado, tiempo, límite de intentos, preguntas y claves de respuesta.
- Impide que el propietario del intento revise sus propias respuestas manuales.
- Conserva la autorización del revisor mediante `private.can_manage_assessment_course`.
- No altera la rúbrica, el cálculo de puntajes ni el cierre del curso.

## Matriz de pruebas en staging

| Caso | Resultado esperado |
|---|---|
| Usuario sin sesión | Denegado |
| Perfil inactivo con sesión aún válida | No puede iniciar ni enviar intento |
| Perfil activo sin matrícula activa | No puede iniciar ni enviar intento |
| Estudiante activo y matriculado | Puede iniciar y enviar conforme a reglas de evaluación |
| Intento expirado | Se marca como expirado, sin calificación |
| Tutor asignado que revisa a otro estudiante | Permitido si conserva el alcance del curso |
| Tutor/administrador que intenta revisar su propio intento | Denegado |
| Tutor sin asignación del curso | Denegado |
| Revisor con perfil inactivo | Denegado por el helper de alcance |

## Despliegue

Aplicar primero en staging con cuentas independientes para estudiante, tutor y administrador. Verificar regresión de intentos objetivos, respuestas abiertas, rúbricas manuales, límite de intentos, expiración y finalización de curso.

La migración no se ha aplicado ni probado con identidades reales en producción.
