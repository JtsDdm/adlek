/* ==========================================================================
   Adlek — video (VSL) de la sección "El problema"

   El export trae en esa sección un recuadro 16:9 oscuro con un botón de play
   naranja: un placeholder sin video. Este script lo llena: pone encima una
   portada con el mismo botón y, al tocarlo, reproduce el video con sonido.

   NO SE DESCARGA NADA HASTA EL PLAY

   El video pesa decenas de MB. Antes del toque solo se carga la portada
   (imagenes/vsl-poster.webp, ~66 KB), así la página abre igual de rápido.
   El <video> se crea en el momento del clic, que además es lo que permite
   arrancar con audio: los navegadores bloquean el autoplay con sonido.

   DOS CALIDADES

   - imagenes/vsl-1080.mp4  1920x1080, ~2.4 Mbps  -> por defecto
   - imagenes/vsl-720.mp4   1280x720,  ~1.0 Mbps  -> conexión lenta o ahorro
                                                     de datos

   Se elige con navigator.connection cuando existe (Chrome/Android). Safari no
   lo expone, así que hay una segunda red: si el 1080 se atora dos veces, se
   cambia al 720 en el mismo segundo y sigue.

   Los dos son H.264 + AAC con `faststart`: empiezan a reproducirse sin
   bajarse completos y se puede adelantar. Salen del máster de Media Encoder
   (imagenes/finalvid.mp4, que no se sube); el comando está en CLAUDE.md.

   DEBAJO DEL VIDEO: CTA A WHATSAPP

   Un botón "Hablemos por WhatsApp" con el estilo del CTA del hero (píldora
   naranja con sombra dura y la flecha a mano). Toma el enlace del CTA del
   nav (#adlek-nav-cta), así el número vive en un solo lugar: el export.

   El reproductor vive en un Shadow DOM dentro del recuadro del export (árbol
   React): es una excepción a "nunca inyectar dentro de #dc-root" (CLAUDE.md),
   con el mismo patrón que footer-links.js. Si el script fallara, queda el
   placeholder original.
   ========================================================================== */

