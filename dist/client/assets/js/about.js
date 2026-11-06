/* about.js - page motion for about.html. Everything is progressive: without gsap / ScrollTrigger / a fine pointer
   the page is the static layout from about.css. */
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
    var spots = $$('[data-spotlight]').map(function (n) {
      var s = { n: n, vis: false, tx: 0, ty: 0, x: 0, y: 0, w: 1, h: 1, hover: false, t0: Math.random() * 6 };
      new IntersectionObserver(function (es) { s.vis = es[0].isIntersecting; }).observe(n);
      n.addEventListener('pointermove', function (e) {
        var r = n.getBoundingClientRect(); s.w = r.width; s.h = r.height;
        s.tx = e.clientX - r.left; s.ty = e.clientY - r.top;
        if (!s.hover) { s.hover = true; s.x = s.tx; s.y = s.ty; }
        if (reduced) { s.x = s.tx; s.y = s.ty; put(s); }
      });
      n.classList.add('is-live');
      return s;
    });
    function put(s) { s.n.style.setProperty('--x', s.x.toFixed(1) + 'px'); s.n.style.setProperty('--y', s.y.toFixed(1) + 'px'); }
    if (reduced) { spots.forEach(function (s) { s.x = s.n.clientWidth * 0.5; s.y = s.n.clientHeight * 0.55; put(s); }); return; }
    var t = 0, last = 0;
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
      if (!D.hidden) spots.forEach(function (s) {
        if (!s.vis) return;
        if (!s.hover) { s.w = s.n.clientWidth; s.h = s.n.clientHeight; s.tx = s.w * (0.5 + 0.28 * Math.sin(0.7 * (t + s.t0))); s.ty = s.h * (0.6 + 0.15 * Math.cos(0.9 * (t + s.t0))); }
        s.x += (s.tx - s.x) * (1 - Math.pow(0.9, dt * 60)); s.y += (s.ty - s.y) * (1 - Math.pow(0.9, dt * 60));
        put(s);
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- K25 pinned principles: cell grows to full, slides clip in and out, bar fills, mark fans open ---------- */
  function initPrinciples() {
    var sec = D.querySelector('.prin'); if (!sec) return;
    var cell = sec.querySelector('.prin__cell'), slides = $$('.pslide', sec), bar = sec.querySelector('.prin__bar i'), rays = $$('.mark__ray', sec);
    var r = (getComputedStyle(H).getPropertyValue('--r') || '6px').trim();
    var IN = 'inset(100% 0% 0% 0%)', SHOWN = 'inset(0% 0% 0% 0%)', OUT = 'inset(0% 0% 100% 0%)';
    var tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: 0.6, invalidateOnRefresh: true } });
    tl.fromTo(cell, { clipPath: 'inset(6% 4% 6% 4% round ' + r + ')' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 0.1 }, 0);
    rays.forEach(function (ray, i) {
      var a = (i - 1) * 34;
      gsap.set(ray, { clearProps: 'transform' });
      tl.fromTo(ray, { rotation: 0, svgOrigin: '60 104' }, { rotation: a, svgOrigin: '60 104', duration: 0.12, ease: 'power2.out' }, 0.02);
    });
    if (bar) tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 0.9 }, 0.1);
    // a slide that is clipped away is hidden outright, so no text is left stacked under another
    var spans = slides.map(function (s, i) { return [i === 0 ? 0 : 0.1 + i * 0.3, i < slides.length - 1 ? 0.1 + (i + 1) * 0.3 + 0.07 : 9]; });
    function show() { var t = tl.progress() * tl.duration(); slides.forEach(function (s, i) { s.style.visibility = t >= spans[i][0] - 0.005 && t <= spans[i][1] + 0.005 ? '' : 'hidden'; }); }
    tl.eventCallback('onUpdate', show); show();
    slides.forEach(function (s, i) {
      var at = i === 0 ? 0 : 0.1 + i * 0.3;
      if (i) tl.fromTo(s, { clipPath: IN }, { clipPath: SHOWN, duration: 0.07, ease: 'power3.inOut' }, at);
      if (i < slides.length - 1) tl.fromTo(s, { clipPath: SHOWN }, { clipPath: OUT, duration: 0.07, ease: 'power3.inOut', immediateRender: false }, 0.1 + (i + 1) * 0.3);
    });
  }

  /* ---------- scroll choreography ---------- */
  function initScroll() {
    if (!motion) return;
    var hero = D.querySelector('.ahero');
    if (hero) {
      var tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 } });
      // once the hero has left the screen nothing of it stays painted
      ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: function (st) { hero.style.visibility = st.isActive ? '' : 'hidden'; } });
      tl.to('.ahero__h1', { scale: 0.94, yPercent: 5, ease: 'none', duration: 1 }, 0)
        .to('.ahero__intro,.ahero__meta', { y: -30, opacity: 0, ease: 'none', duration: 0.35 }, 0);
    }
    // B19-style side entries: each flat band slides in from alternating sides
    $$('.trio__line').forEach(function (l, i) {
      var dir = parseFloat(l.getAttribute('data-from')) || (i % 2 ? 1 : -1), d = [160, 110, 180][i % 3];
      gsap.fromTo(l, { x: dir * d }, { x: 0, ease: 'none', scrollTrigger: { trigger: l, start: 'top 92%', end: 'top 48%', scrub: 0.6 } });
    });
    // photos rock gently as they cross the viewport
    $$('[data-shot]').forEach(function (s, i) {
      var dir = i % 2 ? -1 : 1;
      gsap.fromTo(s, { rotation: 3 * dir, yPercent: 3 }, { rotation: -2.4 * dir, yPercent: -3, ease: 'none', scrollTrigger: { trigger: s, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    // K72 sticky cards: the card underneath scales down and tilts as the next one arrives
    // wide screens only: below 900px the cards are a plain stack
    if (matchMedia('(min-width:901px)').matches) $$('[data-steps]').forEach(function (list) {
      var steps = $$('.stage', list);
      steps.forEach(function (s, i) {
        var next = steps[i + 1]; if (!next) return;
        // the card's copy fades as the next one slides over it, so no text is left under another card
        var tl = gsap.timeline({ defaults: { ease: 'none' },
          scrollTrigger: { trigger: next, start: 'top bottom', end: function () { return 'top ' + (parseFloat(getComputedStyle(next).top) || 0) + 'px'; }, scrub: true, invalidateOnRefresh: true } });
        tl.to(s, { scale: 0.92, rotation: i % 2 ? 2.2 : -2.2, yPercent: -2, duration: 1 }, 0)
          .to(s.children, { opacity: 0, duration: 0.45 }, 0.3);
      });
    });
    initPrinciples();
  }

  function enter() {
    if (!motion) { $$('.ahero__word').forEach(function (w) { w.classList.add('is-in'); }); return; }
    var w = D.querySelector('.ahero__word');
    if (w) gsap.fromTo(w, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.6, ease: 'expo.out', delay: 0.15, onStart: function () { w.classList.add('is-in'); }, clearProps: 'opacity,transform' });
  }

  initSpot();
  initScroll();
  if (W.GC && GC.onReady) GC.onReady(enter); else enter();
  addEventListener('load', function () { if (gs) ScrollTrigger.refresh(); });
})();
