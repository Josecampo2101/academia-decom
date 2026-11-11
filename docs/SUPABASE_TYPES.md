# Tipado del esquema Supabase

## Fuente y actualización

El archivo `lib/supabase/database.types.ts` se genera desde el esquema actual del proyecto Academia DECOM mediante el generador oficial de tipos TypeScript de Supabase.

Para regenerarlo después de aplicar migraciones aprobadas, ejecutar:

```bash
npx supabase gen types typescript --project-id mfnavhfgjqlscjhuxgkj > lib/supabase/database.types.ts
```

Revisar el diff antes de confirmar el archivo. No editar manualmente el archivo generado.

## Uso

Los clientes de navegador y servidor importan `Database` y lo pasan a `createBrowserClient<Database>` y `createServerClient<Database>`. Esto proporciona comprobación estática de tablas, columnas, relaciones y RPC conocidas por el esquema que sirvió de origen.

## Alcance y límites

- Estos tipos representan una fotografía del esquema de producción tomada el 11 de noviembre de 2026.
- No crean ni modifican tablas, funciones, permisos, políticas RLS ni datos.
- No garantizan que una operación esté autorizada: RLS y las comprobaciones de servidor siguen siendo obligatorias.
- Las tablas académicas aún no existen en el esquema actual; sus tipos aparecerán cuando se diseñen y aprueben las migraciones correspondientes.
- Toda migración debe probarse en un entorno aislado antes de aplicarse a producción.
- No incluir claves secretas ni datos de usuarios en este archivo.
