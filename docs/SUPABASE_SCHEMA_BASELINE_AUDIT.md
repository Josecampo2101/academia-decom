# Auditoría inicial de línea base de Supabase

> Estado: inventario preliminar de solo lectura. No es una migración baseline ni declara que el esquema sea reproducible todavía.

- Proyecto inspeccionado: Academia DECOM (`mfnavhfgjqlscjhuxgkj`).
- Fecha de inspección: 2026-11-11.
- Rama de trabajo: `docs/supabase-schema-baseline-audit`.
- Alcance: consultas de catálogo y metadatos; no se ejecutó DDL ni se modificaron datos, permisos o configuración.

## 1. Hallazgo principal

El historial de migraciones registrado actualmente en producción contiene cinco versiones:

| Versión | Nombre |
|---|---|
| `20261111024732` | `allow_committee_create_congregations` |
| `20261111100116` | `break_congregations_memberships_rls_cycle` |
| `20261111100516` | `grant_authenticated_invitation_management` |
| `20261111100627` | `restrict_legacy_invitation_rpc_access` |
| `20261111100827` | `add_scoped_invitation_request_listing` |

El inventario de objetos existentes es considerablemente más amplio que esas cinco entradas. Por tanto, **no se debe ejecutar un reset, reconstruir producción desde cero ni asumir que el historial actual permite crear una base equivalente**.

## 2. Inventario confirmado

Consultas de catálogo de solo lectura sobre los esquemas indicados:

| Objeto | Cantidad |
|---|---:|
| Tablas del esquema `public` | 13 |
| Funciones en `public` y `private` | 30 |
| Triggers no internos en `public`, `auth` y `storage` | 17 |
| Políticas RLS en `public` y `storage` | 32 |
| Índices en `public` y `storage` | 70 |

### Tablas públicas observadas

- `area_memberships`
- `areas`
- `congregations`
- `districts`
- `invitation_notifications`
- `invitation_requests`
- `invitations`
- `membership_transfer_area_reviews`
- `membership_transfers`
- `memberships`
- `profiles`
- `roles`
- `user_role_assignments`

Las 13 tablas observadas tienen RLS habilitado en el inventario de tablas consultado.

### Observaciones de Storage

La consulta de inventario a `storage.buckets` no devolvió filas agregadas. Se debe confirmar el estado de Storage y sus políticas con una consulta específica antes de diseñar la baseline. No se debe interpretar la ausencia de buckets como prueba de que toda la configuración de Storage sea inexistente.

## 3. Riesgos y límites de esta inspección

Este documento todavía no contiene una extracción completa de:

- Definiciones de todas las tablas, constraints, secuencias y tipos.
- Definiciones completas de vistas y materialized views.
- Todas las funciones, triggers y dependencias en formato reproducible.
- Grants de esquemas, tablas, secuencias y funciones, incluidos privilegios por defecto.
- Políticas y configuración de Storage, buckets y objetos.
- Extensiones instaladas y sus esquemas, versiones y dependencias.
- Configuración de Auth, Realtime, cron, Vault y otros componentes gestionados.
- Comparación objeto por objeto entre producción, migraciones del repositorio y ramas abiertas.

Los conteos son una fotografía del catálogo consultado; no sustituyen la extracción DDL ni la validación en una base aislada.

## 4. Procedimiento seguro propuesto

1. Congelar una referencia del estado actual de producción y registrar fecha/hora de extracción.
2. Inventariar por separado objetos administrados por Supabase y objetos propios de la aplicación.
3. Descargar el contenido de las migraciones versionadas en todas las ramas relevantes y compararlo con las cinco versiones registradas.
4. Obtener el DDL del esquema propio sin incluir datos de usuarios ni secretos.
5. Clasificar cada objeto como cubierto, faltante, divergente o administrado por Supabase.
6. Construir una baseline para instalaciones nuevas, separada de las migraciones incrementales existentes.
7. Probar la baseline en una base de desarrollo aislada y vacía; verificar tablas, constraints, índices, funciones, triggers, políticas y grants.
8. Aplicar las migraciones incrementales posteriores y comparar el esquema resultante con el inventario de origen.
9. Añadir CI para detectar drift y validar migraciones en cada PR.
10. Documentar el procedimiento de restauración y rollback.

## 5. Reglas de seguridad

- No ejecutar `db reset`, DROP, TRUNCATE ni recreación de objetos en producción.
- No marcar migraciones como aplicadas para ocultar diferencias.
- No copiar datos reales de perfiles, membresías, invitaciones ni tokens a una base de prueba.
- No incluir secretos, claves API, contraseñas ni valores de Vault en Git.
- No generar una baseline a partir de un inventario parcial.
- No aplicar una baseline a producción. La baseline es para instalaciones nuevas; producción conserva su historial y requiere un plan de reconciliación separado.
- Todo cambio de esquema posterior debe llegar como migración revisable y probarse fuera de producción.

## 6. Próximos entregables

- [ ] Extracción DDL completa y sanitizada.
- [ ] Matriz de cobertura entre catálogo de producción y migraciones del repositorio.
- [ ] Baseline reproducible para bases nuevas.
- [ ] Prueba de reconstrucción en entorno aislado.
- [ ] Validación automática de migraciones y tipos.
- [ ] Guía de operación, restauración y rollback.

**Conclusión:** la auditoría confirma que la línea base de migraciones es una prioridad real. El trabajo realizado aquí es únicamente el primer inventario; no se ha creado ni aplicado una migración baseline.
