/* Te programé algo 💌 — capa sorpresa común a todas las piezas.
 *
 * Se carga en el <head> ANTES del script de la pieza:  <script src="../_comun/sorpresa.js"></script>
 * Parámetros opcionales del link (además de los de cada pieza):
 *   secreto=…        mensaje oculto: al final aparece un candado que hay que mantener presionado
 *   abre=AAAA-MM-DD  (o AAAA-MM-DDTHH:MM) el sobre no se puede abrir hasta esa fecha (cuenta regresiva)
 *   musica=0         sin la cajita musical
 *   sobre=0          sin sobre (lo usa la tienda en el carrusel automático)
 *
 * Cómo «pausa» la pieza mientras el sobre está cerrado: hasta que la persona toca, los
 * setTimeout / setInterval / requestAnimationFrame que pida la pieza se guardan en cola, las
 * animaciones CSS quedan en pausa y las de el.animate() se pausan. Al abrir se sueltan todas.
 * En el video (?video=1) no hace nada: el renderizador controla el tiempo con su reloj virtual.
 * Todo texto que viene del link se pone con textContent (nunca innerHTML).
 */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  if (q.has('video')) return;

  var EN = q.get('lang') === 'en';
  var T = EN ? {
    alguien: 'Someone coded something for you', para: 'For', paraTi: 'For you', abrir: 'Tap to open',
    seAbre: 'Opens in', todavia: 'Not yet', vuelve: 'Come back on', d: 'd', listo: 'It\'s time! Tap to open',
    secreto: 'Secret message · hold to unlock', responder: 'Reply', respuesta: 'I opened it! I loved it <3',
    hecho: 'Made with <3 · Gift one', cerrar: 'Close', sonido: 'Sound', locale: 'en-US'
  } : {
    alguien: 'Alguien te programó algo', para: 'Para', paraTi: 'Para ti', abrir: 'Toca para abrir',
    seAbre: 'Se abre en', todavia: 'Todavía no', vuelve: 'Vuelve el', d: 'd', listo: '¡Ya es hora! Toca para abrir',
    secreto: 'Mensaje secreto · mantén presionado', responder: 'Responder', respuesta: '¡Lo abrí! Me encantó <3',
    hecho: 'Hecho con <3 · Regala uno', cerrar: 'Cerrar', sonido: 'Sonido', locale: 'es-EC'
  };
  var TIENDA = 'https://teprogramealgo.github.io/';
  var corta = function (s, n) { return (s || '').trim().slice(0, n); };
  var PARA = corta(q.get('para'), 40);
  var SECRETO = corta(q.get('secreto'), 300);
  var MUSICA = q.get('musica') !== '0';
  var abreTxt = q.get('abre') || '';
  var ABRE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(abreTxt) ? new Date(abreTxt.length === 10 ? abreTxt + 'T00:00' : abreTxt) : null;
  if (ABRE && isNaN(ABRE)) ABRE = null;
  var clave = 'sp-abierto:' + location.pathname + location.search;
  var yaAbierto = false;
  try { yaAbierto = sessionStorage.getItem(clave) === '1'; } catch (e) {}
  var CON_SOBRE = q.get('sobre') !== '0' && !yaAbierto;

  // ---- relojes originales (la capa los usa siempre; la pieza usa los envueltos) ----
  var W = window;
  var _st = W.setTimeout.bind(W), _si = W.setInterval.bind(W), _raf = W.requestAnimationFrame.bind(W);
  var _animate = Element.prototype.animate;

  /* ---------------- estilos ---------------- */
  var css = [
    'html.sp-espera :not(#sp-capa):not(#sp-capa *){animation-play-state:paused!important}',
    '#sp-capa{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;',
    ' background:radial-gradient(ellipse at 50% 35%,#2a1638 0%,#120a1f 55%,#07050d 100%);color:#ffe9f2;font-family:Quicksand,system-ui,sans-serif;',
    ' text-align:center;padding:24px;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;transition:opacity .8s ease}',
    '#sp-capa.fuera{opacity:0;pointer-events:none}',
    '#sp-capa .sp-chip{font:700 12px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#ff8fb8;',
    ' border:1px solid rgba(255,77,141,.4);background:rgba(255,77,141,.08);padding:8px 12px;border-radius:99px}',
    '#sp-capa .sp-para{font-family:"Dancing Script",cursive;font-weight:700;font-size:clamp(34px,10vw,52px);line-height:1.1;color:#fff;',
    ' text-shadow:0 0 24px rgba(255,77,141,.55);max-width:92vw;overflow-wrap:anywhere}',
    '#sp-capa .sp-para small{display:block;font:600 15px Quicksand,sans-serif;color:#c9b8d6;margin-bottom:2px;text-shadow:none}',
    '.sp-sobre{position:relative;width:min(240px,64vw);aspect-ratio:3/2;perspective:700px;animation:sp-flota 3.2s ease-in-out infinite}',
    '.sp-cuerpo{position:absolute;inset:0;border-radius:10px;background:linear-gradient(160deg,#ffe3ec,#ffc2d6);box-shadow:0 18px 50px rgba(255,77,141,.35),0 0 0 1px rgba(255,255,255,.4) inset;overflow:hidden}',
    '.sp-cuerpo:before,.sp-cuerpo:after{content:"";position:absolute;bottom:0;width:0;height:0;border-bottom:calc(min(240px,64vw)*.42) solid #ffb3cb}',
    '.sp-cuerpo:before{left:0;border-right:calc(min(240px,64vw)*.55) solid transparent}',
    '.sp-cuerpo:after{right:0;border-left:calc(min(240px,64vw)*.55) solid transparent;border-bottom-color:#ffa9c4}',
    '.sp-carta{position:absolute;left:8%;right:8%;top:10%;height:80%;border-radius:6px;background:#fffaf3;box-shadow:0 2px 8px rgba(0,0,0,.12);',
    ' display:grid;place-items:center;font:800 26px "JetBrains Mono",monospace;color:#ff4d8d;transition:transform .9s cubic-bezier(.2,.9,.3,1.2) .35s}',
    '.sp-tapa{position:absolute;left:0;right:0;top:0;height:62%;transform-origin:50% 0;transition:transform .6s ease-in;z-index:2;',
    ' background:linear-gradient(180deg,#ff9fbe,#ff86ad);clip-path:polygon(0 0,100% 0,50% 100%);border-radius:10px 10px 0 0}',
    '.sp-sello{position:absolute;left:50%;top:62%;transform:translate(-50%,-50%);z-index:3;width:54px;height:54px;border-radius:50%;',
    ' background:radial-gradient(circle at 35% 30%,#ff6f9f,#c2185b 70%);box-shadow:0 4px 12px rgba(120,0,40,.45),0 0 0 4px rgba(194,24,91,.35);',
    ' display:grid;place-items:center;font:800 17px "JetBrains Mono",monospace;color:#ffe3ec;transition:transform .35s ease,opacity .35s}',
    '.sp-abierto .sp-sello{transform:translate(-50%,-50%) scale(1.6);opacity:0}',
    '.sp-abierto .sp-tapa{transform:rotateX(180deg);z-index:0}',
    '.sp-abierto .sp-carta{transform:translateY(-55%)}',
    '.sp-abierto.sp-sobre{animation:none}',
    '#sp-capa .sp-boton{font:700 16px Quicksand,sans-serif;color:#1a0d16;background:linear-gradient(90deg,#ffd54a,#ff8fb8);border:0;border-radius:99px;',
    ' padding:14px 26px;box-shadow:0 8px 30px rgba(255,77,141,.35);animation:sp-late 1.6s ease-in-out infinite;cursor:pointer}',
    '#sp-capa .sp-boton[disabled]{background:rgba(255,255,255,.1);color:#d9cde4;box-shadow:none;animation:none;cursor:default}',
    '#sp-capa .sp-cuenta{font:800 clamp(22px,7vw,30px) "JetBrains Mono",monospace;color:#ffd54a;letter-spacing:.02em}',
    '#sp-capa .sp-nota{font-size:14px;color:#bba9c9}',
    '.sp-chispa{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.0;animation:sp-brilla var(--d) ease-in-out infinite;animation-delay:var(--r)}',
    '@keyframes sp-flota{0%,100%{transform:translateY(0) rotate(-1.5deg)}50%{transform:translateY(-10px) rotate(1.5deg)}}',
    '@keyframes sp-late{0%,100%{transform:scale(1)}12%{transform:scale(1.06)}24%{transform:scale(1)}36%{transform:scale(1.04)}}',
    '@keyframes sp-brilla{0%,100%{opacity:0}50%{opacity:.9}}',
    '#sp-lienzo{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483001}',
    '.sp-flot{position:fixed;z-index:2147482990;font-family:Quicksand,system-ui,sans-serif;-webkit-tap-highlight-color:transparent}',
    '#sp-son{left:12px;bottom:14px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.25);background:rgba(10,6,16,.45);',
    ' color:#fff;font-size:16px;cursor:pointer;backdrop-filter:blur(6px);opacity:.75}',
    '#sp-fin{left:50%;top:var(--sp-fin-top,calc(12px + env(safe-area-inset-top)));transform:translate(-50%,-20px);display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;',
    ' pointer-events:none;transition:opacity .9s,transform .9s;width:max-content;max-width:92vw}',
    '#sp-fin.sp-ver{opacity:1;transform:translate(-50%,0);pointer-events:auto}',
    '#sp-fila{display:flex;align-items:center;gap:8px}',
    '#sp-fin a,#sp-fin button{font:700 14px Quicksand,sans-serif;text-decoration:none;cursor:pointer;border-radius:99px}',
    '#sp-resp{color:#1a0d16;background:linear-gradient(90deg,#ffd54a,#ff8fb8);padding:9px 16px;border:0;box-shadow:0 6px 22px rgba(255,77,141,.35)}',
    '#sp-marca{color:rgba(255,255,255,.75);font-size:12px!important;font-weight:600!important;padding:9px 12px;background:rgba(10,6,16,.45);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(6px)}',
    '#sp-candado{position:relative;color:#ffe9f2;background:rgba(20,10,30,.6);border:1px solid rgba(255,213,74,.55);padding:10px 16px 10px 14px;',
    ' backdrop-filter:blur(6px);overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;animation:sp-late 2s ease-in-out infinite}',
    '#sp-candado i{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,rgba(255,213,74,.45),rgba(255,77,141,.45));z-index:-1}',
    '#sp-secreto{position:fixed;inset:0;z-index:2147482995;display:grid;place-items:center;padding:24px;background:rgba(6,3,12,.72);',
    ' backdrop-filter:blur(8px);opacity:0;pointer-events:none;transition:opacity .6s}',
    '#sp-secreto.sp-ver{opacity:1;pointer-events:auto}',
    '#sp-secreto div{max-width:420px;background:linear-gradient(160deg,#fffaf3,#ffe6ef);color:#5a1830;border-radius:18px;padding:28px 24px 22px;',
    ' text-align:center;box-shadow:0 20px 60px rgba(255,77,141,.35);transform:scale(.9);transition:transform .6s cubic-bezier(.2,.9,.3,1.3)}',
    '#sp-secreto.sp-ver div{transform:scale(1)}',
    '#sp-secreto p{font-family:"Dancing Script",cursive;font-weight:700;font-size:clamp(22px,6.4vw,30px);line-height:1.3;white-space:pre-wrap;overflow-wrap:anywhere}',
    '#sp-secreto span{display:block;font:800 13px "JetBrains Mono",monospace;color:#ff4d8d;margin-bottom:12px;letter-spacing:.06em}',
    '#sp-secreto button{margin-top:18px;font:700 14px Quicksand,sans-serif;border:1px solid #ff8fb8;background:none;color:#c2185b;padding:8px 16px;border-radius:99px;cursor:pointer}'
  ].join('\n');
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------------- cola: la pieza espera a que se abra el sobre ---------------- */
  var esperando = CON_SOBRE, cola = [], animPausadas = [];
  if (esperando) {
    document.documentElement.classList.add('sp-espera');
    W.setTimeout = function (fn, ms) {
      if (!esperando) return _st.apply(W, arguments);
      var a = Array.prototype.slice.call(arguments, 2), h = { id: null, vivo: true };
      cola.push(function () { if (h.vivo) h.id = _st.apply(W, [fn, ms].concat(a)); });
      return h;
    };
    W.setInterval = function (fn, ms) {
      if (!esperando) return _si.apply(W, arguments);
      var a = Array.prototype.slice.call(arguments, 2), h = { id: null, vivo: true, int: true };
      cola.push(function () { if (h.vivo) h.id = _si.apply(W, [fn, ms].concat(a)); });
      return h;
    };
    var _ct = W.clearTimeout.bind(W), _ci = W.clearInterval.bind(W);
    W.clearTimeout = function (h) { if (h && typeof h === 'object') { h.vivo = false; if (h.id != null) (h.int ? _ci : _ct)(h.id); } else _ct(h); };
    W.clearInterval = function (h) { W.clearTimeout(h); };
    W.requestAnimationFrame = function (fn) {
      if (!esperando) return _raf(fn);
      cola.push(function () { _raf(fn); });
      return 0;
    };
    Element.prototype.animate = function () {
      var an = _animate.apply(this, arguments);
      if (esperando && !(this.closest && this.closest('#sp-capa'))) { an.pause(); animPausadas.push(an); }
      return an;
    };
  }
  function soltar() {
    if (!esperando) return;
    esperando = false;
    document.documentElement.classList.remove('sp-espera');
    var c = cola; cola = [];
    c.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    animPausadas.forEach(function (a) { try { a.play(); } catch (e) {} });
    animPausadas = [];
    try { sessionStorage.setItem(clave, '1'); } catch (e) {}
  }

  /* ---------------- corazones (al abrir y al tocar la pantalla) ---------------- */
  var lienzo, ctx, parts = [], animando = false;
  function asegurarLienzo() {
    if (lienzo) return;
    lienzo = document.createElement('canvas'); lienzo.id = 'sp-lienzo';
    document.body.appendChild(lienzo); ctx = lienzo.getContext('2d');
    var medir = function () { var r = W.devicePixelRatio || 1; lienzo.width = innerWidth * r; lienzo.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0); };
    medir(); addEventListener('resize', medir);
  }
  function corazon(x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
    ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    ctx.fill();
  }
  var COLORES = ['#ff4d8d', '#ff8fb8', '#ffd54a', '#ffffff', '#ff6f9f'];
  function estallar(x, y, n, fuerza) {
    asegurarLienzo();
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * fuerza;
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - fuerza * 0.6, s: 8 + Math.random() * 14,
        c: COLORES[(Math.random() * COLORES.length) | 0], vida: 0, max: 60 + Math.random() * 50, rot: (Math.random() - 0.5) * 0.4 });
    }
    if (!animando) { animando = true; _raf(pintar); }
  }
  function pintar() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.vida++; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.vx *= 0.985;
      if (p.vida > p.max) { parts.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.vida / p.max);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot * p.vida * 0.1); ctx.fillStyle = p.c;
      corazon(0, -p.s / 2, p.s); ctx.restore();
    }
    if (parts.length) _raf(pintar); else { animando = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  /* ---------------- cajita musical (sintetizada en el momento: original, sin derechos) ---------------- */
  var audio = null, sonando = false, siguiente = 0, paso = 0, master = null;
  // progresión I–V–vi–IV en Do mayor, arpegios que varían al azar: cada apertura suena un poco distinta
  var ACORDES = [[60, 64, 67, 72], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]];
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  function nota(m, t, vol) {
    var f = hz(m);
    [[1, 1], [2, 0.22], [3, 0.08]].forEach(function (h) {
      var o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = f * h[0];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * h[1], t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8 / h[0]);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 2);
    });
  }
  function programar() {
    if (!sonando) return;
    var negra = 0.36;
    while (siguiente < audio.currentTime + 0.6) {
      var ac = ACORDES[Math.floor(paso / 8) % 4], i = paso % 8;
      var m = i === 0 ? ac[0] + 12 : ac[[1, 2, 3, 2, 1, 2, 3][i - 1]] + 12;
      if (i === 0) nota(ac[0], siguiente, 0.05);
      if (Math.random() < 0.18 && i % 2) m += 2;           // adorno
      nota(m + (Math.random() < 0.12 ? 12 : 0), siguiente, 0.06);
      siguiente += negra; paso++;
    }
    _st(programar, 200);
  }
  function encenderMusica() {
    if (!MUSICA) return;
    try {
      var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return;
      audio = audio || new AC();
      if (!master) {
        master = audio.createGain(); master.gain.value = 0.9;
        var eco = audio.createDelay(); eco.delayTime.value = 0.27;
        var reg = audio.createGain(); reg.gain.value = 0.28;
        master.connect(audio.destination); master.connect(eco); eco.connect(reg); reg.connect(eco); reg.connect(audio.destination);
      }
      audio.resume(); sonando = true; siguiente = audio.currentTime + 0.15; programar();
      botonSonido();
    } catch (e) {}
  }
  var bSon = null;
  function botonSonido() {
    if (bSon) return;
    bSon = document.createElement('button'); bSon.id = 'sp-son'; bSon.className = 'sp-flot'; bSon.setAttribute('data-no-video', '');
    bSon.setAttribute('aria-label', T.sonido); bSon.textContent = '🔊';
    bSon.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    bSon.addEventListener('click', function (e) {
      e.stopPropagation();
      sonando = !sonando; bSon.textContent = sonando ? '🔊' : '🔇';
      if (sonando) { audio.resume(); siguiente = audio.currentTime + 0.1; programar(); } else audio.suspend();
    });
    document.body.appendChild(bSon);
  }
  document.addEventListener('visibilitychange', function () {
    if (!audio || !sonando) return;
    if (document.hidden) audio.suspend(); else { audio.resume(); siguiente = audio.currentTime + 0.1; }
  });

  /* ---------------- el sobre ---------------- */
  function chispas(cont) {
    for (var i = 0; i < 40; i++) {
      var s = document.createElement('i'); s.className = 'sp-chispa';
      s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 100 + '%';
      s.style.setProperty('--d', (2 + Math.random() * 3) + 's'); s.style.setProperty('--r', (-Math.random() * 4) + 's');
      cont.appendChild(s);
    }
  }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function montarSobre() {
    var capa = el('div'); capa.id = 'sp-capa'; capa.setAttribute('role', 'button'); capa.setAttribute('data-no-video', '');
    chispas(capa);
    var chip = el('div', 'sp-chip', '💌 ' + T.alguien);
    var sobre = el('div', 'sp-sobre');
    var cuerpo = el('div', 'sp-cuerpo'); var carta = el('div', 'sp-carta', '<3');
    sobre.appendChild(carta); sobre.appendChild(cuerpo); sobre.appendChild(el('div', 'sp-tapa')); sobre.appendChild(el('div', 'sp-sello', '<3'));
    var para = el('div', 'sp-para');
    if (PARA) { para.appendChild(el('small', '', T.para)); para.appendChild(document.createTextNode(PARA)); } else para.textContent = T.paraTi;
    var boton = el('button', 'sp-boton', T.abrir); boton.type = 'button';
    var cuenta = el('div', 'sp-cuenta'), nota = el('div', 'sp-nota');
    [chip, sobre, para, cuenta, boton, nota].forEach(function (n) { capa.appendChild(n); });
    document.body.appendChild(capa);

    var bloqueado = false;
    function revisarFecha() {
      if (!ABRE) { cuenta.remove(); nota.remove(); return; }
      var falta = ABRE - Date.now();
      if (falta <= 0) {
        if (bloqueado) { bloqueado = false; boton.disabled = false; boton.textContent = T.listo; cuenta.remove(); nota.remove(); estallar(innerWidth / 2, innerHeight / 2, 30, 7); }
        else { cuenta.remove(); nota.remove(); }
        return;
      }
      bloqueado = true; boton.disabled = true; boton.textContent = '🔒 ' + T.todavia;
      var s = Math.floor(falta / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      var dos = function (n) { return (n < 10 ? '0' : '') + n; };
      cuenta.textContent = (d ? d + T.d + ' ' : '') + dos(h) + ':' + dos(m) + ':' + dos(x);
      nota.textContent = T.vuelve + ' ' + ABRE.toLocaleDateString(T.locale, { weekday: 'long', day: 'numeric', month: 'long' }) + ' 💛';
      _st(revisarFecha, 1000);
    }
    revisarFecha();

    var abierto = false;
    function abrir(e) {
      if (e) { e.stopPropagation(); e.preventDefault(); }
      if (abierto || bloqueado) return;
      abierto = true;
      encenderMusica();                                   // el toque permite que suene el audio
      try { navigator.vibrate && navigator.vibrate([40, 70, 90]); } catch (er) {}
      sobre.classList.add('sp-abierto');
      var r = sobre.getBoundingClientRect();
      _st(function () { estallar(r.left + r.width / 2, r.top + r.height * 0.4, 46, 8); }, 250);
      _st(function () { capa.classList.add('fuera'); soltar(); }, 1300);
      _st(function () { capa.remove(); }, 2200);
    }
    capa.addEventListener('pointerdown', abrir);
    capa.addEventListener('click', function (e) { e.stopPropagation(); });
    capa.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') abrir(e); });
  }

  /* ---------------- final: secreto, responder, marca ---------------- */
  function montarFinal() {
    var fin = el('div', 'sp-flot'); fin.id = 'sp-fin'; fin.setAttribute('data-no-video', '');
    var parar = function (n) { n.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); n.addEventListener('click', function (e) { e.stopPropagation(); }); };
    if (SECRETO) {
      var cand = el('button'); cand.id = 'sp-candado'; cand.type = 'button';
      var barra = el('i'); cand.appendChild(barra); cand.appendChild(document.createTextNode('🔒 ' + T.secreto));
      var hoja = el('div'); hoja.id = 'sp-secreto';
      var tarjeta = el('div'); tarjeta.appendChild(el('span', '', '🔓 ' + (EN ? 'SECRET MESSAGE' : 'MENSAJE SECRETO')));
      tarjeta.appendChild(el('p', '', SECRETO));
      var cerrar = el('button', '', T.cerrar); cerrar.type = 'button'; tarjeta.appendChild(cerrar);
      hoja.appendChild(tarjeta); document.body.appendChild(hoja); parar(hoja);
      cerrar.addEventListener('click', function (e) { e.stopPropagation(); hoja.classList.remove('sp-ver'); });
      var inicio = 0, rafId = 0, manteniendo = false;
      var avanzar = function (now) {
        if (!manteniendo) return;
        var p = Math.min((now - inicio) / 1300, 1); barra.style.width = (p * 100) + '%';
        if (p < 1) rafId = _raf(avanzar);
        else {
          manteniendo = false; barra.style.width = '0';
          try { navigator.vibrate && navigator.vibrate([30, 40, 30, 40, 120]); } catch (er) {}
          hoja.classList.add('sp-ver'); estallar(innerWidth / 2, innerHeight / 2, 40, 7);
        }
      };
      cand.addEventListener('pointerdown', function (e) { e.stopPropagation(); e.preventDefault(); manteniendo = true; inicio = performance.now(); rafId = _raf(avanzar); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { cand.addEventListener(ev, function () { manteniendo = false; barra.style.width = '0'; }); });
      cand.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      cand.addEventListener('click', function (e) { e.stopPropagation(); });
      fin.appendChild(cand);
    }
    var resp = el('a', '', '💌 ' + T.responder); resp.id = 'sp-resp';
    resp.href = 'https://wa.me/?text=' + encodeURIComponent(T.respuesta); resp.target = '_blank'; resp.rel = 'noopener';
    var marca = el('a', '', T.hecho); marca.id = 'sp-marca'; marca.href = TIENDA + (EN ? '?lang=en' : ''); marca.target = '_blank'; marca.rel = 'noopener';
    var fila = el('div'); fila.id = 'sp-fila';
    fila.appendChild(resp); fila.appendChild(marca);
    fin.insertBefore(fila, fin.firstChild);
    parar(resp); parar(marca);
    document.body.appendChild(fin);

    // aparece cuando la pieza muestra su botón «Ver de nuevo» (cada pieza lo hace al terminar)
    var rep = document.getElementById('repetir');
    var mostrar = function () { fin.classList.add('sp-ver'); if (SECRETO) estallar(innerWidth / 2, innerHeight - 90, 14, 4); };
    if (rep) {
      var ob = new MutationObserver(function () { if (rep.classList.contains('visible')) { ob.disconnect(); _st(mostrar, 900); } });
      ob.observe(rep, { attributes: true, attributeFilter: ['class'] });
    } else _st(mostrar, 15000);
  }

  function iniciar() {
    if (CON_SOBRE) montarSobre();
    montarFinal();
    // corazones donde toque (también sobre la pieza; no bloquea sus botones)
    addEventListener('pointerdown', function (e) {
      if (esperando || (e.target && e.target.closest && e.target.closest('#sp-fin,#sp-son,#sp-secreto'))) return;
      estallar(e.clientX, e.clientY, 9, 4.5);
    }, true);
    if (!CON_SOBRE && MUSICA) {
      // sin sobre (p. ej. al darle «Ver de nuevo»): la música arranca con el primer toque
      addEventListener('pointerdown', function una() { removeEventListener('pointerdown', una, true); encenderMusica(); }, true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
