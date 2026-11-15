# Plan de renovación del frontend — Academia DECOM

**Base de trabajo:** `feat/escuela-comunicaciones-d34-frontend`  
**Principio:** un PR pequeño por fase, con base en la rama de trabajo indicada. No fusionar ni desplegar sin autorización.

## Reglas de ejecución

- Mantener el comportamiento actual: autenticación, recuperación, redirecciones, permisos, consultas, mutaciones, validaciones y reglas académicas.
- No modificar `proxy.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, guards, RPCs, RLS, grants ni datos.
- No leer ni modificar `.env*`, claves, tokens o secretos.
- No aplicar migraciones remotas. Si una fase requiere cambios de esquema o políticas, se detiene y se solicita autorización.
- Crear rama `feat/*` o `fix/*` desde la rama de trabajo; abrir un PR dirigido a `feat/escuela-comunicaciones-d34-frontend`.
- Cada PR debe describir problema, alcance, archivos, pruebas ejecutadas, capturas en claro/oscuro y escritorio/móvil, y “Lo que NO se tocó”.
- No declarar una prueba ejecutada si no se ejecutó. No usar resultados de CI como sustituto de una prueba manual.
- Si aparece un hallazgo crítico, detener la tarea y reportarlo antes de continuar.

## Fase 0 — Tokens, superficies y tema sin parpadeo

**Objetivo:** consolidar un sistema visual basado en la marca, sin alterar navegación ni comportamiento de módulos.

**Qué se modifica**
- Normalizar tokens semánticos para color, superficie, texto, borde, foco, sombra, radio y estados.
- Alinear azul `#087DB5`, turquesa `#19A7A0`, azul oscuro `#102D4D` y fondo `#F4F7FA`.
- Definir equivalentes accesibles para modo claro y oscuro.
- Unificar la resolución de `light | dark | system` y evitar flash de tema.
- Retirar gradientes decorativos del fondo global y sustituirlos por superficies sobrias.
- Mantener contraste AA y foco visible.

**Archivos previstos**
- `app/globals.css`
- `app/layout.tsx` (solo inicialización visual del tema)
- Nuevos componentes/utilidades de tema, si la implementación lo requiere, bajo `components/theme/` o `lib/theme/`
- `docs/DECISIONS.md` para registrar decisiones visuales.

**Pruebas**
- `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- Comprobación en navegador de carga inicial con tema claro, oscuro y sistema; recarga y cambio de preferencia del sistema.
- Verificación de contraste AA, foco visible y `prefers-reduced-motion`.
- Capturas en escritorio/móvil de los tres temas.

**Criterios de aceptación**
- La preferencia se aplica antes del primer pintado y no se pierde al navegar o recargar.
- Los tokens sustituyen los colores hardcodeados que sean globales; no se cambian todavía los diseños particulares del login ni de cada módulo.
- No hay gradientes decorativos globales.
- No cambian rutas, permisos, datos, textos funcionales ni handlers.

**No regresión**
- Comparar el comportamiento del login, dashboard y páginas existentes antes/después.
- Revisar diff para confirmar que no se modificaron auth, proxy, clientes Supabase, RLS, RPCs ni lógica de negocio.

## Fase 1 — Layout institucional y sidebar

**Estado:** en curso. PR #56 abierta como Draft: https://github.com/Josecampo2101/academia-decom/pull/56.

**Objetivo:** establecer un shell de navegación consistente, accesible y adaptable.

**Qué se modifica**
- Refinar sidebar colapsable: estados activo/hover/foco, tooltips al colapsar y agrupación clara.
- Refinar drawer móvil: apertura/cierre, foco, tecla Escape y cierre al navegar.
- Unificar cabecera, área de contenido, espaciado y contenedor de página.
- Mantener navegación y visibilidad de opciones exactamente según las reglas actuales.

**Archivos previstos**
- `app/dashboard/page.tsx` como punto de integración.
- Nuevos componentes presentacionales en `components/dashboard/` (por ejemplo, sidebar, shell, navegación y cabecera).
- `app/globals.css` solo si se requieren tokens o utilidades comunes adicionales.

**Pruebas**
- Lint, typecheck, tests y build.
- Navegación con teclado, foco, lector de pantalla y viewport móvil.
- Probar rutas representativas de estudiante, tutor, coordinador distrital y administrador nacional con cuentas de prueba.
- Capturas de sidebar expandido/colapsado y drawer móvil.

**Criterios de aceptación**
- Todas las rutas existentes siguen accesibles.
- El elemento activo refleja la ruta actual.
- Sidebar colapsable y drawer funcionan sin pérdida de estado ni bloqueo de contenido.
- Las etiquetas siguen siendo comprensibles con el menú colapsado.
- No se amplía ni reduce el acceso funcional de ningún rol.

**No regresión**
- Comparar enlaces y condiciones de visibilidad antes/después.
- Verificar que no se modifican las consultas de roles ni las reglas RLS que respaldan la autorización.

## Fase 2 — Login institucional

**Estado:** en curso. PR #57 abierta como Draft: https://github.com/Josecampo2101/academia-decom/pull/57. Se incorporó una ilustración vectorial original porque el repositorio no tenía activos gráficos institucionales disponibles.

**Objetivo:** aplicar la referencia visual solicitada con marca propia, preservando la lógica actual.

**Qué se modifica**
- Banner superior redondeado con imagen propia aprobada y máscara oscura.
- Tarjeta de acceso angosta superpuesta y adaptable.
- Presentación del logo DECOM en versiones clara/oscura si los activos oficiales están disponibles; no inventar ni copiar el logo de Templum.
- Ojo de contraseña integrado y flotante dentro del campo.
- Botón principal a ancho completo con estado de carga.
- Enlace de recuperación y pie institucional.
- Mantener el selector de tema de tres modos y todos los textos actuales.

**Archivos previstos**
- `app/page.tsx` como orquestador de los handlers existentes.
- Nuevos componentes presentacionales en `components/auth/`.
- Activos propios aprobados en `public/`.
- `app/globals.css` solo para estilos compartidos.

**Pruebas**
- Lint, typecheck, tests y build.
- Prueba manual de credenciales válidas e inválidas, carga, recuperación, mensajes y redirección.
- Verificar que no se persiste la contraseña y que el comportamiento de correo recordado permanece igual.
- Capturas claro/oscuro en escritorio y móvil.

**Criterios de aceptación**
- Se conserva exactamente la integración actual de `signInWithPassword`, `resetPasswordForEmail`, destino de recuperación, mensajes y navegación.
- Campos etiquetados, contraste AA, foco visible y controles accesibles.
- La imagen y el logo son activos propios, no copias de la referencia.

**No regresión**
- Comparar handlers y llamadas Supabase antes/después.
- No modificar sesiones, Auth, proxy, rutas protegidas ni configuración de Supabase.

## Fase 3 — Dashboard y experiencia de inicio

**Objetivo:** mejorar jerarquía, lectura y utilidad del inicio según rol y perfil.

**Qué se modifica**
- Jerarquía del saludo, nombre visible, fotografía disponible y resumen de actividad.
- Tarjetas/módulos con tamaños, iconografía y estados consistentes, sin exceso de tarjetas.
- Estados de carga, vacío, error y datos parciales.
- Diseño responsive y uso consistente de tokens.
- Separar componentes de presentación del estado/consultas existentes sin cambiar su resultado.

**Archivos previstos**
- `app/dashboard/page.tsx`
- Nuevos componentes presentacionales en `components/dashboard/`
- `app/globals.css` si se requieren ajustes de tokens.

**Pruebas**
- Lint, typecheck, tests y build.
- Pruebas manuales con al menos dos roles distintos y perfiles con/sin fotografía.
- Probar datos vacíos, errores de consulta y nombres largos.
- Capturas claro/oscuro y escritorio/móvil.

**Criterios de aceptación**
- El nombre de la persona es el identificador principal; el correo no reemplaza al nombre.
- Saludo y módulos siguen correspondiendo a la hora y rol que ya determina la lógica actual.
- Estados de carga/vacío/error son claros y no presentan datos inventados.
- Se mantiene la navegación existente.

**No regresión**
- No cambiar consultas, filtros, mutations, permisos ni RPCs.
- Revisar que la extracción de componentes no cambie el orden de carga ni las condiciones de acceso.

## Fase 4 — Componentes compartidos

**Objetivo:** reducir duplicación visual y mejorar consistencia entre módulos.

**Qué se modifica**
- Componentes presentacionales reutilizables para botones, campos, formularios, tablas, filtros, encabezados, indicadores, diálogos, estados vacíos y mensajes.
- Variantes visuales accesibles y documentadas.
- Migración progresiva de páginas, una familia de componentes por PR si el alcance lo requiere.

**Archivos previstos**
- Nuevos componentes en `components/ui/` y `components/forms/`.
- Páginas de `app/dashboard/` seleccionadas por prioridad.
- `app/globals.css` para estilos base, evitando selectores globales que rompan módulos.

**Pruebas**
- Lint, typecheck, tests y build.
- Tests de componentes para estados, validación visual y teclado cuando proceda.
- Revisión de formularios, tablas y diálogos en móvil y escritorio.
- Capturas representativas antes/después.

**Criterios de aceptación**
- Los componentes compartidos tienen API pequeña, semántica y documentada.
- Se mantienen nombres de campos, validaciones, mensajes, llamadas y reglas de negocio.
- No se introduce una dependencia UI grande sin justificación.
- Se conserva el comportamiento específico de cada módulo.

**No regresión**
- Comparar el contrato de props y handlers con la implementación original.
- No migrar todos los módulos en un único cambio masivo.

## Fase 5 — Pulido, accesibilidad y consistencia

**Objetivo:** cerrar brechas de accesibilidad, responsive y calidad visual.

**Qué se modifica**
- Contraste AA, navegación por teclado, orden de foco, etiquetas, nombres accesibles y mensajes de estado.
- Áreas táctiles, tablas en pantallas estrechas, overflow, tipografía y espaciado.
- Estados de error y carga; movimiento reducido.
- Revisión de iconografía Lucide, textos y consistencia entre módulos.

**Archivos previstos**
- Componentes compartidos de `components/`.
- Páginas priorizadas de `app/dashboard/`.
- `app/globals.css` y documentación visual.

**Pruebas**
- Lint, typecheck, tests y build.
- Revisión manual de accesibilidad con teclado y lector de pantalla.
- Auditoría automatizada de accesibilidad en páginas representativas.
- Flujo manual login → dashboard → logout con dos roles de prueba.
- Matriz de capturas claro/oscuro y escritorio/móvil.

**Criterios de aceptación**
- Sin errores críticos de accesibilidad en las páginas incluidas.
- Contraste AA en texto y controles; foco visible y estados anunciados.
- Sin overflow horizontal no intencional en móviles.
- CI verde y pruebas manuales registradas.

**No regresión**
- Verificar todas las rutas afectadas y permisos de los roles de prueba.
- No declarar terminada la fase si falta una prueba obligatoria; registrar lo no ejecutado.

## Puertas de control entre fases

1. Un PR por fase, pequeño y revisable, dirigido a la rama de trabajo.
2. CI verde en el commit exacto del PR.
3. Capturas de los estados acordados.
4. Checklist de “Lo que NO se tocó”.
5. Revisión del diff para asegurar que la lógica no cambió.
6. No fusionar PR ni desplegar sin autorización expresa.
7. Las divergencias de migraciones, el bucket de avatar y los hallazgos de seguridad se gestionan en trabajos separados; no se resuelven dentro de una fase visual.
