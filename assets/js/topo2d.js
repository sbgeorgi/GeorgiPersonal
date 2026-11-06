/* topo2d.js - Canvas 2D contour field (K37 TopoLayer) behind subpage heroes and the home no-WebGL fallback.
   Auto-mounts every canvas[data-topo]. window.Topo2D.mount(canvas,{seed,ridge:[x,y]}) -> {destroy(), setPointer(x,y)}.
   Pointer coordinates are CSS px relative to the canvas box. Colour = getComputedStyle(canvas).color (the chapter ink). */
(function () {
  'use strict';

  var LEVELS = 22, L0 = 0.06, DL = 0.042, DATUM = 10, TICK = 33, DT = 0.35;
  var RAMP = ['#2a1b6e', '#2f5fe0', '#17b3a3', '#c9f24f', '#ffb340', '#ff6a3d', '#e2376e'];
  var AMBER = '#ffb340';
  var rampRGB = RAMP.map(function (h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; });
  var rampCss = [];
  for (var li = 0; li < LEVELS; li++) {
    var q = li / (LEVELS - 1) * (RAMP.length - 1), k = Math.min(RAMP.length - 2, Math.floor(q)), f = q - k;
    rampCss.push('rgb(' + [0, 1, 2].map(function (c) { return Math.round(rampRGB[k][c] + (rampRGB[k + 1][c] - rampRGB[k][c]) * f); }).join(',') + ')');
  }
  var reduceMq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function hashSeed(s) {
    var n = parseFloat(s);
    if (isFinite(n)) return n >>> 0;
    var h = 2166136261;
    s = String(s || 'topo');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // seeded value noise: 256-entry permutation + value table, quintic interpolation
  function makeNoise(seed) {
    var a = seed >>> 0 || 1;
    function rnd() { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var perm = new Uint8Array(512), val = new Float32Array(256), i;
    for (i = 0; i < 256; i++) { perm[i] = i; val[i] = rnd(); }
    for (i = 255; i > 0; i--) { var j = (rnd() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (i = 0; i < 256; i++) perm[i + 256] = perm[i];
    function n2(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      xi &= 255; yi &= 255;
      var u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
      var a0 = val[perm[perm[xi] + yi]], b0 = val[perm[perm[xi + 1] + yi]],
          c0 = val[perm[perm[xi] + yi + 1]], d0 = val[perm[perm[xi + 1] + yi + 1]];
      return a0 + (b0 - a0) * u + (c0 - a0) * v + (a0 - b0 - c0 + d0) * u * v;
    }
    return function fbm(x, y) { // 4 octaves, 0..1
      return (n2(x, y) + 0.5 * n2(x * 2 + 17.3, y * 2 + 9.1) + 0.25 * n2(x * 4 + 3.7, y * 4 + 31.9) + 0.125 * n2(x * 8 + 11.2, y * 8 + 5.5)) / 1.875;
    };
  }

  function parseColor(s) {
    var m = (s || '').match(/-?[\d.]+/g);
    if (!m || m.length < 3) return [241, 236, 226];
    var sc = /^color\(/.test(s) ? 255 : 1;
    return [Math.round(m[0] * sc), Math.round(m[1] * sc), Math.round(m[2] * sc)];
  }

  function mount(canvas, opts) {
    if (!canvas || canvas.__topo) return canvas && canvas.__topo;
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    if (!ctx) return { destroy: function () {}, setPointer: function () {} };
    if (!canvas.hasAttribute('aria-hidden')) canvas.setAttribute('aria-hidden', 'true');

    var seed = hashSeed(opts.seed != null ? opts.seed : canvas.getAttribute('data-topo-seed'));
    var ridge = opts.ridge;
    if (!ridge) {
      var ra = (canvas.getAttribute('data-topo-ridge') || '').split(',').map(parseFloat);
      if (ra.length === 2 && isFinite(ra[0]) && isFinite(ra[1])) ridge = ra;
    }
    var fbm = makeNoise(seed), ox = (seed % 997) * 0.37, oy = (seed % 463) * 0.53;

    var W = 0, H = 0, dpr = 1, cs = 10, cols = 0, rows = 0, vals = null, edgeX = null, edgeY = null, nb = null;
    var t = 0, tick = 0, lastTick = -1e9;
    var paths = [], datumDash = null;
    var ink = [241, 236, 226], inkStr = '';
    var mx = 0, my = 0, lx = 0, ly = 0, havePtr = false, lensOn = false, lensMoving = false;
    var visible = true, running = false, raf = 0, last = 0, t0 = 0, destroyed = false, reduce = reduceMq.matches;
    var stats = { ms: 0, build: 0, frames: 0 }; // moving averages (ms): draw() and field+contours

    function readInk() {
      var s = getComputedStyle(canvas).color;
      if (s !== inkStr) { inkStr = s; ink = parseColor(s); }
    }
    function rgba(a) { return 'rgba(' + ink[0] + ',' + ink[1] + ',' + ink[2] + ',' + a + ')'; }

    function size() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return false;
      dpr = Math.min(window.devicePixelRatio || 1, w > 1600 ? 1.5 : 2);
      var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      W = w; H = h;
      cs = w < 720 ? 14 : 10;
      cols = Math.ceil(w / cs) + 1; rows = Math.ceil(h / cs) + 1;
      vals = new Float32Array(cols * rows);
      return true;
    }

    function field() {
      var s = 0.0024, tx = t * 0.012, ty = t * 0.006, i, j, x, y, n, p = 0;
      var rx = 0, ry = 0, hasR = !!ridge;
      if (hasR) { rx = ridge[0] + 0.03 * Math.sin(t * 0.021); ry = ridge[1] + 0.03 * Math.cos(t * 0.017); }
      for (j = 0; j < rows; j++) {
        y = j * cs;
        for (i = 0; i < cols; i++, p++) {
          x = i * cs;
          n = 0.5 + (fbm(x * s + tx + ox, y * s - ty + oy) - 0.5) * 2.4;
          if (hasR) { var dx = x / W - rx, dy = y / H - ry; n += 0.42 * Math.exp(-(dx * dx * 5 + dy * dy * 7)); }
          vals[p] = 0.5 + 0.5 * Math.tanh((n - 0.5) * 2.4); // soft squash keeps contours alive near the extremes
        }
      }
    }

    // marching squares: one Path2D per level; datum additionally chained into long polylines so the dash is continuous
    function contours() {
      var L, p, i, j, a, b, c, d, mn, mx2, lo, hi, v, code, e, x0, y0;
      for (L = 0; L < LEVELS; L++) paths[L] = new Path2D();
      var dpts = [], dx = [], dy = [];
      for (j = 0; j < rows - 1; j++) {
        y0 = j * cs;
        for (i = 0; i < cols - 1; i++) {
          x0 = i * cs; p = j * cols + i;
          a = vals[p]; b = vals[p + 1]; c = vals[p + cols + 1]; d = vals[p + cols];
          mn = a < b ? a : b; if (c < mn) mn = c; if (d < mn) mn = d;
          mx2 = a > b ? a : b; if (c > mx2) mx2 = c; if (d > mx2) mx2 = d;
          lo = Math.ceil((mn - L0) / DL); if (lo < 0) lo = 0;
          hi = Math.floor((mx2 - L0) / DL); if (hi > LEVELS - 1) hi = LEVELS - 1;
          for (L = lo; L <= hi; L++) {
            v = L0 + L * DL;
            code = (a >= v ? 8 : 0) | (b >= v ? 4 : 0) | (c >= v ? 2 : 0) | (d >= v ? 1 : 0);
            if (code === 0 || code === 15) continue;
            // edge crossings: T(top a-b), R(right b-c), B(bottom d-c), Lf(left a-d)
            var tx = x0 + cs * (v - a) / (b - a), ty = y0,
                rx2 = x0 + cs, ry2 = y0 + cs * (v - b) / (c - b),
                bx = x0 + cs * (v - d) / (c - d), by = y0 + cs,
                lx2 = x0, ly2 = y0 + cs * (v - a) / (d - a);
            var pa = paths[L], seg = null;
            switch (code) {
              case 1: case 14: seg = [lx2, ly2, bx, by]; break;
              case 2: case 13: seg = [bx, by, rx2, ry2]; break;
              case 3: case 12: seg = [lx2, ly2, rx2, ry2]; break;
              case 4: case 11: seg = [tx, ty, rx2, ry2]; break;
              case 6: case 9: seg = [tx, ty, bx, by]; break;
              case 7: case 8: seg = [tx, ty, lx2, ly2]; break;
              case 5: case 10:
                e = (a + b + c + d) * 0.25 >= v;
                var s1 = (code === 5) === e ? [tx, ty, lx2, ly2] : [tx, ty, rx2, ry2];
                seg = (code === 5) === e ? [bx, by, rx2, ry2] : [lx2, ly2, bx, by];
                pa.moveTo(s1[0], s1[1]); pa.lineTo(s1[2], s1[3]);
                if (L === DATUM) dpts.push(s1);
                break;
            }
            pa.moveTo(seg[0], seg[1]); pa.lineTo(seg[2], seg[3]);
            if (L === DATUM) dpts.push(seg);
          }
        }
      }
      datumDash = chain(dpts);
    }

    // join segments end-to-end by matching endpoints (keys are the exact shared edge crossings)
    function chain(segs) {
      var path = new Path2D(), map = {}, n = segs.length, i, s, k0, k1, used = new Uint8Array(n);
      function key(x, y) { return Math.round(x * 64) + ',' + Math.round(y * 64); }
      for (i = 0; i < n; i++) {
        s = segs[i]; k0 = key(s[0], s[1]); k1 = key(s[2], s[3]);
        (map[k0] || (map[k0] = [])).push(i); (map[k1] || (map[k1] = [])).push(i);
      }
      function next(k, from) {
        var l = map[k]; if (!l) return -1;
        for (var q = 0; q < l.length; q++) if (!used[l[q]] && l[q] !== from) return l[q];
        return -1;
      }
      for (i = 0; i < n; i++) {
        if (used[i]) continue;
        used[i] = 1; s = segs[i];
        // walk backwards to an open end first
        var pts = [s[0], s[1], s[2], s[3]], ex = s[2], ey = s[3], cur, g;
        for (var dir = 0; dir < 2; dir++) {
          for (;;) {
            cur = next(key(ex, ey), -1); if (cur < 0) break;
            used[cur] = 1; g = segs[cur];
            if (key(g[0], g[1]) === key(ex, ey)) { ex = g[2]; ey = g[3]; } else { ex = g[0]; ey = g[1]; }
            if (dir === 0) pts.push(ex, ey); else pts.unshift(ex, ey);
          }
          if (dir === 0) { ex = pts[0]; ey = pts[1]; }
        }
        path.moveTo(pts[0], pts[1]);
        for (var m = 2; m < pts.length; m += 2) path.lineTo(pts[m], pts[m + 1]);
      }
      return path;
    }

    function draw() {
      var t1 = performance.now(), L, r = (W < 720 ? 120 : 170);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash([]);
      for (L = 0; L < LEVELS; L++) {
        if (L === DATUM) continue;
        var major = L % 4 === 0;
        ctx.strokeStyle = rgba(major ? 0.42 : 0.13); ctx.lineWidth = major ? 1.15 : 0.7;
        ctx.stroke(paths[L]);
      }
      ctx.strokeStyle = AMBER; ctx.lineWidth = 1.1; ctx.setLineDash([6, 5]);
      ctx.stroke(datumDash);
      ctx.setLineDash([]);
      if (lensOn) {
        ctx.save();
        ctx.beginPath(); ctx.arc(lx, ly, r, 0, 6.2832); ctx.clip();
        for (L = 0; L < LEVELS; L++) {
          ctx.strokeStyle = rampCss[L]; ctx.lineWidth = (L % 4 === 0 ? 1.15 : 0.7) * 1.5;
          ctx.stroke(paths[L]);
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(lx, ly, r, 0, 6.2832);
        ctx.strokeStyle = rgba(0.6); ctx.lineWidth = 1; ctx.stroke();
      }
      stats.ms += (performance.now() - t1 - stats.ms) * 0.1; stats.frames++;
    }

    function rebuild() { var b0 = performance.now(); readInk(); field(); contours(); stats.build += (performance.now() - b0 - stats.build) * 0.1; }

    function idleTarget(sec) { return [W * (0.5 + 0.28 * Math.sin(0.7 * sec)), H * (0.6 + 0.15 * Math.cos(0.9 * sec))]; }

    function frame(now) {
      raf = 0;
      if (!running || destroyed) return;
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      var rebuilt = false;
      if (now - lastTick >= TICK) { lastTick = now; t += DT; rebuild(); rebuilt = true; }
      else readInk();
      var tx, ty;
      if (havePtr) { tx = mx; ty = my; } else { var it = idleTarget((now - t0) / 1000); tx = it[0]; ty = it[1]; }
      var k = 1 - Math.pow(1 - 0.12, dt * 60);
      lx += (tx - lx) * k; ly += (ty - ly) * k;
      lensOn = true;
      draw();
      loop();
    }
    function loop() { if (running && !raf && !destroyed) raf = requestAnimationFrame(frame); }

    function syncRun() {
      var want = visible && !document.hidden && !reduce && !destroyed && W > 0;
      if (want && !running) { running = true; last = performance.now(); loop(); }
      else if (!want && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }

    var stillRaf = 0;
    function drawStill() { // reduced motion / paused: one frame, redrawn on demand
      if (stillRaf || destroyed || !W) return;
      stillRaf = requestAnimationFrame(function () { stillRaf = 0; if (destroyed) return; readInk(); draw(); });
    }

    function setPointer(x, y) {
      mx = x; my = y;
      if (!havePtr) { havePtr = true; if (!lensOn) { lx = x; ly = y; } }
      if (reduce || !running) { lx = x; ly = y; lensOn = true; if (!paths[0]) rebuild(); drawStill(); }
    }
    function onMove(e) {
      var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return; // pointer is elsewhere on the page
      setPointer(x, y);
    }
    function onChapter() { // colour may be mid-transition: redraw a few times while paused
      if (running) return;
      [0, 450, 1000].forEach(function (d) { setTimeout(function () { if (!destroyed && !running) { readInk(); draw(); } }, d); });
    }
    function onVis() { syncRun(); }
    function onMq() { reduce = reduceMq.matches; syncRun(); if (reduce) { drawStill(); } }

    var ro = new ResizeObserver(function () {
      if (!size()) return;
      rebuild();
      if (!lensOn) { lx = W * 0.5; ly = H * 0.6; }
      if (!running) { draw(); }
      syncRun();
    });
    var io = new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; syncRun(); });

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('gc:chapter', onChapter);
    window.addEventListener('gc:chapter', onChapter);
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', onMq);
    t0 = performance.now();
    ro.observe(canvas); io.observe(canvas);
    if (size()) { rebuild(); lx = W * 0.5; ly = H * 0.6; draw(); syncRun(); }

    var api = {
      stats: stats,
      setPointer: setPointer,
      destroy: function () {
        destroyed = true; syncRun(); ro.disconnect(); io.disconnect();
        window.removeEventListener('pointermove', onMove);
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('gc:chapter', onChapter);
        window.removeEventListener('gc:chapter', onChapter);
        if (reduceMq.removeEventListener) reduceMq.removeEventListener('change', onMq);
        if (stillRaf) cancelAnimationFrame(stillRaf);
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.__topo = null;
      }
    };
    canvas.__topo = api;
    return api;
  }

  window.Topo2D = { mount: mount };
  function auto() { var l = document.querySelectorAll('canvas[data-topo]'); for (var i = 0; i < l.length; i++) mount(l[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
