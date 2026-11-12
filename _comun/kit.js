/* Te programé algo 💌 — kit común para las piezas interactivas.
 * <script src="../_comun/kit.js"></script>  (en el <head>, después de sorpresa.js)
 *
 * K.q, K.EN, K.VIDEO          parámetros del link, inglés, modo video (?video=1)
 * K.lienzo('c')               canvas a pantalla completa con devicePixelRatio → {cv, ctx, W, H}
 * K.escribir(el, txt, t0, t)  texto que se escribe solo (con cursor |)
 * K.pista(el, txt)            cambia el texto de ayuda con un fundido
 * K.entrada({abajo, mover, arriba})   toques reales (no se activa en el video)
 * K.guion(pasos, manejadores) en el video, un cursor hace lo que haría la persona:
 *     paso = { cuando: t => ms|null, donde: () => ({x,y}), dur?: ms (mantener), trazo?: e => ({x,y}) (arrastrar) }
 * K.chispas(ctx)              partículas: .soltar(x, y, n, colores, fuerza) / .pintar()
 * K.puntosTexto(txt, fuente, ancho, alto, paso)   puntos que forman un texto (para partículas)
 * Animar solo con rAF / setTimeout / CSS / el.animate(): el reloj virtual del renderizador los controla.
 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  var K = {
    q: q, EN: q.get('lang') === 'en', VIDEO: q.has('video'),
    clamp: function (v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(Math.max(v, a), b); },
    easeOut: function (t) { return 1 - Math.pow(1 - t, 3); },
    easeInOut: function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    rnd: function (a, b) { return a + Math.random() * (b - a); },
    rebote: function (t) { var n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; }
  };
  K.vibrar = function (p) { if (!K.VIDEO) try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

  // estilos base: pista, texto escribiéndose, cursor del video, botón «Ver de nuevo»
  var st = document.createElement('style');
  st.textContent = [
    '#pista{position:fixed;left:0;right:0;bottom:11vh;z-index:4;text-align:center;padding:0 24px;font:700 clamp(15px,4.3vw,18px) Quicksand,sans-serif;',
    ' color:var(--pista,#fff);text-shadow:0 2px 10px rgba(0,0,0,.55);opacity:0;transition:opacity .5s;pointer-events:none}',
    '#pista.ver{opacity:1;animation:k-respira 1.8s ease-in-out infinite}',
    '@keyframes k-respira{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}',
    '.typing::after{content:"|";margin-left:2px;animation:k-blink .8s steps(1) infinite}',
    '@keyframes k-blink{50%{opacity:0}}',
    '#k-cursor{position:fixed;left:0;top:0;width:34px;height:34px;pointer-events:none;opacity:0;z-index:50;transition:opacity .3s;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}',
    '#k-cursor.abajo path{transform:scale(.86);transform-origin:20% 10%}',
    '#k-dedo{position:fixed;left:0;top:0;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;z-index:49;opacity:0;',
    ' background:radial-gradient(circle,rgba(255,255,255,.55),rgba(255,255,255,0) 70%);transition:opacity .15s}',
    '#repetir{position:fixed;bottom:14px;right:14px;z-index:6;background:rgba(255,255,255,.1);border:1px solid var(--acento,#ff8fb8);color:var(--acento,#ff8fb8);',
    ' font:14px Quicksand,sans-serif;padding:8px 14px;border-radius:20px;cursor:pointer;opacity:0;transition:opacity 1s}',
    '#repetir.visible{opacity:1}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(st);

  K.lienzo = function (id) {
    var cv = document.getElementById(id), ctx = cv.getContext('2d'), o = { cv: cv, ctx: ctx, W: 0, H: 0 };
    function medir() { var d = window.devicePixelRatio || 1; o.W = innerWidth; o.H = innerHeight; cv.width = o.W * d; cv.height = o.H * d; ctx.setTransform(d, 0, 0, d, 0, 0); }
    medir(); addEventListener('resize', medir);
    return o;
  };
  K.escribir = function (el, txt, t0, t, vel) {
    vel = vel || 40;
    var p = K.clamp((t - t0) / Math.max(txt.length * vel, 1)), n = Math.round(p * txt.length);
    if (el.__n !== n) { el.textContent = txt.slice(0, n); el.__n = n; }
    el.classList.toggle('typing', p > 0 && p < 1);
    return p >= 1;
  };
  K.pista = function (el, txt) {
    if (el.__txt === txt) return; el.__txt = txt;
    el.classList.remove('ver');
    if (txt) setTimeout(function () { if (el.__txt === txt) { el.textContent = txt; el.classList.add('ver'); } }, 260);
  };
  K.entrada = function (h) {
    if (K.VIDEO) return;
    var abajo = false;
    addEventListener('pointerdown', function (e) {
      if (e.target.closest && e.target.closest('button,a,input,#sp-fin,#sp-son,#sp-secreto,#sp-capa')) return;
      abajo = true; h.abajo && h.abajo(e.clientX, e.clientY, e);
    });
    addEventListener('pointermove', function (e) { h.mover && h.mover(e.clientX, e.clientY, abajo, e); });
    var fin = function (e) { if (!abajo) return; abajo = false; h.arriba && h.arriba(e.clientX, e.clientY, e); };
    addEventListener('pointerup', fin); addEventListener('pointercancel', fin);
  };

  K.guion = function (pasos, h) {
    if (!K.VIDEO) return function () {};
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'k-cursor'; svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = '<path fill="#fff" stroke="#000" stroke-width="1.2" d="M5 2 L5 20 L9.5 15.5 L12.5 22 L15.5 20.7 L12.6 14.3 L19 14.3 Z"/>';
    var dedo = document.createElement('div'); dedo.id = 'k-dedo';
    document.body.appendChild(dedo); document.body.appendChild(svg);
    var i = 0, obj = null, pos = { x: innerWidth * .82, y: innerHeight * .92 }, tFin = null;
    function abajo(v) { svg.classList.toggle('abajo', v); dedo.style.opacity = v ? 1 : 0; }
    return function (t) {
      if (i >= pasos.length) {
        if (tFin == null) tFin = t;
        if (t > tFin + 700) svg.style.opacity = 0;
      } else {
        var s = pasos[i], viaje = s.viaje || 700;
        if (!obj) {
          var c = s.cuando(t);
          if (c != null) { obj = { en: Math.max(c, t + viaje), de: { x: pos.x, y: pos.y }, fase: 'ir' }; svg.style.opacity = 1; }
        }
        if (obj && obj.fase === 'ir') {
          var d = s.donde(), p = K.easeOut(K.clamp(1 - (obj.en - t) / viaje));
          pos = { x: obj.de.x + (d.x - obj.de.x) * p, y: obj.de.y + (d.y - obj.de.y) * p };
          if (t >= obj.en) {
            pos = d; obj.fase = 'accion'; obj.t0 = t; abajo(true);
            h.abajo && h.abajo(pos.x, pos.y);
            if (!s.dur) { obj.fase = 'soltar'; obj.t0 = t; }
          }
        } else if (obj && obj.fase === 'accion') {
          var e = K.clamp((t - obj.t0) / s.dur);
          if (s.trazo) { pos = s.trazo(e); h.mover && h.mover(pos.x, pos.y, true); }
          if (e >= 1) { obj.fase = 'soltar'; obj.t0 = t; }
        }
        if (obj && obj.fase === 'soltar' && t >= obj.t0 + 120) {
          abajo(false); h.arriba && h.arriba(pos.x, pos.y); i++; obj = null;
        }
      }
      svg.style.transform = 'translate(' + (pos.x - 6) + 'px,' + (pos.y - 3) + 'px)';
      dedo.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    };
  };

  K.chispas = function (ctx) {
    var l = [];
    return {
      lista: l,
      soltar: function (x, y, n, cols, f, extra) {
        f = f || 4;
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2, v = K.rnd(.4, 1) * f;
          l.push(Object.assign({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - f * .45, vida: 0, max: K.rnd(40, 85),
            col: cols[(Math.random() * cols.length) | 0], s: K.rnd(1.4, 3.2), g: .09, forma: 'o' }, extra || {}));
        }
      },
      pintar: function () {
        for (var i = l.length - 1; i >= 0; i--) {
          var c = l[i]; c.vida++; c.x += c.vx; c.y += c.vy; c.vy += c.g; c.vx *= .985;
          if (c.vida > c.max) { l.splice(i, 1); continue; }
          ctx.globalAlpha = 1 - c.vida / c.max; ctx.fillStyle = c.col;
          if (c.forma === 'c') K.corazon(ctx, c.x, c.y, c.s * 3);
          else { ctx.beginPath(); ctx.arc(c.x, c.y, c.s, 0, 7); ctx.fill(); }
        }
        ctx.globalAlpha = 1;
      }
    };
  };
  K.corazon = function (ctx, x, y, s) {
    y -= s / 2;
    ctx.beginPath(); ctx.moveTo(x, y + s * .3);
    ctx.bezierCurveTo(x, y, x - s * .5, y, x - s * .5, y + s * .3);
    ctx.bezierCurveTo(x - s * .5, y + s * .6, x, y + s * .8, x, y + s);
    ctx.bezierCurveTo(x, y + s * .8, x + s * .5, y + s * .6, x + s * .5, y + s * .3);
    ctx.bezierCurveTo(x + s * .5, y, x, y, x, y + s * .3);
    ctx.fill();
  };
  K.puntosTexto = function (txt, fuente, ancho, alto, paso) {
    ancho = Math.round(ancho); alto = Math.round(alto);           // enteros: si no, el índice de píxeles se descuadra
    var c = document.createElement('canvas'); c.width = ancho; c.height = alto;
    var x = c.getContext('2d'), tam = parseFloat(fuente.match(/(\d+(\.\d+)?)px/)[1]);
    x.font = fuente;
    var w = x.measureText(txt).width;
    if (w > ancho * .92) { tam *= ancho * .92 / w; x.font = fuente.replace(/\d+(\.\d+)?px/, tam + 'px'); }
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, ancho / 2, alto / 2);
    var d = x.getImageData(0, 0, ancho, alto).data, out = [];
    for (var yy = 0; yy < alto; yy += paso) for (var xx = 0; xx < ancho; xx += paso) if (d[(yy * ancho + xx) * 4 + 3] > 128) out.push({ x: xx - ancho / 2, y: yy - alto / 2 });
    return out;
  };
  K.repetir = function () { var r = document.getElementById('repetir'); if (r) r.classList.add('visible'); };
  K.traducirRepetir = function () {
    if (!K.EN) return; var r = document.getElementById('repetir');
    if (r && r.dataset.en) r.textContent = r.dataset.en; document.documentElement.lang = 'en';
  };
  window.K = K;
})();
