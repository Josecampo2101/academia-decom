# Conexión de las pantallas del estudiante a datos reales

Todas las conexiones son de **solo lectura**, filtradas por el propio usuario y dependientes de las políticas RLS
existentes. No se creó ni modificó ninguna tabla, política ni función.

## Estado actual

| Pantalla | Estado | Fuente de datos |
|---|---|---|
| Reconocimientos (`/dashboard/estudiante/reconocimientos`) | Real (insignias calculadas) | `course_enrollments`, `lesson_progress`, `academic_activity_submissions`, `academic_assessment_attempts` |
| Seguimiento (`/dashboard/estudiante/seguimiento`) | Real | las anteriores + `courses`, `course_modules`, `lessons`, `academic_activity_assignments`, `academic_activities`, `academic_assessments` |
| Biblioteca (`/dashboard/estudiante/biblioteca`) | Real | `academic_library_categories`, `academic_library_resources` (solo `status = published`) y el bucket privado `academic-library-resources` con enlaces firmados de 5 minutos |
| Evaluación de práctica | Demostración | contenido fijo en el código (la clave de respuestas viaja al navegador; solo es práctica) |

## Lógica reutilizable (con pruebas)

- `lib/recognitions/engine.mjs`: insignias, puntos, niveles y rachas.
- `lib/tracking/engine.mjs`: avance por curso, actividades pendientes, línea de tiempo y próximos pasos.
- `lib/library/resources.mjs`: filtros sin tildes, validación de enlaces (solo http/https), tamaños y modos de apertura.
- Los lectores `lib/*/data.ts` solo hacen `select`; los motores son funciones puras.

## Qué comprobar antes de desplegar

1. **Migraciones aplicadas.** La biblioteca depende de las migraciones `20261112095208` a `20261112095349`
   (tablas, bucket privado y endurecimiento). Si no están aplicadas en tu base de desarrollo, la pantalla mostrará un
   aviso de error (no se rompe).
2. **RLS de lectura.** Con una cuenta de estudiante real, comprueba que ve solo sus matrículas, entregas e intentos,
   y solo los recursos publicados de su distrito. Con una cuenta de otro distrito, que no ve los de este.
3. **Aislamiento de datos de administradores.** Un `national_admin` que entre a estas pantallas ve sus propios datos
   (probablemente vacíos), porque las consultas filtran por `user_id`.

## Pendiente importante: administración de la biblioteca

`/dashboard/administracion/biblioteca` es todavía un **prototipo con datos en memoria**: no crea, sube, versiona ni
publica recursos en las tablas reales. Hasta conectarlo, la biblioteca del estudiante solo mostrará recursos insertados
por otras vías (por ejemplo, SQL). Conectarlo implica escrituras (crear, subir a Storage, publicar, nueva versión,
archivar) regidas por las políticas existentes; conviene hacerlo con una cuenta de prueba por rol y revisar el resultado.

## Pendiente menor

- Seguimiento no muestra todavía la fecha límite de cada actividad pendiente (el dato existe).
- Las evaluaciones disponibles no se listan en "Próximos pasos"; se enlaza a la pantalla de evaluaciones.
- Reconocimientos no muestra certificados (ver `docs/propuestas/insignias-y-certificados.md`).
