# Adlek — sitio web

Landing de Adlek. Sitio estático, sin build step y sin dependencias: se despliega
tal cual está.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La landing. **Export de Claude Design y fuente de verdad del diseño.** |
| `page-boot.js` | Puente de arranque: evita el parpadeo de contenido crudo al cargar. |
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

### `page-boot.js` — puente de arranque

Al desempaquetarse, el bundle reemplaza el documento y deja por un instante la
plantilla **cruda** a la vista: los 5 FAQ abiertos a la vez, los `image-slot`
sin estilo y los `{{ placeholders }}` como texto. El `dc-runtime` la oculta,
pero unos milisegundos tarde, y el navegador alcanza a pintarla: es el
pantallazo de "elementos amontonados" al recargar.

Medido en local, antes del arreglo:

| Momento | t | Qué se ve |
|---|---|---|
| swap del documento | 42.6 ms | plantilla cruda, 7836 px de alto |
| el runtime la oculta | 51.2 ms | **8.6 ms de contenido amontonado** |
| React monta y pinta | 155.0 ms | **103.8 ms más de pantalla vacía** |

`page-boot.js` cierra las dos ventanas: oculta la plantilla cruda en el mismo
instante del swap (el callback de `MutationObserver` es una microtask, así que
corre antes del pintado) y sostiene el verde del splash durante el hueco. Se
retira solo en cuanto React monta, y también por timeout si el bundle fallara,
para no dejar nunca una pantalla vacía. Tras el arreglo la ventana de crudo
expuesto baja de 8.6 ms a 0.4 ms, sin pintado posible en medio.

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
