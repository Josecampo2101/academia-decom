# Tipado del esquema Supabase

## Fuente y actualización

`lib/supabase/database.types.ts` se genera desde el esquema real del proyecto Academia DECOM mediante el generador oficial de tipos TypeScript de Supabase.

Para regenerarlo después de aplicar una migración versionada:

```bash
npx supabase gen types typescript --project-id mfnavhfgjqlscjhuxgkj > lib/supabase/database.types.ts
```

Revisar el diff antes de confirmar el archivo. No editar manualmente el archivo generado.

## Uso

Los clientes de navegador y servidor importan `Database` y lo pasan a `createBrowserClient<Database>` y `createServerClient<Database>`. Esto proporciona comprobación estática de tablas, columnas, relaciones y RPC conocidas por el esquema que sirvió de origen.

## Alcance actual

- Los tipos incluyen las tablas institucionales existentes y el catálogo académico persistente: `academic_programs`, `courses`, `course_modules`, `lessons`, `curriculum_versions` y `academic_catalog_events`.
- También incluyen la RPC pública `publish_academic_course`.
- La fotografía fue regenerada el 11 de noviembre de 2026 después de aplicar las migraciones académicas.
- Los archivos SQL de `supabase/migrations` deben conservar exactamente la versión registrada en `supabase_migrations.schema_migrations`.

## Límites y seguridad

- Los tipos no crean ni modifican tablas, funciones, permisos, políticas RLS ni datos.
- El tipado no garantiza autorización: RLS y las comprobaciones de servidor siguen siendo obligatorias.
- Las claves secretas nunca deben importarse en componentes cliente.
- El esquema académico se aplicó a producción con migraciones aditivas autorizadas. Se verificaron RLS, políticas y privilegios; no se creó una rama de Supabase de pago ni se insertaron registros de prueba.
- La CI valida lint, TypeScript, pruebas y compilación de la aplicación; no sustituye pruebas funcionales de SQL con usuarios de cada rol.
