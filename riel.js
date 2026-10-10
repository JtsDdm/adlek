/* ==========================================================================
   Adlek — sincroniza el riel de "Todo conectado" con sus tarjetas

   PROBLEMA

   En el export, el punto que baja por el riel y el encendido de cada tarjeta
   son animaciones CSS independientes que solo comparten duración (9.2 s):

   - El punto recorre el riel con `ease-in-out`: lento al inicio y al final,
     rápido en medio.
   - Cada tarjeta se enciende en un porcentaje fijo del tiempo (10 %, 30 %,
     50 %, 70 %, 90 %), con una rampa de entrada de ~0.65 s.

   Nada las ata a la geometría real, así que el punto llega a un checkpoint y
   la tarjeta se ilumina tarde (o antes), y el desfase cambia con el alto de
   cada tarjeta y con el ancho de pantalla.

   SOLUCIÓN

   El punto se queda con su animación original. Lo que cambia es quién decide
   cuándo se enciende cada tarjeta: en cada frame se lee la posición real del
   punto y se ilumina la tarjeta (y su checkpoint) sobre la que está pasando.
   Las animaciones CSS de tarjetas y checkpoints se apagan desde aquí, con
   estilos inline en runtime; el export no se toca.

   Con `prefers-reduced-motion` el export detiene el riel, y este script no
   hace nada.
   ========================================================================== */

(function () {
  'use strict';

  var GRID_ID    = 'adlek-rail-grid';
  var LINE_ID    = 'adlek-rail-line';
  var COLOR_BASE = '#134A4D';   /* los mismos dos tonos de adlekCard1..5 */
  var COLOR_ON   = '#1F7A72';
  var MAX_ESPERA = 15000;       /* red de seguridad si #dc-root nunca aparece */

  var pasos = [];      /* [{ card, punto, top, bottom }] */
  var grid = null, line = null, dot = null;
  var activo = -1;
  var visible = false;
  var raf = 0;

  function reducido() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function pintar(paso, on) {
    paso.card.style.backgroundColor = on ? COLOR_ON : COLOR_BASE;
    paso.punto.style.opacity = on ? '1' : '.25';
    paso.punto.style.transform = on ? 'scale(1.5)' : 'scale(1)';
  }

  /* Cada tarjeta responde por su propia franja mas la mitad del hueco que la
     separa de sus vecinas, para que siempre haya exactamente una encendida. */
  function medir() {
    for (var i = 0; i < pasos.length; i++) {
      pasos[i].top = pasos[i].card.offsetTop;
      pasos[i].bottom = pasos[i].top + pasos[i].card.offsetHeight;
    }
    for (var j = 0; j < pasos.length - 1; j++) {
      var medio = (pasos[j].bottom + pasos[j + 1].top) / 2;
      pasos[j].bottom = medio;
      pasos[j + 1].top = medio;
    }
    if (pasos.length) {
      pasos[0].top = -Infinity;
      pasos[pasos.length - 1].bottom = Infinity;
    }
  }

  function frame() {
    raf = 0;
    if (!visible) return;

    /* offsetTop incluye el `top` animado; todo es relativo al grid, asi que
       no depende del scroll. */
    var y = line.offsetTop + dot.offsetTop + dot.offsetHeight / 2;
    var nuevo = -1;
    for (var i = 0; i < pasos.length; i++) {
      if (y >= pasos[i].top && y < pasos[i].bottom) { nuevo = i; break; }
    }
    if (nuevo !== activo) {
      if (activo >= 0) pintar(pasos[activo], false);
      if (nuevo >= 0) pintar(pasos[nuevo], true);
      activo = nuevo;
    }
    raf = requestAnimationFrame(frame);
  }

  function arrancar() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  function montar() {
    if (!document.getElementById('dc-root')) return false;
    grid = document.getElementById(GRID_ID);
    line = document.getElementById(LINE_ID);
    if (!grid || !line) return false;
    if (reducido()) return true;

    dot = line.lastElementChild;   /* el punto principal, el de 16 px */
    if (!dot) return true;

    /* Tras el riel, el grid alterna: checkpoint, tarjeta, checkpoint, ... */
    var hijos = [];
    for (var i = 0; i < grid.children.length; i++) {
      if (grid.children[i] !== line) hijos.push(grid.children[i]);
    }
    for (var k = 0; k + 1 < hijos.length; k += 2) {
      var punto = hijos[k].firstElementChild;
      var card = hijos[k + 1];
      if (!punto || !card) continue;

      card.style.animation = 'none';
      card.style.transition = 'background-color .12s ease-out';
      punto.style.animation = 'none';
      punto.style.transition = 'opacity .12s ease-out, transform .12s ease-out';

      var paso = { card: card, punto: punto, top: 0, bottom: 0 };
      pintar(paso, false);
      pasos.push(paso);
    }
    if (!pasos.length) return true;

    medir();
    window.addEventListener('resize', medir);
    if (window.ResizeObserver) new ResizeObserver(medir).observe(grid);

    /* Solo se trabaja mientras la seccion esta en pantalla. */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entradas) {
        visible = entradas[entradas.length - 1].isIntersecting;
        arrancar();
      }).observe(grid);
    } else {
      visible = true;
      arrancar();
    }
    return true;
  }

  /* El script corre sobre el shell, antes del swap del documento: hay que
     esperar a que React pinte el riel. */
  var t = setInterval(function () {
    if (montar()) clearInterval(t);
  }, 50);
  setTimeout(function () { clearInterval(t); }, MAX_ESPERA);
})();
