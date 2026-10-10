/* ==========================================================================
   Adlek — carrusel de "Trabajos entregados"

   Sustituye la rejilla de tarjetas del export por un carrusel tipo "scroll
   reel": tres columnas de mosaicos donde la del centro lleva las fotos de los
   trabajos y se desplaza un paso por cada cambio, mientras las dos de los
   lados giran en sentido contrario. El texto entra letra por letra.

   DE DÓNDE SALE EL CONTENIDO

   No hay datos duplicados aquí: el carrusel lee las tarjetas que ya están en
   el DOM (título, descripción y foto), en su orden, incluida la que agrega
   casos.js. Para sumar o editar un trabajo se toca esa tarjeta, no este
   archivo. Las fotos del export son blob URLs que el <image-slot> resuelve en
   runtime, así que se leen del propio slot cuando ya cargaron.

   La rejilla original no se borra, solo se oculta: si este script fallara,
   la sección se seguiría viendo como antes.

   El carrusel vive en un Shadow DOM, aislado del design system, y se inserta
   dentro de la sección (árbol React): es una excepción a "nunca inyectar
   dentro de #dc-root" (CLAUDE.md), con el mismo patrón que footer-links.js.
   ========================================================================== */

(function () {
  'use strict';

  var HOST_ID    = 'adlek-trabajos-reel';
  var ANCLA      = 'adlek-caso-3';      /* image-slot de la primera tarjeta */
  var CASO_EXTRA = 'adlek-caso-swiss';  /* tarjeta que agrega casos.js */
  var MAX_ESPERA = 15000;   /* red de seguridad si #dc-root nunca aparece */
  var ESPERA_EXTRA = 1500;  /* margen para que casos.js inserte su tarjeta */

  var EXIT_MS  = 240;   /* sale el texto viejo / entra el nuevo */
  var SLIDE_MS = 800;   /* deslizamiento de columnas + bloqueo de interacción */
  var STAGGER  = 6;     /* ms entre letra y letra */

  var CSS =
    ':host{display:block;margin:clamp(40px,6vw,72px) 0 0;font-family:Inter,system-ui,sans-serif;' +
      '--cell:148px;--gap:8px}' +
    '*{box-sizing:border-box}' +

    '.reel{position:relative;display:flex;align-items:stretch;min-height:380px;overflow:hidden;' +
      'background:#FFFFFF;border:1px solid #D8D5CD;border-radius:16px;' +
      'box-shadow:6px 6px 0 #1A6265;outline:none}' +
    '.reel:focus-visible{box-shadow:6px 6px 0 #1A6265,0 0 0 3px #E8683C}' +

    /* --- mosaico --- */
    '.stage{position:relative;flex:none;width:min(46%,500px);align-self:stretch;overflow:hidden;' +
      'background:#1A6265}' +
    '.mask{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
      'gap:var(--gap);' +
      '-webkit-mask-image:linear-gradient(to right,transparent 0%,#000 14%,#000 86%,transparent 100%),' +
        'linear-gradient(to bottom,transparent 0%,#000 10%,#000 90%,transparent 100%);' +
      'mask-image:linear-gradient(to right,transparent 0%,#000 14%,#000 86%,transparent 100%),' +
        'linear-gradient(to bottom,transparent 0%,#000 10%,#000 90%,transparent 100%);' +
      '-webkit-mask-composite:source-in;mask-composite:intersect}' +
    '.col{display:flex;flex:none;flex-direction:column;gap:var(--gap);will-change:transform}' +
    '.ready .col{transition:transform ' + SLIDE_MS + 'ms cubic-bezier(.65,0,.35,1)}' +
    '.cell{flex:none;width:var(--cell);height:var(--cell);border-radius:14px;' +
      'border:1px solid rgba(244,242,237,.10);' +
      'background:linear-gradient(to bottom,#1F7A72,#134A4D);filter:blur(1px);' +
      'box-shadow:inset 0 1px 0 rgba(244,242,237,.14)}' +
    '.feat{position:relative;flex:none;width:var(--cell);height:var(--cell);border-radius:14px;' +
      'overflow:hidden;background:#E4E1D8;' +
      'box-shadow:5px 5px 0 #10393B;' +
      'opacity:.45;transform:scale(.94);' +
      'transition:opacity ' + SLIDE_MS + 'ms ease,transform ' + SLIDE_MS + 'ms cubic-bezier(.65,0,.35,1)}' +
    '.feat.on{opacity:1;transform:scale(1)}' +
    '.feat img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'object-position:center 30%;display:block;-webkit-user-drag:none;user-select:none}' +

    /* --- texto --- */
    '.body{display:flex;flex:1;min-width:0;flex-direction:column;justify-content:space-between;' +
      'gap:28px;padding:clamp(24px,4vw,44px)}' +
    '.count{margin:0;font-family:"Archivo Black",sans-serif;color:#E8683C;' +
      'font-size:clamp(2rem,4.4vw,3rem);line-height:.9;letter-spacing:-.03em}' +
    '.count small{font-size:.42em;letter-spacing:0;color:#8A8F8C;margin-left:.5em}' +
    '.text{display:grid;margin-top:clamp(16px,2.4vw,24px);overflow:hidden}' +
    '.block{grid-area:1/1;min-width:0}' +
    '.sizer{visibility:hidden}' +
    '.live{will-change:transform,opacity}' +
    '.live.exit{opacity:0;transform:translateY(-10px);' +
      'transition:opacity ' + EXIT_MS + 'ms ease,transform ' + EXIT_MS + 'ms ease}' +
    '.live.exit .ch{animation:none;opacity:1;transform:none}' +
    '.title{margin:0;font-family:"Archivo Black",sans-serif;text-transform:uppercase;color:#1C1C1C;' +
      'font-size:clamp(1.35rem,3vw,2.1rem);line-height:1.05;letter-spacing:-.02em}' +
    '.bar{width:56px;height:4px;background:#E8683C;margin:clamp(14px,2vw,18px) 0 0}' +
    '.desc{margin:clamp(14px,2vw,18px) 0 0;max-width:40ch;font-size:clamp(1rem,1.5vw,1.15rem);' +
      'line-height:1.55;color:#3A3F3E}' +
    '.w{display:inline-block;white-space:nowrap}' +
    '.ch{display:inline-block;opacity:0;transform:translateY(.55em);' +
      'animation:rise .5s cubic-bezier(.22,1,.36,1) forwards}' +
    '@keyframes rise{to{opacity:1;transform:none}}' +
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +

    /* --- controles --- */
    '.nav{display:flex;align-items:center;gap:12px}' +
    '.btn{display:grid;place-items:center;width:46px;height:46px;padding:0;border:0;' +
      'border-radius:999px;background:#E8683C;color:#1C1C1C;cursor:pointer;' +
      'box-shadow:3px 3px 0 #10393B;-webkit-tap-highlight-color:transparent;' +
      'transition:transform .2s cubic-bezier(.22,1,.36,1),opacity .2s,box-shadow .2s}' +
    '.btn:hover:enabled{transform:translate(-1px,-1px);box-shadow:4px 4px 0 #10393B}' +
    '.btn:active:enabled{transform:translate(2px,2px);box-shadow:1px 1px 0 #10393B}' +
    '.btn:disabled{cursor:default;opacity:.35}' +
    '.btn:focus-visible{outline:3px solid #1A6265;outline-offset:3px}' +
    '.btn svg{width:18px;height:18px}' +

    '@media (max-width:760px){' +
      ':host{--cell:112px}' +
      '.reel{flex-direction:column;min-height:0}' +
      '.stage{width:100%;height:250px}' +
      '.body{padding:24px 20px 26px}' +
    '}' +
    '@media (prefers-reduced-motion:reduce){' +
      '.ready .col,.feat,.live.exit,.btn{transition:none}' +
      '.ch{animation:none;opacity:1;transform:none}' +
    '}';

  var FLECHA_IZQ =
    '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 2.5 3.5 6l4 3.5"/></svg>';
  var FLECHA_DER =
    '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 2.5 4 3.5-4 3.5"/></svg>';

  var grid = null, host = null, root = null;
  var casos = [];      /* [{ titulo, texto, card, img }] */
  var el = {};
  var index = 0;
  var animando = false;

  function crear(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function dosDigitos(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------------------------------------------------------------- datos */

  function leerCasos() {
    var out = [];
    for (var i = 0; i < grid.children.length; i++) {
      var card = grid.children[i];
      var h3 = card.querySelector('h3');
      var p = card.querySelector('p');
      if (!h3 || !p) continue;
      out.push({
        titulo: h3.textContent.trim(),
        texto: p.textContent.trim(),
        card: card,
        img: null
      });
    }
    return out;
  }

  /* Foto de una tarjeta: <img> normal (casos.js) o el del shadow root del
     <image-slot>, que aparece cuando el slot termina de resolver su blob. */
  function fotoDe(card) {
    var img = card.querySelector('img');
    if (!img) {
      var slot = card.querySelector('image-slot');
      img = slot && slot.shadowRoot && slot.shadowRoot.querySelector('img');
    }
    return img && (img.currentSrc || img.getAttribute('src')) || '';
  }

  function cargarFotos() {
    var faltan = 0;
    for (var i = 0; i < casos.length; i++) {
      if (casos[i].img.getAttribute('src')) continue;
      var src = fotoDe(casos[i].card);
      if (src) casos[i].img.src = src; else faltan++;
    }
    return faltan === 0;
  }

  /* ------------------------------------------------------------ construir */

  /* Texto partido letra por letra. Los espacios quedan como nodos de texto
     entre palabras para que el salto de línea siga siendo natural. */
  function letras(dest, texto, desde) {
    var idx = desde;
    var palabras = texto.split(' ');
    for (var w = 0; w < palabras.length; w++) {
      var span = crear('span', 'w');
      var chars = Array.from(palabras[w]);
      for (var c = 0; c < chars.length; c++) {
        var ch = crear('span', 'ch');
        ch.textContent = chars[c];
        ch.style.animationDelay = (idx * STAGGER) + 'ms';
        span.appendChild(ch);
        idx++;
      }
      dest.appendChild(span);
      if (w < palabras.length - 1) { dest.appendChild(document.createTextNode(' ')); idx++; }
    }
    return idx;
  }

  function bloque(caso, cls, animado) {
    var b = crear('div', 'block ' + cls);
    var t = crear('h3', 'title');
    var d = crear('p', 'desc');
    if (animado) {
      var n = letras(t, caso.titulo, 0);
      letras(d, caso.texto, n + 6);
    } else {
      t.textContent = caso.titulo;
      d.textContent = caso.texto;
    }
    b.appendChild(t);
    b.appendChild(crear('div', 'bar'));
    b.appendChild(d);
    return b;
  }

  function columnaLateral(n) {
    var col = crear('div', 'col');
    for (var i = 0; i < n; i++) col.appendChild(crear('div', 'cell'));
    return col;
  }

  function construir() {
    var n = casos.length;

    host = crear('div');
    host.id = HOST_ID;
    root = host.attachShadow({ mode: 'open' });

    var style = crear('style');
    style.textContent = CSS;
    root.appendChild(style);

    el.reel = crear('div', 'reel');
    el.reel.tabIndex = 0;
    el.reel.setAttribute('role', 'region');
    el.reel.setAttribute('aria-roledescription', 'carrusel');
    el.reel.setAttribute('aria-label', 'Trabajos entregados');

    /* Mosaico: la columna central lleva 3 celdas, luego cada foto con 2
       celdas entre una y otra, y 3 celdas al final. */
    var stage = crear('div', 'stage');
    stage.setAttribute('aria-hidden', 'true');
    var mask = crear('div', 'mask');
    el.izq = columnaLateral(4 + 2 * n);
    el.der = columnaLateral(4 + 2 * n);
    el.centro = crear('div', 'col');
    var i, k;
    for (k = 0; k < 3; k++) el.centro.appendChild(crear('div', 'cell'));
    for (i = 0; i < n; i++) {
      var feat = crear('div', 'feat');
      var img = crear('img');
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      feat.appendChild(img);
      casos[i].img = img;
      casos[i].feat = feat;
      el.centro.appendChild(feat);
      if (i < n - 1) {
        el.centro.appendChild(crear('div', 'cell'));
        el.centro.appendChild(crear('div', 'cell'));
      }
    }
    for (k = 0; k < 3; k++) el.centro.appendChild(crear('div', 'cell'));
    mask.appendChild(el.izq);
    mask.appendChild(el.centro);
    mask.appendChild(el.der);
    stage.appendChild(mask);

    /* Texto */
    var body = crear('div', 'body');
    var arriba = crear('div');
    el.count = crear('p', 'count');
    el.count.setAttribute('aria-hidden', 'true');
    el.text = crear('div', 'text');
    el.text.setAttribute('aria-hidden', 'true');
    /* Copias invisibles de todos los casos: la caja mide lo que el más
       largo, así el alto no brinca al cambiar. */
    for (i = 0; i < n; i++) el.text.appendChild(bloque(casos[i], 'sizer', false));
    el.live = bloque(casos[0], 'live', true);
    el.text.appendChild(el.live);
    el.sr = crear('div', 'sr');
    el.sr.setAttribute('aria-live', 'polite');
    arriba.appendChild(el.count);
    arriba.appendChild(el.text);
    arriba.appendChild(el.sr);

    var nav = crear('div', 'nav');
    el.prev = crear('button', 'btn');
    el.prev.type = 'button';
    el.prev.setAttribute('aria-label', 'Trabajo anterior');
    el.prev.innerHTML = FLECHA_IZQ;    /* markup propio y estático */
    el.next = crear('button', 'btn');
    el.next.type = 'button';
    el.next.setAttribute('aria-label', 'Trabajo siguiente');
    el.next.innerHTML = FLECHA_DER;
    nav.appendChild(el.prev);
    nav.appendChild(el.next);

    body.appendChild(arriba);
    body.appendChild(nav);
    el.reel.appendChild(stage);
    el.reel.appendChild(body);
    root.appendChild(el.reel);

    el.prev.addEventListener('click', function () { paginar(-1); });
    el.next.addEventListener('click', function () { paginar(1); });
    el.reel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); paginar(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); paginar(-1); }
    });
    deslizarConDedo(stage);
  }

  /* Deslizar el mosaico hacia los lados cambia de trabajo; el gesto vertical
     se deja pasar para no estorbar el scroll de la página. */
  function deslizarConDedo(zona) {
    var x0 = 0, y0 = 0, activo = false;
    zona.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; activo = true;
    }, { passive: true });
    zona.addEventListener('touchend', function (e) {
      if (!activo) return;
      activo = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) paginar(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  /* --------------------------------------------------------------- estado */

  /* Un paso = distancia entre dos fotos: 3 x (celda + hueco), medido del
     DOM porque el tamaño de celda cambia en celular. */
  function colocar() {
    var celda = el.centro.firstElementChild;
    var hueco = parseFloat(getComputedStyle(el.centro).rowGap) || 8;
    var paso = 3 * (celda.offsetHeight + hueco);
    var y = ((casos.length - 1) / 2 - index) * paso;
    el.centro.style.transform = 'translateY(' + y + 'px)';
    el.izq.style.transform = 'translateY(' + (-y) + 'px)';
    el.der.style.transform = 'translateY(' + (-y) + 'px)';
  }

  function pintar() {
    el.count.textContent = dosDigitos(index + 1);
    var total = document.createElement('small');
    total.textContent = '/ ' + dosDigitos(casos.length);
    el.count.appendChild(total);
    el.prev.disabled = index === 0;
    el.next.disabled = index === casos.length - 1;
    for (var i = 0; i < casos.length; i++) {
      casos[i].feat.classList.toggle('on', i === index);
    }
  }

  function paginar(dir) {
    if (animando) return;
    var next = index + dir;
    if (next < 0 || next >= casos.length) return;
    animando = true;
    index = next;

    colocar();
    pintar();
    el.live.classList.add('exit');

    setTimeout(function () {
      var nuevo = bloque(casos[index], 'live', true);
      el.text.replaceChild(nuevo, el.live);
      el.live = nuevo;
      el.sr.textContent = casos[index].titulo + '. ' + casos[index].texto;
    }, EXIT_MS);
    setTimeout(function () { animando = false; }, SLIDE_MS);
  }

  /* -------------------------------------------------------------- montaje */

  function insertar() {
    if (!grid || !grid.parentNode || !host) return;
    if (host.parentNode !== grid.parentNode) {
      grid.parentNode.insertBefore(host, grid.nextSibling);
    }
    if (grid.style.display !== 'none') grid.style.display = 'none';
  }

  function montar() {
    casos = leerCasos();
    if (casos.length < 2) return;   /* nada que rotar: se queda la rejilla */

    construir();
    insertar();
    colocar();
    pintar();
    /* Las transiciones se activan después del primer pintado, para que el
       mosaico aparezca ya en su sitio y no entre deslizándose. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.reel.classList.add('ready'); });
    });

    if (!cargarFotos()) {
      var f = setInterval(function () { if (cargarFotos()) clearInterval(f); }, 150);
      setTimeout(function () { clearInterval(f); }, MAX_ESPERA);
    }

    window.addEventListener('resize', colocar);
    if (window.ResizeObserver) new ResizeObserver(colocar).observe(el.reel);

    var dc = document.getElementById('dc-root');
    if (dc) new MutationObserver(insertar).observe(dc, { childList: true, subtree: true });
  }

  /* El script corre sobre el shell, antes del swap del documento: hay que
     esperar a que React pinte la rejilla, y a que casos.js agregue la suya. */
  var visto = 0;
  var t = setInterval(function () {
    var slot = document.getElementById(ANCLA);
    var card = slot && slot.parentNode && slot.parentNode.parentNode;
    grid = card && card.parentNode;
    if (!grid) return;
    if (!visto) visto = Date.now();
    if (!document.getElementById(CASO_EXTRA) && Date.now() - visto < ESPERA_EXTRA) return;
    clearInterval(t);
    montar();
  }, 50);
  setTimeout(function () { clearInterval(t); }, MAX_ESPERA);
})();
