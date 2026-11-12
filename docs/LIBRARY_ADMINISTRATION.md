# Administración de la Biblioteca académica

> Entregable de interfaz y propuesta editorial. Los registros visibles en esta fase son sintéticos y locales. No hay persistencia, carga de archivos, publicación efectiva ni integración con Supabase Storage.

## Objetivo

Dar a Administración nacional y a Editores académicos una interfaz para preparar recursos de consulta, clasificarlos, asociarlos a cursos y gestionar su ciclo editorial sin confundir una acción visual con una publicación institucional.

## Alcance de la interfaz

Ruta: `/dashboard/administracion/biblioteca`.

- Resumen de recursos por estado editorial.
- Búsqueda por título, descripción, categoría y curso.
- Filtros por estado y tipo.
- Alta de recursos en estado borrador.
- Edición de metadatos y selección local de un archivo (solo se conserva el nombre en memoria).
- Asociación a una categoría y a un curso, o alcance general.
- Versión editorial visible.
- Vista previa de cambios de estado: borrador, publicado y archivado.
- Acceso desde el menú principal para `national_admin` y `academic_editor`.

La autorización de ruta en cliente solo mejora la experiencia. No constituye un control de seguridad suficiente para endpoints, descargas ni mutaciones futuras.

## Ciclo editorial propuesto

1. **Borrador:** el editor completa metadatos y prepara el archivo.
2. **Validación:** el servidor verifica título, descripción, tipo MIME, tamaño, categoría, curso, versión y permisos.
3. **Publicación:** una operación privilegiada valida que el recurso está completo, registra autor y fecha y cambia su estado en una transacción.
4. **Actualización:** un recurso publicado no debe sobrescribirse en sitio. Se crea una nueva versión en borrador, conservando el artefacto y los metadatos de la versión publicada.
5. **Archivado:** deja de aparecer en el catálogo normal, pero conserva su historial y referencias para auditoría.
6. **Retiro:** si se requiere ocultar contenido por seguridad o error, usar una acción explícita auditada y no borrar evidencia histórica.

La interfaz actual no implementa estas garantías: los cambios son temporales y se pierden al recargar.

## Modelo lógico que deberá concretarse

- **Recurso:** identidad estable, título, descripción, categoría, tipo, ámbito, curso opcional y estado editorial.
- **Versión de recurso:** número/etiqueta de versión, metadatos congelados, referencia privada al objeto, tamaño, MIME, checksum, autor, fecha y estado.
- **Categoría:** nombre, descripción, orden y estado.
- **Vinculación curricular:** recurso asociado a curso, versión de curso, módulo o lección; no asumir que el título del curso es una clave.
- **Evento editorial:** actor, acción, recurso, versión, fecha, resultado y motivo.
- **Permiso editorial:** capacidad de crear/editar borradores, publicar, archivar y administrar categorías, definida explícitamente y no derivada de acceso general al dashboard.

Los nombres son conceptuales y no constituyen un esquema SQL aprobado.

## Matriz de autorización propuesta

| Acción | Administración nacional | Editor académico |
|---|---:|---:|
| Consultar catálogo administrativo | Sí | Sí |
| Crear borrador | Sí | Sí |
| Editar borrador propio o autorizado | Sí | Sí |
| Publicar recurso | Sí | Según permiso editorial explícito |
| Archivar recurso | Sí | Según permiso editorial explícito |
| Administrar categorías | Sí | Según permiso editorial explícito |
| Acceder a archivos privados | Solo con permiso y URL firmada | Solo con permiso y URL firmada |
| Consultar auditoría completa | Sí | Solo eventos de su ámbito |

Esta matriz requiere aprobación funcional y pruebas RLS/servidor antes de implementarse. La interfaz no concede estos permisos.

## Archivos y seguridad

- Bucket privado; no habilitar lectura pública para materiales internos.
- Validar MIME real y extensión, tamaño máximo y análisis de contenido en servidor.
- Usar rutas de objeto no predecibles y evitar nombres de archivo como identificador.
- Emitir URLs firmadas de corta duración solo tras comprobar sesión, rol, ámbito y relación curricular.
- Nunca confiar en el nombre, MIME o tamaño declarados por el navegador.
- No eliminar un objeto referenciado por una versión publicada sin una política de retención y auditoría.
- Mantener auditoría de carga, reemplazo, publicación, archivo y descarga cuando corresponda.

## Criterios de aceptación para la integración real

- Un usuario sin `national_admin` ni permiso editorial no puede entrar ni invocar mutaciones.
- Un editor no puede publicar fuera del ámbito autorizado.
- Un recurso publicado conserva su versión anterior al crear una nueva.
- La nueva versión no aparece a estudiantes hasta que el servidor confirma su publicación.
- Los filtros del catálogo de estudiantes solo muestran recursos publicados y aplicables a su curso/ámbito.
- No se puede acceder a un archivo privado cambiando su UUID o URL.
- Los fallos de carga no dejan versiones publicadas sin objeto válido.
- Las operaciones editoriales son idempotentes y quedan auditadas.
- Los datos reales se conectan únicamente después de aprobar esquema, permisos, migraciones y pruebas en entorno aislado.

## Límites de esta PR

- No crea tablas, RPC, políticas RLS ni migraciones.
- No escribe en Supabase ni Storage.
- No persiste cambios de recursos ni archivos.
- No habilita publicación real ni notificaciones.
- No despliega a Vercel.
