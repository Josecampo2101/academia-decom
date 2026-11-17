# Fase 6: consistencia visual, modo oscuro y cabeceras de seguridad

Rama de trabajo: `feat/phase-6-consistency` (parte de la cima de la fase 5).
Alcance: solo presentación, enrutamiento y cabeceras HTTP. No se tocó `proxy.ts`, la lógica de
autenticación, Supabase, migraciones ni políticas RLS.

## Qué cambió

1. **Formato.** Prettier (ancho 100) aplicado a 29 páginas con líneas de más de 220 caracteres.
   Commit aparte, sin cambios de comportamiento.
2. **Acceso único.** `/conexion` (copia antigua del login) redirige a `/` (307) y su página se eliminó.
   Los `router.replace("/conexion")` existentes siguen funcionando por la redirección.
3. **Cabeceras de seguridad.** Se integra `security/global-response-headers` (HSTS, nosniff,
   X-Frame-Options, Referrer-Policy) y se añade `Permissions-Policy`
   (cámara, micrófono, geolocalización y pagos desactivados).
4. **Tokens de diseño.** Nuevos tokens semánticos en `app/globals.css`:
   `surface`, `surface-muted`, `line`, `line-soft`, `muted-fg`, `decom-blue(-hover|-text|-soft)`,
   `decom-teal(-text|-light)`, `decom-navy`. Se adaptan solos entre claro y oscuro.
5. **Migración de colores.** ~650 colores fijos (hex y neutros de Tailwind) pasaron a tokens en 46 archivos.
   Se eliminaron 219 variantes `dark:` neutras redundantes.
6. **Modo oscuro de la paleta de estado.** Fondos claros (50 a 100) y bordes (200) de amber, emerald, red,
   rose, sky, teal, orange y green pasan a tintes translúcidos; los textos oscuros (700 a 900) a tonos claros.
   Se hace en `:root.dark` redefiniendo las variables de Tailwind, sin tocar cada página.
7. **Botones primarios unificados.** Habían tres azules distintos (`#087DB5`, `blue-700`, `sky-700`);
   ahora todos usan `decom-blue` con `decom-blue-hover`.
8. **Contraste.**
   - `--muted` (claro) pasó de `#60748a` a `#56697f`: ahora cumple AA sobre `surface`, `background`
     y `surface-muted` (antes 4.3:1 sobre `surface-muted`).
   - Texto sobre relleno turquesa: de blanco (3.0:1) a azul oscuro (4.7:1) en 6 botones.
   - El texto turquesa sobre fondo claro usa `#0e7a75` (5.2:1).

9. **Páginas de estado.** `not-found`, `error`, `global-error` y `dashboard/loading` con la identidad de la
   plataforma (antes se veían las pantallas por defecto de Next.js). El error no muestra el mensaje técnico.
10. **Componentes compartidos.** `Spinner` (reemplaza 10 copias), `Skeleton` y `PublicFooter` en `components/ui`.
11. **Accesibilidad base.** Enlace "Saltar al contenido" y `id="contenido"` en los 93 `<main>`;
    `viewport.themeColor` claro/oscuro; plantilla de título.
12. **Pie en el login** con enlaces verificados (`TODO` para términos, política de datos y redes).
13. **Prettier.** `.prettierrc.json`, `.prettierignore` y scripts `format` / `format:check`.
    No se reformateó el resto del repositorio a propósito: hay ramas sin fusionar (`security/*`, `fix/*`)
    que tocan los mismos archivos y se generarían conflictos. Conviene correr `npm run format` una sola vez
    cuando esas ramas estén fusionadas y entonces añadir `format:check` al CI.

14. **`StatusScreen`.** El bloque de "acceso restringido" estaba copiado en 12 páginas; 10 usan ahora el
    componente compartido (mismos textos y acciones). Quedan `lesson-client` y `tutor/page` con variantes propias.

15. **Pulido verificado con capturas reales.** Se usó un navegador sin interfaz contra la app con datos
    ficticios (servidor Supabase simulado, solo en local). Auditoría de contraste automática en 12 pantallas,
    claro y oscuro: 24 hallazgos -> 0. Cambios: azul de texto AA en claro (`#096ba0`), eyebrow turquesa legible
    sobre el hero azul marino, saludo no duplicado, login con botón secundario en contorno y divisor de líneas,
    botones azul marino -> azul de marca, sombra `sm` más suave, `text-wrap: balance/pretty`.
16. **Móvil.** Sin desborde horizontal en 18 pantallas a 360 y 768 px. Áreas táctiles mínimas de 40 px
    (controles < 36 px a 360 px: de 47 a 1, el input de archivo oculto). Encabezado móvil del panel más limpio.

> Límites de la auditoría automática: no evalúa texto sobre fondos con degradado ni imágenes; las pantallas de
> estudiante y tutor se revisaron con listas vacías (sin datos de ejemplo), así que falta ver su aspecto con
> contenido real.

## Verificación ejecutada

| Comprobación                                         | Resultado                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `npm run lint`                                       | sin errores                                                     |
| `npm run typecheck` (sin caché `.next`)              | sin errores                                                     |
| `npm test`                                           | 30 de 30                                                        |
| `npm run build` (fuente de Google simulada, sin red) | compila                                                         |
| `/conexion` en ejecución                             | 307 hacia `/`                                                   |
| Cabeceras en `/`                                     | las 5 presentes                                                 |
| CSS generado                                         | todas las utilidades de tokens existen                          |
| `/ruta-inexistente`                                  | 404 con la página de marca y las cabeceras de seguridad         |
| Login                                                | contiene enlace de salto, `theme-color`, `id="contenido"` y pie |
| `/dashboard/...` sin sesión                          | 307 a `/` (el proxy sigue igual)                                |
| `npm ci` + lint + pruebas tras agregar Prettier      | sin errores, 30 de 30                                           |

## Lo que NO se verificó (revisar a ojo antes de fusionar)

No hubo navegador, así que no se vio ninguna pantalla. Revisar en **claro y oscuro**, a 360, 768 y 1440 px:
login, dashboard, congregaciones, reubicaciones, perfil, estudiante (formación, actividades,
evaluaciones, biblioteca), tutor (calificaciones, evaluaciones) y administración.
Puntos a mirar: tarjetas internas (`surface-muted` es más claro que `surface` en oscuro),
insignias de estado (amber, red, sky, teal, emerald) y paneles con fondo azul marino.

## Pendiente (no incluido)

- Colores sueltos restantes: 47 (casi todos únicos: `#0B1422`, `#101B2A`, `#0AA9D2`, etc.).
- Partir `dashboard/page.tsx` y `reubicaciones/page.tsx` (más de 1.300 líneas cada uno).
- Más componentes compartidos (PageHeader, tabla, modal, estado vacío); falta el encabezado de página y el estado vacío de tablas.
- `loading.tsx` por sección (solo existe el de `/dashboard`) y no hay `error.tsx` propio en el dashboard.
- Pie de página: solo el del login; faltan términos, política de datos y redes oficiales.
- `bg-decom-teal` con texto blanco quedó corregido en botones; las barras de progreso turquesa no llevan texto.
- HSTS lleva `includeSubDomains`: confirmar que ningún subdominio del dominio final dependa de HTTP.
