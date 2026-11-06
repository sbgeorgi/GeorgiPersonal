/* work.js - page motion for work.html. Everything is progressive: without gsap / ScrollTrigger / a fine pointer
   the page is the static layout from work.css. */
(function () {
  'use strict';
  var D = document, W = window, H = D.documentElement;
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  var gs = !!(W.gsap && W.ScrollTrigger);
  var motion = H.classList.contains('motion') && gs && !reduced;
  if (gs) gsap.registerPlugin(ScrollTrigger);

  /* ---------- B65 spotlight: duotone base, colour revealed under a soft lens that trails the pointer ---------- */
  function initSpot() {
    if (!fine) return;
    function idle(n, k, d) { // idle anchor / drift as fractions of the frame; data-idle-<k>-m overrides on narrow screens (the phone crop is framed differently)
      var m = innerWidth <= 900 && n.getAttribute('data-idle-' + k + '-m'), v = parseFloat(m !== null && m !== false ? m : n.getAttribute('data-idle-' + k)); return isNaN(v) ? d : v;
    }
    var spots = $$('[data-spotlight]').map(function (n) {
      var s = { n: n, vis: false, tx: 0, ty: 0, x: 0, y: 0, w: 1, h: 1, hover: false, t0: Math.random() * 6, ax: idle(n, 'x', 0.5), ay: idle(n, 'y', 0.6), am: idle(n, 'a', 0.28) };
      new IntersectionObserver(function (es) { s.vis = es[0].isIntersecting; }).observe(n);
      n.addEventListener('pointermove', function (e) {
        var r = n.getBoundingClientRect(); s.w = r.width; s.h = r.height;
        s.tx = e.clientX - r.left; s.ty = e.clientY - r.top;
        if (!s.hover) { s.hover = true; s.x = s.tx; s.y = s.ty; }
        if (reduced) { s.x = s.tx; s.y = s.ty; put(s); }
      });
      n.addEventListener('pointerleave', function () {
        s.hover = false; // back to the idle drift (reduced motion: park on the anchor)
        if (reduced) { s.x = n.clientWidth * s.ax; s.y = n.clientHeight * s.ay; put(s); }
      });
      s.x = n.clientWidth * s.ax; s.y = n.clientHeight * s.ay; // start on the anchor, not the corner
      n.classList.add('is-live');
      return s;
    });
    function put(s) { s.n.style.setProperty('--x', s.x.toFixed(1) + 'px'); s.n.style.setProperty('--y', s.y.toFixed(1) + 'px'); }
    if (reduced) { spots.forEach(function (s) { s.x = s.n.clientWidth * s.ax; s.y = s.n.clientHeight * s.ay; put(s); }); return; }
    var t = 0, last = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
      if (!D.hidden) spots.forEach(function (s) {
        if (!s.vis) return;
        if (!s.hover) { s.w = s.n.clientWidth; s.h = s.n.clientHeight; s.tx = s.w * (s.ax + s.am * Math.sin(0.7 * (t + s.t0))); s.ty = s.h * (s.ay + s.am * 0.54 * Math.cos(0.9 * (t + s.t0))); }
        s.x += (s.tx - s.x) * (1 - Math.pow(0.9, dt * 60)); s.y += (s.ty - s.y) * (1 - Math.pow(0.9, dt * 60));
        put(s);
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- scroll choreography ---------- */
  function initScroll() {
    if (!motion) return;
    var hero = D.querySelector('.whero');
    if (hero) {
      var tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 } });
      tl.to('.whero__h1', { scale: 0.94, yPercent: 5, ease: 'none', duration: 1 }, 0)
        .to('.whero__intro,.whero__meta', { y: -30, opacity: 0, ease: 'none', duration: 0.35 }, 0);
    }
    // screenshots: a clip-path wipe tied to the scroll, then a slow parallax; the second shot of a pair travels faster for depth
    $$('[data-shot]').forEach(function (s) {
      var k = parseFloat(s.getAttribute('data-shot')) || 0, fig = s.firstElementChild;
      gsap.fromTo(fig, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', clearProps: 'clipPath',
        scrollTrigger: { trigger: s, start: 'top 94%', end: 'top 50%', scrub: true } });
      if (k) gsap.fromTo(s, { yPercent: 5 * k }, { yPercent: -5 * k, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
    });
    // panorama: the picture drifts inside its frame
    $$('.case__pano').forEach(function (p) {
      if (innerWidth <= 900) return; // phone crop is framed exactly; the 1.16 drift would clip the headline; on desktop the drift is kept inside the text-free gaps (no line sliced at the frame edge)
      gsap.fromTo($$('.spot img', p), { yPercent: -2.8, scale: 1.16 }, { yPercent: 2.4, scale: 1.16, ease: 'none', scrollTrigger: { trigger: p, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // case titles slide in against the flat field
    $$('.case__head .case__title').forEach(function (t) {
      gsap.fromTo(t, { xPercent: -3 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: t, start: 'top 100%', end: 'top 55%', scrub: true } });
    });
  }

  function enter() {
    if (!motion) { $$('.whero__word').forEach(function (w) { w.classList.add('is-in'); }); return; }
    var w = D.querySelector('.whero__word');
    if (w) gsap.fromTo(w, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.6, ease: 'expo.out', delay: 0.15, onStart: function () { w.classList.add('is-in'); }, clearProps: 'opacity,transform' });
  }

  initSpot();
  initScroll();
  if (W.GC && GC.onReady) GC.onReady(enter); else enter();
  addEventListener('load', function () { if (gs) ScrollTrigger.refresh(); });
})();
