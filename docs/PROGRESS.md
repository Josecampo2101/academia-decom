# Registro de progreso — Academia DECOM

## Estado general

- **Fase actual:** fase 0 implementada con CI verde; fase 1 en validación.
- **Rama de trabajo:** `feat/escuela-comunicaciones-d34-frontend`.
- **Última referencia auditada:** `0072fd4b659ea442a32ae9aa2ecb5d88043873a3`.
- **Estado de producción:** sin cambios realizados durante esta sesión.

## Registro de sesiones

| Fecha | Fase / tarea | Cambios realizados | Verificaciones ejecutadas | Estado |
|---|---|---|---|---|
| 2026-11-15 | Fase 0 — tokens y tema | Actualizados tokens DECOM, tema inicial y sincronización de preferencia en acceso/conexión/dashboard | CI GitHub PR #55: lint, tests, auditoría, TypeScript y build correctos; pruebas locales y capturas pendientes | Implementación y CI completados; revisión visual pendiente |
| 2026-11-15 | Fase 1 — layout y sidebar | Drawer móvil adaptable, cierre con Escape, contención de foco, bloqueo de scroll de fondo, ayudas accesibles al colapsar y perfil con avatar/nombre/rol | CI GitHub PR #56: lint, tests, auditoría, TypeScript y build correctos; pruebas locales, matriz manual y capturas pendientes | Implementación y CI completados; revisión visual pendiente |
| 2026-11-15 | Fase 2 — login institucional | Rediseño visual del acceso y nueva ilustración SVG original; handlers y flujo Supabase conservados | CI GitHub PR #57 en ejecución; pruebas manuales y capturas pendientes | En curso |

## Fases frontend

| Fase | Descripción | Estado | PR |
|---|---|---|---|
| 0 | Tokens y tema sin parpadeo | Implementación y CI completados; PR #55 abierta como Draft para revisión visual | https://github.com/Josecampo2101/academia-decom/pull/55 |
| 1 | Layout y sidebar | Implementación y CI completados; PR #56 abierta como Draft para revisión visual | https://github.com/Josecampo2101/academia-decom/pull/56 |
| 2 | Login institucional | En curso; PR #57 abierta como Draft | https://github.com/Josecampo2101/academia-decom/pull/57 |
| 3 | Dashboard | Pendiente | — |
| 4 | Componentes compartidos | Pendiente | — |
| 5 | Pulido y accesibilidad | Pendiente | — |

## Bloqueos y riesgos abiertos

- Reconciliar las 12 migraciones registradas en Supabase que no están versionadas en la rama auditada.
- Probar en Supabase local la migración del bucket privado de avatares.
- Revisar los avisos del asesor de seguridad de Supabase.
- Conseguir un entorno local reproducible con Node, dependencias, Supabase CLI y Docker.
- Ejecutar pruebas manuales con al menos dos roles de prueba.

## Plantilla para nuevas entradas

### AAAA-MM-DD — Título

- **Objetivo:**
- **Rama / PR:**
- **Archivos modificados:**
- **Pruebas ejecutadas:**
- **Resultado:**
- **Pendientes / bloqueos:**
- **Lo que NO se tocó:**
