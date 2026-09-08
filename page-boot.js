/* ==========================================================================
   Adlek — puente de arranque del bundle

   PROBLEMA

   index.html es un bundle auto-desempaquetable. Al desempaquetarse hace
   `document.documentElement.replaceWith(...)`, y el documento nuevo trae el
   <x-dc> con la plantilla CRUDA: los 5 FAQ abiertos a la vez, los
   <image-slot> sin estilo y los {{ placeholders }} como texto plano.

   El dc-runtime la oculta con `x-dc{display:none}` (hideRawTemplate), pero
   solo cuando su script alcanza a ejecutarse, unos milisegundos despues del
   swap. En ese hueco el navegador puede pintar la pagina entera sin procesar:
   el pantallazo de "elementos amontonados" al recargar.

   Medido en local, en maquina rapida:

     swap del documento .................  42.6 ms   <x-dc> crudo, 7836 px de alto
     hideRawTemplate del runtime ........  51.2 ms   -> 8.6 ms de crudo expuesto
     React monta y pinta ................ 155.0 ms   -> 103.8 ms mas de pantalla vacia

   Ocultar el crudo a secas solo cambiaria el amontonado por ~112 ms de
   blanco. Hay que cerrar las dos ventanas.

   SOLUCION

   - Oculta <x-dc> en el mismo instante del swap. El callback de
     MutationObserver es una microtask, y las microtasks drenan antes del
     siguiente pintado: le ganamos la carrera al render.
   - Pinta mientras tanto el verde del splash (#1A6265, que es tambien el del
     hero), para que la secuencia sea continua en vez de un parpadeo blanco.

   Se retira solo en cuanto React monta, asi que no deja rastro en la pagina
   ya cargada. Si el bundle fallara y React nunca montara, tambien se retira
   por timeout: preferimos la pagina cruda a una pantalla verde vacia.

   No toca el export: vive fuera y solo inyecta una regla temporal.
   ========================================================================== */

(function () {
  'use strict';

  var STYLE_ID   = 'adlek-boot-bridge';
  var SPLASH_BG  = '#1A6265';   /* mismo verde del splash del shell y del hero */
  var MAX_ESPERA = 10000;       /* red de seguridad si React nunca monta */

  var htmlInicial = document.documentElement;
  var estilo    = null;
  var timer     = null;
  var terminado = false;

  function poner() {
    if (estilo || !document.head) return;
    estilo = document.createElement('style');
    estilo.id = STYLE_ID;
    estilo.textContent =
      'x-dc{display:none!important}' +
      'html{background:' + SPLASH_BG + '}';
    document.head.appendChild(estilo);
  }

  /* Retira el puente y deja de observar, en un solo paso.

     Las dos cosas van juntas a proposito: quitar el <style> es en si mismo una
     mutacion del DOM, asi que si siguieramos observando, el propio callback
     volveria a ver `estilo === null` y lo reinstalaria en bucle. */
  function finalizar() {
    if (terminado) return;
    terminado = true;
    if (timer) { clearTimeout(timer); timer = null; }
    if (estilo && estilo.parentNode) estilo.parentNode.removeChild(estilo);
    estilo = null;
    obs.disconnect();
  }

  var obs = new MutationObserver(function () {
    if (terminado) return;

    if (!estilo) {
      /* Nada que hacer hasta que el bundle reemplace el documento entero. */
      if (document.documentElement === htmlInicial) return;
      poner();
      timer = setTimeout(finalizar, MAX_ESPERA);
    }

    var root = document.getElementById('dc-root');
    if (root && root.children.length) finalizar();
  });

  obs.observe(document, { childList: true, subtree: true });
})();
