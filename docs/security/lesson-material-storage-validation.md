# Storage: acceso a materiales de lecciones

## Cambio propuesto

Las políticas actuales de `public.lesson_materials` y `storage.objects` permiten consultar metadatos y descargar archivos publicados cuando el usuario puede ver el catálogo académico del distrito, sin exigir matrícula en el curso. Esto deja los controles de metadatos y del archivo desalineados con el alcance académico esperado.

La migración `20261115103000_restrict_lesson_material_storage_to_enrolled_students.sql` alinea el acceso a metadatos y al archivo y exige:

- Para metadatos: registro `lesson_materials` dentro del ámbito autorizado.\n- Para descargas: bucket `academic-lesson-materials` y ruta exacta del objeto.
- Registro de material publicado y ruta exacta coincidente.
- Lección, módulo, curso y programa publicados y dentro del mismo distrito.
- Una de estas dos condiciones:
  - Personal académico que ya puede administrar los recursos de esa lección mediante `private.can_manage_lesson_resources_for_lesson`.
  - Usuario con acceso al catálogo publicado y matrícula en el curso en estado `active` o `completed`.

No se modifica la política de inserción, actualización o eliminación. No se altera la política del bucket de biblioteca ni la de entregas.

## Matriz de validación obligatoria en staging

| Identidad de prueba | Recurso | Resultado esperado |
|---|---|---|
| Anónimo | Cualquier material | Denegado |
| Estudiante activo matriculado | Material publicado de su curso | Permitido |
| Estudiante con matrícula completada | Material publicado de su curso | Permitido |
| Estudiante del mismo distrito sin matrícula | Material del curso | Denegado |
| Estudiante matriculado en otro curso | Material del curso ajeno | Denegado |
| Estudiante de otro distrito | Material del curso | Denegado |
| Tutor asignado al curso | Material de su curso, incluso borrador | Permitido, sujeto al helper existente |
| Tutor sin asignación al curso | Material del curso | Denegado |\n| Gestor académico autorizado | Material borrador de su ámbito | Permitido |
| Administrador nacional | Material publicado | Permitido, sujeto al helper existente |
| Usuario autenticado sin rol académico | Material de curso | Denegado |

## Procedimiento de despliegue seguro

1. Aplicar primero en un proyecto Supabase de staging, nunca directamente en producción.
2. Ejecutar la matriz con cuentas distintas; no basta con probar como administrador.
3. Probar descarga directa y URL firmada nueva. Verificar expiración/revocación de URLs firmadas existentes según la estrategia de la aplicación.
4. Ejecutar las pruebas de regresión de biblioteca y entregas.
5. Revisar el SQL aplicado y el resultado de los asesores de seguridad.
6. Solo entonces aprobar la migración para producción.

## Limitaciones conocidas

- El proyecto Supabase auditado no tenía una rama de staging disponible al momento de la auditoría.
- Esta migración no se ha aplicado ni probado contra identidades reales. El CI de GitHub puede validar formato y pruebas de repositorio, pero no sustituye la prueba RLS/Storage en staging.
- Las URLs firmadas emitidas antes del cambio deben tratarse como credenciales temporales hasta su vencimiento.
