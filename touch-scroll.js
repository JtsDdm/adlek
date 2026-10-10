/* ==========================================================================
   Adlek — scroll táctil sobre las imágenes

   PROBLEMA

   Las imágenes de la landing son <image-slot>, un componente del export que
   en Claude Design permite reencuadrar la foto arrastrándola. Para eso su
   Shadow DOM trae `.frame img{touch-action:none}`, y esa regla viaja también
   al sitio publicado, donde ya no hay nada que arrastrar. En celular, poner
   el dedo sobre una imagen no desplaza la página: se queda quieta.

   SOLUCIÓN

   El <img> interno está expuesto como `part="image"`, así que se puede
   alcanzar desde fuera con `::part(image)` sin tocar el export. Una regla del
   documento le gana a una regla normal del shadow root, y devuelve el gesto
   al navegador.

   El <style> se agrega al <head> del documento ya desempaquetado: el del
   shell se destruye en el swap (ver CLAUDE.md), por eso se espera a #dc-root.
   ========================================================================== */

(function () {
  'use strict';

  var STYLE_ID   = 'adlek-touch-scroll';
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */

  function poner() {
    if (!document.head || document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = 'image-slot::part(image){touch-action:auto}';
    document.head.appendChild(s);
  }

  var t = setInterval(function () {
    if (document.getElementById('dc-root')) { clearInterval(t); poner(); }
  }, 50);
  setTimeout(function () { clearInterval(t); poner(); }, MAX_ESPERA);
})();
