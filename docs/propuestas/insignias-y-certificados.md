# Insignias, niveles y certificados: diseño y propuesta

Estado: **implementado el cálculo y la interfaz (solo lectura)**; el almacenamiento y los certificados son
**propuesta** y requieren autorización antes de tocar la base de datos.

## Qué ya funciona (sin cambios en la base de datos)

La página `/dashboard/estudiante/reconocimientos` calcula las insignias a partir del progreso real del estudiante:

| Dato | Tabla (solo lectura, filtrado por el propio usuario) |
|---|---|
| Lecciones completadas | `lesson_progress` (estado `completed`) vía `course_enrollments` del usuario |
| Actividades entregadas y calificadas | `academic_activity_submissions` |
| Evaluaciones superadas | `academic_assessment_attempts` (`passed = true`, evaluaciones distintas) |
| Cursos completados | `course_enrollments` (`status = completed` o `completed_at`) |
| Racha de días | fechas de las tres fuentes anteriores, en hora de Colombia (UTC-5) |

Código: `lib/recognitions/engine.mjs` (reglas, probadas con 10 pruebas), `lib/recognitions/progress.ts`
(lectura) y `components/recognitions/*` (interfaz). Hay un botón "Ver con datos de ejemplo" para conocer la
experiencia sin actividad real.

## Criterios propuestos (DECOM debe validarlos)

Los umbrales, puntos y niveles son una **propuesta de diseño**, no una regla institucional.
Se cambian en un solo lugar: `BADGE_CATALOG` y `LEVELS` en `lib/recognitions/engine.mjs`.

| Familia | Bronce | Plata | Oro |
|---|---|---|---|
| Aprendizaje (lecciones) | 1 · 10 pts | 5 · 25 pts | 15 · 60 pts |
| Práctica (entregadas / calificadas) | 1 entregada · 15 pts | 3 calificadas · 35 pts | 8 calificadas · 80 pts |
| Evaluación (superadas) | 1 · 20 pts | 3 · 50 pts | 6 · 100 pts |
| Constancia (días seguidos) | 3 · 15 pts | 7 · 40 pts | 21 · 120 pts |
| Programa (cursos completados) | n/a | 1 · 80 pts | 3 · 200 pts |

Niveles por puntos: Aprendiz (0), Practicante (60), Comunicador (200), Referente (450), Mentor (750).

Preguntas para la coordinación:
1. ¿"Actividad calificada" basta, o una insignia debe exigir una nota mínima o aprobación explícita?
2. ¿Cuántos cursos forman el programa "Comunicador con propósito"? (hoy: 3)
3. ¿Se reconocen insignias de servicio (por ejemplo, participación en equipos) además de las académicas?

## Limitaciones actuales

- Las insignias **no se almacenan**: se recalculan cada vez. No hay fecha de obtención ni historial.
  Si una actividad cambia de estado, la insignia puede aparecer o desaparecer.
- Cualquier cambio en los criterios afecta retroactivamente a todos los estudiantes.
- La lectura depende de que las políticas RLS permitan al estudiante ver sus propias filas.
- No hay certificados: la sección solo informa.

## Propuesta de fase 2: otorgamiento persistente (NO aplicar sin autorización)

Objetivo: guardar cuándo se obtuvo cada insignia, congelarla y permitir reconocimientos manuales.
Borrador conceptual (adaptar a las funciones de rol y convenciones reales antes de convertirlo en migración):

```sql
-- BORRADOR. No es una migración. Requiere revisión de seguridad y autorización.
create table public.student_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  district_id uuid not null,                 -- aislamiento por distrito
  badge_id text not null,                    -- id del catálogo (código)
  awarded_at timestamptz not null default now(),
  awarded_by uuid references auth.users (id), -- null = automática
  unique (user_id, badge_id)
);

alter table public.student_badges enable row level security;

-- Lectura: el propio estudiante.
create policy "student reads own badges" on public.student_badges
  for select using (user_id = auth.uid());

-- Lectura distrital y escritura: SOLO mediante funciones que validen rol y distrito
-- (ADAPTAR con las funciones existentes; no conceder INSERT/UPDATE directo a los estudiantes).
```

Reglas de seguridad para esta fase: sin escritura directa desde el cliente; el otorgamiento automático lo
hace una función del servidor que recalcula con las mismas reglas; todo cambio queda auditado; pruebas de
RLS (estudiante A no ve ni crea insignias de B, ni de otro distrito).

## Propuesta de fase 3: certificados verificables

- Emisión al completar un curso y validar la aprobación (rol autorizado).
- Código único (no secuencial) y página pública de verificación que muestre solo lo mínimo
  (nombre, curso, fecha, vigencia).
- PDF con identidad de marca y código QR hacia la página de verificación.
- Revocación y registro de emisiones.
- Validar con la parte jurídica de la IPUC qué datos personales pueden mostrarse públicamente (Ley 1581 de 2012).
