/* ==========================================================================
   Adlek — burbuja de chat (widget aislado)

   index.html es un bundle auto-desempaquetable: en runtime reemplaza el
   documento entero (`document.documentElement.replaceWith(...)`) y monta
   React 18 dentro de <div id="dc-root">.

   Por eso este script NO monta nada al ejecutarse. Corre como `defer` desde
   el shell (antes de DOMContentLoaded, que es cuando arranca el
   desempaquetador), sobrevive al swap porque su estado vive en `window`, y
   espera a que aparezca #dc-root para montar en document.body.

   El widget vive en un Shadow DOM: ni el design system de la página lo toca,
   ni él toca la página.
   ========================================================================== */

(function () {
  'use strict';

  var MOUNT_ID = 'adlek-chat-root';
  var CSS_HREF = 'chat-widget.css';
  var API_URL  = '/api/chat';

  /* El endpoint POST /api/chat todavía no existe. Mientras tanto la respuesta
     se simula con setTimeout. Cuando el endpoint esté listo, poner false. */
  var USE_MOCK = true;

  var MOBILE_MQ = '(max-width: 620px)';
  var WELCOME   = 'Hola. Soy el asistente de Adlek. Cuéntenos de su clínica y le decimos cómo llenamos su agenda.';

  var state = {
    mounted: false,
    open: false,
    sending: false,
    messages: [],        /* [{ role: 'user' | 'bot', text: string }] */
    lastUserText: null,  /* para reintentar tras un error de red */
    prevBodyOverflow: null
  };

  var el = {};   /* refs dentro del shadow root */
  var host = null;
  var root = null;

  /* ---------------------------------------------------------------- iconos
     Trazos redondeados, igual que las flechas dibujadas a mano del export. */

  var ICON_BUBBLE =
    '<svg class="adlek-chat-icon-open" viewBox="0 0 28 28" fill="none" aria-hidden="true">' +
      '<path d="M3.5 12.6C3.5 7.9 8.2 4.1 14 4.1s10.5 3.8 10.5 8.5S19.8 21.1 14 21.1' +
      'c-1.2 0-2.4-.2-3.5-.5L5 23.2l1.5-4.4C4.6 17.3 3.5 15.1 3.5 12.6Z" ' +
      'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var ICON_X =
    '<svg viewBox="0 0 28 28" fill="none" aria-hidden="true">' +
      '<path d="M8 8l12 12M20 8L8 20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '</svg>';

  /* La misma flecha que usan el nav CTA y el CTA de cierre del export */
  var ICON_ARROW =
    '<svg viewBox="0 0 34 18" fill="none" aria-hidden="true">' +
      '<path d="M1 15 C 9 15 14 5 27 4" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M21 1.5 L28.5 4 L23.5 9.5" stroke="currentColor" stroke-width="2.6" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var MARKUP =
    '<button type="button" class="adlek-chat-launcher" aria-label="Abrir el chat de Adlek" ' +
            'aria-expanded="false" aria-controls="adlek-chat-panel">' +
      ICON_BUBBLE +
      '<span class="adlek-chat-icon-close">' + ICON_X + '</span>' +
    '</button>' +

    '<div class="adlek-chat-panel" id="adlek-chat-panel" role="dialog" ' +
         'aria-labelledby="adlek-chat-title" hidden>' +

      '<div class="adlek-chat-header">' +
        '<div class="adlek-chat-header-text">' +
          '<p class="adlek-chat-title" id="adlek-chat-title">Hablemos</p>' +
          '<p class="adlek-chat-subtitle">Respondemos en minutos</p>' +
        '</div>' +
        '<button type="button" class="adlek-chat-close" aria-label="Cerrar el chat">' +
          ICON_X +
        '</button>' +
      '</div>' +

      '<div class="adlek-chat-log" role="log" aria-live="polite" aria-relevant="additions">' +
        '<div class="adlek-chat-typing" aria-label="Escribiendo" hidden>' +
          '<span></span><span></span><span></span>' +
        '</div>' +
      '</div>' +

      '<div class="adlek-chat-error" role="alert" hidden>' +
        '<span class="adlek-chat-error-text">No pudimos enviar su mensaje.</span>' +
        '<button type="button" class="adlek-chat-retry">Reintentar</button>' +
      '</div>' +

      '<form class="adlek-chat-form">' +
        '<textarea class="adlek-chat-input" rows="1" placeholder="Escriba su mensaje…" ' +
                  'aria-label="Mensaje"></textarea>' +
        '<button type="submit" class="adlek-chat-send" aria-label="Enviar" disabled>' +
          ICON_ARROW +
        '</button>' +
      '</form>' +

    '</div>';

  /* ------------------------------------------------------------- arranque */

  function boot() {
    if (waitDone()) return;
    var tries = setInterval(function () {
      if (waitDone()) clearInterval(tries);
    }, 50);
    /* Si #dc-root nunca aparece (bundle cambiado, error de desempaquetado),
       montamos igual para no perder el canal de contacto. */
    setTimeout(function () {
      clearInterval(tries);
      if (document.body) mount();
    }, 15000);
  }

  function waitDone() {
    if (!document.getElementById('dc-root')) return false;
    mount();
    return true;
  }

  /* --------------------------------------------------------------- montaje */

  function mount() {
    if (state.mounted || document.getElementById(MOUNT_ID)) return;
    if (!document.body) return;
    state.mounted = true;

    host = document.createElement('div');
    host.id = MOUNT_ID;
    /* Capa fija a viewport completo que no intercepta clicks: los hijos
       reactivan pointer-events. Resuelve a la vez el fullscreen móvil y la
       esquina en desktop. Es lo único que no puede vivir en el CSS, porque el
       host queda fuera del shadow root. */
    host.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;pointer-events:none;visibility:hidden';

    root = host.attachShadow({ mode: 'open' });

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    /* El <link> va dentro del shadow root, no en el <head>: el head del shell
       se destruye en el swap del documento. */
    link.onload = link.onerror = reveal;
    root.appendChild(link);

    var wrap = document.createElement('div');
    wrap.innerHTML = MARKUP;      /* markup propio y estático */
    while (wrap.firstChild) root.appendChild(wrap.firstChild);

    /* Hermano de #dc-root, nunca dentro de un contenedor de la página:
       React solo reconcilia #dc-root, así que esto sobrevive a sus renders. */
    document.body.appendChild(host);

    cacheRefs();
    wireEvents();
    addMessage('bot', WELCOME);

    setTimeout(reveal, 3000);     /* red de seguridad si el CSS no responde */
  }

  function reveal() {
    if (!host) return;
    host.style.visibility = 'visible';
    /* Un frame despues habilitamos las transiciones (ver chat-widget.css):
       asi el primer pintado es estatico y no se ve entrar la sombra.
       El setTimeout cubre el caso de rAF congelado (pestana en segundo plano),
       donde si no las transiciones quedarian desactivadas para siempre. */
    requestAnimationFrame(function () {
      requestAnimationFrame(markReady);
    });
    setTimeout(markReady, 120);
  }

  function markReady() {
    if (host) host.classList.add('adlek-chat-ready');
  }

  function cacheRefs() {
    el.launcher = root.querySelector('.adlek-chat-launcher');
    el.panel    = root.querySelector('.adlek-chat-panel');
    el.close    = root.querySelector('.adlek-chat-close');
    el.log      = root.querySelector('.adlek-chat-log');
    el.typing   = root.querySelector('.adlek-chat-typing');
    el.error    = root.querySelector('.adlek-chat-error');
    el.errorText= root.querySelector('.adlek-chat-error-text');
    el.retry    = root.querySelector('.adlek-chat-retry');
    el.form     = root.querySelector('.adlek-chat-form');
    el.input    = root.querySelector('.adlek-chat-input');
    el.send     = root.querySelector('.adlek-chat-send');
  }

  function wireEvents() {
    el.launcher.addEventListener('click', function () {
      state.open ? closePanel() : openPanel();
    });
    el.close.addEventListener('click', closePanel);
    el.retry.addEventListener('click', retry);

    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });

    el.input.addEventListener('input', function () {
      autoGrow();
      syncSendState();
    });

    el.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {   /* Shift+Enter = salto de línea */
        e.preventDefault();
        submit();
      }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.open) {
        e.stopPropagation();
        closePanel();
      }
    });
  }

  /* ------------------------------------------------------- abrir / cerrar */

  function isMobile() {
    return window.matchMedia && window.matchMedia(MOBILE_MQ).matches;
  }

  function openPanel() {
    state.open = true;
    el.panel.hidden = false;
    el.launcher.classList.add('is-open');
    el.launcher.setAttribute('aria-expanded', 'true');
    el.launcher.setAttribute('aria-label', 'Cerrar el chat de Adlek');

    if (isMobile()) lockScroll();

    el.input.focus();
    scrollLog();
  }

  function closePanel() {
    state.open = false;
    el.panel.hidden = true;
    el.launcher.classList.remove('is-open');
    el.launcher.setAttribute('aria-expanded', 'false');
    el.launcher.setAttribute('aria-label', 'Abrir el chat de Adlek');

    unlockScroll();
    el.launcher.focus();
  }

  /* Guarda y restaura el valor inline exacto: la página nunca queda alterada. */
  function lockScroll() {
    if (state.prevBodyOverflow !== null) return;
    state.prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  function unlockScroll() {
    if (state.prevBodyOverflow === null) return;
    document.body.style.overflow = state.prevBodyOverflow;
    state.prevBodyOverflow = null;
  }

  /* ------------------------------------------------------------- mensajes */

  function addMessage(role, text) {
    state.messages.push({ role: role, text: text });

    var node = document.createElement('div');
    node.className = 'adlek-chat-msg ' +
      (role === 'user' ? 'adlek-chat-msg-user' : 'adlek-chat-msg-bot');
    node.textContent = text;    /* nunca innerHTML: inmune a XSS */

    el.log.insertBefore(node, el.typing);
    scrollLog();
  }

  function scrollLog() {
    el.log.scrollTop = el.log.scrollHeight;
  }

  function autoGrow() {
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 120) + 'px';
  }

  function syncSendState() {
    el.send.disabled = state.sending || el.input.value.trim() === '';
  }

  /* -------------------------------------------------------------- envío */

  function submit() {
    var text = el.input.value.trim();
    if (!text || state.sending) return;

    el.input.value = '';
    autoGrow();
    addMessage('user', text);
    state.lastUserText = text;
    send(text);
  }

  function retry() {
    if (state.lastUserText) send(state.lastUserText);
  }

  function send(text) {
    state.sending = true;
    syncSendState();
    el.error.hidden = true;
    el.typing.hidden = false;
    scrollLog();

    requestReply(text).then(function (data) {
      var reply = (data && data.reply) ||
        'Gracias por escribir. Le respondemos enseguida.';
      addMessage('bot', String(reply));
      state.lastUserText = null;
    }).catch(function (err) {
      el.errorText.textContent = 'No pudimos enviar su mensaje. Revise su conexión.';
      el.error.hidden = false;
      if (window.console) console.warn('[adlek-chat]', err);
    }).then(function () {
      state.sending = false;
      el.typing.hidden = true;
      syncSendState();
      scrollLog();
    });
  }

  /* Capa de red. El camino real ya está escrito: activar el endpoint es
     poner USE_MOCK en false, nada más. */
  function requestReply(text) {
    if (USE_MOCK) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve({ reply: pickMockReply(text) });
        }, 700 + Math.random() * 600);
      });
    }

    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: state.messages })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function pickMockReply(text) {
    var t = (text || '').toLowerCase();

    /* El orden importa: "cuanto tiempo" es una pregunta de plazos, no de precio,
       asi que los plazos se evaluan primero. */
    if (/tiempo|cu[aá]ndo|tarda|plazo|entrega|arrancan|empezar|empiezan/.test(t)) {
      return 'El arranque toma entre dos y tres semanas. Desde el primer mes ya hay campañas corriendo.';
    }
    if (/precio|costo|cuesta|tarifa|presupuesto|cotiza|invers|cu[aá]nto (es|sale|cobran|vale)/.test(t)) {
      return 'El arranque va de $4,500 a $9,000 y la mensualidad de $3,500 a $4,500. ' +
             'Se lo cotizamos exacto después de conocer su clínica.';
    }
    if (/whatsapp|llamar|teléfono|telefono|hablar|cita|agenda/.test(t)) {
      return 'Con gusto. Escríbanos por WhatsApp y agendamos 15 minutos para ver su caso.';
    }
    if (/c[oó]mo|funciona|sistema|servicio|hacen|trabajan/.test(t)) {
      return 'Armamos el sistema completo: sitio, campañas y seguimiento, todo conectado. ' +
             'Usted solo atiende a los pacientes que llegan.';
    }
    return 'Gracias por escribir. Cuéntenos en qué ciudad está su clínica y qué servicio ' +
           'quiere llenar, y le decimos cómo lo resolvemos.';
  }

  boot();
})();
