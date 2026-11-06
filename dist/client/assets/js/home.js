/* home.js - sections after the hero: work rail (K72), spotlight shots (B65), how-I-work stage (K25),
   capabilities accordion (K5), drawn instruments, counters and parallax. Plain script, every part guards GSAP. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var hasG = !!W.gsap, hasST = hasG && !!W.ScrollTrigger;
  var reduced = W.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';
  if (hasST) gsap.registerPlugin(ScrollTrigger);
  var motion = function () { return hasG && !reduced && H.classList.contains('motion'); };
  function safe(n, f) { try { f(); } catch (e) { console.error('[home] ' + n, e); } }
  function refreshSoon() { clearTimeout(refreshSoon.t); refreshSoon.t = setTimeout(function () { if (hasST) ScrollTrigger.refresh(); }, 120); }

  /* ---------- helpers ---------- */
  function S(tag, a, parent) { var n = D.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); if (parent) parent.appendChild(n); return n; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var RAMP = [[42, 27, 110], [47, 95, 224], [23, 179, 163], [201, 242, 79], [255, 179, 64], [255, 106, 61], [226, 55, 110]];
  function ramp(t) {
    t = Math.max(0, Math.min(.9999, t)) * (RAMP.length - 1); var i = t | 0, f = t - i, a = RAMP[i], b = RAMP[i + 1];
    return 'rgb(' + [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * f); }).join(',') + ')';
  }
  function draw(p) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '0'; return p; }

  /* ---------- instruments: each returns { play(), stop() }; the drawn state is complete without GSAP ---------- */
  function mk(tl, loops) {
    return {
      play: function () { if (tl) tl.restart(); loops.forEach(function (l) { l.resume(); }); },
      stop: function () { loops.forEach(function (l) { l.pause(); }); }
    };
  }
  function build(fn) {
    return function (svg) {
      var tl = motion() ? gsap.timeline({ paused: true }) : null, loops = [];
      svg.textContent = ''; fn(svg, tl, loops); return mk(tl, loops);
    };
  }
  function loop(loops, tw) { tw.pause(); loops.push(tw); return tw; }

  var evidence = build(function (svg, tl) {
    var r = rng(11), L = 'var(--field-ink)';
    S('path', { d: 'M36 18V222H386', fill: 'none', stroke: L, 'stroke-opacity': .35, 'stroke-width': 1 }, svg);
    var dots = [], n = 120, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) {
      var x = r(), y = Math.max(.04, Math.min(.97, .16 + .64 * x + (r() + r() - 1) * .3));
      sx += x; sy += y; sxx += x * x; sxy += x * y;
      dots.push(S('circle', { cx: (44 + x * 332).toFixed(1), cy: (212 - y * 184).toFixed(1), r: (2.4 + r() * 1.4).toFixed(1), fill: ramp(.12 + .88 * y) }, svg));
    }
    var b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
    var line = draw(S('path', { d: 'M44 ' + (212 - a * 184).toFixed(1) + 'L376 ' + (212 - (a + b) * 184).toFixed(1), fill: 'none', stroke: L, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg));
    var panels = [];
    for (var p = 0; p < 7; p++) {
      var g = S('g', {}, svg), cx = 58 + p * 48;
      S('path', { d: 'M' + cx + ' 252V238', stroke: L, 'stroke-opacity': .5, 'stroke-width': 1.5 }, g);
      S('rect', { x: cx - 18, y: 233, width: 36, height: 5, fill: L, 'fill-opacity': .8, transform: 'rotate(-16 ' + cx + ' 236)' }, g);
      panels.push(g);
    }
    if (tl) {
      tl.from(panels, { yPercent: 140, opacity: 0, stagger: .07, duration: .8, ease: 'expo.out' }, 0)
        .from(dots, { scale: 0, opacity: 0, transformOrigin: '50% 50%', duration: .5, ease: 'back.out(2.2)', stagger: { amount: 1.3, from: 'random' } }, .15)
        .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.2, ease: 'expo.inOut' }, 1.1);
    }
  });

  var decisions = build(function (svg, tl, loops) {
    var X0 = 64, Y0 = 130, ends = [34, 82, 130, 178, 226], cols = [.33, .5, .67, .83, 1];
    function curve(e, rev) { var c1 = Y0 + (e - Y0) * .08, c2 = Y0 + (e - Y0) * .72; return rev ? 'C250 ' + c2 + ' 150 ' + c1 + ' ' + X0 + ' ' + Y0 : 'C150 ' + c1 + ' 250 ' + c2 + ' 376 ' + e; }
    function band(i, j, fill, op) { return S('path', { d: 'M' + X0 + ' ' + Y0 + curve(ends[i]) + 'L376 ' + ends[j] + curve(ends[j], true) + 'Z', fill: fill, 'fill-opacity': op }, svg); }
    S('path', { d: 'M' + X0 + ' 24V236', stroke: 'var(--field-ink)', 'stroke-opacity': .3, 'stroke-dasharray': '3 5' }, svg);
    var bands = [band(0, 4, 'var(--teal)', .2), band(1, 3, 'var(--lime)', .22)];
    var paths = ends.map(function (e, i) { return draw(S('path', { d: 'M' + X0 + ' ' + Y0 + curve(e), fill: 'none', stroke: ramp(cols[i]), 'stroke-width': i === 2 ? 3 : 2, 'stroke-linecap': 'round' }, svg)); });
    var ring = S('circle', { cx: X0, cy: Y0, r: 7, fill: 'none', stroke: 'var(--amber)', 'stroke-width': 1.5 }, svg);
    var dot = S('circle', { cx: X0, cy: Y0, r: 6, fill: 'var(--amber)' }, svg);
    if (tl) {
      tl.from(bands, { opacity: 0, duration: 1.2, ease: 'power2.out', stagger: .25 }, .2)
        .fromTo(paths, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.5, ease: 'expo.inOut', stagger: .1 }, 0)
        .from(dot, { scale: 0, svgOrigin: X0 + ' ' + Y0, duration: .7, ease: 'back.out(3)' }, 0);
      loop(loops, gsap.fromTo(ring, { scale: 1, opacity: .8 }, { scale: 3.4, opacity: 0, svgOrigin: X0 + ' ' + Y0, duration: 1.7, repeat: -1, ease: 'power1.out' }));
    }
  });

  var access = build(function (svg, tl, loops) {
    var r = rng(5), cx = 200, cy = 120, L = 'var(--field-ink)', rings = [];
    [[100, 'var(--teal)', 1], [70, 'var(--lime)', -1], [42, 'var(--amber)', 1]].forEach(function (cfg) {
      var pts = '', ph = [r() * 6, r() * 6, r() * 6];
      for (var k = 0; k <= 90; k++) { var t = k / 90 * Math.PI * 2, rr = cfg[0] * (1 + .1 * Math.sin(3 * t + ph[0]) + .06 * Math.sin(5 * t + ph[1]) + .03 * Math.sin(7 * t + ph[2])); pts += (k ? 'L' : 'M') + (cx + rr * Math.cos(t) * 1.45).toFixed(1) + ' ' + (cy + rr * Math.sin(t)).toFixed(1); }
      rings.push([S('path', { d: pts + 'Z', fill: 'none', stroke: cfg[1], 'stroke-opacity': .85, 'stroke-width': 1.5, 'stroke-dasharray': '3 6' }, svg), cfg[2]]);
    });
    var route = draw(S('path', { d: 'M104 156C150 96 160 86 206 88S270 172 306 168', fill: 'none', stroke: 'var(--lime)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, svg));
    var pins = [[104, 156, 'var(--amber)'], [206, 88, 'var(--thermal)'], [306, 168, 'var(--magenta)']].map(function (p) {
      var g = S('g', {}, svg); S('path', { d: 'M' + p[0] + ' ' + p[1] + 'v-12', stroke: L, 'stroke-width': 1.5 }, g); S('circle', { cx: p[0], cy: p[1] - 18, r: 7, fill: p[2] }, g); return g;
    });
    var car = S('circle', { cx: 104, cy: 156, r: 5, fill: L, stroke: 'var(--field)', 'stroke-width': 2 }, svg);
    var len = route.getTotalLength(), o = { p: 0 };
    function at(p) { var q = route.getPointAtLength(p * len); car.setAttribute('cx', q.x); car.setAttribute('cy', q.y); }
    at(.45);
    if (tl) {
      tl.from(pins, { y: -70, opacity: 0, duration: 1.2, ease: 'elastic.out(1,.45)', stagger: .22 }, 0)
        .fromTo(route, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: 'expo.inOut' }, .3);
      rings.forEach(function (rg, i) { loop(loops, gsap.to(rg[0], { rotation: 360 * rg[1], svgOrigin: cx + ' ' + cy, duration: 90 + i * 30, repeat: -1, ease: 'none' })); });
      loop(loops, gsap.fromTo(o, { p: 0 }, { p: 1, duration: 4.2, repeat: -1, yoyo: true, ease: 'sine.inOut', onUpdate: function () { at(o.p); } }));
    }
  });

  /* accordion instruments: viewBox 360 x 220, drawn in the card's own ink (currentColor) */
  var carbon = build(function (svg, tl) {
    var steps = [150, 138, 142, 118, 104, 110, 82, 70, 58], d = 'M20 ' + steps[0], bars = [];
    steps.forEach(function (y, i) { d += (i ? 'V' + y : '') + 'H' + (20 + (i + 1) * 36 - (i === 8 ? 8 : 0)); });
    var line = draw(S('path', { d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg));
    steps.forEach(function (y, i) { var h = 16 + ((i * 53) % 7) * 5 + i * 3; bars.push(S('rect', { x: 22 + i * 36, y: 210 - h, width: 24, height: h, fill: 'currentColor', 'fill-opacity': .85 }, svg)); });
    var dot = S('circle', { cx: 336, cy: 58, r: 6, fill: 'var(--bg)', stroke: 'currentColor', 'stroke-width': 3 }, svg);
    if (tl) {
      tl.from(bars, { scaleY: 0, transformOrigin: '50% 100%', duration: .8, ease: 'expo.out', stagger: .06 }, 0)
        .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'expo.inOut' }, .2)
        .from(dot, { scale: 0, svgOrigin: '336 58', duration: .6, ease: 'back.out(3)' }, 1.4);
    }
  });

  var agri = build(function (svg, tl, loops) {
    var pv = [], rot = [];
    S('path', { d: 'M30 160A150 150 0 0 1 330 160', fill: 'none', stroke: 'currentColor', 'stroke-opacity': .4, 'stroke-width': 1.5, 'stroke-dasharray': '3 6' }, svg);
    S('path', { d: 'M10 208H350', stroke: 'currentColor', 'stroke-width': 1.5 }, svg);
    for (var i = 0; i < 6; i++) {
      var o = S('g', {}, svg), px = 46 + i * 54;
      S('path', { d: 'M' + px + ' 208V184', stroke: 'currentColor', 'stroke-width': 2 }, o);
      rot.push([S('rect', { x: px - 21, y: 178, width: 42, height: 8, fill: 'currentColor' }, o), px]); pv.push(o);
    }
    var sun = S('circle', { cx: 180, cy: 40, r: 13, fill: 'var(--thermal)', stroke: 'currentColor', 'stroke-width': 2 }, svg), st = { t: .36 };
    function place(t) {
      var a = Math.PI * (1 - t), x = 180 + 150 * Math.cos(a), y = 160 - 150 * Math.sin(a);
      sun.setAttribute('cx', x.toFixed(1)); sun.setAttribute('cy', y.toFixed(1));
      rot.forEach(function (q) { q[0].setAttribute('transform', 'rotate(' + Math.max(-58, Math.min(58, (x - q[1]) * .26)).toFixed(1) + ' ' + q[1] + ' 182)'); });
    }
    place(st.t);
    if (tl) {
      tl.from(pv, { yPercent: 40, opacity: 0, duration: .8, ease: 'expo.out', stagger: .07 }, 0).from(sun, { opacity: 0, duration: .6 }, .3);
      loop(loops, gsap.fromTo(st, { t: .06 }, { t: .94, duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut', onUpdate: function () { place(st.t); } }));
    }
  });

  var research = build(function (svg, tl) {
    var r = rng(21), base = 206, pdf = function (x) { return Math.exp(-Math.pow((x - 180) / 64, 2) / 2); }, d = '', i, dots = [], bins = {};
    for (i = 0; i <= 64; i++) { var x = 20 + i * 5; d += (i ? 'L' : 'M') + x + ' ' + (base - 120 * pdf(x)).toFixed(1); }
    S('path', { d: d + 'L340 ' + base + 'L20 ' + base + 'Z', fill: 'currentColor', 'fill-opacity': .16 }, svg);
    var line = draw(S('path', { d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }, svg));
    S('path', { d: 'M10 ' + base + 'H350', stroke: 'currentColor', 'stroke-width': 1.5 }, svg);
    for (i = 0; i < 42; i++) {
      var z = Math.sqrt(-2 * Math.log(r() + 1e-6)) * Math.cos(6.2832 * r()), px = Math.max(30, Math.min(330, 180 + z * 62)), k = Math.round(px / 11);
      bins[k] = (bins[k] || 0) + 1;
      dots.push(S('circle', { cx: k * 11, cy: base - 6 - (bins[k] - 1) * 10.4, r: 4.8, fill: i % 9 === 4 ? 'var(--amber)' : 'currentColor' }, svg));
    }
    if (tl) {
      tl.fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.3, ease: 'expo.inOut' }, 0)
        .from(dots, { y: -150, opacity: 0, duration: .9, ease: 'bounce.out', stagger: { amount: 1.6, from: 'random' } }, .5);
    }
  });

  var data = build(function (svg, tl, loops) {
    var nodes = [], links = [], pulses = [], C = 6, R = 4, pos = function (i, j) { return [40 + i * 56 + ((i * 7 + j * 3) % 5) * 2, 34 + j * 50 + ((i * 3 + j * 5) % 4) * 2]; };
    function link(a, b, pulse) {
      var p = pos(a[0], a[1]), q = pos(b[0], b[1]), d = 'M' + p[0] + ' ' + p[1] + 'L' + q[0] + ' ' + q[1];
      links.push(draw(S('path', { d: d, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .7, 'stroke-width': 1.5 }, svg)));
      if (pulse) { var u = S('path', { d: d, fill: 'none', stroke: 'var(--chalk)', 'stroke-width': 3.5, 'stroke-linecap': 'round', pathLength: 1 }, svg); u.style.strokeDasharray = '.1 .9'; u.style.strokeDashoffset = '0'; pulses.push(u); }
    }
    for (var j = 0; j < R; j++) for (var i = 0; i < C; i++) {
      if (i < C - 1) link([i, j], [i + 1, j], (i + j) % 3 === 0);
      if (j < R - 1) link([i, j], [i, j + 1], (i * 2 + j) % 4 === 1);
      if (i < C - 1 && j < R - 1 && (i + j) % 3 === 1) link([i, j], [i + 1, j + 1], true);
    }
    for (j = 0; j < R; j++) for (i = 0; i < C; i++) { var p = pos(i, j); nodes.push(S('circle', { cx: p[0], cy: p[1], r: (i + j) % 4 === 2 ? 8 : 5.5, fill: (i + j) % 4 === 2 ? 'var(--chalk)' : 'currentColor' }, svg)); }
    if (tl) {
      tl.fromTo(links, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .9, ease: 'power2.inOut', stagger: { amount: 1.1, from: 'start' } }, 0)
        .from(nodes, { scale: 0, transformOrigin: '50% 50%', duration: .55, ease: 'back.out(2.5)', stagger: { amount: 1, from: 'start' } }, .1);
      pulses.forEach(function (u, k) { loop(loops, gsap.fromTo(u, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.8 + (k % 4) * .3, repeat: -1, ease: 'none', delay: k * .13 })); });
    }
  });

  /* ---------- S4 rail (K72) ---------- */
  function initRail() {
    var rail = $('[data-rail]'); if (!rail || !hasST) return;
    var track = $('.rail__track', rail), view = $('.rail__view', rail), pin = $('.rail__pin', rail), bar = $('.rail__prog i', rail), covers = $$('.cover', rail), n = covers.length;
    var mm = gsap.matchMedia();
    mm.add('(min-width: 761px)', function () {
      if (!motion()) return;
      var pad = function () { return parseFloat(getComputedStyle(view).paddingLeft) || 24; };
      var dist = function () { return Math.max(0, track.offsetWidth + pad() * 2 - W.innerWidth); };
      var setRun = function () { rail.style.setProperty('--run', dist() + 'px'); };
      setRun(); ScrollTrigger.addEventListener('refreshInit', setRun);
      var cur = -1;
      var tw = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: rail, start: 'top top', end: 'bottom bottom', scrub: .6, invalidateOnRefresh: true,
          onUpdate: function (self) {
            gsap.set(bar, { scaleX: self.progress });
            var i = Math.round(self.progress * (n - 1)); if (i !== cur) { cur = i; pin.style.setProperty('--hue-now', covers[i].style.getPropertyValue('--hue')); }
          }
        }
      });
      covers.forEach(function (c, i) {
        var dir = i % 2 ? -1 : 1, st = { trigger: c, containerAnimation: tw, start: 'left right', end: 'right left', scrub: true };
        gsap.fromTo(c, { rotation: 5 * dir, yPercent: 4 }, { rotation: -4 * dir, yPercent: -3, ease: 'none', scrollTrigger: st });
        gsap.fromTo($('.cover__word', c), { xPercent: 5 }, { xPercent: -5, ease: 'none', scrollTrigger: st });
        gsap.fromTo($$('.shot img', c), { xPercent: -5, scale: 1.12 }, { xPercent: 5, scale: 1.12, ease: 'none', scrollTrigger: st });
      });
      return function () { ScrollTrigger.removeEventListener('refreshInit', setRun); rail.style.removeProperty('--run'); };
    });
  }

  /* ---------- B65 spotlight on every project shot ---------- */
  function initShots() {
    var shots = $$('.shot').map(function (el) { return { el: el, w: 1, h: 1, x: .5, y: .6, tx: .5, ty: .6, ptr: false, vis: false, t0: Math.random() * 6 }; });
    if (!shots.length) return;
    var phone = W.matchMedia('(max-width: 760px)'), t = 0, last = 0, raf = 0;
    function apply() { shots.forEach(function (s) { s.el.classList.toggle('is-spot', !phone.matches); }); }
    function size(s) { var r = s.el.getBoundingClientRect(); s.w = s.el.offsetWidth || r.width; s.h = s.el.offsetHeight || r.height; s.el.style.setProperty('--k', Math.max(.4, s.w / 900).toFixed(2)); }
    function put(s) { s.el.style.setProperty('--x', (s.x * s.w).toFixed(1) + 'px'); s.el.style.setProperty('--y', (s.y * s.h).toFixed(1) + 'px'); }
    function frame(now) {
      raf = 0; var dt = Math.min(now - last, 50); last = now; t += dt / 1000; var k = 1 - Math.pow(.9, dt / 16.7), any = false;
      shots.forEach(function (s) {
        if (!s.vis || phone.matches) return; any = true;
        if (!s.ptr) { s.tx = .5 + .28 * Math.sin(.7 * (t + s.t0)); s.ty = .4 + .17 * Math.cos(.9 * (t + s.t0)); }
        s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; put(s);
      });
      if (any && !D.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && !reduced) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    apply(); if (phone.addEventListener) phone.addEventListener('change', apply);
    shots.forEach(function (s) {
      size(s); put(s);
      var cover = s.el.closest('.cover') || s.el;
      cover.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return; var r = s.el.getBoundingClientRect(); s.ptr = true;
        s.tx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); s.ty = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        if (reduced) { s.x = s.tx; s.y = s.ty; put(s); }
      });
      cover.addEventListener('pointerleave', function () { s.ptr = false; });
    });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { var s = shots.filter(function (q) { return q.el === e.target; })[0]; s.vis = e.isIntersecting; if (e.isIntersecting) { size(s); kick(); } }); }, { rootMargin: '10% 0px 10% 0px' });
    shots.forEach(function (s) { io.observe(s.el); });
    W.addEventListener('resize', function () { shots.forEach(size); });
    D.addEventListener('visibilitychange', function () { if (!D.hidden) kick(); });
  }

  /* ---------- S5 how I work: one composed screen per stage; each instrument plays while its screen is in view ---------- */
  function initHow() {
    var steps = $$('.step'); if (!steps.length) return;
    var builders = [evidence, decisions, access];
    var inst = steps.map(function (st, i) { var f = $('.viz', st), x = builders[i]($('svg', f)); f.classList.add('is-built'); return x; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { var i = steps.indexOf(e.target); if (e.isIntersecting) inst[i].play(); else inst[i].stop(); });
    }, { threshold: .35 });
    steps.forEach(function (st) { io.observe(st); });
    if (!motion() || !hasST) return;
    steps.forEach(function (st) {
      gsap.fromTo($('.step__name', st), { xPercent: 3 }, { xPercent: -3, ease: 'none', scrollTrigger: { trigger: st, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  /* ---------- S6 capabilities: elastic accordion (K5) ---------- */
  function initAcc() {
    var acc = $('[data-acc]'); if (!acc) return;
    var cards = $$('.acc__card', acc), phone = W.matchMedia('(max-width: 760px)'), fine = W.matchMedia('(hover:hover) and (pointer:fine)').matches;
    var B = { carbon: carbon, agri: agri, research: research, data: data }, inst = cards.map(function (c) { return B[c.getAttribute('data-viz')]($('svg', c)); });
    var cur = cards[0], hov;
    function openW() { var w = acc.clientWidth - 36; acc.style.setProperty('--open-w', Math.round(w * 3.4 / 6.4) + 'px'); }
    function fx(card) { return $$('.acc__t,.acc__p', card); }
    function set(card, on) { card.classList.toggle('is-open', on); $('.acc__btn', card).setAttribute('aria-expanded', on ? 'true' : 'false'); }
    function open(card) {
      if (card === cur) return;
      var prev = cur, pi = cards.indexOf(prev), ci = cards.indexOf(card); cur = card;
      set(prev, false); set(card, true); inst[pi].stop();
      if (!hasG) { inst[ci].play(); return; }
      var ph = phone.matches, svC = $('svg', card), svP = $('svg', prev);
      gsap.killTweensOf([prev, card, svC, svP].concat(fx(prev), fx(card)));
      if (ph) {
        gsap.to(prev, { height: 88, duration: .7, ease: 'power3.inOut' });
        gsap.to(card, { height: 'auto', duration: .8, ease: 'power3.inOut', onComplete: function () { card.style.height = ''; refreshSoon(); } });
      } else {
        gsap.to(prev, { flexGrow: 1, duration: reduced ? 0 : 1.3, ease: 'elastic.out(1,.6)' });
        gsap.to(card, { flexGrow: 3.4, duration: reduced ? 0 : 1.6, ease: 'elastic.out(1,.3)' });
      }
      gsap.to(fx(prev), { y: 12, opacity: 0, duration: reduced ? 0 : .35, ease: 'power2.in' });
      gsap.fromTo(fx(card), { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: reduced ? 0 : 1, delay: reduced ? 0 : .5, ease: 'power3.out', stagger: reduced ? 0 : .08 });
      gsap.fromTo(svC, { scale: 1 }, { scale: 1.06, duration: reduced ? 0 : 2.4, ease: 'power3.out' });
      gsap.to(svP, { scale: 1, duration: .4 });
      gsap.delayedCall(reduced ? 0 : .5, function () { if (cur === card) inst[ci].play(); });
    }
    cards.forEach(function (c) {
      $('.acc__btn', c).addEventListener('click', function () { open(c); });
      if (fine) {
        c.addEventListener('pointerenter', function () { if (phone.matches) return; clearTimeout(hov); hov = setTimeout(function () { open(c); }, 120); });
        c.addEventListener('pointerleave', function () { clearTimeout(hov); });
      }
    });
    function layout() { openW(); cards.forEach(function (c) { c.style.height = ''; if (phone.matches) c.style.flexGrow = ''; }); refreshSoon(); }
    W.addEventListener('resize', layout); if (phone.addEventListener) phone.addEventListener('change', layout); layout();
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); inst[cards.indexOf(cur)].play(); } }, { rootMargin: '0px 0px -30% 0px' });
    io.observe(acc);
  }

  /* ---------- manifesto: counters, scroll parallax on the clip and the photograph, clip pauses off screen ---------- */
  function initFacts() {
    var nums = $$('[data-num]'); if (!nums.length) return;
    var fmt = function (n, v) { return v.toFixed(parseInt(n.getAttribute('data-dec') || '0', 10)) + (n.getAttribute('data-suf') || ''); };
    if (!motion()) { $$('.fact').forEach(function (f) { f.classList.add('is-in'); }); return; }
    nums.forEach(function (n) { n.textContent = fmt(n, parseFloat(n.getAttribute('data-from')) || 0); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; io.unobserve(e.target);
        var n = $('[data-num]', e.target), o = { v: parseFloat(n.getAttribute('data-from')) || 0 }, to = parseFloat(n.getAttribute('data-num'));
        e.target.classList.add('is-in');
        gsap.to(o, { v: to, duration: .75, ease: 'power3.out', onUpdate: function () { n.textContent = fmt(n, o.v); }, onComplete: function () { n.textContent = fmt(n, to); } });
      });
    }, { threshold: .3 });
    $$('.fact').forEach(function (f) { io.observe(f); });
  }
  function initParallax() {
    if (!motion() || !hasST) return;
    $$('[data-parallax]').forEach(function (fr) {
      var m = $('video, img', fr); if (!m) return;
      gsap.fromTo(m, { yPercent: 2, scale: 1.18, transformOrigin: '50% 0%' }, { yPercent: -9, scale: 1.18, ease: 'none', scrollTrigger: { trigger: fr, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }
  function initLoops() {
    $$('video[data-loop]').forEach(function (v) {
      if (reduced) { v.removeAttribute('autoplay'); v.pause(); return; }
      new IntersectionObserver(function (es) { if (es[0].isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }, { threshold: .1 }).observe(v);
    });
  }

  safe('shots', initShots); safe('rail', initRail); safe('how', initHow); safe('acc', initAcc); safe('facts', initFacts); safe('parallax', initParallax); safe('loops', initLoops);
  W.addEventListener('load', refreshSoon);
  if (D.fonts && D.fonts.ready) D.fonts.ready.then(refreshSoon);
})();
