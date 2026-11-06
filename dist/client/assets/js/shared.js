/* ==========================================================================
   GC shared engine - Lenis + GSAP wiring, loader, ink transition, cursor,
   chapters, nav/menu, reveals, scrub, offset type, scramble, bands, carousel.
   Plain deferred script. Every library is optional; each behaviour is isolated.
   ========================================================================== */
(function () {
  'use strict';

  var D = document, H = D.documentElement, W = window;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(pointer:fine)').matches && matchMedia('(hover:hover)').matches;
  var IO_EASE = 'cubic-bezier(.7,0,.2,1)';
  var hasGsap = !!W.gsap, hasST = hasGsap && !!W.ScrollTrigger;
  if (!hasGsap) H.classList.remove('motion');
  var motion = hasGsap && H.classList.contains('motion') && !reduced;
  if (hasST) gsap.registerPlugin(ScrollTrigger);

  function safe(name, fn) { try { fn(); } catch (e) { console.error('[GC] ' + name, e); } }
  function el(tag, cls) { var n = D.createElement(tag); if (cls) n.className = cls; return n; }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function store(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- shared ticker (one rAF for every lerp) ---------- */
  var ticks = [], lenis = null, pointer = { x: -1, y: -1, active: false };
  function runTicks(dt) { for (var i = 0; i < ticks.length; i++) { try { ticks[i](dt); } catch (e) { console.error('[GC] tick', e); } } }
  function addTick(fn) { ticks.push(fn); return function () { var i = ticks.indexOf(fn); if (i > -1) ticks.splice(i, 1); }; }
  if (hasGsap) gsap.ticker.add(function (t, dt) { runTicks(Math.min(dt || 16.7, 50)); });
  else (function () { var last = performance.now(); (function loop(now) { runTicks(Math.min(now - last, 50)); last = now; requestAnimationFrame(loop); })(last); })();
  var lerpK = function (k, dt) { return 1 - Math.pow(1 - k, dt / 16.7); };

  /* ---------- Lenis ---------- */
  safe('lenis', function () {
    if (!W.Lenis || reduced) return;
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasST) lenis.on('scroll', ScrollTrigger.update);
    if (hasGsap) { gsap.ticker.add(function (t) { lenis.raf(t * 1000); }); gsap.ticker.lagSmoothing(0); }
    else addTick(function () { lenis.raf(performance.now()); });
    W.__lenis = lenis;
  });

  /* ---------- ready gate ---------- */
  var isReady = false, readyCbs = [];
  function ready() {
    if (isReady) return; isReady = true; H.classList.add('gc-ready');
    readyCbs.splice(0).forEach(function (f) { safe('onReady', f); });
    D.dispatchEvent(new Event('gc:ready'));
  }
  function onReady(fn) { if (isReady) safe('onReady', fn); else readyCbs.push(fn); }

  /* ---------- text helpers ---------- */
  function splitWords(root, make) {
    var out = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = D.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) frag.appendChild(D.createTextNode(p));
            else { var s = make(p); frag.appendChild(s); out.push(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR' && !n.hasAttribute('aria-hidden')) walk(n);
      });
    })(root);
    return out;
  }
  var CS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function rc() { return CS.charAt(Math.random() * CS.length | 0); }

  /* entrance scramble into new text (E25) */
  function scrambleTo(node, text) {
    if (node.__sc) clearInterval(node.__sc);
    if (reduced) { node.textContent = text; return; }
    var pos = 0, len = text.length;
    node.__sc = setInterval(function () {
      pos += 0.5; var i = Math.floor(pos);
      if (i >= len) { clearInterval(node.__sc); node.__sc = 0; node.textContent = text; return; }
      var out = text.slice(0, i);
      for (var j = i; j < Math.min(len, i + 3); j++) out += text.charAt(j) === ' ' ? ' ' : rc();
      node.textContent = out;
    }, 25);
  }

  /* ---------- fitting: monuments sized to the width of their container ---------- */
  function fitAll() {
    $$('[data-fit],.foot__name,.cta__title').forEach(function (n) {
      var p = n.parentElement, cs = getComputedStyle(p);
      var ns = getComputedStyle(n);
      var avail = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (parseFloat(ns.marginLeft) || 0) - (parseFloat(ns.marginRight) || 0);
      var factor = parseFloat(n.getAttribute('data-fit')) || 1;
      var pad = n.hasAttribute('data-offset-type') ? 0.14 : 0;
      n.style.fontSize = '100px';
      var rg = D.createRange(); rg.selectNodeContents(n);
      var w = rg.getBoundingClientRect().width - (parseFloat(getComputedStyle(n).letterSpacing) || 0); // text width, not the block width; the last glyph's negative tracking is ink the range misses
      if (!w) return;
      var fs = avail * factor / (w / 100 + pad);
      var maxVw = n.classList.contains('cta__title') ? 11 : parseFloat(n.getAttribute('data-fit-max'));
      if (maxVw) fs = Math.min(fs, H.clientWidth * maxVw / 100);
      n.style.fontSize = fs.toFixed(2) + 'px';
    });
  }
  var fitT;
  function fitSoon() { clearTimeout(fitT); fitT = setTimeout(fitAll, 80); }

  /* ---------- chapters ---------- */
  var CHAPTER_COLOR = { night: '#0c0e0b', bone: '#e9e3d6', field: '#10281b', ember: '#ff6a3d' };
  function initChapters() {
    var secs = $$('[data-chapter]'); if (!secs.length) return;
    var meta = $('meta[name="theme-color"]');
    if (!meta) { meta = el('meta'); meta.name = 'theme-color'; D.head.appendChild(meta); }
    var snapRaf = 0, lastY = W.scrollY, first = true;
    // colours jump (no blend) for two frames when the page jumped or on the first apply; smooth scrolling keeps the animated blend
    function snap() { H.classList.add('chapter-snap'); cancelAnimationFrame(snapRaf); snapRaf = requestAnimationFrame(function () { snapRaf = requestAnimationFrame(function () { H.classList.remove('chapter-snap'); }); }); }
    function set(c, instant) {
      if (!CHAPTER_COLOR[c] || H.getAttribute('data-chapter') === c) return;
      if (instant) snap();
      H.setAttribute('data-chapter', c); meta.setAttribute('content', CHAPTER_COLOR[c]);
    }
    // the chapter under the viewport centre line; at the very bottom, the last one (the footer)
    function update() {
      var y = W.scrollY, jump = first || Math.abs(y - lastY) > innerHeight * 0.8; lastY = y; first = false;
      var mid = innerHeight / 2, cur = secs[0];
      if (y + innerHeight >= D.documentElement.scrollHeight - 2) cur = secs[secs.length - 1];
      else secs.forEach(function (s) { if (s.getBoundingClientRect().top <= mid) cur = s; });
      set(cur.getAttribute('data-chapter'), jump);
    }
    update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    addEventListener('load', update);
    D.addEventListener('gc:ready', update);
  }

  /* ---------- nav + menu ---------- */
  var menuOpen = false, closeMenu = function () {};
  function initNav() {
    var nav = $('[data-nav]') || $('.nav'); if (!nav) return;
    var last = 0;
    function onScroll() {
      var y = W.scrollY; nav.classList.toggle('is-solid', y > 40);
      if (!menuOpen) { if (y > 140 && y > last + 4) nav.classList.add('is-hidden'); else if (y < last - 4 || y < 140) nav.classList.remove('is-hidden'); }
      last = y;
    }
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });

    var btn = $('.nav__menu', nav), menu = $('#menu'); if (!btn || !menu) return;
    var links = $$('a', menu), trap = [btn].concat(links), hideT;
    $$('.menu__links a', menu).forEach(function (a, i) {
      a.style.setProperty('--i', i);
      if (!$('.menu__t', a)) a.innerHTML = '<span class="menu__t">' + a.innerHTML + '</span>';
    });
    var meta = $('.menu__meta', menu); // pages may paste the short markup: complete it with LinkedIn and the sun line
    if (meta) {
      if (!$('[data-sunline]', meta)) meta.insertAdjacentHTML('beforeend', '<span data-sunline></span>');
      if (!$('a[href*="linkedin"]', meta)) meta.insertAdjacentHTML('afterbegin', '<a href="https://www.linkedin.com/in/georgichertkov/" target="_blank" rel="noopener">LinkedIn</a>');
      links = $$('a', menu); trap = [btn].concat(links);
    }
    menu.setAttribute('data-lenis-prevent', '');
    function open() {
      if (menuOpen) return; menuOpen = true; clearTimeout(hideT);
      var night = H.getAttribute('data-chapter') === 'ember'; // never the same colour as the section underneath
      menu.setAttribute('data-tone', night ? 'night' : 'ember'); H.classList.toggle('is-menu-night', night);
      menu.hidden = false; void menu.offsetWidth; menu.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true'); btn.textContent = 'Close'; H.classList.add('is-menu');
      if (lenis) lenis.stop(); else H.style.overflow = 'hidden';
      setTimeout(function () { if (links[0]) links[0].focus({ preventScroll: true }); }, 60);
    }
    closeMenu = function (refocus) {
      if (!menuOpen) return; menuOpen = false;
      menu.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); btn.textContent = 'Menu'; H.classList.remove('is-menu'); setTimeout(function () { if (!menuOpen) H.classList.remove('is-menu-night'); }, 780);
      if (lenis) lenis.start(); else H.style.overflow = '';
      hideT = setTimeout(function () { menu.hidden = true; }, 780);
      if (refocus) btn.focus({ preventScroll: true });
    };
    btn.addEventListener('click', function () { menuOpen ? closeMenu(true) : open(); });
    D.addEventListener('keydown', function (e) {
      if (!menuOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') {
        var i = trap.indexOf(D.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); trap[trap.length - 1].focus(); }
        else if (!e.shiftKey && i === trap.length - 1) { e.preventDefault(); trap[0].focus(); }
      }
    });
    addEventListener('resize', function () { if (innerWidth > 900) closeMenu(false); });
  }

  /* ---------- live bits: year, clock, sunline, nav sun glyph ---------- */
  function liveBits() {
    var S = W.Sun, now = S && S.now ? S.now() : new Date();
    function clockStr(d) {
      if (S && S.clock) return S.clock(d);
      var t = new Date(d.getTime() - 7 * 3600e3), h = t.getUTCHours(), m = t.getUTCMinutes();
      return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'am' : 'pm');
    }
    $$('[data-clock]').forEach(function (n) { n.textContent = clockStr(now); });
    $$('[data-year]').forEach(function (n) { n.textContent = new Date().getFullYear(); });
    if (!S || !S.position) return;
    var p = S.position(now), line = p.elevation >= 0
      ? 'sun ' + Math.round(p.elevation) + '° above the horizon, ' + (S.compass ? S.compass(p.azimuth) : '')
      : 'sun ' + Math.round(-p.elevation) + '° below the horizon';
    $$('[data-sunline]').forEach(function (n) { n.textContent = line.replace(/, $/, ''); });
    var dot = $('.sunmark__sun');
    if (dot && S.times) {
      var t = S.times(now), f = (now - t.sunrise) / (t.sunset - t.sunrise), up = f >= 0 && f <= 1; f = clamp(f, 0, 1);
      dot.setAttribute('cx', (14 - 12 * Math.cos(Math.PI * f)).toFixed(2));
      dot.setAttribute('cy', (14 - 12 * Math.sin(Math.PI * f)).toFixed(2));
      dot.style.opacity = up ? 1 : 0.4;
    }
  }

  /* ---------- CTA: the e-mail address is the action; Copy copies it ---------- */
  function initCta() {
    $$('.cta__base').forEach(function (base) {
      var old = $('a.btn[href^="mailto:"]', base), mail = old || $('a.cta__mail', base); if (!mail) return;
      var addr = mail.getAttribute('href').replace(/^mailto:/, '').split('?')[0];
      if (old) { // short contract markup -> poster markup
        var made = el('div', 'cta__act');
        made.innerHTML = '<a class="cta__mail link-u" href="mailto:' + esc(addr) + '" data-roll>' + esc(addr) + '</a>';
        base.replaceChild(made, old);
      }
      var act = $('.cta__act', base);
      if (!$('.cta__copy', act)) act.insertAdjacentHTML('beforeend', '<button class="btn cta__copy" type="button" data-copy="' + esc(addr) + '"><span class="btn__label">Copy</span></button>');
      var b = $('.cta__copy', act), lab = $('.btn__label', b), t;
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-copy') || addr;
        function done() { b.classList.add('is-done'); scrambleTo(lab, 'Copied'); clearTimeout(t); t = setTimeout(function () { b.classList.remove('is-done'); scrambleTo(lab, 'Copy'); }, 2000); }
        function fallback() { var ta = el('textarea'); ta.value = v; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0'; D.body.appendChild(ta); ta.select(); try { D.execCommand('copy'); } catch (e) { /* manual copy still possible from the visible address */ } D.body.removeChild(ta); done(); }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, fallback); else fallback();
      });
    });
  }

  /* ---------- text roll + scramble + magnetic ---------- */
  function initButtons() {
    $$('.btn__arr').forEach(function (a) { if (a.textContent.indexOf('↗') > -1) a.classList.add('btn__arr--ne'); });
    if (reduced) return;
    $$('[data-roll]').forEach(function (n) {
      var t = n.textContent; n.classList.add('is-roll');
      n.innerHTML = '<span class="roll__in"><span>' + esc(t) + '</span><span aria-hidden="true">' + esc(t) + '</span></span>';
    });
    $$('[data-scramble]').forEach(function (n) {
      var orig = n.textContent, iv = 0;
      function stop() { clearInterval(iv); iv = 0; n.textContent = orig; n.style.minWidth = ''; }
      n.addEventListener('pointerenter', function (e) {
        if (e.pointerType === 'touch' || iv) return;
        n.style.minWidth = n.offsetWidth + 'px'; n.style.display = 'inline-block';
        if (n.matches('a,button')) n.setAttribute('aria-label', orig);
        var f = 0;
        iv = setInterval(function () {
          f++; var rev = Math.floor(f / 4), out = '';
          for (var i = 0; i < orig.length; i++) out += (i < rev || orig.charAt(i) === ' ') ? orig.charAt(i) : rc();
          n.textContent = out; if (rev >= orig.length) stop();
        }, 25);
      });
      n.addEventListener('pointerleave', function () { if (iv) stop(); });
    });
    if (!fine) return;
    var mags = $$('[data-magnetic]').map(function (n) { return { n: n, x: 0, y: 0 }; });
    if (!mags.length) return;
    addEventListener('pointermove', function (e) {
      mags.forEach(function (m) {
        var r = m.n.getBoundingClientRect(), cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y;
        var near = Math.abs(e.clientX - cx) < r.width / 2 + 40 && Math.abs(e.clientY - cy) < r.height / 2 + 40;
        var x = near ? (e.clientX - cx) * 0.22 : 0, y = near ? (e.clientY - cy) * 0.32 : 0;
        if (x !== m.x || y !== m.y) { m.x = x; m.y = y; m.n.style.translate = x.toFixed(1) + 'px ' + y.toFixed(1) + 'px'; }
      });
    }, { passive: true });
  }

  /* ---------- tilt + spotlight ---------- */
  function initTilt() {
    if (!fine || reduced) return;
    $$('[data-tilt]').forEach(function (n) {
      var phone = n.getAttribute('data-tilt') === 'phone', s = { cx: 0, cy: 0, tx: 0, ty: 0 }, k = phone ? 0.06 : 0.12;
      if (phone) addEventListener('pointermove', function (e) { s.tx = e.clientX / innerWidth - 0.5; s.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
      else {
        n.addEventListener('pointermove', function (e) { var r = n.getBoundingClientRect(); s.tx = (e.clientX - r.left) / r.width - 0.5; s.ty = (e.clientY - r.top) / r.height - 0.5; });
        n.addEventListener('pointerleave', function () { s.tx = 0; s.ty = 0; });
      }
      var rest = true;
      addTick(function (dt) {
        var a = lerpK(k, dt); s.cx += (s.tx - s.cx) * a; s.cy += (s.ty - s.cy) * a;
        if (Math.abs(s.tx - s.cx) < 5e-4 && Math.abs(s.ty - s.cy) < 5e-4) { if (rest) return; s.cx = s.tx; s.cy = s.ty; rest = true; } else rest = false;
        n.style.transform = phone
          ? 'perspective(1400px) rotateY(' + (s.cx * 18).toFixed(3) + 'deg) rotateX(' + (-s.cy * 14).toFixed(3) + 'deg)'
          : 'perspective(1100px) rotateY(' + (s.cx * 14).toFixed(3) + 'deg) rotateX(' + (-s.cy * 14).toFixed(3) + 'deg)';
      });
    });
  }
  function initSpot() {
    if (!fine) return;
    $$('[data-spot]').forEach(function (n) {
      n.addEventListener('pointermove', function (e) { var r = n.getBoundingClientRect(); n.style.setProperty('--mx', (e.clientX - r.left) + 'px'); n.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
  }

  /* ---------- cursor ---------- */
  function initCursor() {
    if (!fine) return;
    var dot = el('div', 'cursor-dot'), ring = el('div', 'cursor-ring');
    dot.setAttribute('aria-hidden', 'true'); ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = '<div class="cursor-ring__s"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="47"/></svg><i class="cursor-ring__fill"></i></div>' +
      '<span class="cursor-ring__label"></span>' +
      '<div class="cursor-ring__ret"><svg viewBox="0 0 120 120"><g class="ret-spin"><circle cx="60" cy="60" r="58" stroke-dasharray="3 5"/></g><circle cx="60" cy="60" r="26"/><path d="M60 2v10M60 108v10M2 60h10M108 60h10"/><circle class="ret-dot" cx="60" cy="60" r="2.5"/></svg></div>';
    D.body.appendChild(dot); D.body.appendChild(ring);
    H.classList.add('has-cursor');
    var label = $('.cursor-ring__label', ring), mx = -200, my = -200, rx = -200, ry = -200, on = false, mode = '', txt = '';
    function setMode(m, t) {
      if (m !== mode) {
        ['is-link', 'is-label', 'is-lens'].forEach(function (c) { ring.classList.remove(c); }); dot.classList.toggle('is-lens', m === 'lens');
        if (m) ring.classList.add('is-' + m); mode = m;
      }
      if (m === 'label' && t !== txt) { txt = t; label.textContent = t; }
    }
    function show(v) { on = v; dot.classList.toggle('is-on', v); ring.classList.toggle('is-on', v); }
    addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      mx = e.clientX; my = e.clientY; pointer.x = mx; pointer.y = my; pointer.active = true;
      if (!on) { rx = mx; ry = my; show(true); }
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      var t = e.target; if (!t || !t.closest) return;
      var lab = t.closest('[data-cursor]'), name = lab && lab.getAttribute('data-cursor');
      if (name) setMode('label', name);
      else if (lab || t.closest('a,button,[role="button"],[role="slider"],summary,label')) setMode('link');
      else if (t.closest('[data-cursor-mode="lens"]')) setMode('lens');
      else setMode('');
    }, { passive: true });
    H.addEventListener('mouseleave', function () { show(false); pointer.active = false; });
    D.addEventListener('mouseout', function (e) { if (!e.relatedTarget) { show(false); pointer.active = false; } });
    addEventListener('blur', function () { show(false); });
    D.addEventListener('visibilitychange', function () { if (D.hidden) show(false); });
    addEventListener('pointerdown', function () { ring.classList.add('is-down'); });
    addEventListener('pointerup', function () { ring.classList.remove('is-down'); });
    addTick(function (dt) {
      var a = reduced ? 1 : lerpK(0.16, dt); rx += (mx - rx) * a; ry += (my - ry) * a;
      ring.style.transform = 'translate3d(' + rx.toFixed(1) + 'px,' + ry.toFixed(1) + 'px,0)';
    });
  }

  /* ---------- reveals, rules, counts, scrub, offset type ---------- */
  function initSplits() {
    if (!motion) return;
    $$('[data-reveal="lines"]').forEach(function (n) {
      var ws = splitWords(n, function (p) { var w = el('span', 'w'), i = el('i'); i.textContent = p; w.appendChild(i); return w; });
      gsap.set(ws.map(function (w) { return w.firstChild; }), { yPercent: 110 });
      n.classList.add('is-split');
    });
  }
  function playReveal(n, delay, instant) {
    var v = n.getAttribute('data-reveal') || 'up'; n.classList.add('is-in');
    var d = instant ? 0 : delay || 0;
    if (v === 'lines') { var ws = $$('.w>i', n); if (instant) gsap.set(ws, { yPercent: 0 }); else gsap.to(ws, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.035, delay: d }); }
    else if (instant) gsap.set(n, { clearProps: 'all' });
    else if (v === 'wipe') gsap.fromTo(n, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'expo.inOut', delay: d, clearProps: 'clipPath' });
    else gsap.fromTo(n, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', delay: d, clearProps: 'opacity,transform' });
  }
  function initCounts() {
    $$('[data-count]').forEach(function (n) {
      var to = parseFloat(n.getAttribute('data-count')), from = parseFloat(n.getAttribute('data-from')) || 0, dec = parseInt(n.getAttribute('data-dec') || '0', 10);
      var pre = n.getAttribute('data-pre') || '', suf = n.getAttribute('data-suf') || '';
      var fmt = function (v) { return pre + v.toFixed(dec) + suf; };
      n.textContent = motion ? fmt(from) : fmt(to);
      n.__play = function () { var o = { v: from }; gsap.to(o, { v: to, duration: 2.2, delay: 0.2, ease: 'expo.out', onUpdate: function () { n.textContent = fmt(o.v); } }); };
    });
  }
  function startObservers() {
    if (!motion) return;
    var items = [];
    $$('[data-reveal]').forEach(function (n) { if (!n.closest('[data-reveal-group]')) items.push(n); });
    $$('[data-reveal-group]').forEach(function (n) { items.push(n); });
    $$('[data-rule]').forEach(function (n) { items.push(n); });
    $$('[data-count]').forEach(function (n) { if (n.__play) items.push(n); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var n = e.target, past = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (!e.isIntersecting && !past) return;
        io.unobserve(n);
        if (n.hasAttribute('data-reveal-group')) {
          $$('[data-reveal]', n).forEach(function (c, i) { playReveal(c, i * 0.07, past); });
          if (n.hasAttribute('data-reveal')) playReveal(n, 0, past);
        } else if (n.hasAttribute('data-rule')) { n.classList.add('is-in'); if (!past) gsap.fromTo(n, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: 'expo.inOut', clearProps: 'transform' }); }
        else if (n.__play) { if (past) n.__play(); else n.__play(); }
        else playReveal(n, 0, past);
      });
    }, { rootMargin: '0px 0px -12% 0px' });
    items.forEach(function (n) { io.observe(n); });
  }
  function initScrub() {
    if (!motion || !hasST) return;
    $$('[data-scrub]').forEach(function (n) {
      var ws = splitWords(n, function (p) { var s = el('span', 'sw'); s.textContent = p; return s; }); if (!ws.length) return;
      var each = 0.35, tl = gsap.timeline({ scrollTrigger: { trigger: n, start: 'top 80%', end: 'bottom 45%', scrub: true } });
      tl.fromTo(ws, { opacity: 0.16 }, { opacity: 1, duration: 1, ease: 'none', stagger: each }, 0);
      ws.forEach(function (w, i) { if (w.closest('mark')) tl.fromTo(w, { '--p': 0 }, { '--p': 1, duration: 1, ease: 'none' }, i * each); });
    });
  }
  function initOffset() {
    var items = [];
    $$('[data-offset-type]').forEach(function (n) {
      var inner = n.innerHTML;
      [1, 2, 3].forEach(function (i) { var s = el('span', 'ot ot--' + i); s.setAttribute('aria-hidden', 'true'); s.innerHTML = inner; n.appendChild(s); });
      if (!motion || !hasST) return;
      var st = { n: n, p: 0, vis: false, ox: 0.7071, oy: 0.7071, k: -1 };
      n.style.setProperty('--k', 0);
      ScrollTrigger.create({ trigger: n, start: 'top 85%', end: 'top 35%', scrub: true, onUpdate: function (s) { st.p = s.progress; }, onToggle: function (s) { st.vis = s.isActive || s.progress >= 1; } });
      st.p = 0; items.push(st);
    });
    if (!items.length) return;
    addTick(function (dt) {
      var a = lerpK(0.08, dt);
      items.forEach(function (st) {
        var tx = 0.7071, ty = 0.7071;
        if (fine && pointer.active) { var r = st.n.getBoundingClientRect(), dx = pointer.x - (r.left + r.width / 2), dy = pointer.y - (r.top + r.height / 2), l = Math.hypot(dx, dy); if (l > 1) { tx = dx / l; ty = dy / l; } }
        st.ox += (tx - st.ox) * a; st.oy += (ty - st.oy) * a;
        var k = 0.045 * st.p;
        st.n.style.setProperty('--ox', st.ox.toFixed(3)); st.n.style.setProperty('--oy', st.oy.toFixed(3)); st.n.style.setProperty('--k', k.toFixed(4));
      });
    });
  }

  /* ---------- bands ---------- */
  function initBands() {
    $$('.band__group').forEach(function (g) { if (g.parentNode.querySelectorAll('.band__group').length === 1) { var c = g.cloneNode(true); c.setAttribute('aria-hidden', 'true'); g.parentNode.appendChild(c); } });
    if (!hasGsap || reduced) return;
    var all = [], hover = false, cur = 1, lastY = W.scrollY;
    $$('.bands').forEach(function (bs) {
      var items = $$('.band', bs).map(function (b) { return { b: b, tw: null }; }), vis = true;
      function build() {
        if (bs.classList.contains('is-svg')) return;
        items.forEach(function (it) {
          var prog = it.tw ? it.tw.progress() : Math.random();
          if (it.tw) it.tw.kill();
          var gs = $$('.band__group', it.b), cs = getComputedStyle(it.b);
          var w = gs[0].offsetWidth + (parseFloat(cs.columnGap) || 0), dur = parseFloat(cs.getPropertyValue('--dur')) || 60, rev = it.b.classList.contains('band--rev');
          gsap.set(gs, { x: 0 });
          it.tw = gsap.fromTo(gs, { x: rev ? -w : 0 }, { x: rev ? 0 : -w, duration: dur, ease: 'none', repeat: -1 }).progress(prog).paused(!vis);
        });
        bs.classList.add('is-gsap');
      }
      build();
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting; items.forEach(function (it) { it.tw.paused(!vis); }); }).observe(bs);
      bs.addEventListener('pointerenter', function () { hover = true; }); bs.addEventListener('pointerleave', function () { hover = false; });
      bs.addEventListener('focusin', function () { hover = true; }); bs.addEventListener('focusout', function () { hover = false; });
      bs.__kill = function () { items.forEach(function (it) { if (it.tw) it.tw.kill(); }); };
      all.push({ build: build, items: items });
    });
    if (!all.length) return;
    var rt; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { all.forEach(function (o) { o.build(); }); }, 200); });
    addTick(function (dt) {
      var v = lenis ? lenis.velocity : (W.scrollY - lastY) / (dt / 16.7); lastY = W.scrollY;
      var target = hover ? 0 : 1 + Math.min(Math.abs(v || 0) * 0.04, 3);
      cur += (target - cur) * lerpK(0.08, dt);
      all.forEach(function (o) { o.items.forEach(function (it) { it.tw.timeScale(cur); }); });
    });
  }

  /* ---------- bands as contour labels: text flows along a gently curving tape (inline svg) ----------
     progressive: the HTML band stays as the no-JS fallback and is hidden only once the svg exists */
  var NS = 'http://www.w3.org/2000/svg', SEP = '  •  ', bandSeq = 0, bandSets = [];
  function sv(tag, attrs, parent) { var n = D.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function enhanceBands() {
    if (!W.SVGTextContentElement || !D.createElementNS) return;
    var boost = 1, lastY = W.scrollY;
    $$('.bands').forEach(function (bs) {
      var tapes = $$('.band', bs).map(function (b) {
        var g = $('.band__group', b); if (!g) return null;
        var cs = getComputedStyle(b), parts = [''];
        Array.prototype.forEach.call(g.childNodes, function (n) { if (n.nodeType === 1 && n.classList.contains('band__sun')) parts.push(''); else parts[parts.length - 1] += n.textContent; });
        var words = parts.map(function (t) { return t.replace(/\s+/g, ' ').trim().toUpperCase(); }).filter(Boolean);
        if (!words.length) return null;
        return { words: words, rev: b.classList.contains('band--rev'), dur: parseFloat(cs.getPropertyValue('--dur')) || 60,
          bg: cs.getPropertyValue('--band-bg').trim() || cs.backgroundColor, ink: cs.getPropertyValue('--band-ink').trim() || cs.color, ph: Math.random() };
      }).filter(Boolean);
      if (!tapes.length) return;
      var svg = null, vis = true, hover = false, shown = false;
      function build() {
        var w = bs.clientWidth; if (w < 120) return;
        var old = svg; if (old) tapes.forEach(function (t) { if (t.period) t.ph = t.pos / t.period; });
        var mob = w < 640, fs = clamp(w * (mob ? 0.095 : 0.045), 26, 72), T = fs * 1.3, n = tapes.length;
        var A = n > 1 ? Math.max(w * 0.035, T * 1.5) : w * (mob ? 0.05 : 0.04); // steep enough that crossed tapes only overlap in a short X
        var h = Math.ceil(2.3 * A + T + fs * 0.4), ym = h / 2, x0 = -fs * 2, x1 = w + fs * 2;
        var next = sv('svg', { 'class': 'band-svg', viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, focusable: 'false' });
        if (bs.getAttribute('aria-hidden') === 'true') next.setAttribute('aria-hidden', 'true');
        else { next.setAttribute('role', 'img'); next.setAttribute('aria-label', bs.getAttribute('aria-label') || tapes.map(function (t) { return t.words.join(', '); }).join('. ')); }
        bs.appendChild(next); // in the DOM first: text must be measurable
        try {
          tapes.forEach(function (t) {
            var sg = t.rev ? -1 : 1, id = 'gcband' + (++bandSeq);
            var d = 'M' + x0 + ' ' + (ym + sg * A) + 'C' + w * 0.38 + ' ' + (ym + sg * A * 1.15) + ' ' + w * 0.62 + ' ' + (ym - sg * A * 1.15) + ' ' + x1 + ' ' + (ym - sg * A);
            var path = sv('path', { id: id, d: d, fill: 'none', stroke: t.bg, 'stroke-width': T }, next);
            var L = path.getTotalLength();
            var tx = sv('text', { 'class': 'band-svg__t', 'font-size': fs, dy: (fs * 0.36).toFixed(2), fill: t.ink }, next);
            var unit = t.words.join(SEP) + SEP; tx.textContent = unit;
            var period = tx.getComputedTextLength(); if (!(period > 10)) throw new Error('band text not measurable');
            var tp = sv('textPath', { href: '#' + id, startOffset: 0 }, null);
            tp.textContent = new Array(Math.ceil(L / period) + 2).join(unit);
            tx.textContent = ''; tx.appendChild(tp);
            t.tp = tp; t.period = period; t.speed = Math.max(period, w) / t.dur; t.pos = (((t.ph % 1) + 1) % 1) * period;
            t.apply = function () { tp.setAttribute('startOffset', (t.rev ? t.pos - period : -t.pos).toFixed(2)); }; t.apply();
          });
        } catch (e) { next.remove(); throw e; }
        if (old) old.remove();
        svg = next;
        if (!shown) { shown = true; bs.classList.add('is-svg'); if (bs.__kill) bs.__kill(); }
      }
      function rebuild() { try { build(); } catch (e) { console.error('[GC] bands', e); } }
      var rt;
      if (D.fonts && D.fonts.load) D.fonts.load('800 40px Unbounded').then(rebuild, rebuild); else rebuild();
      if (D.fonts && D.fonts.addEventListener) D.fonts.addEventListener('loadingdone', function () { clearTimeout(rt); rt = setTimeout(rebuild, 60); });
      addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(rebuild, 200); });
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(bs);
      bs.addEventListener('pointerenter', function () { hover = true; }); bs.addEventListener('pointerleave', function () { hover = false; });
      bs.addEventListener('focusin', function () { hover = true; }); bs.addEventListener('focusout', function () { hover = false; });
      bandSets.push({ tapes: tapes, live: function () { return shown && vis; }, hover: function () { return hover; } });
    });
    if (!bandSets.length || reduced) return; // reduced motion: static tapes
    addTick(function (dt) {
      var v = lenis ? lenis.velocity : (W.scrollY - lastY) / (dt / 16.7); lastY = W.scrollY;
      if (D.hidden) return;
      boost += ((1 + Math.min(Math.abs(v || 0) * 0.04, 3)) - boost) * lerpK(0.08, dt);
      bandSets.forEach(function (s) {
        if (!s.live() || s.hover()) return;
        s.tapes.forEach(function (t) { if (!t.tp) return; t.pos = (t.pos + t.speed * boost * dt / 1000) % t.period; t.apply(); });
      });
    });
  }

  /* ---------- carousel (keeps the old data-carousel API) ---------- */
  function initCarousel() {
    $$('[data-carousel]').forEach(function (root) {
      var track = $('.carousel-track', root), vp = $('.carousel-viewport', root) || track.parentNode; if (!track) return;
      var slides = Array.prototype.slice.call(track.children), n = slides.length, box = $('.carousel-dots', root), count = $('.carousel-count', root);
      var i = 0, timer = 0, paused = false, vis = true, sx = null, dx = 0, moved = false;
      root.setAttribute('aria-roledescription', 'carousel');
      var dots = slides.map(function (s, k) {
        var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', 'Show slide ' + (k + 1));
        b.addEventListener('click', function () { go(k); }); if (box) box.appendChild(b); return b;
      });
      function render() {
        track.style.transform = 'translate3d(' + (-i * 100) + '%,0,0)';
        dots.forEach(function (d, k) { d.classList.toggle('on', k === i); if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
        slides.forEach(function (s, k) { s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); });
        if (count) count.textContent = (i + 1) + ' of ' + n;
      }
      function go(k) { i = (k + n) % n; render(); restart(); }
      function restart() { clearInterval(timer); if (!reduced && n > 1) timer = setInterval(function () { if (!paused && vis && !D.hidden) go(i + 1); }, 5200); }
      var prev = $('[data-car-prev]', root), next = $('[data-car-next]', root);
      if (prev) prev.addEventListener('click', function () { go(i - 1); });
      if (next) next.addEventListener('click', function () { go(i + 1); });
      root.addEventListener('pointerenter', function () { paused = true; }); root.addEventListener('pointerleave', function () { paused = false; });
      root.addEventListener('focusin', function () { paused = true; }); root.addEventListener('focusout', function () { paused = false; });
      root.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(i - 1); else if (e.key === 'ArrowRight') go(i + 1); });
      new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }).observe(root);
      vp.addEventListener('pointerdown', function (e) { if (e.button) return; sx = e.clientX; dx = 0; moved = false; });
      addEventListener('pointermove', function (e) {
        if (sx === null) return; dx = e.clientX - sx;
        if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-drag'); }
        if (moved) track.style.transform = 'translate3d(calc(' + (-i * 100) + '% + ' + dx + 'px),0,0)';
      });
      function end() { if (sx === null) return; track.classList.remove('is-drag'); var d = dx; sx = null; dx = 0; if (Math.abs(d) > 60) go(d < 0 ? i + 1 : i - 1); else render(); }
      addEventListener('pointerup', end); addEventListener('pointercancel', end);
      render(); restart();
    });
  }

  /* ---------- grain ---------- */

  /* ---------- links: ink transition (K94) + same-page anchors ---------- */
  var inking = false;
  function inkOut(a) {
    if (inking) return; inking = true;
    var from = a.closest('[data-ink-from]') || a, r = from.getBoundingClientRect(), vw = H.clientWidth, vh = innerHeight;
    var rad = (getComputedStyle(H).getPropertyValue('--r') || '6px').trim();
    var ink = el('div', 'ink'); ink.setAttribute('aria-hidden', 'true');
    var f = 'inset(' + r.top + 'px ' + (vw - r.right) + 'px ' + (vh - r.bottom) + 'px ' + r.left + 'px round ' + rad + ')';
    ink.style.clipPath = f; D.body.appendChild(ink); store('gc-ink', '1');
    var gone = false; function go() { if (gone) return; gone = true; location.href = a.href; }
    ink.animate([{ clipPath: f }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 640, easing: IO_EASE, fill: 'forwards' }).onfinish = go;
    setTimeout(go, 900);
  }
  function initLinks() {
    D.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href'); if (!href || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      var u; try { u = new URL(a.href); } catch (x) { return; }
      if (u.protocol !== location.protocol || u.host !== location.host) return;
      var same = u.pathname === location.pathname && u.search === location.search;
      if (same) {
        if (!u.hash || u.hash === '#') return;
        var t = D.getElementById(decodeURIComponent(u.hash.slice(1))); if (!t) return;
        e.preventDefault(); closeMenu(false);
        if (lenis) lenis.scrollTo(t, { offset: -80 }); else t.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
        try { history.pushState(null, '', u.hash); } catch (x) {}
        return;
      }
      if (!/\.html?$/i.test(u.pathname) && !/\/$/.test(u.pathname)) return;
      if (!motion) return;
      e.preventDefault(); inkOut(a);
    });
    addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      inking = false; $$('.ink,.loader').forEach(function (n) { n.remove(); }); H.classList.remove('is-loading'); H.classList.add('gc-booted');
      if (lenis) lenis.start(); closeMenu(false); ready();
    });
  }

  /* ---------- boot: loader (once per session) or entry cover ---------- */
  function fontsThen(fn, cap) { var done = false; function go() { if (!done) { done = true; fn(); } } setTimeout(go, cap || 800); if (D.fonts && D.fonts.ready) D.fonts.ready.then(go); else go(); }
  function runEntry() {
    var c = el('div', 'ink'); c.setAttribute('aria-hidden', 'true'); c.style.clipPath = 'inset(0)'; D.body.appendChild(c); H.classList.add('gc-booted');
    fontsThen(function () {
      fitAll();
      setTimeout(function () {
        c.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 720, easing: IO_EASE, fill: 'forwards' }).onfinish = function () { c.remove(); };
        setTimeout(function () { c.remove(); }, 2600); // safety if frames stall
        setTimeout(ready, 600);
      }, 120);
    });
  }
  function ringPath(i) {
    var cx = 200, cy = 200, r0 = 34 + i * 31, pts = [], ph = [i * 1.7 + .3, i * 2.3 + 1.1, i * .9 + 2.2], N = 120;
    for (var k = 0; k <= N; k++) {
      var t = k / N * Math.PI * 2, r = r0 * (1 + .1 * Math.sin(3 * t + ph[0]) + .055 * Math.sin(5 * t + ph[1]) + .03 * Math.sin(7 * t + ph[2]));
      pts.push((k ? 'L' : 'M') + (cx + r * Math.cos(t) * (1 + i * .015)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1));
    }
    return pts.join('') + 'Z';
  }
  function runLoader() {
    var S = W.Sun, status = ['Reading the terrain', 'Finding the sun over Tucson', 'Setting the contour interval', 'Ready'];
    if (S && S.position) { var p = S.position(S.now ? S.now() : new Date()); status[1] += ' — ' + Math.round(p.azimuth) + '° / ' + Math.round(p.elevation) + '°'; }
    var L = el('div', 'loader'); L.setAttribute('aria-hidden', 'true');
    var paths = ''; for (var i = 0; i < 6; i++) paths += '<path pathLength="1" d="' + ringPath(i) + '"/>';
    L.innerHTML = '<div class="loader__in"><div class="loader__rings"><svg viewBox="0 0 400 400">' + paths + '</svg></div>' +
      '<div class="loader__status">' + status.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' +
      '<div class="loader__count"><span class="loader__d"><b>0</b></span><span class="loader__d"><b>0</b></span><span class="loader__d"><b>0</b></span></div></div><div class="loader__wipe"></div>';
    D.body.appendChild(L); H.classList.add('is-loading', 'gc-booted'); if (lenis) lenis.stop();
    var inner = $('.loader__in', L), wipe = $('.loader__wipe', L), rings = $$('path', L), lines = $$('.loader__status span', L), digs = $$('.loader__d b', L);
    var start = performance.now(), shown = 0, target = 35, lastDraw = 0, shownDigits = '000', thresholds = [0, 30, 62, 97];
    function draw(force, now) {
      var s = ('00' + shown).slice(-3);
      if (s === shownDigits || (!force && now - lastDraw < 110)) return; lastDraw = now;
      for (var d = 0; d < 3; d++) if (s.charAt(d) !== shownDigits.charAt(d)) { digs[d].textContent = s.charAt(d); digs[d].animate([{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' }); }
      shownDigits = s;
    }
    // fonts + load both done -> 100; hard cap at 1s so the intro never holds the page
    var got = 0; function part() { if (++got >= 2) target = 100; else target = Math.max(target, 70); }
    fontsThen(part, 900);
    if (D.readyState === 'complete') part(); else addEventListener('load', part);
    setTimeout(function () { target = 100; }, 1000);
    (function loop(now) {
      var cap = Math.min(target, (now - start) / 8);
      if (shown < cap) shown = Math.min(100, Math.min(Math.ceil(cap), shown + Math.max(1, Math.round((cap - shown) * 0.12))));
      draw(shown >= 100, now);
      rings.forEach(function (p, k) { p.style.strokeDashoffset = (1 - clamp((shown - k * 12) / 40, 0, 1)).toFixed(3); });
      lines.forEach(function (ln, k) { var on = shown >= thresholds[k]; ln.classList.toggle('is-on', on); ln.classList.toggle('is-now', on && (k === 3 || shown < thresholds[k + 1])); });
      if (shown < 100) { requestAnimationFrame(loop); return; }
      finish();
    })(start);
    // the count is frame-driven, so slow frames (low-end GPU, busy tab) would stretch it: finish on the clock
    var finished = false;
    setTimeout(finish, 1300);
    function finish() {
      if (finished) return; finished = true;
      if (shown < 100) { shown = 100; draw(true, performance.now()); rings.forEach(function (p) { p.style.strokeDashoffset = 0; }); lines.forEach(function (ln, k) { ln.classList.add('is-on'); ln.classList.toggle('is-now', k === 3); }); }
      setTimeout(function () {
        wipe.style.transition = 'transform .42s ' + IO_EASE; wipe.style.transform = 'scaleY(1)';
        setTimeout(function () {
          inner.style.opacity = 0; H.classList.remove('is-loading'); if (lenis) lenis.start(); fitAll(); ready();
          L.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 100% 0)' }], { duration: 600, easing: IO_EASE, fill: 'forwards' }).onfinish = function () { L.remove(); };
          setTimeout(function () { L.remove(); }, 900);
        }, 400);
      }, 120);
    }
  }
  function boot() {
    if (!motion) { H.classList.add('gc-booted'); ready(); return; }
    var inkFlag = store('gc-ink'), seen = store('gc-boot');
    store('gc-ink', null); store('gc-boot', '1');
    if (!seen && !inkFlag) runLoader(); else runEntry();
    setTimeout(ready, 7000);
  }

  /* ---------- go ---------- */
  safe('chapters', initChapters);
  safe('nav', initNav);
  safe('live', function () { liveBits(); setInterval(liveBits, 20000); });
  safe('cta', initCta);
  safe('buttons', initButtons);
  safe('tilt', initTilt);
  safe('spot', initSpot);
  safe('cursor', initCursor);
  safe('offset', initOffset);
  safe('splits', initSplits);
  safe('counts', initCounts);
  safe('scrub', initScrub);
  safe('bands', initBands);
  safe('bandsSvg', enhanceBands);
  safe('carousel', initCarousel);
  safe('links', initLinks);
  safe('fit', fitAll);
  onReady(function () { safe('observers', startObservers); });
  addEventListener('resize', fitSoon);
  if (D.fonts && D.fonts.addEventListener) D.fonts.addEventListener('loadingdone', function () { fitSoon(); });
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(function () { fitAll(); if (hasST) ScrollTrigger.refresh(); });
  addEventListener('load', function () { fitAll(); if (hasST) ScrollTrigger.refresh(); });
  try { boot(); } catch (e) { console.error('[GC] boot', e); H.classList.add('gc-booted'); ready(); }

  W.GC = {
    lenis: lenis, reduced: reduced, fine: fine, pointer: pointer,
    onReady: onReady, scrambleTo: scrambleTo, tick: addTick, fit: fitAll,
    refresh: function () { if (hasST) ScrollTrigger.refresh(); }
  };
})();