(function () {
  'use strict';

  var HOST_ID    = 'adlek-vsl';
  var SECCION    = 'section[data-screen-label="El problema"]';
  var SRC_ALTA   = 'imagenes/vsl-1080.mp4';
  var SRC_BAJA   = 'imagenes/vsl-720.mp4';
  var POSTER     = 'imagenes/vsl-poster.webp';
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */
  var ATORONES   = 2;       /* pausas por búfer antes de bajar de calidad */
  var CTA_ID     = 'adlek-vsl-cta';
  var CTA_TEXTO  = 'Hablemos por WhatsApp';
  var WA_RESPALDO = 'https://wa.me/522461957348';   /* si el nav no estuviera */

  var CSS =
    ':host{position:absolute;inset:0;display:block;border-radius:inherit;overflow:hidden;' +
      'background:#1C1C1C}' +
    '*{box-sizing:border-box}' +
    '.poster,video{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '.poster{object-fit:cover}' +
    'video{object-fit:contain;background:#000}' +
    '.play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'width:100%;height:100%;margin:0;padding:0;border:0;cursor:pointer;' +
      'background:linear-gradient(to top,rgba(16,57,59,.45),rgba(16,57,59,.10));' +
      '-webkit-tap-highlight-color:transparent}' +
    '.disco{display:flex;align-items:center;justify-content:center;' +
      'width:clamp(64px,11vw,84px);height:clamp(64px,11vw,84px);border-radius:999px;' +
      'background:#E8683C;box-shadow:4px 4px 0 #10393B;' +
      'transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}' +
    '.disco svg{width:36%;height:36%;margin-left:6%}' +
    '.play:hover .disco{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #10393B}' +
    '.play:active .disco{transform:translate(2px,2px);box-shadow:2px 2px 0 #10393B}' +
    '.play:focus-visible{outline:none}' +
    '.play:focus-visible .disco{outline:3px solid #F4F2ED;outline-offset:4px}' +
    '@media (prefers-reduced-motion:reduce){.disco{transition:none}}';

  var CSS_CTA =
    ':host{display:flex;justify-content:center;margin:clamp(28px,4vw,40px) 0 0}' +
    'a{display:inline-flex;align-items:center;justify-content:center;gap:12px;' +
      'background:#E8683C;color:#1C1C1C;text-decoration:none;' +
      'font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:1.08rem;line-height:1;' +
      'padding:20px 34px;border-radius:999px;box-shadow:5px 5px 0 #10393B;' +
      '-webkit-tap-highlight-color:transparent;' +
      'transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}' +
    'a:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 #10393B}' +
    'a:active{transform:translate(2px,2px);box-shadow:3px 3px 0 #10393B}' +
    'a:focus-visible{outline:3px solid #1A6265;outline-offset:4px}' +
    'svg{width:30px;height:16px;flex:none}' +
    '@media (max-width:620px){a{width:min(100%,420px);font-size:1.14rem;padding:24px 30px}}' +
    '@media (prefers-reduced-motion:reduce){a{transition:none}}';

  /* La misma flecha del CTA del hero y del nav */
  var FLECHA =
    '<svg viewBox="0 0 34 18" fill="none" aria-hidden="true">' +
      '<path d="M1 15 C 9 15 14 5 27 4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M21 1.5 L28.5 4 L23.5 9.5" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var caja = null, host = null, root = null, video = null;
  var cta = null, ctaLink = null;
  var enBaja = false;
  var atorones = 0;

  /* Conexión lenta o ahorro de datos: directo al 720. */
  function empezarEnBaja() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return false;
    if (c.saveData) return true;
    if (/(^|-)(2g|3g)$/.test(c.effectiveType || '')) return true;
    return typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < 4;
  }

  /* Cambia al 720 conservando el segundo en el que iba. */
  function bajarCalidad() {
    if (enBaja || !video) return;
    enBaja = true;
    var t = video.currentTime;
    var pausado = video.paused;
    video.addEventListener('loadedmetadata', function alCargar() {
      video.removeEventListener('loadedmetadata', alCargar);
      try { video.currentTime = t; } catch (e) { /* sigue desde el inicio */ }
      if (!pausado) {
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      }
    });
    video.src = SRC_BAJA;
    video.load();
  }

  function reproducir() {
    if (video) return;
    enBaja = empezarEnBaja();

    video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    video.poster = POSTER;
    video.src = enBaja ? SRC_BAJA : SRC_ALTA;

    /* `waiting` también salta al adelantar; solo cuentan los atorones en
       reproducción normal. */
    var buscando = false;
    video.addEventListener('seeking', function () { buscando = true; });
    video.addEventListener('seeked', function () { buscando = false; });
    video.addEventListener('waiting', function () {
      if (buscando || enBaja || video.currentTime < 1) return;
      if (++atorones >= ATORONES) bajarCalidad();
    });
    /* Si el 1080 falla del todo, se intenta con el 720 antes de rendirse. */
    video.addEventListener('error', function () {
      if (!enBaja) bajarCalidad();
    });

    root.appendChild(video);
    var boton = root.querySelector('.play');
    var poster = root.querySelector('.poster');
    if (boton) boton.remove();
    if (poster) poster.remove();

    var p = video.play();
    if (p && p.catch) p.catch(function () { /* quedan los controles nativos */ });
    video.focus();
  }

  function construir() {
    host = document.createElement('div');
    host.id = HOST_ID;
    root = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);

    var img = document.createElement('img');
    img.className = 'poster';
    img.src = POSTER;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    root.appendChild(img);

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'play';
    boton.setAttribute('aria-label', 'Reproducir el video de Adlek');
    /* markup propio y estático: el mismo triángulo del placeholder */
    boton.innerHTML =
      '<span class="disco"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M5 3 L21 12 L5 21 Z" fill="#1C1C1C"/></svg></span>';
    boton.addEventListener('click', reproducir);
    root.appendChild(boton);
  }

  function enlaceWhatsApp() {
    var nav = document.getElementById('adlek-nav-cta');
    var href = nav && nav.getAttribute('href');
    return href && /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href) ? href : WA_RESPALDO;
  }

  function construirCta() {
    cta = document.createElement('div');
    cta.id = CTA_ID;
    var r = cta.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = CSS_CTA;
    r.appendChild(style);
    ctaLink = document.createElement('a');
    ctaLink.href = enlaceWhatsApp();
    ctaLink.target = '_blank';
    ctaLink.rel = 'noopener';
    ctaLink.appendChild(document.createTextNode(CTA_TEXTO));
    ctaLink.insertAdjacentHTML('beforeend', FLECHA);   /* markup propio y estático */
    r.appendChild(ctaLink);
  }

  function buscarCaja() {
    var sec = document.querySelector(SECCION);
    return sec && sec.querySelector('div[style*="aspect-ratio"]');
  }

  function insertar() {
    var c = buscarCaja();
    if (!c || !host) return;
    caja = c;
    if (host.parentNode !== caja) caja.appendChild(host);
    /* El CTA va justo debajo del recuadro, como hermano. */
    if (cta && caja.parentNode && cta.previousSibling !== caja) {
      caja.parentNode.insertBefore(cta, caja.nextSibling);
    }
    if (ctaLink) ctaLink.href = enlaceWhatsApp();
  }

  function montar() {
    if (!document.getElementById('dc-root')) return false;
    if (!buscarCaja()) return false;
    construir();
    construirCta();
    insertar();
    new MutationObserver(insertar)
      .observe(document.getElementById('dc-root'), { childList: true, subtree: true });
    return true;
  }

  /* El script corre sobre el shell, antes del swap del documento: hay que
     esperar a que React pinte la sección. */
  var t = setInterval(function () {
    if (montar()) clearInterval(t);
  }, 50);
  setTimeout(function () { clearInterval(t); }, MAX_ESPERA);
})();
