/* ==========================================================================
   Adlek — doctor animado en el hero

   La imagen del hero es un <image-slot> del export (#adlek-hero-overlay) con
   el doctor recortado sobre el verde. Este script le pone encima el mismo
   doctor animado, como video con fondo transparente, y oculta la imagen fija
   solo cuando el video ya está reproduciéndose de verdad.

   La imagen fija no se quita: es lo que se ve mientras el video carga, y lo
   que queda si el video no puede reproducirse (navegador viejo, modo de bajo
   consumo en iPhone, ahorro de datos) o si el visitante pide menos
   movimiento.

   DOS ARCHIVOS, A PROPÓSITO

   Ningún formato de video con transparencia funciona en todos los navegadores:

   - imagenes/hero-doctor.webm  VP9 con alfa   -> Chrome, Edge, Firefox, Android
   - imagenes/hero-doctor.mp4   HEVC con alfa  -> Safari y todo iPhone/iPad

   Safari sí abre WebM, pero ignora el alfa y pinta el fondo negro; por eso se
   elige por navegador en vez de dejar que el <video> escoja con <source>.

   Los dos salen del mismo máster (ProRes 4444, 5 s) reproducido ida y vuelta,
   para que el bucle de 10 s no tenga salto.

   El <video> va dentro de #adlek-hero-media, que es árbol React: es una
   excepción a "nunca inyectar dentro de #dc-root" (CLAUDE.md), con el mismo
   patrón que footer-links.js. React no borra nodos ajenos, y un
   MutationObserver lo repone si hiciera falta.
   ========================================================================== */

(function () {
  'use strict';

  var VIDEO_ID   = 'adlek-hero-video';
  var MEDIA_ID   = 'adlek-hero-media';
  var SLOT_ID    = 'adlek-hero-overlay';
  var SRC_WEBM   = 'imagenes/hero-doctor.webm';
  var SRC_HEVC   = 'imagenes/hero-doctor.mp4';
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */

  var video = null;

  function reducido() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* WebKit (Safari, y cualquier navegador en iOS) necesita el HEVC. */
  function elegirFuente() {
    var ua = navigator.userAgent || '';
    var ios = /iP(hone|ad|od)/.test(ua);
    var safari = /Safari/.test(ua) && !/Chrome|Chromium|Android|Edg\//.test(ua);
    var probe = document.createElement('video');
    if (!probe.canPlayType) return null;
    if (ios || safari) {
      return probe.canPlayType('video/mp4; codecs="hvc1"') ? SRC_HEVC : null;
    }
    return probe.canPlayType('video/webm; codecs="vp9"') ? SRC_WEBM : null;
  }

  /* El <img> real vive en el shadow root del slot y va con fit="contain":
     el video copia su caja exacta para caer en el mismo lugar. */
  function cajaImagen(slot) {
    var img = slot.shadowRoot && slot.shadowRoot.querySelector('img');
    var r = (img || slot).getBoundingClientRect();
    if (!img || !r.width || !r.height) {
      var s = slot.getBoundingClientRect();
      var lado = Math.min(s.width, s.height);
      return { left: s.left + (s.width - lado) / 2, top: s.top + (s.height - lado) / 2,
               width: lado, height: lado };
    }
    return r;
  }

  function colocar() {
    var media = document.getElementById(MEDIA_ID);
    var slot = document.getElementById(SLOT_ID);
    if (!video || !media || !slot) return;
    var m = media.getBoundingClientRect();
    var c = cajaImagen(slot);
    video.style.left = (c.left - m.left) + 'px';
    video.style.top = (c.top - m.top) + 'px';
    video.style.width = c.width + 'px';
    video.style.height = c.height + 'px';
  }

  function mostrarVideo(on) {
    var slot = document.getElementById(SLOT_ID);
    if (video) video.style.opacity = on ? '1' : '0';
    if (slot) slot.style.opacity = on ? '0' : '';
  }

  function poner(src) {
    var media = document.getElementById(MEDIA_ID);
    if (!media || !document.getElementById(SLOT_ID)) return;
    if (video && video.parentNode === media) return;

    if (!video) {
      video = document.createElement('video');
      video.id = VIDEO_ID;
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.disablePictureInPicture = true;
      video.preload = 'auto';
      video.style.cssText =
        'position:absolute;z-index:1;opacity:0;pointer-events:none;' +
        'object-fit:contain;background:transparent';
      video.addEventListener('playing', function () { colocar(); mostrarVideo(true); });
      video.addEventListener('error', function () { mostrarVideo(false); });
      video.src = src;
    }

    media.appendChild(video);
    colocar();
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* autoplay bloqueado: queda la imagen */ });
  }

  function montar() {
    var root = document.getElementById('dc-root');
    var media = document.getElementById(MEDIA_ID);
    var slot = document.getElementById(SLOT_ID);
    if (!root || !media || !slot) return false;
    if (reducido()) return true;

    var src = elegirFuente();
    if (!src) return true;

    poner(src);
    new MutationObserver(function () { poner(src); })
      .observe(root, { childList: true, subtree: true });

    window.addEventListener('resize', colocar);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(colocar);
      ro.observe(media);
      ro.observe(slot);
    }

    /* Fuera de pantalla no tiene caso gastar batería. */
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entradas) {
        if (!video) return;
        if (entradas[entradas.length - 1].isIntersecting) {
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        } else {
          video.pause();
        }
      }).observe(media);
    }
    return true;
  }

  /* El script corre sobre el shell, antes del swap del documento: hay que
     esperar a que React pinte el hero. */
  var t = setInterval(function () {
    if (montar()) clearInterval(t);
  }, 50);
  setTimeout(function () { clearInterval(t); }, MAX_ESPERA);
})();
