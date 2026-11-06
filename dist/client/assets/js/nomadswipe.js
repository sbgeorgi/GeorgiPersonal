/* nomadswipe.html page behaviour: K72 sticky process cards, preference bars, FAQ accordion.
   Everything here is progressive: without gsap / ScrollTrigger or under reduced motion the content is already in its final state. */
(function () {
  var D = document, H = D.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var g = window.gsap, ST = window.ScrollTrigger;
  var live = !!(g && ST && !reduced && H.classList.contains('motion'));
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }

  /* ---------- core loop: each card scales back and tips as the next one rides over it (K72) ---------- */
  if (live) {
    var steps = $$('.step');
    steps.forEach(function (s, i) {
      var next = steps[i + 1]; if (!next) return;
      g.to(s, {
        scale: 0.92, rotation: i % 2 ? 2.2 : -2.2, yPercent: -2, ease: 'none',
        scrollTrigger: { trigger: next, start: 'top bottom', end: function () { return 'top ' + parseFloat(getComputedStyle(s).top) + 'px'; }, scrub: true, invalidateOnRefresh: true }
      });
      /* the next card ends up fully over this one: fade its text out so nothing is ever read from under another card */
      g.to(s.children, {
        opacity: 0, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: next, start: function () { return 'top ' + (parseFloat(getComputedStyle(s).top) + s.offsetHeight * 1.3) + 'px'; }, end: function () { return 'top ' + (parseFloat(getComputedStyle(s).top) + s.offsetHeight * 0.55) + 'px'; }, scrub: true, invalidateOnRefresh: true }
      });
    });

    /* preference bars draw in once */
    var bars = D.querySelector('.bars');
    if (bars) {
      bars.classList.add('is-live');
      ST.create({ trigger: bars, start: 'top 80%', once: true, onEnter: function () {
        g.to($$('.bar__fill', bars), { scaleX: 1, duration: 1.5, ease: 'expo.out', stagger: 0.12 });
      } });
    }
  }

  /* ---------- FAQ: buttons + aria-expanded + region, height tween (the one place layout height is animated, as the brief asks) ---------- */
  var items = $$('.faq__item');
  items.forEach(function (it, i) {
    var btn = it.querySelector('.faq__q'), panel = it.querySelector('.faq__a'), anim = null;
    function set(open) { btn.setAttribute('aria-expanded', open ? 'true' : 'false'); it.classList.toggle('is-open', open); }
    function toggle(open) {
      if (anim) anim.cancel();
      var dur = reduced ? 0 : 520, from = panel.hidden ? 0 : panel.getBoundingClientRect().height;
      set(open);
      if (open) panel.hidden = false;
      var to = open ? panel.scrollHeight : 0;
      if (!dur || !panel.animate) { panel.hidden = !open; return; }
      anim = panel.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: dur, easing: 'cubic-bezier(.7,0,.2,1)' });
      anim.onfinish = function () { anim = null; panel.hidden = !open; if (ST) ST.refresh(); };
    }
    // answers ship visible in the HTML; JS collapses all but the first
    var open0 = i === 0; set(open0); panel.hidden = !open0;
    btn.addEventListener('click', function () { toggle(btn.getAttribute('aria-expanded') !== 'true'); });
  });
  /* ---------- hero lens: park its idle position behind the phone so the copy stays on calm ground; a real pointer still takes over ---------- */
  (function () {
    var c = D.querySelector('canvas[data-topo]'), ph = D.querySelector('.nh .phone');
    function park() {
      if (!c || !c.__topo || !ph || (window.GC && GC.pointer && GC.pointer.active)) return;
      var a = c.getBoundingClientRect(), b = ph.getBoundingClientRect();
      c.__topo.setPointer(b.left + b.width / 2 - a.left, b.top + b.height / 2 - a.top);
    }
    park(); addEventListener('load', park); addEventListener('resize', park);
  })();
})();
