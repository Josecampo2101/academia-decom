# Registro de decisiones — Academia DECOM

Este documento conserva decisiones explícitas de arquitectura, experiencia de usuario, seguridad y operación. Una propuesta no se considera decisión hasta que haya sido aprobada.

## Decisiones aprobadas

_Decisiones registradas durante la preparación de fase 0._

| ID | Fecha | Decisión | Motivo | Alcance | Estado |
|---|---|---|---|---|---|
| DEC-001 | 2026-11-15 | Mantener los nombres de tokens CSS semánticos existentes y alinear sus valores a la paleta oficial DECOM | Evitar cambios masivos en módulos que consumen las variables actuales | `app/globals.css` | Aprobada |

### DEC-002 — El tema inicial se determina antes del primer pintado y se representa mediante la clase `dark` del elemento raíz

- **Fecha:** 2026-11-15
- **Estado:** Aprobada
- **Contexto:** El script inicial y los efectos de cliente podían dejar atributos y clases de tema desincronizados durante la hidratación.
- **Opciones consideradas:** Mantener atributo `data-theme` como segunda fuente de verdad; utilizar la clase raíz `dark` como fuente de verdad visual.
- **Decisión:** Utilizar la clase raíz `dark` y validar la preferencia persistida antes de pintar.
- **Justificación:** Reduce estados duplicados y conserva la clave y selector de tres modos ya existentes.
- **Consecuencias:** Las páginas deben seguir sincronizando la clase raíz al cambiar el modo; no cambia la lógica de autenticación.
- **Archivos o módulos afectados:** `app/globals.css`, `app/layout.tsx`, páginas de acceso, conexión y dashboard.
- **Quién la aprobó:** Aprobación del plan de fase 0 por el usuario; detalle de implementación conservador.

## Decisiones pendientes

| ID | Tema | Opciones | Recomendación | Impacto |
|---|---|---|---|---|
| DEC-P-001 | Tema pendiente | Opción A / Opción B | Recomendación razonada | Consecuencias |

## Plantilla para registrar una decisión

### DEC-XXX — Título

- **Fecha:**
- **Estado:** Propuesta / Aprobada / Rechazada / Sustituida
- **Contexto:**
- **Opciones consideradas:**
- **Decisión:**
- **Justificación:**
- **Consecuencias:**
- **Archivos o módulos afectados:**
- **Quién la aprobó:**
