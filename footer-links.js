/* ==========================================================================
   Adlek — enlace "Aviso de Privacidad" en el pie de la landing

   El pie vive dentro de la plantilla del bundle (index.html:393) y lo pinta
   React en #dc-root, así que no se puede editar en el HTML. Este script
   agrega el enlace en runtime, al final de la columna WhatsApp / correo /
   Instagram, clonando el <a> de Instagram para heredar su estilo inline
   exacto.

   Es la única excepción a "nunca inyectar dentro de #dc-root" (CLAUDE.md), y
   por eso se cubre por los dos lados:

   - React no borra nodos ajenos al reconciliar: solo inserta, mueve y quita
     los suyos. Un <a> agregado al final de la columna sobrevive a los toggles
     del acordeón (verificado en navegador).
   - Aun así, un MutationObserver sobre #dc-root lo repone si algún render
     futuro (re-export, cambio de key) llegara a recrear la columna.

   Si se re-exporta desde Claude Design con el enlace ya incluido, este script
   detecta el href y no hace nada. En ese momento se puede borrar.
   ========================================================================== */

(function () {
  'use strict';

  var LINK_ID   = 'adlek-privacy-link';
  var HREF      = '/privacidad';
  var TEXTO     = 'Aviso de Privacidad';
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */

  function poner() {
    var root = document.getElementById('dc-root');
    if (!root) return;
    if (document.getElementById(LINK_ID)) return;
    if (root.querySelector('a[href="' + HREF + '"]')) return;   /* ya viene en el export */

    var insta = root.querySelector('a[href*="instagram.com/adlek"]');
    if (!insta || !insta.parentNode) return;

    var a = insta.cloneNode(false);   /* mismo style inline, sin hijos */
    a.id = LINK_ID;
    a.href = HREF;
    a.textContent = TEXTO;
    insta.parentNode.appendChild(a);
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
