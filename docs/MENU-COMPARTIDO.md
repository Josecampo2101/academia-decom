# Menú lateral y barra superior compartidos

Todas las páginas de `/dashboard` comparten ahora el mismo menú lateral y la misma barra superior
(`app/dashboard/layout.tsx` + `components/dashboard/DashboardShell.tsx`).

## Qué hace el menú compartido

- Solo **muestra**: nombre, foto, rol, navegación, tema y botón de salir. No redirige ni valida accesos.
  Cada página conserva su verificación de sesión, de rol y de perfil (la lógica de autenticación no cambió).
- Persiste al navegar (no se recarga) y conserva su posición de desplazamiento.
- Escritorio: colapsable a iconos (el estado se recuerda). Móvil: cajón con botón de menú, se cierra con Escape
  o al elegir una opción.
- Marca la opción activa (`aria-current="page"`) y muestra el título de la página en la barra superior.
- Tema claro, oscuro y automático para todas las pantallas del panel.
- Barra de desplazamiento fina y siempre visible cuando el menú no cabe en pantalla.

## Reglas de navegación

`lib/dashboard/navigation.mjs` contiene las reglas (qué módulos se habilitan y a dónde llevan según los roles).
Se probaron contra una copia exacta de la lógica anterior en las 128 combinaciones posibles de roles.

## Errores y rutas inexistentes dentro del panel

- `app/dashboard/error.tsx`: si una página falla, el error se muestra en el contenido y el menú sigue disponible.
- `app/dashboard/not-found.tsx` + `app/dashboard/[...slug]/page.tsx`: una ruta inexistente bajo `/dashboard`
  muestra el 404 con el menú. Nota: esas respuestas llevan código HTTP 200 (el panel exige sesión y no se indexa).

## Cambios en las páginas

- Se quitó el logo y el rótulo "ACADEMIA DECOM" de las barras propias de cada página (ya los da el menú).
  Se conservaron los subtítulos y todos los botones (volver, actualizar, etc.).
- Cuatro enlaces internos hechos con `<a>` pasaron a `<Link>` para no recargar la página.
- El panel principal perdió su menú propio; conserva su contenido y su verificación de perfil.

## Verificado

Navegador (datos simulados): persistencia del menú, scroll, colapso, tema, cajón móvil, 26 rutas sin desborde
horizontal (360 y 768 px) y 0 hallazgos de contraste en claro y oscuro. Pendiente de revisión humana: el aspecto
con datos reales de cada módulo.
