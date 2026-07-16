/* ============================================================
   GC — shared engine: cursor / preloader / wipes / reveals /
   nav / marquee / carousel / magnetic / smooth scroll
   ============================================================ */
(function () {
  'use strict';

  /* ---------- smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    if (window.gsap && window.ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
    }
  }
  window.__lenis = lenis;

  /* ---------- custom cursor ---------- */
  const fine = window.matchMedia('(pointer:fine)').matches;
  if (fine) {
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    ring.innerHTML = '<span class="cursor-label"></span>';
    document.body.append(dot, ring);
    const label = ring.querySelector('.cursor-label');
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    });
    (function loop() {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    const bindCursor = root => {
      root.querySelectorAll('a,button,[data-cursor]').forEach(el => {
        if (el.__cb) return; el.__cb = true;
        el.addEventListener('mouseenter', () => {
          const t = el.getAttribute('data-cursor');
          if (t) { ring.classList.add('is-view'); label.textContent = t; }
          else ring.classList.add('is-hover');
        });
        el.addEventListener('mouseleave', () => ring.classList.remove('is-hover', 'is-view'));
      });
    };
    bindCursor(document);
    window.__bindCursor = bindCursor;
  }

  /* ---------- grain ---------- */
  const grain = document.createElement('div');
  grain.className = 'grain';
  document.body.appendChild(grain);

  /* ---------- page wipe ---------- */
  const wipe = document.createElement('div');
  wipe.className = 'wipe enter';
  wipe.innerHTML = '<span class="w1"></span><span class="w2"></span>';
  document.body.appendChild(wipe);
  setTimeout(() => wipe.remove(), 1100);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || a.target === '_blank') return;
    e.preventDefault();
    const w = document.createElement('div');
    w.className = 'wipe leave';
    w.innerHTML = '<span class="w1"></span><span class="w2"></span>';
    document.body.appendChild(w);
    setTimeout(() => (location.href = href), 620);
  });

  /* ---------- nav ---------- */
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = 0;
    const onScroll = y => {
      if (y > 140 && y > lastY + 4) nav.classList.add('hidden');
      else if (y < lastY - 4 || y < 140) nav.classList.remove('hidden');
      lastY = y;
    };
    if (lenis) lenis.on('scroll', e => onScroll(e.scroll));
    else addEventListener('scroll', () => onScroll(scrollY), { passive: true });

    const burger = nav.querySelector('.nav-burger');
    const overlay = document.querySelector('.menu-overlay');
    if (burger && overlay) {
      burger.addEventListener('click', () => {
        const open = overlay.classList.toggle('open');
        nav.classList.toggle('menu-open', open);
        nav.style.mixBlendMode = open ? 'normal' : '';
        if (lenis) open ? lenis.stop() : lenis.start();
      });
      overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        overlay.classList.remove('open'); nav.classList.remove('menu-open');
        nav.style.mixBlendMode = ''; if (lenis) lenis.start();
      }));
    }
  }

  /* ---------- word splitter ---------- */
  document.querySelectorAll('.word-reveal').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(w => `<span class="w"><i>${w}</i></span>`).join(' ');
    el.querySelectorAll('.w i').forEach((i, k) => (i.style.transitionDelay = `${k * 0.035}s`));
  });

  /* ---------- reveal observer ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('[data-reveal],[data-stagger],.word-reveal,.line-grow').forEach(el => io.observe(el));

  /* ---------- marquee duplication ---------- */
  document.querySelectorAll('.marquee-track').forEach(t => { t.innerHTML += t.innerHTML; });

  /* ---------- magnetic ---------- */
  if (fine) {
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * strength}px,${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)';
        el.style.transform = 'translate(0,0)';
        setTimeout(() => (el.style.transition = ''), 600);
      });
    });
  }

  /* ---------- tilt ---------- */
  if (fine) {
    document.querySelectorAll('[data-tilt]').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1000px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1)';
        el.style.transform = 'perspective(1000px) rotateY(0) rotateX(0)';
        setTimeout(() => (el.style.transition = ''), 700);
      });
    });
  }

  /* ---------- carousel ---------- */
  document.querySelectorAll('[data-carousel]').forEach(root => {
    const track = root.querySelector('.carousel-track');
    const slides = [...track.children];
    const dotsBox = root.querySelector('.carousel-dots');
    const count = root.querySelector('.carousel-count');
    let i = 0, timer;
    slides.forEach((_, k) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', 'slide ' + (k + 1));
      b.addEventListener('click', () => go(k));
      dotsBox && dotsBox.appendChild(b);
    });
    const dots = dotsBox ? [...dotsBox.children] : [];
    function render() {
      track.style.transform = `translateX(${-i * 100}%)`;
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    }
    function go(k) { i = (k + slides.length) % slides.length; render(); restart(); }
    function restart() { clearInterval(timer); timer = setInterval(() => go(i + 1), 5200); }
    root.querySelector('[data-car-prev]')?.addEventListener('click', () => go(i - 1));
    root.querySelector('[data-car-next]')?.addEventListener('click', () => go(i + 1));
    /* drag */
    let sx = null, dx = 0;
    track.addEventListener('pointerdown', e => { sx = e.clientX; track.style.transition = 'none'; });
    addEventListener('pointermove', e => {
      if (sx === null) return;
      dx = e.clientX - sx;
      track.style.transform = `translateX(calc(${-i * 100}% + ${dx}px))`;
    });
    addEventListener('pointerup', () => {
      if (sx === null) return;
      track.style.transition = '';
      if (Math.abs(dx) > 60) go(dx < 0 ? i + 1 : i - 1); else render();
      sx = null; dx = 0;
    });
    render(); restart();
  });

  /* ---------- counters ---------- */
  const cio = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target, target = parseFloat(el.dataset.count), suf = el.dataset.suffix || '';
      const t0 = performance.now(), dur = 1600;
      (function tick(t) {
        const p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(target * e) + suf;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
      cio.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

  /* ---------- footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(el => (el.textContent = new Date().getFullYear()));
})();
