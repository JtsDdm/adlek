# Adlek — sitio web

Landing de Adlek. Sitio estático, sin build step y sin dependencias: se despliega
tal cual está.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La landing. **Export de Claude Design y fuente de verdad del diseño.** |
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

## La burbuja de chat

Se carga con una sola línea antes de `</body>`:

```html
<script defer src="chat-widget.js"></script>
```

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
