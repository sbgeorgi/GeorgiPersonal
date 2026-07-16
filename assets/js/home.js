/* ============================================================
   GC — landing hero: reactive topographic field (three.js)
   fbm contours + mouse warp + scroll drift
   ============================================================ */
(function () {
  const canvas = document.getElementById('topo-canvas');
  if (!canvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uTime:   { value: 0 },
    uRes:    { value: new THREE.Vector2(1, 1) },
    uMouse:  { value: new THREE.Vector2(0.5, 0.5) },
    uScroll: { value: 0 },
  };

  const frag = `
    precision highp float;
    uniform float uTime;
    uniform vec2  uRes;
    uniform vec2  uMouse;
    uniform float uScroll;

    vec2 hash(vec2 p){
      p = vec2(dot(p,vec2(127.1,311.7)), dot(p,vec2(269.5,183.3)));
      return -1.0 + 2.0*fract(sin(p)*43758.5453123);
    }
    float noise(in vec2 p){
      const float K1 = 0.366025404;
      const float K2 = 0.211324865;
      vec2 i = floor(p + (p.x+p.y)*K1);
      vec2 a = p - i + (i.x+i.y)*K2;
      vec2 o = (a.x>a.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
      vec2 b = a - o + K2;
      vec2 c = a - 1.0 + 2.0*K2;
      vec3 h = max(0.5-vec3(dot(a,a), dot(b,b), dot(c,c)), 0.0);
      vec3 n = h*h*h*h*vec3(dot(a,hash(i+0.0)), dot(b,hash(i+o)), dot(c,hash(i+1.0)));
      return dot(n, vec3(70.0));
    }
    float fbm(vec2 p){
      float v = 0.0, a = 0.55;
      mat2 rot = mat2(0.8,0.6,-0.6,0.8);
      for(int i=0;i<5;i++){ v += a*noise(p); p = rot*p*2.02; a *= 0.5; }
      return v;
    }

    float contour(float v, float freq, float w){
      float f = fract(v*freq);
      float d = min(f, 1.0-f);
      return smoothstep(w, 0.0, d);
    }

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      vec2 p  = (gl_FragCoord.xy - 0.5*uRes.xy) / min(uRes.x, uRes.y);

      vec2 m = (uMouse - 0.5) * 1.4;
      float t = uTime * 0.055;

      /* domain warp — mouse pushes the field */
      vec2 q = p*1.7 + vec2(t, -t*0.6);
      q += 0.35*vec2(fbm(q + m*2.0 + uTime*0.03), fbm(q - m*2.0));
      q.y += uScroll*0.55;

      float v = fbm(q + 0.6*fbm(q + vec2(1.7,9.2) + m));

      /* base gradient: near-black with a faint green depth */
      vec3 col = mix(vec3(0.039,0.043,0.031), vec3(0.075,0.086,0.047), uv.y + v*0.35);

      /* lime contours */
      float c1 = contour(v + t*0.35, 9.0, 0.055);
      col = mix(col, vec3(0.788,0.949,0.310), c1 * 0.85);

      /* secondary faint bone contours (denser) */
      float c2 = contour(v + t*0.35 + 0.5, 18.0, 0.03);
      col = mix(col, vec3(0.937,0.929,0.894), c2 * 0.10);

      /* orange ridge highlight on a sparse band */
      float band = smoothstep(0.06,0.0,abs(v - 0.18 - 0.05*sin(t*2.0)));
      float c3 = contour(v + t*0.35, 9.0, 0.05) * band;
      col = mix(col, vec3(1.0,0.416,0.239), c3 * 0.9);

      /* mouse glow */
      float md = length(p - m*0.9);
      col += vec3(0.788,0.949,0.310) * 0.05 * smoothstep(0.65, 0.0, md);

      /* vignette */
      float vig = smoothstep(1.45, 0.35, length(p*vec2(1.0,1.25)));
      col *= vig;

      /* dither */
      col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453) - 0.5) / 255.0;

      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const vert = `void main(){ gl_Position = vec4(position,1.0); }`;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag })
  );
  scene.add(mesh);

  function size() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    uniforms.uRes.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }
  size();
  addEventListener('resize', size);

  const targetM = new THREE.Vector2(0.5, 0.5);
  addEventListener('mousemove', e => targetM.set(e.clientX / innerWidth, 1 - e.clientY / innerHeight));

  let scrollV = 0;
  addEventListener('scroll', () => { scrollV = scrollY / innerHeight; }, { passive: true });

  const clock = new THREE.Clock();
  let inView = true;
  new IntersectionObserver(en => (inView = en[0].isIntersecting)).observe(canvas);

  (function loop() {
    requestAnimationFrame(loop);
    if (!inView) return;
    uniforms.uTime.value = clock.getElapsedTime();
    uniforms.uMouse.value.lerp(targetM, 0.045);
    uniforms.uScroll.value += (scrollV - uniforms.uScroll.value) * 0.06;
    renderer.render(scene, camera);
  })();
})();
