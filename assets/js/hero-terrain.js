/* Hero: the name cut into a WebGL relief of the Tucson basin, lit by today's sun, read through a spectral lens.
   Raw WebGL1, auto-inits on section.hero. Needs Sun (sun.js). Uses GC, gsap/ScrollTrigger and Topo2D when present.
   QA: ?sun=HH:MM (Sun.now), ?lens=x,y (0-1, pins the lens), ?dpr=N (pins the pixel ratio, no adaptation). */
(function () {
  'use strict';
  var hero = document.querySelector('section.hero');
  if (!hero || hero.__terrain || !window.Sun) return;
  hero.__terrain = true;
  var pin = hero.querySelector('.hero__pin') || hero, canvas = hero.querySelector('.hero__gl'), h1 = hero.querySelector('.hero__name');
  var root = document.documentElement, qs = new URLSearchParams(location.search);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = matchMedia('(pointer: coarse)').matches;
  var motionOn = root.classList.contains('motion');
  var FONT = '"Unbounded","Arial Black",Impact,sans-serif';
  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var lerp3 = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  var RAMP = ['#2a1b6e', '#2f5fe0', '#17b3a3', '#c9f24f', '#ffb340', '#ff6a3d', '#e2376e'];
  var RAMPV = RAMP.map(function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.substr(i, 2), 16) / 255; }); });
  function rampCss(t) { // t 0..1 -> css colour on the spectral ramp
    var f = clamp(t, 0, 1) * 6, i = Math.min(5, Math.floor(f)), c = lerp3(RAMPV[i], RAMPV[i + 1], f - i);
    return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
  }

  /* ---------- state ---------- */
  var S = { p: 0 };                        // scroll story progress 0..1 (GSAP tweens this)
  var st = {
    W: 0, H: 0, dpr: 1, letterIn: 0, lensIn: 0, T: 0, last: 0, vis: true, raf: 0, gl: null, frames: 0, ftSum: 0,
    dprPinned: qs.has('dpr') ? +qs.get('dpr') : 0, lx: 0, ly: 0, hasLens: false,
    ptr: null, ptrIn: false, ptrT: -1e9, dirty: true, hudT: 0, hudDue: true, p1T: -1e9, p1Dirty: true,
    sunMin: 0, shownP: -1, light: null, lightMin: -1e9
  };
  var L = null;                            // name layout, computed once per size
  var pin01 = (qs.get('lens') || '').split(',').map(parseFloat);
  var lensPinned = pin01.length === 2 && isFinite(pin01[0]) && isFinite(pin01[1]);

  /* ---------- name layout: JS decides, canvas mask and DOM h1 follow ---------- */
  var probe = null, mprobe = null, lines = h1 ? h1.querySelectorAll('.hero__line') : [];
  var hud = hero.querySelector('.hud'), dial = hero.querySelector('.sundial'), copyEl = hero.querySelector('.hero__copy');
  var cornerEl = hero.querySelector('.hero__corner'), scaleEl = hero.querySelector('.hero__scale');
  var measCtx = document.createElement('canvas').getContext('2d');
  var PORTRAIT_AR = 0.625;                                              // W/H at or below this: the name turns a quarter (phones)
  function inkOf(txt) {                                                 // ink extent of a line at 100px, in em (same letter-spacing as drawName)
    var c = measCtx, ls = -5, l = 0, r = 0; c.font = '800 100px ' + FONT;
    if ('letterSpacing' in c) { c.letterSpacing = ls + 'px'; var m = c.measureText(txt); l = -m.actualBoundingBoxLeft; r = m.actualBoundingBoxRight; c.letterSpacing = '0px'; }
    else { var x = 0; for (var i = 0; i < txt.length; i++) { var g = c.measureText(txt[i]); if (!i) l = -g.actualBoundingBoxLeft; r = x + g.actualBoundingBoxRight; x += g.width + ls; } }
    return { l: l / 100, r: r / 100 };
  }
  function pageMargin() {
    if (!mprobe) { mprobe = document.createElement('i'); mprobe.setAttribute('aria-hidden', 'true'); mprobe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding-left:var(--m,24px)'; hero.appendChild(mprobe); }
    return parseFloat(getComputedStyle(mprobe).paddingLeft) || 24;
  }
  function computeLayout() {
    var W = pin.clientWidth, H = pin.clientHeight;
    if (!h1 || !W || !H) return null;
    var portrait = W / H <= PORTRAIT_AR, M = pageMargin();
    hero.style.setProperty('--nfs', '100px');
    hero.style.setProperty('--nx', '0px'); hero.style.setProperty('--ny', '0px'); hero.style.setProperty('--nrot', '0deg');
    if (!probe) { probe = document.createElement('i'); probe.setAttribute('aria-hidden', 'true'); probe.className = 'hero__probe'; lines[lines.length - 1].appendChild(probe); }
    var hr = h1.getBoundingClientRect(), wu = lines[lines.length - 1].getBoundingClientRect().width / 100;
    var y2u = (probe.getBoundingClientRect().bottom - hr.top) / 100;   // baseline of line 2, in em
    var c = measCtx; c.font = '800 100px ' + FONT;
    var cm = c.measureText('H'), capR = cm.actualBoundingBoxAscent ? cm.actualBoundingBoxAscent / 100 : 0.7;
    if (!(wu > 0) || !(y2u > 0)) return null;
    var ia = inkOf(lines[0].textContent.trim().toUpperCase()), ib = inkOf(lines[lines.length - 1].textContent.trim().toUpperCase());
    var inkW = Math.max(ib.r - ib.l, ia.r - ia.l, 0.5);
    var fs, tx, ty, rot = 0, edge = 0, lh = 0.86, topM = 76;
    if (!portrait) {
      fs = Math.min((W - 2 * M) / inkW, 0.5 * H / (lh + capR));         // CHERTKOV fills the width between the margins; never more than half the height
      if (parseFloat(getComputedStyle(hero).getPropertyValue('--short'))) {  // short window (hero.css): the name fits the band under the copy and the dial
        var lim = 0; [copyEl, dial].forEach(function (e) { if (e && e.offsetWidth) lim = Math.max(lim, e.offsetTop + e.offsetHeight); });
        fs = Math.max(20, Math.min(fs, (H - M - lim - 6) / (y2u + 0.006)));
      }
      tx = M - ib.l * fs; ty = H - M - 0.006 * fs - y2u * fs;            // whole name inside the fold: baseline one margin above the bottom
    } else {
      rot = 90;
      fs = Math.min((H - topM - M) / inkW, (W - 3 * M - 150) / (lh + capR)); // runs down the right side, all of it on the first screen
      var y1p = (y2u - lh) * fs;
      tx = W - M + y1p - capR * fs; ty = topM - ib.l * fs;
      edge = tx - y2u * fs;                                            // left edge of the name block
    }
    var y1 = (y2u - lh) * fs;
    return { W: W, H: H, M: M, fs: fs, tx: tx, ty: ty, rot: rot, portrait: portrait, y1: y1, y2: y2u * fs, edge: edge, capR: capR,
      top: portrait ? topM : ty + y1 - capR * fs, blockW: (lh + capR) * fs,
      box: portrait ? [edge, topM, edge + (lh + capR) * fs, topM + inkW * fs] : [M, ty + y1 - capR * fs, M + inkW * fs, H - M] };
  }
  function applyLayout() {
    hero.style.setProperty('--nfs', L.fs.toFixed(2) + 'px');
    hero.style.setProperty('--nx', L.tx.toFixed(2) + 'px'); hero.style.setProperty('--ny', L.ty.toFixed(2) + 'px');
    hero.style.setProperty('--nrot', L.rot + 'deg');
    hero.style.setProperty('--name-edge', L.portrait ? Math.round(L.edge) + 'px' : '0px');
    hero.style.setProperty('--name-h', L.portrait ? '0px' : Math.round(L.H - L.top) + 'px');
    hero.classList.add('is-fitted'); fitUI();
  }
  /* Right column (landscape): corner note and scale from the top, HUD under them, dial rising from just above the name. If the column is too short the HUD
     sheds its sparkline (lite), then docks left of the dial, then goes. Portrait: copy, HUD (two readouts), dial stack down the left column.
     Nothing in the hero ever overlaps; every step is checked against the measured boxes. */
  function fitUI() {
    var cl = hero.classList, off = function (e) { return e && e.offsetWidth ? { t: e.offsetTop, b: e.offsetTop + e.offsetHeight, l: e.offsetLeft, r: e.offsetLeft + e.offsetWidth } : null; };
    var place = function () {
      if (L.portrait) { hero.style.setProperty('--dial-h', (dial ? dial.offsetHeight : 0) + 'px'); return; }
      var cb = off(cornerEl), sc = off(scaleEl), top = cb ? cb.b : 112;
      if (sc) { scaleEl.style.top = (top + 8) + 'px'; top = top + 8 + scaleEl.offsetHeight; }
      if (hud) hud.style.top = cl.contains('hud-dock') ? '' : (top + 22) + 'px';
      fitUI.top = top;
    };
    var clear = function () {
      var h = off(hud), d = off(dial), cp = off(copyEl);
      if (!h || hud.hidden || cl.contains('hud-off')) return true;
      if (L.portrait) return !cp || h.t >= cp.b + 16;
      if (cl.contains('hud-dock')) return h.t >= fitUI.top + 14 && h.l >= (cp ? cp.r : 0) + 24 && (!d || h.r + 20 <= d.l);
      return !d || h.b + 18 <= d.t;
    };
    var steps = L.portrait ? [[], ['hud-off']] : [[], ['hud-dock'], ['hud-dock', 'hud-lite'], ['hud-dock', 'hud-lite', 'hud-off']];
    for (var i = 0; i < steps.length; i++) {
      ['hud-lite', 'hud-dock', 'hud-off'].forEach(function (c) { cl.remove(c); }); steps[i].forEach(function (c) { cl.add(c); });
      if (!L.portrait && scaleEl) scaleEl.style.top = '';
      place(); if (clear()) break;
    }
    st.boxDirty = true; st.copyB = copyEl ? copyEl.offsetTop + copyEl.offsetHeight : 0;
    st.keep = keepRects();
  }
  function keepRects() {                                                // boxes the lens must stay out of (copy, corner note, scale, HUD, dial)
    var out = [];
    [copyEl, cornerEl, scaleEl, hud, dial].forEach(function (e) {
      if (e && !e.hidden && e.offsetWidth && getComputedStyle(e).display !== 'none') out.push([e.offsetLeft, e.offsetTop, e.offsetLeft + e.offsetWidth, e.offsetTop + e.offsetHeight]);
    });
    return out;
  }
  function lensR() { return L.portrait || L.W < 700 ? 88 : clamp(L.W * 0.105, 112, 164); }
  function avoid(x, y, R, rects) {                                      // push a circle out of every rectangle (3 relaxation passes)
    var pad = 16, need = R + pad;
    for (var k = 0; k < 3; k++) rects.forEach(function (r) {
      var cx = clamp(x, r[0], r[2]), cy = clamp(y, r[1], r[3]), dx = x - cx, dy = y - cy, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd >= need) return;
      if (dd > 0.001) { x = cx + dx / dd * need; y = cy + dy / dd * need; return; }
      var a = x - r[0], b = r[2] - x, t = y - r[1], u = r[3] - y, mn = Math.min(a, b, t, u);
      if (mn === a) x = r[0] - need; else if (mn === b) x = r[2] + need; else if (mn === t) y = r[1] - need; else y = r[3] + need;
    });
    return [x, y];
  }
  function restTarget(T) {                                              // idle path: slow Lissajous over the name / open basin, never over copy
    var W = L.W, H = L.H, R = lensR(), x, y;
    if (L.portrait) { x = W - R - 8; y = H * (0.72 + 0.1 * Math.sin(0.43 * T)); } // low on the right: whole circle on screen, below the first letters of the name
    else { x = W * (0.5 + 0.3 * Math.sin(0.31 * T)); y = L.top + (L.H - L.top) * (0.44 + 0.13 * Math.cos(0.43 * T)); }
    var p = avoid(x, y, R, st.keep || []);
    return [clamp(p[0], 0.3 * R, W - 0.3 * R), clamp(p[1], 0.3 * R, H - 0.3 * R)];
  }

  /* ---------- height mask (offscreen 2D) ---------- */
  var maskCv = document.createElement('canvas'), maskCtx = maskCv.getContext('2d');
  var tmpCv = document.createElement('canvas'), blurCv = document.createElement('canvas');
  function drawName(ctx, sc, color) {
    ctx.setTransform(sc, 0, 0, sc, 0, 0); ctx.translate(L.tx, L.ty); ctx.rotate(L.rot * Math.PI / 180);
    ctx.font = '800 ' + L.fs + 'px ' + FONT; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
    var ls = -0.05 * L.fs, names = [lines[0].textContent.trim().toUpperCase(), lines[lines.length - 1].textContent.trim().toUpperCase()];
    var ys = [L.y1, L.y2];
    for (var i = 0; i < 2; i++) {
      if ('letterSpacing' in ctx) { ctx.letterSpacing = ls + 'px'; ctx.fillText(names[i], 0, ys[i]); }
      else { var x = 0; for (var k = 0; k < names[i].length; k++) { ctx.fillText(names[i][k], x, ys[i]); x += ctx.measureText(names[i][k]).width + ls; } }
    }
  }
  function buildMask() {
    var sc = Math.min(1600, Math.round(L.W * Math.min(window.devicePixelRatio || 1, 1.5) * 0.5)) / L.W;
    var mw = Math.round(L.W * sc), mh = Math.round(L.H * sc);
    [maskCv, tmpCv, blurCv].forEach(function (c) { c.width = mw; c.height = mh; });
    var a = tmpCv.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.fillStyle = '#000'; a.fillRect(0, 0, mw, mh);
    drawName(a, sc, '#fff');                                           // crisp
    var b = blurCv.getContext('2d'), N = L.fs * 0.02 * sc; b.setTransform(1, 0, 0, 1, 0, 0); b.fillStyle = '#000'; b.fillRect(0, 0, mw, mh);
    if ('filter' in b) { b.filter = 'blur(' + N.toFixed(1) + 'px)'; b.drawImage(tmpCv, 0, 0); b.filter = 'none'; }
    else {                                                              // stacked shadowBlur passes
      b.shadowColor = '#fff'; b.shadowBlur = N * 2; b.shadowOffsetX = 4000;
      for (var i = 0; i < 3; i++) { b.save(); b.translate(-4000, 0); drawName(b, sc, '#fff'); b.restore(); }
    }
    var m = maskCtx; m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'source-over'; m.fillStyle = '#000'; m.fillRect(0, 0, mw, mh);
    m.globalCompositeOperation = 'lighter'; m.globalAlpha = 0.5; m.drawImage(blurCv, 0, 0); m.globalAlpha = 0.5; m.drawImage(tmpCv, 0, 0);
    m.globalAlpha = 1; m.globalCompositeOperation = 'source-over';
  }

  /* ---------- light: one sun vector drives the scene (A10: smooth factors only) ---------- */
  function lightFor(az, el) {
    var col = lerp3([0.55, 0.30, 0.80], [1, 0.55, 0.25], smooth(-4, 2, el));
    col = lerp3(col, [1, 0.85, 0.65], smooth(5, 14, el)); col = lerp3(col, [0.95, 0.95, 0.9], smooth(18, 32, el));
    var strength = smooth(-9, -1, el) * (0.95 + 0.4 * smooth(-1, 7, el) - 0.35 * smooth(30, 70, el));
    var eL = 0.5 * (el + 3 + Math.sqrt((el - 3) * (el - 3) + 4)) * Math.PI / 180;   // smooth max(el, ~3deg)
    var a = az * Math.PI / 180, ce = Math.cos(eL);
    var night = 1 - smooth(-10, -2, el), day = smooth(-2, 14, el);
    var moon = [0.45, 0.55, 0.85], mw = (0.2 + 0.2 * night) * night * 1.4 + 0.12 * night;
    var amb = lerp3([0.012, 0.016, 0.038], [0.045, 0.052, 0.075], day);
    amb = lerp3(amb, [0.07, 0.04, 0.09], smooth(-9, -2, el) * (1 - smooth(-2, 4, el)) * 0.8);
    var lsun = Math.max(col[0], col[1], col[2]) * strength, lmoon = Math.max(moon[1], moon[2]) * mw, wsun = lsun / (lsun + 0.9 * lmoon + 1e-4);
    var sx = Math.sin(a) * wsun - 0.62 * (1 - wsun), sy = Math.cos(a) * wsun + 0.5 * (1 - wsun), sl = Math.hypot(sx, sy) || 1;
    return {
      shDir: [sx / sl, sy / sl], shAmt: clamp(Math.max(lsun, 0.9 * lmoon), 0, 1) * 0.85, shLen: 0.1 + 0.14 * (1 - smooth(4, 45, el)),
      sunDir: [Math.sin(a) * ce, Math.cos(a) * ce, Math.sin(eL)], sunCol: [col[0] * strength, col[1] * strength, col[2] * strength],
      moonDir: [-0.64, 0.52, 0.56], moonCol: [moon[0] * mw, moon[1] * mw, moon[2] * mw], amb: amb, night: night, el: el, az: az
    };
  }

  /* ---------- shaders ---------- */
  var VERT = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.,1.);}';
  var HEAD = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var FRAG1 = HEAD + [
    'uniform vec2 uFb;uniform float uAspect,uZoom,uLetter;uniform vec2 uDrift;uniform sampler2D uMask;uniform float uOct;',
    'vec2 h22(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy)*2.-1.;}',
    'float gn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);',
    ' return mix(mix(dot(h22(i),f),dot(h22(i+vec2(1.,0.)),f-vec2(1.,0.)),u.x),mix(dot(h22(i+vec2(0.,1.)),f-vec2(0.,1.)),dot(h22(i+vec2(1.,1.)),f-vec2(1.,1.)),u.x),u.y);}',
    'float fbm(vec2 p){float s=0.,a=.5,n=0.;mat2 R=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){if(float(i)>=uOct)break;s+=a*gn(p);n+=a;p=R*p*2.03+11.7;a*=.42;}return .5+.62*s/n;}',
    'void main(){vec2 uv=gl_FragCoord.xy/uFb;vec2 p=(uv-.5)*vec2(uAspect,1.)*uZoom;',
    ' float n=clamp(.5+(fbm(p*1.25+uDrift)-.5)*2.3,0.,1.);',
    ' float ry=.5+p.y;float rn=fbm(p*1.1+vec2(3.7,1.3)+uDrift*.5);',
    ' float ridge=smoothstep(.58,1.02,ry+.2*(rn-.5));',
    ' float base=.08+.56*n+.24*ridge;',
    ' float mk=texture2D(uMask,vec2(uv.x,1.-uv.y)).r;float m=uLetter*mk;',
    ' float plate=.84;',
    ' float h=clamp(mix(base,plate,m),0.,.9999);',
    ' float v=floor(h*65535.+.5);float hi=floor(v/256.);gl_FragColor=vec4(hi/255.,(v-hi*256.)/255.,0.,1.);}'
  ].join('\n');
  var FRAG2 = '#extension GL_OES_standard_derivatives : enable\n' + HEAD + [
    '#ifdef GL_OES_standard_derivatives',
    '#define FW(x) fwidth(x)',
    '#define DX(x) dFdx(x)',
    '#define DY(x) dFdy(x)',
    '#else',
    '#define FW(x) (.03)',
    '#define DX(x) (.0)',
    '#define DY(x) (.0)',
    '#endif',
    'uniform sampler2D uH,uMask;uniform vec2 uRes,uFb,uLens,uShDir;uniform float uDpr,uAspect,uZoom,uLetter,uLensR,uLensA,uGrat,uTime,uNight,uK,uShLen,uShAmt;',
    'uniform vec3 uSunDir,uSunCol,uMoonDir,uMoonCol,uAmb,uRamp[7];uniform vec2 uSunXY;uniform vec4 uBox[4];uniform vec4 uBoxK;',
    'float boxM(vec4 b,vec2 f){vec2 c=(b.xy+b.zw)*.5,h=(b.zw-b.xy)*.5+30.*uDpr;vec2 q=abs(f-c)-h;float d=length(max(q,0.))+min(max(q.x,q.y),0.);return 1.-smoothstep(0.,130.*uDpr,d);}',
    'float dec(vec2 t){vec4 c=floor(texture2D(uH,t)*255.+.5);return (c.r*256.+c.g)/65535.;}',
    'float hAt(vec2 uv){vec2 f=uv*uFb-.5,i=floor(f),w=f-i,t=(i+.5)/uFb,o=1./uFb;',
    ' return mix(mix(dec(t),dec(t+vec2(o.x,0.)),w.x),mix(dec(t+vec2(0.,o.y)),dec(t+o),w.x),w.y);}',
    'vec3 ramp(float t){float f=clamp(t,0.,1.)*6.;float i=floor(f);vec3 a=uRamp[0],b=uRamp[1];',
    ' for(int k=0;k<6;k++){if(float(k)==i){a=uRamp[k];b=uRamp[k+1];}}if(i>=6.){a=uRamp[6];b=uRamp[6];}return mix(a,b,f-i);}',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}',
    /* AA line of width w (device px) at distance dpx (device px) */
    'float ln(float dpx,float w){return 1.-smoothstep(w*.5-.5,w*.5+.5,dpx);}',
    'void main(){',
    ' vec2 frag=gl_FragCoord.xy;vec2 d=frag-uLens;float dist=length(d);float R=uLensR*uDpr;float wp=uDpr;',
    ' bool inside=dist<R+1.&&uLensA>.001;',
    ' vec2 sp=inside?uLens+d/1.22:frag;vec2 uv=sp/uRes;',
    ' vec2 e=4.5/uFb;float hc=hAt(uv);',
    ' vec2 dw=vec2(e.x*uAspect*uZoom,e.y*uZoom);',
    ' float gx=(hAt(uv+vec2(e.x,0.))-hAt(uv-vec2(e.x,0.)))/(2.*dw.x);float gy=(hAt(uv+vec2(0.,e.y))-hAt(uv-vec2(0.,e.y)))/(2.*dw.y);',
    ' float mk=texture2D(uMask,vec2(uv.x,1.-uv.y)).r;float lt=uLetter;',
    ' vec2 mo=vec2(1.5)*uDpr/uRes;vec2 gm=vec2(texture2D(uMask,vec2(uv.x+mo.x,1.-uv.y)).r-texture2D(uMask,vec2(uv.x-mo.x,1.-uv.y)).r,texture2D(uMask,vec2(uv.x,1.-uv.y-mo.y)).r-texture2D(uMask,vec2(uv.x,1.-uv.y+mo.y)).r)*uDpr/3.;',
    ' vec3 n=normalize(vec3(-gx*uK-gm.x*16.*lt,-gy*uK-gm.y*16.*lt,1.));',
    ' float scr=max(max(boxM(uBox[0],frag)*uBoxK.x,boxM(uBox[1],frag)*uBoxK.y),max(boxM(uBox[2],frag)*uBoxK.z,boxM(uBox[3],frag)*uBoxK.w));',
    /* light: one sun (or the moon) drives hillshade, wall lighting and the cast shadow */
    ' float sunW=clamp(max(uSunCol.r,max(uSunCol.g,uSunCol.b))/.9,0.,1.);float moonW=clamp(max(uMoonCol.b,uMoonCol.g)*1.3,0.,1.);',
    ' float dlS=dot(n,uSunDir)-uSunDir.z,dlM=dot(n,uMoonDir)-uMoonDir.z;',
    ' vec3 sunT=uSunCol/max(max(uSunCol.r,max(uSunCol.g,uSunCol.b)),.001);',
    ' vec3 tint=mix(vec3(.026,.036,.05),vec3(.07,.066,.052),smoothstep(.12,.82,hc));',
    /* cast shadow of the mesa on the anti-sun side: a few soft taps of the letter mask towards the light */
    ' float shd=0.;',
    ' if(uShAmt>.01&&mk<.55&&lt>.02){float len=uShLen*uDpr;float jt=hash(frag);',
    '  for(int i=1;i<=7;i++){float f=(float(i)-.5+(jt-.5)*.9)/7.;vec2 o=uShDir*len*f/uRes;',
    '   float mm=texture2D(uMask,vec2(uv.x+o.x,1.-(uv.y+o.y))).r;shd=max(shd,smoothstep(.42,.9,mm)*(1.-f*.8));}',
    '  shd*=lt*uShAmt*(1.-smoothstep(.3,.55,mk));}',
    ' vec3 gcol=max(tint+uAmb*.6+(uSunCol*.03+uMoonCol*.035)*(1.-.88*shd)+(uSunCol*dlS*.16+uMoonCol*dlM*.15)*(1.-shd),0.);',
    ' vec3 bone=vec3(.93,.91,.85);',
    ' float wl=smoothstep(.1,.9,mk)*lt;float tp=smoothstep(.6,.9,mk)*lt;',
    ' float wv=clamp(.14+(max(dot(n,uSunDir),0.)*sunW+max(dot(n,uMoonDir),0.)*moonW*.85)*.95,.03,1.);',
    ' vec3 lc3=mix(vec3(.8,.86,1.),mix(vec3(1.),sunT,.5),sunW);',
    ' vec3 topC=bone*mix(vec3(.84,.9,1.)*.9,mix(vec3(1.),sunT,.3)*.98,sunW);',
    ' vec3 col=mix(gcol,bone*lc3*wv,wl);col=mix(col,topC,tp);',
    ' col+=uSunCol*.02*clamp(.5+dot(uv-.5,uSunXY)*.9,0.,1.);',
    /* contours: ~1 css px, bone, every 5th brighter and a touch thicker */
    ' float ch=hc*24.;float fw=FW(ch)+1e-5;float idx=floor(ch+.5);float maj=step(abs(mod(idx,5.)),.5);',
    ' float dl=abs(fract(ch-.5)-.5)/fw;float la=ln(dl,wp*(1.05+.75*maj));',
    ' float fade=1.-smoothstep(.16,.36,fw);float mesa=1.-smoothstep(.03,.13,mk*lt);',
    ' float aMin=mix(.2,.27,uNight),aMaj=mix(.46,.56,uNight);',
    ' float a=la*mix(aMin,aMaj,maj)*fade*mesa*(1.-.5*shd)*(1.-.8*scr);',
    ' col=mix(col,vec3(.93,.91,.85),a);',
    /* one foot contour hugging the letters */
    ' float fm=FW(mk)+1e-5;float ft=ln(abs(mk-.2)/fm,wp*1.1)*.5*smoothstep(.02,.3,lt)*(1.-.8*scr);',
    ' col=mix(col,vec3(.93,.91,.85),ft);',
    /* the trail: one dashed amber contour wandering the basin, never over the letters */
    ' float tr=ln(abs(ch-10.5)/fw,wp*1.5);',
    ' vec2 g=vec2(DX(ch),DY(ch));vec2 tg=normalize(vec2(-g.y,g.x)+vec2(1e-6));',
    ' float s=abs(tg.x)>abs(tg.y)?frag.x:frag.y;float dash=1.-smoothstep(.5,.58,fract(s/(12.*wp)));',
    ' if(tr>.01){float tm=mk;for(int i=0;i<6;i++){float aa=float(i)*1.047198;vec2 o=vec2(cos(aa),sin(aa))/uRes;',                 // keep ~14 and ~35 css px clear of every letter
    '  tm=max(tm,max(texture2D(uMask,vec2(uv.x+o.x*14.*uDpr,1.-uv.y-o.y*14.*uDpr)).r,texture2D(uMask,vec2(uv.x+o.x*35.*uDpr,1.-uv.y-o.y*35.*uDpr)).r));}',
    '  tr*=1.-smoothstep(.02,.2,tm*lt);}',
    ' tr*=dash*fade*mesa*(1.-.85*scr);col=mix(col,vec3(1.,.7,.25),tr*.92);',
    /* graticule */
    ' vec2 ll=vec2(-110.95+(uv.x-.5)*.30*uZoom,32.25+(uv.y-.5)*.30*uZoom);',
    ' float gr=max(1.-smoothstep(0.,1.5,abs(fract(ll.x/.05-.5)-.5)/(FW(ll.x/.05)+1e-5)),1.-smoothstep(0.,1.5,abs(fract(ll.y/.05-.5)-.5)/(FW(ll.y/.05)+1e-5)));col=mix(col,vec3(.93,.91,.85),gr*.13*uGrat);',
    /* the lens: a spectral instrument. Deep indigo ground, thin bright contours coloured by elevation through the ramp, a fine graticule, one bone rim. */
    ' if(inside){',
    '  float c2=ch*2.;float tl=clamp((floor(c2+.5)*.5/24.-.14)/.5,0.,1.);',
    '  vec3 rcl=ramp(tl);rcl=mix(rcl,vec3(.62,.7,1.),(1.-smoothstep(0.,.32,tl))*.65);',          // line colour: the ramp, lifted at the dark indigo end
        '  vec3 lcol=vec3(.04,.036,.15)+mix(vec3(.16,.1,.43),vec3(.09,.5,.55),smoothstep(0.,1.,tl))*.07+max(uSunCol*dlS*.16+uMoonCol*dlM*.14,0.)*vec3(.5,.6,1.);',
    '  float dn=smoothstep(.2,.5,fw);',
    '  float tpL=smoothstep(.6,.9,mk)*lt;',
    '  lcol=mix(lcol,rcl*.95,dn*.8*smoothstep(0.,.25,mk*lt));',                                  // steep walls: the contours fuse into a ramp-coloured face
    '  float f2=fw*2.;float mj2=step(abs(mod(floor(c2+.5),4.)),.5);float ll2=ln(abs(fract(c2-.5)-.5)/f2,wp*(1.+.7*mj2))*(1.-smoothstep(.16,.36,f2));',
    '  lcol=mix(lcol,min(rcl*(1.08+.22*mj2),1.),ll2*(1.-dn)*(.88+.12*mj2));',
    '  lcol=mix(lcol,mix(vec3(.97,.96,.93),mix(uRamp[4],uRamp[5],.5),.05),tpL);',                // flat tops stay light, tinted by the top of the ramp
    '  vec2 ad=abs(d)/wp;',
    '  vec2 gq=abs(fract(d/(16.*wp)+.5)-.5)*16.*wp;lcol=mix(lcol,vec3(.5,.6,1.),max(ln(gq.x,wp),ln(gq.y,wp))*.1*(1.-.9*tpL));',   // fine graticule
    '  float hx=ln(abs(d.y),wp*1.)*smoothstep(13.*wp-1.,13.*wp,abs(d.x))*(1.-smoothstep(R-12.*wp,R-11.*wp,abs(d.x)));',
    '  float hy=ln(abs(d.x),wp*1.)*smoothstep(13.*wp-1.,13.*wp,abs(d.y))*(1.-smoothstep(R-12.*wp,R-11.*wp,abs(d.y)));',
    '  float tkx=ln(abs(fract(ad.x/20.+.5)-.5)*20.*wp,wp)*(1.-smoothstep(3.,4.,ad.y))*step(13.,ad.x)*(1.-smoothstep(R/wp-14.,R/wp-13.,ad.x));',
    '  float tky=ln(abs(fract(ad.y/20.+.5)-.5)*20.*wp,wp)*(1.-smoothstep(3.,4.,ad.x))*step(13.,ad.y)*(1.-smoothstep(R/wp-14.,R/wp-13.,ad.y));',
    '  float cr=max(max(hx,hy)*.3,max(tkx,tky)*.55);',
    '  lcol=mix(lcol,vec3(.93,.91,.85),cr);',
    '  float ang=atan(d.y,d.x)*57.29578;float ar=fract(ang/6.+.5)-.5;float arcT=abs(ar)*6.*dist*.0174533;',
    '  float major=step(abs(mod(floor(ang/6.+.5),5.)),.5);float inner=(R-dist)/wp;',
    '  float tkr=ln(arcT,wp)*smoothstep(0.,1.,inner)*(1.-smoothstep(4.+4.*major,5.+4.*major,inner));',
    '  lcol=mix(lcol,vec3(.93,.91,.85),tkr*.5);',
    '  lcol*=1.-.45*scr*(1.-tpL);',
    '  float cov=uLensA*(1.-smoothstep(R-.5,R+.5,dist));',
    '  col=mix(col,lcol,cov);',
    '  col=mix(col,vec3(.945,.925,.886),ln(abs(dist-R),wp*1.3)*uLensA*.92);',
    ' }',
    ' col+=(hash(frag+uTime)-.5)/255.;',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);}'
  ].join('\n');

  /* ---------- GL ---------- */
  var gl = null, P1 = null, P2 = null, U1 = {}, U2 = {}, fbo = null, hTex = null, mTex = null, fbW = 0, fbH = 0, hasDeriv = false;
  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
    return s;
  }
  function prog(fs, names) {
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}; names.forEach(function (n) { u[n] = gl.getUniformLocation(p, n); }); return { p: p, u: u };
  }
  function tex(filter) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function initGL() {
    gl = canvas && canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    try {
      hasDeriv = !!gl.getExtension('OES_standard_derivatives');
      var f2 = hasDeriv ? FRAG2 : FRAG2.replace('#extension GL_OES_standard_derivatives : enable\n', '');
      P1 = prog(FRAG1, ['uFb', 'uAspect', 'uZoom', 'uLetter', 'uDrift', 'uMask', 'uOct']);
      P2 = prog(f2, ['uH', 'uMask', 'uRes', 'uFb', 'uLens', 'uShDir', 'uShLen', 'uShAmt', 'uDpr', 'uAspect', 'uZoom', 'uLetter', 'uLensR', 'uLensA', 'uGrat', 'uTime', 'uNight', 'uK',
        'uSunDir', 'uSunCol', 'uMoonDir', 'uMoonCol', 'uAmb', 'uRamp[0]', 'uSunXY', 'uBox[0]', 'uBoxK']);
    } catch (err) { console.warn('hero-terrain: shader failed, using the 2D fallback.', err && err.message); gl = null; return false; }
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    hTex = tex(gl.NEAREST); mTex = tex(gl.LINEAR); fbo = gl.createFramebuffer(); fbW = fbH = 0;
    if (L) uploadMask();
    return true;
  }
  function uploadMask() {
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskCv);
    st.p1Dirty = true; st.dirty = true;
  }
  function sizeBuffers() {
    var W = L.W, H = L.H;
    st.dpr = st.dprPinned || Math.max(0.75, ((W <= 768 || coarse) ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)) - st.dropped * 0.25);
    var cw = Math.max(1, Math.round(W * st.dpr)), ch = Math.max(1, Math.round(H * st.dpr));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    var nw = Math.ceil(cw / 2), nh = Math.ceil(ch / 2);
    if (nw !== fbW || nh !== fbH) {
      fbW = nw; fbH = nh;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, hTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbW, fbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, hTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    st.p1Dirty = true; st.dirty = true;
  }
  st.dropped = 0;

  /* ---------- sun dial + clock ---------- */
  var dial = hero.querySelector('.sundial'), dialSlider = null, dialLabel = null, nowBtn = null, dialSvg = null, dialSun = null, dialTick = null;
  var DX0 = 12, DX1 = 288, DYH = 62;
  function midnight(d) { var s = new Date(d.getTime() + Sun.TZ * 3600000); return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - Sun.TZ * 3600000; }
  var dayBase = midnight(Sun.now()), nowMin = 0, tgtMin = 0, curMin = 0, scrubbed = false;
  function minOfNow() { var n = Sun.now(); return clamp((n.getTime() - dayBase) / 60000, 0, 1439); }
  function dateAt(min) { return new Date(dayBase + min * 60000); }
  function describe(min, sep) {
    var d = dateAt(min), p = Sun.position(d), e = p.elevation, ae = Math.round(Math.abs(e));
    var tail = Math.abs(e) < 0.5 ? 'sun on the horizon' : e > 0 ? 'sun ' + ae + '° above the ' + Sun.compass(p.azimuth) + ' horizon' : 'sun ' + ae + '° below the horizon';
    return Sun.clock(d) + sep + tail;
  }
  function dx(min) { return DX0 + (DX1 - DX0) * min / 1440; }
  function dy(e) { return DYH - e * (0.43 + 0.17 * Math.tanh(e / 12)); }
  function buildDial() {
    if (!dial) return;
    nowMin = tgtMin = curMin = minOfNow();
    var pts = [], i, d = '';
    for (i = 0; i <= 288; i++) { var m = i * 5, e = Sun.position(dateAt(Math.min(m, 1439.9))).elevation; d += (i ? 'L' : 'M') + dx(m).toFixed(1) + ' ' + dy(e).toFixed(1); }
    var tm = Sun.times(dateAt(720)), sr = (tm.sunrise - dayBase) / 60000, ss = (tm.sunset - dayBase) / 60000;
    var NS = 'http://www.w3.org/2000/svg';
    dial.querySelectorAll('svg,.sundial__label,.sundial__now,.sundial__slider').forEach(function (n) { n.remove(); });
    dialSlider = document.createElement('div'); dialSlider.className = 'sundial__slider';
    ['role', 'tabindex', 'aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'].forEach(function (a) { if (dial.hasAttribute(a)) { dialSlider.setAttribute(a, dial.getAttribute(a)); dial.removeAttribute(a); } });
    dialSlider.setAttribute('role', 'slider'); dialSlider.setAttribute('tabindex', '0');
    if (!dialSlider.hasAttribute('aria-label')) dialSlider.setAttribute('aria-label', 'Time of day for the sunlight');
    dialSlider.setAttribute('aria-valuemin', '0'); dialSlider.setAttribute('aria-valuemax', '1439');
    dialSlider.setAttribute('aria-orientation', 'horizontal');
    dialSlider.innerHTML = '<svg viewBox="0 0 300 100" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="sd-top"><rect x="0" y="0" width="300" height="' + DYH + '"/></clipPath><clipPath id="sd-bot"><rect x="0" y="' + DYH + '" width="300" height="50"/></clipPath>' +
      '<radialGradient id="sd-glow"><stop offset="0" stop-color="#c9f24f" stop-opacity=".55"/><stop offset="1" stop-color="#c9f24f" stop-opacity="0"/></radialGradient></defs>' +
      '<path class="sundial__fill" clip-path="url(#sd-top)" d="' + d + 'L' + dx(1440).toFixed(1) + ' ' + DYH + 'L' + dx(0).toFixed(1) + ' ' + DYH + 'Z"/>' +
      '<path class="sundial__below" clip-path="url(#sd-bot)" d="' + d + '"/>' +
      '<path class="sundial__arc" clip-path="url(#sd-top)" d="' + d + '"/>' +
      '<line class="sundial__horizon" x1="' + DX0 + '" y1="' + DYH + '" x2="' + DX1 + '" y2="' + DYH + '"/>' +
      '<line class="sundial__rise" x1="' + dx(sr).toFixed(1) + '" y1="' + (DYH - 5) + '" x2="' + dx(sr).toFixed(1) + '" y2="' + (DYH + 5) + '"/>' +
      '<line class="sundial__rise" x1="' + dx(ss).toFixed(1) + '" y1="' + (DYH - 5) + '" x2="' + dx(ss).toFixed(1) + '" y2="' + (DYH + 5) + '"/>' +
      '<line class="sundial__tick" x1="0" y1="' + (DYH - 10) + '" x2="0" y2="' + (DYH + 10) + '"/>' +
      '<g class="sundial__sun"><circle r="15" fill="url(#sd-glow)"/><circle r="7" class="sundial__disc"/></g></svg>';
    dialSvg = dialSlider.querySelector('svg'); dialSun = dialSlider.querySelector('.sundial__sun'); dialTick = dialSlider.querySelector('.sundial__tick');
    dialLabel = document.createElement('p'); dialLabel.className = 'sundial__label'; dialLabel.setAttribute('aria-hidden', 'true');
    nowBtn = document.createElement('button'); nowBtn.type = 'button'; nowBtn.className = 'sundial__now'; nowBtn.hidden = true; nowBtn.textContent = 'Now';
    var row = document.createElement('div'); row.className = 'sundial__row'; row.appendChild(dialLabel); row.appendChild(nowBtn);
    dial.appendChild(dialSlider); dial.appendChild(row);
    dialTick.setAttribute('transform', 'translate(' + dx(nowMin).toFixed(1) + ' 0)');
    dialSlider.addEventListener('keydown', onDialKey);
    dialSlider.addEventListener('pointerdown', function (ev) { dialSlider.setPointerCapture(ev.pointerId); dialDrag(ev); ev.preventDefault(); dialSlider.focus({ preventScroll: true }); });
    dialSlider.addEventListener('pointermove', function (ev) { if (dialSlider.hasPointerCapture(ev.pointerId)) dialDrag(ev); });
    nowBtn.addEventListener('click', function () { setDial(nowMin, true); dialSlider.focus({ preventScroll: true }); });
    dial.__sr = sr; dial.__ss = ss;
    setDial(nowMin, true);
  }
  function dialDrag(ev) {
    var r = dialSvg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 300;
    setDial((x - DX0) / (DX1 - DX0) * 1440);
  }
  function onDialKey(ev) {
    var k = ev.key, step = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15, PageUp: 60, PageDown: -60 }[k];
    if (step !== undefined) setDial(tgtMin + step);
    else if (k === 'Home') setDial(dial.__sr); else if (k === 'End') setDial(dial.__ss); else return;
    ev.preventDefault();
  }
  function setDial(min, live) {
    tgtMin = clamp(Math.round(min), 0, 1439);
    scrubbed = !live && Math.abs(tgtMin - nowMin) >= 1;
    if (live) tgtMin = nowMin;
    var e = Sun.position(dateAt(tgtMin)).elevation;
    dialSlider.setAttribute('aria-valuenow', String(Math.round(tgtMin)));
    dialSlider.setAttribute('aria-valuetext', describe(tgtMin, ', '));
    dialLabel.innerHTML = describe(tgtMin, ' · ').replace(/[a-z]+-[a-z]+/, '<span style="white-space:nowrap">$&</span>'); // keep south-west whole
    dialSun.setAttribute('transform', 'translate(' + dx(tgtMin).toFixed(1) + ' ' + dy(e).toFixed(1) + ')');
    nowBtn.hidden = !scrubbed;
    hero.classList.toggle('is-scrubbed', scrubbed);
    wake();
  }
  setInterval(function () { // the live clock moves on; follow it unless the visitor has scrubbed
    if (!dial || !dialSlider) return; var m = minOfNow(); if (m === nowMin) return;
    nowMin = m; dialTick.setAttribute('transform', 'translate(' + dx(nowMin).toFixed(1) + ' 0)'); if (!scrubbed) setDial(nowMin, true);
  }, 30000);

  /* ---------- HUD (reads the height framebuffer, so it shows exactly what is drawn) ---------- */
  var hudEl = {}, bars = [], profLine = null, profFill = null, profCur = null;
  var WIND8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function buildHud() {
    if (!hud) return;
    hud.innerHTML = '<dl class="hud__grid"><div><dt>Elevation</dt><dd data-hud="elev">–</dd></div><div><dt>Slope</dt><dd data-hud="slope">–</dd></div>' +
      '<div><dt>Aspect</dt><dd data-hud="aspect">–</dd></div><div><dt>Position</dt><dd data-hud="pos">–</dd></div></dl>' +
      '<svg class="hud__profile" viewBox="0 0 264 48" preserveAspectRatio="none" focusable="false"><path class="hud__fill"/><path class="hud__line"/><line class="hud__cur" y1="0" y2="48"/></svg>' +
      '<div class="hud__hist">' + new Array(25).join('<i></i>') + '</div>';
    hud.querySelectorAll('[data-hud]').forEach(function (n) { hudEl[n.getAttribute('data-hud')] = n; });
    bars = [].slice.call(hud.querySelectorAll('.hud__hist i')); profLine = hud.querySelector('.hud__line'); profFill = hud.querySelector('.hud__fill'); profCur = hud.querySelector('.hud__cur');
  }
  var rows = null;
  function hudUpdate() {
    if (!hud || !gl || !fbW) return;
    var cw = canvas.width, rowY = clamp(Math.floor((1 - st.ly / L.H) * fbH), 1, fbH - 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    if (!rows || rows[0].length !== fbW * 4) rows = [new Uint8Array(fbW * 4), new Uint8Array(fbW * 4), new Uint8Array(fbW * 4)];
    for (var r = 0; r < 3; r++) gl.readPixels(0, rowY - 1 + r, fbW, 1, gl.RGBA, gl.UNSIGNED_BYTE, rows[r]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    var k = fbW / L.W;                                                  // framebuffer texels per css px
    var hv = function (row, x) { var i = clamp(Math.round(x * k - 0.5), 0, fbW - 1) * 4; return (rows[row][i] * 256 + rows[row][i + 1]) / 65535; };
    var x = st.lx, h = hv(1, x), z = st.zoom || 1;
    var mpp = 33300 * z / L.H;                                           // metres per css px (lat 32.10-32.40 over the height)
    var gxm = (hv(1, x + 4) - hv(1, x - 4)) / 8 * 2100 / mpp, gym = (hv(2, x) - hv(0, x)) / (2 * L.H / fbH) * 2100 / mpp;
    var slope = Math.atan(Math.hypot(gxm, gym)) * 180 / Math.PI;
    var asp = slope < 1 ? 'flat' : WIND8[Math.round((((Math.atan2(-gxm, -gym) * 180 / Math.PI) % 360) + 360) % 360 / 45) % 8];
    var lon = -110.95 + (st.lx / L.W - 0.5) * 0.30 * z, lat = 32.25 - (st.ly / L.H - 0.5) * 0.30 * z;
    hudEl.elev.textContent = Math.round(700 + h * 2100).toLocaleString('en-US') + ' m';
    hudEl.slope.textContent = slope.toFixed(1) + '°';
    hudEl.aspect.textContent = asp;
    hudEl.pos.textContent = Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S') + ', ' + Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W');
    var d = '', i;
    for (i = 0; i < 48; i++) d += (i ? 'L' : 'M') + (i / 47 * 264).toFixed(1) + ' ' + (46 - hv(1, i / 47 * L.W) * 44).toFixed(1);
    profLine.setAttribute('d', d); profFill.setAttribute('d', d + 'L264 48L0 48Z');
    var cx = (st.lx / L.W * 264).toFixed(1); profCur.setAttribute('x1', cx); profCur.setAttribute('x2', cx);
    for (i = 0; i < 24; i++) {
      var v = hv(1, st.lx + (i - 12) * 14), b = bars[i];
      b.style.transform = 'scaleY(' + (0.12 + v * 0.88).toFixed(3) + ')';
      b.style.background = i === 12 ? '#ffb340' : rampCss(Math.floor(clamp(v, 0, 0.999) * 9) / 8);
    }
  }

  /* ---------- legibility scrims: the terrain is quietly darkened under chalk text (copy, corner, HUD, dial) ---------- */
  var boxF = new Float32Array(16), boxSrc = ['.hero__copy', '.hero__corner', '.hud', '.sundial'];
  function boxes(sc) {
    if (!st.boxDirty && st.boxSc === sc) return boxF;
    boxSrc.forEach(function (sel, i) {
      var e = hero.querySelector(sel), x0 = 0, y0 = 0, x1 = 0, y1 = 0;
      if (e && !e.hidden && e.offsetWidth) {
        var ex = e.offsetLeft, ey = e.offsetTop, w = e.offsetWidth, h = e.offsetHeight;
        if (i === 1) { var sc2 = hero.querySelector('.hero__scale'); if (sc2 && sc2.offsetWidth) { var l = Math.min(ex, sc2.offsetLeft); w = Math.max(ex + w, sc2.offsetLeft + sc2.offsetWidth) - l; h = sc2.offsetTop + sc2.offsetHeight - ey; ex = l; } }
        x0 = ex * sc; x1 = (ex + w) * sc; y0 = (L.H - ey - h) * sc; y1 = (L.H - ey) * sc;
      }
      boxF.set([x0, y0, x1, y1], i * 4);
    });
    st.boxDirty = false; st.boxSc = sc; return boxF;
  }

  /* ---------- render ---------- */
  var tmpU = new Float32Array(21);
  RAMPV.forEach(function (c, i) { tmpU.set(c, i * 3); });
  function render(now) {
    var dtMs = now - st.last; st.last = now; var dt = clamp(dtMs / 1000, 0, 0.1) || 0.016;
    var anim = false;
    // timing + adaptive DPR (first 60 frames)
    if (!reduced && !st.dprPinned && st.frames < 70 && dtMs < 250 && dtMs > 0) {
      st.frames++; if (st.frames > 10) st.ftSum += dtMs;
      if (st.frames === 70) { if (st.ftSum / 60 > 22 && st.dpr > 0.75) { st.dropped++; sizeBuffers(); st.frames = 10; st.ftSum = 0; } }
    }
    if (!reduced) { st.T += dt; }
    // dial easing
    var kd = reduced ? 1 : 1 - Math.pow(1 - 0.08, dt * 60);
    if (Math.abs(tgtMin - curMin) > 0.01) { curMin += (tgtMin - curMin) * kd; if (Math.abs(tgtMin - curMin) < 0.02) curMin = tgtMin; anim = true; }
    if (!st.light || Math.abs(curMin - st.lightMin) > 0.005) {
      var sp = Sun.position(dateAt(curMin)); st.light = lightFor(sp.azimuth, sp.elevation); st.lightMin = curMin; st.dirty = true;
    }
    // scroll story
    var p = S.p, zoom = 1 + 1.4 * p, letter = st.letterIn * (1 - 0.65 * p);
    if (p !== st.shownP) { applyStory(p); st.shownP = p; st.p1Dirty = true; }
    // lens
    var tx, ty, kl = reduced ? 1 : 1 - Math.pow(1 - 0.12, dt * 60);
    if (lensPinned) { tx = pin01[0] * L.W; ty = pin01[1] * L.H; }
    else if (st.ptr && (st.ptrIn || st.T - st.ptrT < 2)) { tx = st.ptr.x; ty = st.ptr.y; }
    else { var rp = restTarget(reduced ? 0 : st.T); tx = rp[0]; ty = rp[1]; }
    if (!st.hasLens) { st.lx = tx; st.ly = ty; st.hasLens = true; }
    var ox = st.lx, oy = st.ly; st.lx += (tx - st.lx) * kl; st.ly += (ty - st.ly) * kl;
    if (Math.abs(st.lx - tx) > 0.05 || Math.abs(st.ly - ty) > 0.05) anim = true; else { st.lx = tx; st.ly = ty; }
    if (st.lx !== ox || st.ly !== oy) st.hudDue = true;
    var contLens = !reduced && !lensPinned && !(st.ptr && st.ptrIn);
    // pass 1 (height), only when something that feeds it changed
    var drift = reduced ? 0 : st.T;
    var need = st.p1Dirty || letter !== st.letterShown || zoom !== st.zoomShown || (!reduced && now - st.p1T > 33);
    st.zoom = zoom;
    if (need) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, fbW, fbH); gl.useProgram(P1.p);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mTex);
      var u = P1.u; gl.uniform2f(u.uFb, fbW, fbH); gl.uniform1f(u.uAspect, L.W / L.H); gl.uniform1f(u.uZoom, zoom); gl.uniform1f(u.uLetter, letter);
      gl.uniform2f(u.uDrift, drift * 0.01, drift * 0.006); gl.uniform1i(u.uMask, 1); gl.uniform1f(u.uOct, L.W < 700 ? 4 : 5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      st.p1Dirty = false; st.p1T = now; st.letterShown = letter; st.zoomShown = zoom; st.dirty = true;
    }
    if (st.hudDue || now - st.hudT > 200) { if (need || st.hudDue || st.hudT === 0) { st.hudDue = false; st.hudT = now; if (hud && p < 0.8 && (!reduced || true)) hudUpdate(); } }
    // pass 2 (shade) every frame while continuous, else on demand
    if (st.dirty || contLens || anim || !reduced) {
      var cw = canvas.width, ch = canvas.height, sc = cw / L.W, Lt = st.light;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, cw, ch); gl.useProgram(P2.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, hTex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mTex);
      var v = P2.u; gl.uniform1i(v.uH, 0); gl.uniform1i(v.uMask, 1); gl.uniform2f(v.uRes, cw, ch); gl.uniform2f(v.uFb, fbW, fbH);
      gl.uniform2f(v.uLens, st.lx * sc, (L.H - st.ly) * sc); gl.uniform1f(v.uDpr, sc); gl.uniform1f(v.uAspect, L.W / L.H);
      gl.uniform1f(v.uZoom, zoom); gl.uniform1f(v.uLetter, letter); gl.uniform1f(v.uLensR, lensR()); gl.uniform1f(v.uLensA, st.lensIn);
      gl.uniform1f(v.uGrat, smooth(0.35, 0.6, p)); gl.uniform1f(v.uTime, reduced ? 0 : (now % 1000)); gl.uniform1f(v.uNight, Lt.night); gl.uniform1f(v.uK, 0.34); gl.uniform2f(v.uShDir, Lt.shDir[0], Lt.shDir[1]); gl.uniform1f(v.uShAmt, Lt.shAmt); gl.uniform1f(v.uShLen, Lt.shLen * L.fs);
      gl.uniform3fv(v.uSunDir, Lt.sunDir); gl.uniform3fv(v.uSunCol, Lt.sunCol); gl.uniform3fv(v.uMoonDir, Lt.moonDir); gl.uniform3fv(v.uMoonCol, Lt.moonCol);
      gl.uniform3fv(v.uAmb, Lt.amb); gl.uniform3fv(v['uRamp[0]'], tmpU);
      gl.uniform4fv(v['uBox[0]'], boxes(sc)); var fcv = parseFloat(hero.style.getPropertyValue('--fc')); var fhv = parseFloat(hero.style.getPropertyValue('--fh')); fcv = isNaN(fcv) ? 1 : fcv; fhv = isNaN(fhv) ? 1 : fhv;
      gl.uniform4f(v.uBoxK, fcv, Math.max(fcv, fhv), fhv, fhv);
      var sx = Math.sin(Lt.az * Math.PI / 180), sy = Math.cos(Lt.az * Math.PI / 180); gl.uniform2f(v.uSunXY, sx, sy);
      gl.drawArrays(gl.TRIANGLES, 0, 3); st.dirty = false;
    }
    return anim || contLens;
  }

  function applyStory(p) {
    var f = clamp(p / 0.3, 0, 1), fh = 1 - clamp((p - 0.8) / 0.1, 0, 1), co = 1 - clamp((p - 0.85) / 0.15, 0, 1);
    hero.style.setProperty('--fc', (1 - f).toFixed(3)); hero.style.setProperty('--drift', (-30 * f).toFixed(1) + 'px'); hero.style.setProperty('--fh', fh.toFixed(3));
    canvas.style.opacity = co.toFixed(3); canvas.style.visibility = co === 0 ? 'hidden' : '';
    hero.classList.toggle('is-past', p > 0.9);
    var sc = hero.querySelector('.hero__scale'); if (sc) { var t = p > 0.5 ? 'Tucson basin · contour interval 200 m' : 'Tucson basin · contour interval 50 m'; if (sc.textContent !== t) sc.textContent = t; }
  }

  /* ---------- loop ---------- */
  function active() { return gl && L && st.vis && !document.hidden && canvas.style.opacity !== '0.000'; }
  function frame(now) {
    st.raf = 0; if (!active()) return;
    var again = render(now);
    if (!reduced || again) wake();
  }
  function wake() { if (!st.raf && gl && L && active()) { st.last = st.last || performance.now(); st.raf = requestAnimationFrame(frame); } }
  new IntersectionObserver(function (es) { st.vis = es[0].isIntersecting; if (st.vis) { st.last = performance.now(); wake(); } }).observe(hero);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { st.last = performance.now(); wake(); } });

  /* ---------- pointer / lens ---------- */
  function setPtr(ev) {
    var r = canvas.getBoundingClientRect(); st.ptr = { x: clamp(ev.clientX - r.left, 0, r.width), y: clamp(ev.clientY - r.top, 0, r.height) };
    st.hudDue = true; wake();
  }
  hero.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.sundial,a,button')) return; if (ev.pointerType === 'touch') { st.ptrIn = true; setPtr(ev); } });
  hero.addEventListener('pointermove', function (ev) { if (ev.target.closest && ev.target.closest('.sundial')) return; if (ev.pointerType === 'touch' && !st.ptrIn) return; st.ptrIn = true; setPtr(ev); });
  function leave() { st.ptrIn = false; st.ptrT = st.T; wake(); }
  hero.addEventListener('pointerleave', function (ev) { if (ev.pointerType !== 'touch') leave(); });
  ['pointerup', 'pointercancel'].forEach(function (n) { hero.addEventListener(n, function (ev) { if (ev.pointerType === 'touch') leave(); }); });

  /* ---------- entrance, ticker, story, resize ---------- */
  var started = false;
  function easeExpoOut(t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function startEntrance() {
    if (started) return; started = true;
    hero.classList.add('is-in');
    if (reduced || !motionOn) { st.letterIn = 1; st.lensIn = 1; st.dirty = true; st.p1Dirty = true; wake(); startTicker(); return; }
    var t0 = performance.now();
    (function step(now) {
      var t = (now - t0) / 1600; st.letterIn = easeExpoOut(t); st.lensIn = clamp((now - t0 - 500) / 1100, 0, 1); st.dirty = true; wake();
      if (t < 1) requestAnimationFrame(step); else { st.letterIn = 1; st.lensIn = 1; }
    })(t0);
    startTicker();
  }
  /* role line: static text first, first change after 3.6s, each role holds 3.6s, a change (local scramble) takes 400ms */
  function scrambleRole(el, text) {
    var G = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789', t0 = performance.now(), len = text.length;
    clearInterval(el.__rs);
    el.__rs = setInterval(function () {                                 // clock-based: finishes at 400ms even when frames are slow
      var f = (performance.now() - t0) / 400; if (f >= 1) { clearInterval(el.__rs); el.textContent = text; return; }
      var k = Math.ceil(len * f), out = text.slice(0, k);
      for (var j = k; j < len; j++) out += /[\s,&]/.test(text.charAt(j)) ? text.charAt(j) : G.charAt(Math.floor(Math.random() * G.length));
      el.textContent = out;
    }, 40);
  }
  function startTicker() {
    var el = hero.querySelector('.hero__roleswap'); if (!el) return;
    var roles = (el.getAttribute('data-roles') || '').split('|').filter(Boolean); if (roles.length < 2) return;
    var i = 0;
    (function next(wait) {
      setTimeout(function () {
        if (!st.vis || document.hidden) return next(500);
        i = (i + 1) % roles.length;
        if (reduced) el.textContent = roles[i]; else scrambleRole(el, roles[i]);
        next(4000);                                                  // 400ms change + 3.6s hold
      }, wait);
    })(3600);
  }
  function setupStory() {
    if (!motionOn || reduced || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.to(S, { p: 1, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: 0.8, onUpdate: wake } });
  }
  function noGL() {
    hero.classList.add('no-gl'); if (canvas) canvas.hidden = true;
    var tc = document.createElement('canvas'); tc.className = 'hero__topo'; tc.setAttribute('aria-hidden', 'true');
    pin.insertBefore(tc, canvas ? canvas.nextSibling : pin.firstChild);
    if (window.Topo2D && Topo2D.mount) { Topo2D.mount(tc, { seed: 7, ridge: [0.5, 0.1] }); window.addEventListener('load', function () { tc.setAttribute('data-topo', ''); }); }
    if (hud) hud.hidden = true;
  }
  var rt = 0;
  function rebuild() {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var nl = computeLayout(); if (!nl) return; L = nl; applyLayout();
      if (!gl) return; buildMask(); sizeBuffers(); uploadMask(); wake();
    }, 150);
  }
  function boot() {
    buildDial(); buildHud();
    L = computeLayout();
    if (L) applyLayout();
    var ok = L && initGL();
    if (!ok) { noGL(); if (L) applyLayout(); } else { buildMask(); sizeBuffers(); uploadMask(); }
    if (ok) {
      hero.classList.add('has-gl');
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); gl = null; });
      canvas.addEventListener('webglcontextrestored', function () { if (initGL()) { sizeBuffers(); wake(); } });
      if (window.ResizeObserver) new ResizeObserver(rebuild).observe(pin); else window.addEventListener('resize', rebuild);
      window.addEventListener('orientationchange', rebuild);
      setupStory(); st.dirty = true; wake();
    }
    var go = function () { startEntrance(); };
    if (window.GC && GC.onReady) GC.onReady(go); else if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    setTimeout(go, 9000);                                               // never leave the page waiting
  }
  var fl = document.fonts && document.fonts.load ? Promise.race([document.fonts.load('800 100px Unbounded'), new Promise(function (r) { setTimeout(r, 2500); })]) : Promise.resolve();
  fl.then(boot, boot);
  hero.__terrain = { S: S, st: st, rebuild: rebuild, layout: function () { return L; }, rest: function (T) { return restTarget(T); }, lensR: function () { return lensR(); } };
})();
