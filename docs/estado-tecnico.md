# Estado técnico y revisión de seguridad

Este documento registra observaciones verificables sobre la rama `main` y el proyecto Supabase conectado. Es una guía de trabajo, no una certificación de seguridad ni una aprobación para producción.

## Arquitectura académica presente

En `main` existen rutas para administración del catálogo, biblioteca académica, actividades, asignación de tutores, planificador, revisión académica, matrículas, estudiante y tutor. La base de datos contiene migraciones para catálogo, inscripciones, progreso, planificador, materiales, evaluaciones, actividades, entregas, revisiones e historial de asignación de tutores.

La asignación de tutores está modelada en `academic_course_tutor_assignments`. El permiso de recursos académicos del tutor se limita por curso mediante `private.can_manage_course_resources(course_id)`. Las políticas de planes, materiales, almacenamiento y revisiones se han adaptado a ese alcance. La pantalla de panel tutor y el flujo de calificación aún requieren validación funcional con un tutor asignado.

## Observaciones de datos al último chequeo

- Cursos registrados: 1.
- Asignaciones activas de tutores: 0.
- Planes de lección: 0.
- Materiales de lección: 0.
- Entregas de actividades: 0.

Con estos datos no es posible completar una prueba de extremo a extremo del ciclo tutor–estudiante–entrega–calificación.

## Revisión de seguridad Supabase

El asesor de seguridad reportó las siguientes categorías:

1. **Tablas con RLS activado y sin políticas explícitas (5 hallazgos):** incluye tablas del esquema privado y tablas públicas relacionadas con notificaciones/solicitudes de invitación y traslados. Algunas pueden estar diseñadas para acceso exclusivo mediante RPC `SECURITY DEFINER`; se debe revisar cada ruta de acceso antes de agregar políticas. No se deben abrir tablas por conveniencia.
2. **Funciones `SECURITY DEFINER` ejecutables por usuarios autenticados (28 hallazgos):** el aviso es una señal para revisar privilegios, no prueba automática de vulnerabilidad. Para cada función se debe determinar si es una RPC pública intencional, verificar validación de identidad y autorización, `search_path`, esquema y permisos `EXECUTE`. Las funciones de autorización consultadas por políticas no deben revocarse sin revisar dependencias.
3. **Rendimiento:** el asesor identificó claves foráneas sin índices de cobertura, índices no utilizados y una política permisiva duplicada en `roles`. También reportó dos índices equivalentes sobre el hash de invitación. No se han eliminado índices ni modificado políticas a partir de estos avisos: primero debe comprobarse el uso real, restricciones y consultas.

Referencias de revisión:
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Seguridad de la base de datos Supabase](https://supabase.com/docs/guides/database/secure-data)

## Pendientes de validación

- Probar con cuentas separadas los roles administrador nacional, coordinación distrital, comité distrital, tutor y estudiante.
- Crear una asignación real tutor–curso y comprobar que el tutor no puede consultar otro curso del mismo distrito.
- Completar matrícula, publicación de actividad, entrega, revisión y consulta del historial.
- Verificar el flujo de invitación: solicitud, aprobación/rechazo, activación y notificaciones.
- Ejecutar localmente `npm run lint`, `npm run typecheck`, `npm test` y `npm run build`.
- Revisar los avisos del asesor de Supabase uno por uno y corregir solo los que se confirmen como defectos.
- Realizar despliegue manual y pruebas de aceptación cuando el propietario lo indique.

## Política de despliegue

No se ha realizado ningún despliegue a Vercel como parte de esta revisión. Mantener los despliegues en pausa hasta la sesión manual de publicación.


## Ajustes de alcance por curso (13 de noviembre de 2026)

Se aplicaron dos migraciones para cerrar permisos académicos que todavía dependían del alcance distrital genérico:

- `20261113023454_enforce_course_scoped_activity_permissions.sql` (versión aplicada en Supabase: `20261113023454`): las lecturas de matrículas y las operaciones de actividades y asignaciones se limitan al curso cuando el actor es tutor. Los administradores académicos conservan su ámbito autorizado y los estudiantes conservan el acceso a sus propias actividades publicadas/asignadas.
- `20261113023517_avoid_activity_assignment_rls_recursion.sql` (versión aplicada en Supabase: `20261113023517`): centraliza la comprobación de alcance de una asignación en una función interna `SECURITY DEFINER` con `search_path` vacío, evitando referencias recursivas entre políticas de actividades y asignaciones.

El panel `app/dashboard/tutor/page.tsx` se sustituyó para consultar asignaciones activas, matrículas, entregas pendientes y revisiones reales. Ya no incluye nombres, entregas ni estadísticas de demostración. Los nombres de estudiantes usan un fallback neutro cuando la política de perfiles no permite leerlos.

**Validación pendiente:** no se ejecutaron lint, TypeScript, build ni pruebas de navegador en esta sesión. Tampoco hay asignaciones activas, matrículas o entregas de prueba en la base de datos, por lo que el flujo visual necesita una prueba manual con un tutor asignado.


## Evaluaciones: alcance de tutor por curso (13 de noviembre de 2026)

Se detectó que el permiso anterior `private.can_manage_assessment(district_id)` incluía a cualquier tutor activo del distrito. Eso permitía que un tutor consultara intentos y revisara respuestas de cursos sin asignación, aunque otros recursos académicos ya estaban limitados por curso.

La migración `20261113100442_scope_assessment_permissions_to_assigned_courses.sql` corrige el alcance:

- El permiso de gestión de evaluaciones ahora distingue administración académica del acceso del tutor.
- Se incorpora `private.can_manage_assessment_course(course_id, district_id)`, que valida el curso y reutiliza el permiso de recursos por curso.
- Las políticas RLS de evaluaciones, preguntas, intentos y respuestas aplican el mismo alcance.
- Las RPC de guardar preguntas, publicar evaluaciones y revisar respuestas validan el curso antes de modificar datos. La pantalla de creación también filtra el selector de cursos a las asignaciones activas del tutor; editores académicos y administración nacional conservan el filtro por su ámbito autorizado.
- Los estudiantes mantienen acceso a evaluaciones publicadas y a sus propios intentos/respuestas; los editores académicos y administración nacional conservan su ámbito de catálogo.

La migración fue aplicada en Supabase y verificada mediante lectura de las funciones y políticas resultantes. El asesor de seguridad sigue reportando hallazgos generales de funciones `SECURITY DEFINER` y tablas privadas sin políticas explícitas; no se han cambiado indiscriminadamente porque varias rutas usan RPC controladas.

**Validación pendiente:** aún no hay asignaciones tutor–curso, matrículas, evaluaciones ni intentos reales para una prueba con usuarios separados. Tampoco se han ejecutado typecheck, lint o build. Vercel permanece sin despliegues.
