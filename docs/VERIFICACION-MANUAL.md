# Verificación manual: Escuela de Comunicaciones D34

Lista de comprobaciones que requieren una persona. Hacerla sobre la **vista previa de Vercel conectada a
Supabase de desarrollo**, nunca sobre producción. Marcar cada casilla y anotar el resultado.

## 0. Preparación

- [ ] Una cuenta de prueba por rol: `national_admin`, `district_coordinator`, `area_coordinator`,
      `local_responsible`, `tutor`, `academic_editor`, `member`. Correos de prueba, nunca reales.
- [ ] Si es posible, dos distritos de prueba (A y B) para comprobar el aislamiento.
- [ ] La vista previa usa las variables de **Preview** apuntando a la base de desarrollo.
- [ ] Probar en un computador y en un celular real, en modo claro y oscuro.

## 1. Comprobaciones técnicas (automáticas)

- [ ] El CI del PR está en verde (lint, formato, pruebas, auditoría, tipos, build).
- [ ] `curl -I <vista-previa>` muestra `Strict-Transport-Security`, `X-Content-Type-Options`,
      `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.
- [ ] `<vista-previa>/conexion` redirige a `/`.
- [ ] Una ruta protegida sin sesión (por ejemplo `/dashboard`) redirige al acceso.
- [ ] Una ruta inexistente muestra la página 404 de la plataforma.

## 2. Diseño (claro y oscuro; 360, 768 y 1440 px)

Marcar cuando la pantalla se vea bien en ambos modos y sin desbordes horizontales.

| Pantalla | Ruta | Claro | Oscuro |
|---|---|---|---|
| Acceso | `/` | [ ] | [ ] |
| Activar cuenta | `/activar` | [ ] | [ ] |
| Solicitud de invitación | `/solicitud-invitacion` | [ ] | [ ] |
| Acceso denegado | `/acceso-denegado` | [ ] | [ ] |
| Panel | `/dashboard` | [ ] | [ ] |
| Perfil | `/dashboard/perfil` | [ ] | [ ] |
| Congregaciones | `/dashboard/congregaciones` | [ ] | [ ] |
| Invitaciones | `/dashboard/invitaciones` | [ ] | [ ] |
| Matrículas | `/dashboard/matriculas` | [ ] | [ ] |
| Reubicaciones | `/dashboard/reubicaciones` | [ ] | [ ] |
| Planificador | `/dashboard/planificador` | [ ] | [ ] |
| Biblioteca | `/dashboard/biblioteca` | [ ] | [ ] |
| Formación | `/dashboard/formacion` | [ ] | [ ] |
| Revisión académica | `/dashboard/revision-academica` | [ ] | [ ] |
| Estudiante: panel y formación | `/dashboard/estudiante`, `/formacion` | [ ] | [ ] |
| Estudiante: actividades | `/dashboard/estudiante/actividades` | [ ] | [ ] |
| Estudiante: evaluaciones | `/dashboard/estudiante/evaluaciones` | [ ] | [ ] |
| Estudiante: lección | `/dashboard/estudiante/leccion/<id>` | [ ] | [ ] |
| Tutor: panel y calificaciones | `/dashboard/tutor`, `/calificaciones` | [ ] | [ ] |
| Tutor: evaluaciones y crear | `/dashboard/tutor/evaluaciones`, `/crear` | [ ] | [ ] |
| Administración: catálogo, tutores, actividades, biblioteca | `/dashboard/administracion/*` | [ ] | [ ] |

Mirar en especial: tarjetas internas en oscuro, insignias de estado (ámbar, rojo, celeste, turquesa,
verde), botones con texto legible y modales.

## 3. Flujos de aprobación (de punta a punta)

Para cada flujo: crear, aprobar o rechazar, ver el resultado y comprobar el historial.

- [ ] **Invitaciones.** Solicitud en `/solicitud-invitacion`, revisión en `/dashboard/invitaciones`,
      activación en `/activar`. Una invitación usada, vencida o revocada no debe servir.
- [ ] **Matrículas.** Alta de un estudiante en un curso y baja; el estudiante ve o deja de ver su formación.
- [ ] **Reubicación de creyentes.** Nuevo traslado, historial y revisión de responsabilidades
      (preservar, trasladar o finalizar). Debe quedar registro de quién lo hizo.
- [ ] **Actividades.** El estudiante entrega, el tutor califica con rúbrica y retroalimentación,
      el estudiante ve el resultado.
- [ ] **Evaluaciones.** El tutor crea, el estudiante la presenta, el tutor revisa.
- [ ] **Revisión académica.** El editor o administrador revisa y publica contenidos.
- [ ] **Tutores.** Asignar un tutor a un curso; un tutor sin asignación no ve estudiantes de ese curso.

## 4. Permisos por rol

- [ ] Cada rol, con la sesión iniciada, intenta abrir rutas que no le corresponden y llega a
      `/acceso-denegado` (o no ve los datos).
- [ ] Un coordinador del distrito A no ve ni edita nada del distrito B.
- [ ] Un `member` solo ve su propia información.
- [ ] Un `tutor` solo ve a los estudiantes y cursos asignados.
- [ ] Cerrar sesión y usar el botón "atrás" no deja ver datos.

## 5. Depuración de datos

- [ ] Las pantallas con contenido de demostración están rotuladas como tal:
      estudiante (biblioteca, reconocimientos, seguimiento, evaluación de práctica),
      tutor (bandeja de calificaciones, ficha de estudiante), planificador y biblioteca de administración.
      Decidir cuáles se conectan a datos reales y cuáles se ocultan antes de producción.
- [ ] Borrar usuarios, correos, congregaciones y matrículas de prueba de la base de desarrollo antes
      de promover nada.
- [ ] Ninguna clave, token ni `.env` quedó en el repositorio.
- [ ] Revisar que las fotos de perfil sean privadas y que un usuario no abra la de otro.

## 6. Accesibilidad rápida

- [ ] Con la tecla Tab en el login: primero aparece "Saltar al contenido" y el foco siempre se ve.
- [ ] Todo se puede usar solo con teclado (menú lateral, modales, formularios).
- [ ] Zoom al 200 % sin que se rompa el diseño.
- [ ] Los errores de formulario se leen junto al campo y no se pierde lo escrito.

## 7. Cierre y despliegue

- [ ] Todas las casillas anteriores marcadas, o con una incidencia anotada.
- [ ] Copia de seguridad de Supabase tomada antes de cualquier migración en producción.
- [ ] Migraciones aplicadas primero en desarrollo y probadas.
- [ ] PRs fusionados en orden (#55 a #60, luego fase 6 y siguientes).
- [ ] Plan de reversa: en Vercel, volver al despliegue anterior ("Instant Rollback").
- [ ] Revisión de las primeras 24 horas: errores en Vercel y en los registros de Supabase.
