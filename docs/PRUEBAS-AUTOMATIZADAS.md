# Batería de pruebas automatizadas y hallazgos

Pruebas ejecutadas con un navegador real sin interfaz (Chromium) contra la aplicación compilada, con datos
**simulados** (un servidor Supabase falso en local; no se usó ninguna base real).

## Pruebas y resultado actual

| Prueba | Alcance | Resultado |
|---|---|---|
| Pruebas unitarias (`npm test`) | 64 pruebas: invitaciones, insignias, seguimiento, biblioteca, navegación | 64 de 64 |
| Accesibilidad con axe-core 4.14.1 | WCAG 2.0 y 2.1 niveles A y AA más buenas prácticas; 25 rutas del panel y 5 públicas, en claro y oscuro | 0 violaciones tras las correcciones |
| Teclado | orden de foco, anillo visible, «Saltar al contenido», cajón móvil (foco dentro, retorno con Escape) | 7 de 7 |
| Humo | 29 rutas: respuesta HTTP, errores de consola, menú presente, enlaces internos | 29 con 200, todas con menú, 0 errores de consola, 0 enlaces rotos |
| Responsive | 26 rutas a 360 y 768 px | sin desborde horizontal; controles táctiles de 40 px |
| Interacción | persistencia del menú, scroll, colapso, tema, cajón móvil, filtros y apertura de recursos | todas correctas |

## Hallazgos corregidos en esta tanda

1. **Críticos**: 3 listas desplegables sin nombre accesible (asignación de tutores y actividades).
2. **Graves**:
   - Botones «Salir» y «Cerrar sesión» con contraste insuficiente (4,36:1 en claro y hasta 3,0:1 en oscuro).
   - Su nombre accesible no contenía el texto visible.
   - Las tarjetas de insignias tenían un nombre accesible que no coincidía con su texto.
3. **Moderados**: el panel principal no tenía título principal (h1) y sus títulos saltaban de nivel.
4. **Teclado**: con el cajón móvil abierto, el foco podía llegar al contenido de atrás. Ahora el contenido queda
   inerte, el foco entra al menú y vuelve al botón al cerrar con Escape.

## Corrección a una conclusión anterior

La auditoría de contraste propia que se usó antes no leía los colores que el navegador reporta en formato `oklch`
(paleta nueva de Tailwind), por lo que informó «0 hallazgos» sin ver los botones rojos. axe-core sí los evalúa.
Lo que se afirmaba sobre contraste en fases anteriores debe leerse con esa salvedad; ahora está cubierto por axe.

## Falsas alarmas descartadas (para no repetirlas)

- Dos pantallas de estudiante se caen con el simulador porque este omite campos que la base real garantiza
  (`lessons.objectives` es `not null default '{}'` y el vínculo de actividades es una clave foránea).
- El «foco fuera de pantalla» era el desplazamiento suave (`scroll-behavior: smooth`) aún en curso al medir.
- Ancho de la barra de desplazamiento en 0: el navegador de pruebas oculta las barras por defecto.

## Lo que estas pruebas NO cubren

- Lectores de pantalla reales (NVDA, VoiceOver, TalkBack): las herramientas automáticas detectan solo una parte de
  los problemas de accesibilidad. Hace falta una revisión manual.
- Otros navegadores (solo se probó Chromium) y dispositivos físicos.
- Permisos reales por rol y distrito (RLS), flujos con datos reales y rendimiento (Lighthouse).
- Pantallas con datos reales de producción.
