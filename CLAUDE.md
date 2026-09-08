# CLAUDE.md — Sitio web Adlek

`index.html` es un export de Claude Design y es la **FUENTE DE VERDAD** del diseño.
El diseño y el responsive ya están terminados y aprobados. No hay nada que rediseñar.

## PROHIBIDO

- Reescribir, reformatear o "limpiar" el HTML o el CSS existente
- Convertir a React, Next.js, Vue, Tailwind o cualquier framework
- Tocar media queries, `clamp()`, grid, flex o cualquier CSS ya escrito
- Renombrar clases o reordenar elementos
- Extraer el CSS o el base64 de las imágenes a archivos aparte

## PERMITIDO

- Crear archivos NUEVOS
- Agregar una línea de `<script>` o `<link>` antes de `</body>`
- Agregar atributos (`id`, `data-*`) a elementos existentes, sin quitar nada

**Si crees que algo del diseño debe cambiar, PREGUNTA primero.**

---

## Por qué estas reglas: `index.html` no es HTML plano

Es un **bundle auto-desempaquetable**. 867 KB en 395 líneas, con esta estructura:

| Zona | Líneas | Qué es |
|---|---|---|
| Shell + splash | 1–35 | CSS del loader, SVG placeholder "ADLEK", `#__bundler_loading` |
| Desempaquetador | 36–377 | JS que decodifica assets y **reemplaza el documento entero** |
| `__bundler/manifest` | 381 | **789 KB** — 26 assets en base64 (imágenes, fuentes woff2, React UMD) |
| `__bundler/ext_resources` | 385 | mapeo de React/ReactDOM 18.3.1 a UUIDs locales |
| `__bundler/template` | 393 | **55 KB** — la página real, como *string JSON escapado* |

Consecuencias operativas:

- **Las líneas 381 y 393 son datos, no código legible.** No editarlas a mano jamás.
- **Nunca correr Prettier, `js-beautify`, `tidy` ni ningún formateador** sobre el archivo. Partir
  esas líneas rompe el bundle de forma silenciosa y no obvia.
- En runtime, el desempaquetador hace `document.documentElement.replaceWith(...)`
  (`index.html:319`) y el `dc-runtime` sustituye `<x-dc>` por `<div id="dc-root">`, donde monta un
  árbol **React 18** (`ReactDOM.createRoot`). **El DOM que ves en el inspector lo genera React**,
  no está escrito literalmente en el archivo.
- Los `<img src>` renderizados son **blob URLs** (`URL.createObjectURL`), regeneradas en cada carga.
  No son estables: nada externo debe depender de ellas. Las fuentes sí quedan como
  `data:font/woff2;base64,...`.
- La página funciona **100 % offline**, React incluido. Las únicas URLs externas son de navegación
  (`wa.me`, `mailto:`, Instagram), no de recursos.

### Referencia rápida del diseño (no modificar)

- **Breakpoints:** `max-width: 900px`, `620px`, `420px` y `prefers-reduced-motion: reduce`. Todas
  con `!important`. El resto del responsive es fluido: `clamp()` inline + `svh`/`vw`.
- **Interactivos:** 7 `<a>` (WhatsApp, `mailto:`, Instagram, anclas `#top` / `#sistema`), un
  acordeón de 5 FAQs gobernado por estado React, y 7 `<image-slot>`. **No hay ningún formulario.**
- **Capas fijas:** nav superior `z-index: 50`; contenedor sticky vacío abajo-derecha `z-index: 60`
  (`pointer-events: none`).

---

## Cómo montar un script añadido (leer antes de tocar nada)

La regla "agregar una línea de `<script>` antes de `</body>`" **es correcta como punto de carga,
pero tiene una trampa**: ese `</body>` pertenece al *shell*, y el shell se destruye entero cuando
el bundle se desempaqueta. El script sí se ejecuta (en parse time), pero:

- cualquier nodo que haya insertado en el DOM **desaparece**;
- cualquier `<style>` o `<link>` agregado al `<head>` del shell **desaparece**.

Lo único que sobrevive al swap es el estado en `window` — el propio bundle lo documenta en
`index.html:52`: *"Error sink persists across replaceWith since it's on window, not the DOM"*.

### Patrón correcto

Cargar el script desde el shell, no tocar nada en ese momento, y **esperar a que exista
`#dc-root`** antes de montar en `document.body` como **hermano** de `#dc-root`:

```js
// chat-widget.js — cargado desde el shell; corre antes del swap del documento.
(function () {
  function mount() {
    if (document.getElementById('adlek-chat-root')) return;   // idempotente
    var host = document.createElement('div');
    host.id = 'adlek-chat-root';
    host.attachShadow({ mode: 'open' });                      // aislado del design system
    document.body.appendChild(host);                          // hermano de #dc-root
    /* … UI dentro de host.shadowRoot … */
  }
  var t = setInterval(function () {                           // espera al swap + mount de React
    if (document.getElementById('dc-root')) { clearInterval(t); mount(); }
  }, 50);
  setTimeout(function () { clearInterval(t); if (document.body) mount(); }, 15000); // fallback
})();
```

Reglas que se derivan de esto:

- **Nunca inyectar dentro de `#dc-root`** (ni en el contenedor sticky vacío del final): es árbol
  React, y cualquier toggle del acordeón lo reconcilia y borraría el nodo insertado.
- **Usar Shadow DOM.** El `dc-runtime` inyecta el CSS completo del design system en `<head>`, con
  reglas globales sobre `*`, `body`, `a` y `h1..h6`.
- **Widget flotante:** `position: fixed`, esquina inferior derecha, `z-index: 70` (por encima del
  sticky 60 y del nav 50), con `env(safe-area-inset-*)` y el panel abriéndose hacia arriba.
- **Atributos en elementos existentes:** agregar `id` / `data-*` a elementos *renderizados* solo se
  puede desde JS en runtime (`el.setAttribute(...)`). El HTML fuente vive dentro del string JSON de
  la línea 393; editarlo a mano está descartado.
- Si algún día un script debe viajar *dentro* del export, pedírselo a Claude Design y **re-exportar**.
