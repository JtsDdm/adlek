# Adlek — sitio web

Landing de Adlek. Sitio estático, sin build step y sin dependencias: se despliega
tal cual está.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La landing. **Export de Claude Design y fuente de verdad del diseño.** |
| `page-boot.js` | Arranque: splash con el logo real y sin parpadeos al cargar. |
| `adlek-logo.png` | Logo para el splash. Copia reducida del que ya viaja en el bundle. |
| `chat-widget.js` | Burbuja de chat, aislada en Shadow DOM. Se monta sola en runtime. |
| `chat-widget.css` | Estilos del widget. Se carga *dentro* del Shadow DOM, no desde el `<head>`. |
| `CLAUDE.md` | Reglas de trabajo sobre el export. **Leer antes de tocar `index.html`.** |

## `index.html` no es HTML plano

Es un bundle auto-desempaquetable: 867 KB en 397 líneas, donde casi todo el peso
está en dos líneas de datos (assets en base64 y la plantilla como string JSON).
En runtime reemplaza el documento entero y monta React 18 en `<div id="dc-root">`.

**Nunca correr Prettier, `js-beautify` ni ningún formateador sobre el archivo:**
partir esas líneas rompe el bundle de forma silenciosa. Los detalles y el
procedimiento correcto para agregar scripts están en [`CLAUDE.md`](CLAUDE.md).

La página funciona 100 % offline: React, imágenes y fuentes viajan dentro del
archivo. Las únicas URLs externas son de navegación (WhatsApp, correo, Instagram).

## Los dos scripts añadidos

El export se toca **solo** con estas dos líneas antes de `</body>`:

```html
<script defer src="page-boot.js"></script>
<script defer src="chat-widget.js"></script>
```

### `page-boot.js` — arranque limpio

Cargar la página pasaba por tres estados feos antes de mostrar la landing.
Medido sobre grabación de pantalla a 60 fps y con instrumentación en local:

| Fase | Duración | Qué se veía |
|---|---|---|
| Splash placeholder | 133-167 ms | un boceto SVG: riel, círculos, caja "ADLEK", píldora "Unpacking…" |
| Plantilla cruda | 8.6 ms | los 5 FAQ abiertos, `image-slot` sin estilo, `{{ placeholders }}` |
| Hueco | 103.8 ms | pantalla vacía hasta que React pinta |

Las tres las cubre `page-boot.js`, y las tres se resuelven **sin tocar el
export**:

1. **Splash.** El placeholder del bundle no es la marca, así que se sustituye
   por el logo real sobre el mismo verde `#1A6265`.
2. **Plantilla cruda.** Se oculta el `<x-dc>` en el mismo instante del swap. El
   callback de `MutationObserver` es una microtask, y las microtasks drenan
   antes del pintado: le gana la carrera al render. La ventana expuesta baja de
   8.6 ms a 0.4 ms, sin pintado posible en medio.
3. **Hueco.** Se sostienen el mismo verde y el mismo logo hasta que React monta.

Como el verde es también el del hero, las tres fases quedan como una sola
imagen continua. El puente se retira solo al montar React, y también por
timeout si el bundle fallara, para no dejar nunca una pantalla vacía.

Sobre `adlek-logo.png`: el logo ya viaja dentro del bundle, pero ahí no sirve
—no está disponible hasta que el bundle se desempaqueta, que es justo lo que
estamos esperando. Por eso hay una copia aparte, reducida a 520 px y en
grises+alfa (16 KB en vez de 31 KB). El export conserva la suya intacta.

### `chat-widget.js` — la burbuja de chat

El script no monta nada al ejecutarse: espera a que el bundle termine de
desempaquetarse y monta en `document.body` como hermano de `#dc-root`, dentro de
un Shadow DOM. Así sobrevive a los re-renders de React y no hereda ni contamina
el CSS de la página.

### Estado del backend

El widget llama a `POST /api/chat`, **que todavía no existe**. Mientras tanto la
respuesta está simulada con `setTimeout`, detrás de un flag en `chat-widget.js`:

```js
var USE_MOCK = true;   // poner en false cuando el endpoint exista
```

El camino real (`fetch` + manejo de errores + reintento) ya está escrito. Cuando
el endpoint esté listo, basta cambiar el flag. Contrato esperado:

- **Request:** `{ "message": string, "history": [{ "role": "user"|"bot", "text": string }] }`
- **Response:** `{ "reply": string }`

En Vercel, el endpoint iría en `api/chat.js` y quedaría servido en esa misma ruta.

## Despliegue

Vercel, sin configuración: framework preset **Other**, sin build command y con el
root del repo como output. `index.html` se sirve en `/`.
