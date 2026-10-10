/* ==========================================================================
   Adlek — tarjeta "SWISS DENTAL" en "Trabajos entregados"

   Las tarjetas de la sección viven dentro de la plantilla del bundle
   (index.html:393) y las pinta React en #dc-root, así que no se pueden editar
   en el HTML. Este script agrega la tarjeta en runtime, justo después de la
   de la Dra. Gloria, clonando sus nodos para heredar el estilo inline exacto.

   Es una excepción a "nunca inyectar dentro de #dc-root" (CLAUDE.md), igual
   que footer-links.js y con las mismas dos coberturas:

   - React no borra nodos ajenos al reconciliar, y esta sección es estática.
   - Un MutationObserver sobre #dc-root repone la tarjeta si algún render
     futuro llegara a recrear la rejilla.

   La portada es un <img> normal, no un <image-slot>: la foto vive fuera del
   bundle (imagenes/swiss-dental.webp) y no necesita el reencuadre del export.

   Si se re-exporta desde Claude Design con la tarjeta ya incluida, el script
   detecta el título y no hace nada. En ese momento se puede borrar.
   ========================================================================== */

(function () {
  'use strict';

  var CARD_ID    = 'adlek-caso-swiss';
  var ANCLA      = 'adlek-caso-3';   /* image-slot de la tarjeta de la Dra. Gloria */
  var TITULO     = 'SWISS DENTAL';
  var TEXTO      = 'Campaña completa: grabamos en su clínica con cámara profesional, ' +
                   'editamos el video, configuramos la campaña, creamos su landing e ' +
                   'implementamos un bot de IA que agenda citas automáticamente. ' +
                   'Sigue en curso y ya retornó 2.2 veces su inversión.';
  var FOTO       = 'imagenes/swiss-dental.webp';
  var FOTO_ALT   = 'Especialista de Swiss Dental trabajando con microscopio dental';
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */

  function yaViene(grid) {
    var hs = grid.querySelectorAll('h3');
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].textContent.trim().toUpperCase() === TITULO) return true;
    }
    return false;
  }

  function poner() {
    if (document.getElementById(CARD_ID)) return;

    var slot = document.getElementById(ANCLA);
    var marco = slot && slot.parentNode;
    var base = marco && marco.parentNode;
    var grid = base && base.parentNode;
    if (!grid) return;
    if (yaViene(grid)) return;   /* ya viene en el export */

    var h3 = base.querySelector('h3');
    var p = base.querySelector('p');
    if (!h3 || !p) return;

    /* Clones superficiales: mismo style inline, sin hijos. */
    var card = base.cloneNode(false);
    card.id = CARD_ID;

    var marcoNuevo = marco.cloneNode(false);
    var img = document.createElement('img');
    img.src = FOTO;
    img.alt = FOTO_ALT;
    img.width = 1200;
    img.height = 750;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover';
    marcoNuevo.appendChild(img);

    var h3Nuevo = h3.cloneNode(false);
    h3Nuevo.textContent = TITULO;

    var pNuevo = p.cloneNode(false);
    pNuevo.textContent = TEXTO;

    card.appendChild(marcoNuevo);
    card.appendChild(h3Nuevo);
    card.appendChild(pNuevo);

    grid.insertBefore(card, base.nextSibling);
  }

  function montar() {
    var root = document.getElementById('dc-root');
    if (!root) return false;
    poner();
    new MutationObserver(poner).observe(root, { childList: true, subtree: true });
    return true;
  }

  /* El script corre sobre el shell, antes del swap del documento: hay que
     esperar a que exista #dc-root. */
  var t = setInterval(function () {
    if (montar()) clearInterval(t);
  }, 50);
  setTimeout(function () { clearInterval(t); }, MAX_ESPERA);
})();
