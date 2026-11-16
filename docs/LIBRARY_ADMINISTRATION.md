# Biblioteca académica: implementación y operación

## Estado de implementación

La Biblioteca de Academia DECOM está conectada a Supabase en la rama de integración. La persistencia usa:

- `academic_library_categories`: categorías por distrito.
- `academic_library_resources`: metadatos, ámbito, curso, versión, estado y ruta privada del archivo.
- Bucket privado `academic-library-resources` para los archivos.
- Políticas RLS y políticas de Storage que limitan las operaciones al ámbito académico autorizado.

La interfaz administrativa está en `/dashboard/administracion/biblioteca`; la vista de consulta del estudiante está en `/dashboard/estudiante/biblioteca`.

## Funciones implementadas

- Crear categorías y recursos en estado borrador.
- Crear recursos de lectura y enlaces externos, o adjuntar archivos.
- Asociar recursos a un curso o publicarlos como material general del distrito.
- Validar campos obligatorios, extensión/tipo MIME declarado y límite de 50 MB en la interfaz.
- Guardar archivos en el bucket privado y vincularlos con el registro del recurso.
- Publicar y archivar recursos.
- Crear nuevas versiones en registros separados, conservando la versión publicada anterior.
- Eliminar borradores y sus archivos.
- Mostrar al estudiante recursos publicados aplicables a su distrito y, si están asociados a un curso, a sus matrículas activas o completadas.
- Generar enlaces firmados de corta duración para descargar/abrir archivos privados.

La carga compensa errores posteriores al upload intentando retirar el objeto y el registro incompleto. Si la operación de compensación también falla, la interfaz informa que puede quedar limpieza manual pendiente.

## Seguridad aplicada

- RLS está habilitado en las tablas de categorías y recursos.
- Las políticas de categorías y recursos usan `private.can_manage_academic_catalog` para restringir las mutaciones al ámbito editorial autorizado.
- Los estudiantes solo consultan recursos publicados y dentro de su ámbito; los recursos vinculados a curso requieren matrícula activa o completada.
- El bucket es privado, con límite de 50 MB y lista permitida de tipos MIME.
- Las políticas de Storage comprueban bucket, distrito, recurso y estado editorial.
- Los enlaces firmados se solicitan desde una sesión autenticada y duran cinco minutos.
- Las versiones publicadas no se sobrescriben: se crea un nuevo registro borrador con `version_parent_id`.

## Límites que siguen pendientes

- La comprobación de MIME/extensión en el navegador no sustituye un análisis de contenido del archivo en servidor. No hay antivirus ni inspección de contenido implementados.
- No hay datos de recursos ni matrículas en el proyecto de pruebas consultado; las tablas de biblioteca y matrículas estaban vacías durante la validación.
- Falta una prueba funcional con una cuenta real de editor y otra de estudiante, incluyendo carga, publicación, lectura, descarga firmada, nueva versión y archivado.
- La integración está en una Pull Request; no debe considerarse activa en producción hasta que se integre y despliegue con autorización.

## Procedimiento de prueba funcional

1. Ingresar con un usuario editor autorizado para el Distrito 34.
2. Crear una categoría y un recurso de lectura.
3. Crear un recurso de archivo PDF y comprobar que aparece en Storage como privado.
4. Publicar ambos recursos.
5. Ingresar con una cuenta estudiante con matrícula activa en el curso asociado.
6. Confirmar que el estudiante ve el recurso publicado y puede abrir el archivo mediante el enlace firmado.
7. Confirmar que una cuenta sin matrícula no ve el recurso específico del curso.
8. Crear una nueva versión y verificar que la versión publicada anterior permanece intacta.
9. Archivar la versión nueva y comprobar que deja de aparecer en el catálogo normal.

No usar información personal real para las pruebas; utilizar cuentas de prueba autorizadas.
