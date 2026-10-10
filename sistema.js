/* ==========================================================================
   Adlek — orden de los pasos en "Todo conectado"

   El export trae "Sitio web" como paso 01 y "Contenido" como 02. Aquí se
   invierten: "Contenido" pasa a ser el 01, con un texto que resalta que se
   graba con equipo profesional, y "Sitio web" queda como 02.

   Los pasos viven dentro de la plantilla del bundle (index.html:393) y los
   pinta React en #dc-root, así que no se pueden editar en el HTML. En vez de
   mover nodos de React, este script solo intercambia el TEXTO de las dos
   tarjetas: los números, el riel y las animaciones se quedan donde están y
   siguen en secuencia.

   Es una excepción a "nunca inyectar dentro de #dc-root" (CLAUDE.md), con el
   mismo patrón que footer-links.js: un MutationObserver vuelve a aplicar el
   cambio si algún render futuro repusiera el texto original.

   Si se re-exporta desde Claude Design con "Contenido" ya en primer lugar, el
   script lo detecta y no hace nada. En ese momento se puede borrar.
   ========================================================================== */

(function () {
  'use strict';

  var GRID_ID    = 'adlek-rail-grid';
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */

  function titulo(h3) {
    return h3.textContent.trim().toLowerCase();
  }

  function poner() {
    var grid = document.getElementById(GRID_ID);
    if (!grid) return;

    var hs = grid.querySelectorAll('h3');
    if (hs.length < 2) return;
    /* Solo actúa sobre el orden original del export. */
    if (titulo(hs[0]) !== 'sitio web' || titulo(hs[1]) !== 'contenido') return;

    var p0 = hs[0].parentNode.querySelector('p');
    var p1 = hs[1].parentNode.querySelector('p');
    if (!p0 || !p1) return;

    var textoSitio = p0.textContent;

    hs[0].textContent = 'Contenido';
    p0.textContent = 'Grabamos foto y video en su consultorio con ';
    var fuerte = document.createElement('strong');
    fuerte.style.cssText = 'font-weight:700;color:#FFFFFF';
    fuerte.textContent = 'equipo profesional';
    p0.appendChild(fuerte);
    p0.appendChild(document.createTextNode('. Publicación cada semana.'));

    hs[1].textContent = 'Sitio web';
    p1.textContent = textoSitio;
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
