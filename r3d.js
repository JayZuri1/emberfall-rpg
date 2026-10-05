/* Emberfall 3D: real 3D world (plain WebGL, no libraries).
   3D characters, monsters and bosses with animated rigs, 3D trees/rocks/houses, per-area scenery, a forest/mountain/lake
   backdrop outside the map, dynamic lights, fog. Button 🧊 or key V switches back to the classic 2D view. Wheel zooms. */
(() => {
  const KEY = 'emberfall.3d', draw2d = draw;
  let on = localStorage.getItem(KEY) !== '0', gl = null, ok = false, fails = 0, zoom = 1.6, yaw = 0, yawT = 0, pitch = 1.02, pitchT = 1.02, cam = null, flashR = 0, lastHp = 0, lastT = 0, VP = null, U = {}, SCN = null, TQ = [];
  const wrap = $('wrap'), c2 = $('c'), glc = document.createElement('canvas'), ov = document.createElement('canvas'), o = ov.getContext('2d'), vg = document.createElement('div');
  glc.id = 'gl'; ov.id = 'ov'; vg.id = 'vg3d'; wrap.insertBefore(glc, c2); c2.after(vg); vg.after(ov);
  const st = document.createElement('style');
  st.textContent = `#gl,#ov,#vg3d{position:absolute;inset:0;width:100%;height:100%;display:none}#ov,#vg3d{pointer-events:none}#vg3d{background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,12,.5) 100%)}
  body.r3d #gl,body.r3d #ov,body.r3d #vg3d{display:block}body.r3d #c{opacity:0}
  #menuPop{position:absolute;top:calc(100% + 6px);right:0;display:none;flex-wrap:wrap;gap:6px;justify-content:flex-end;width:max-content;max-width:200px;background:#0b0f15f2;border:1px solid #2f3643;border-radius:12px;padding:8px;z-index:30}
  #menuPop.open{display:flex}#menuPop button[hidden]{display:none}body.touch #menuPop{right:auto;left:0;justify-content:flex-start}
  #chatlog{top:calc(var(--mmb,130px) + 8px + var(--sat)) !important}@media (max-height:560px){.controls-help{display:none}}`;
  document.head.append(st);

  /* ---------------- math ---------------- */
  const mul = (a, b) => { const r = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
  const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]); };
  function look(e, c) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = zz, xz = -zx; l = Math.hypot(xx, xz); xx /= l; xz /= l; const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
    return new Float32Array([xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  }
  const trs = (tx, ty, tz, sx, sy, sz, rx = 0, rz = 0, ry = 0) => {   // T * Ry * Rz * Rx * S
    const cx = Math.cos(rx), sxn = Math.sin(rx), cz = Math.cos(rz), szn = Math.sin(rz), cy = Math.cos(ry), syn = Math.sin(ry);
    const Rx = new Float32Array([1, 0, 0, 0, 0, cx, sxn, 0, 0, -sxn, cx, 0, 0, 0, 0, 1]), Rz = new Float32Array([cz, szn, 0, 0, -szn, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), Ry = new Float32Array([cy, 0, -syn, 0, 0, 1, 0, 0, syn, 0, cy, 0, 0, 0, 0, 1]);
    const R = mul(Ry, mul(Rz, Rx)); R[0] *= sx; R[1] *= sx; R[2] *= sx; R[4] *= sy; R[5] *= sy; R[6] *= sy; R[8] *= sz; R[9] *= sz; R[10] *= sz; R[12] = tx; R[13] = ty; R[14] = tz; return R;
  };
  const proj = (px, py, pz) => { const m = VP, w = m[3] * px + m[7] * py + m[11] * pz + m[15]; if (w <= 0) return null; return [(m[0] * px + m[4] * py + m[8] * pz + m[12]) / w * .5 + .5, .5 - (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w * .5, w]; };
  const mod = (a, m) => ((a % m) + m) % m, hex = h => { if (h.length == 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; };
  const mb = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const tint = (c, f) => c.map(v => Math.min(1, v * f)), mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

  /* ---------------- GL ---------------- */
  const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec2 aT;attribute vec4 aC;uniform mat4 uM,uVP;uniform float uT;varying vec3 vW,vN,vC;varying vec2 vT;
  void main(){vec3 p=aP;float sw=aC.a;p.x+=sin(uT*1.4+p.x*.013+p.z*.011)*sw;p.z+=cos(uT*1.1+p.x*.011)*sw*.5;vec4 w=uM*vec4(p,1.);vW=w.xyz;vN=mat3(uM)*aN;vT=aT;vC=aC.rgb;gl_Position=uVP*w;}`;
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec3 vW,vN,vC;varying vec2 vT;uniform sampler2D uTex,uCloud;uniform vec4 uCol,uBounds,uLP[6];uniform vec3 uAmb,uFog,uCam,uLC[6];uniform vec2 uFogR,uUV;
  uniform float uUseTex,uLit,uEmit,uFlash,uAT,uCloudOn,uT;
  void main(){
    vec4 c=uCol;if(uUseTex>.5)c*=texture2D(uTex,vT*uUV);if(c.a<uAT)discard;c.rgb*=vC;
    vec3 l=vec3(1.);
    if(uEmit<.5){l=uAmb;if(uLit>.5){vec3 n=normalize(vN);float d=max(dot(n,normalize(vec3(-.4,.8,.45))),0.);l*=.72+.0*d;l+=vec3(1.,.95,.85)*d*.55+vec3(.08,.1,.16)*max(-n.y,0.);}
      for(int i=0;i<6;i++){float d=length(uLP[i].xyz-vW);float f=clamp(1.-d/uLP[i].w,0.,1.);l+=uLC[i]*f*f;}}
    vec3 col=c.rgb*l;
    if(uCloudOn>.5){float k=texture2D(uCloud,vW.xz/1100.+vec2(uT*.012,uT*.004)).r;col*=.8+.2*k;}
    col=mix(col,vec3(1.),uFlash*.7);
    float ox=max(max(uBounds.x-vW.x,vW.x-uBounds.z),0.),oz=max(max(uBounds.y-vW.z,vW.z-uBounds.w),0.);col*=1.-.55*clamp(length(vec2(ox,oz))/700.,0.,1.);
    float fg=clamp((length(vW-uCam)-uFogR.x)/(uFogR.y-uFogR.x),0.,1.);col=mix(col,uFog,fg*.94);
    gl_FragColor=vec4(col,c.a);}`;
  function initGL() {
    gl = glc.getContext('webgl', { antialias: true, alpha: false }) || glc.getContext('experimental-webgl'); if (!gl) return false;
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); ['aP', 'aN', 'aT', 'aC'].forEach((n, i) => gl.bindAttribLocation(pr, i, n)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); gl.useProgram(pr);
    ['uM', 'uVP', 'uTex', 'uCloud', 'uCol', 'uBounds', 'uAmb', 'uFog', 'uCam', 'uFogR', 'uUV', 'uUseTex', 'uLit', 'uEmit', 'uFlash', 'uAT', 'uCloudOn', 'uT'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
    U.uLP = gl.getUniformLocation(pr, 'uLP[0]'); U.uLC = gl.getUniformLocation(pr, 'uLC[0]');
    [0, 1, 2, 3].forEach(i => gl.enableVertexAttribArray(i)); gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uCloud, 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); return true;
  }
  const upload = (v, idx) => { const vb = gl.createBuffer(), ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW); return { vb, ib, n: idx.length }; };
  const mesh = tpl => { const v = []; for (let i = 0; i < tpl.v.length; i += 8) v.push(...tpl.v.slice(i, i + 8), 1, 1, 1, 0); return upload(v, tpl.i); };

  /* ---------------- mesh templates (8 floats per vertex: pos, normal, uv) ---------------- */
  const quadT = () => ({ v: [-.5, 0, 0, 0, 0, 1, 0, 1, .5, 0, 0, 0, 0, 1, 1, 1, .5, 1, 0, 0, 0, 1, 1, 0, -.5, 1, 0, 0, 0, 1, 0, 0], i: [0, 1, 2, 0, 2, 3] });
  function cubeT() {
    const v = [], ix = []; [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].forEach(n => {
      const u = n[1] ? [1, 0, 0] : [0, 1, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], b = v.length / 8;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => v.push(n[0] * .5 + u[0] * a * .5 + w[0] * c * .5, n[1] * .5 + .5 + u[1] * a * .5 + w[1] * c * .5, n[2] * .5 + u[2] * a * .5 + w[2] * c * .5, n[0], n[1], n[2], (a + 1) / 2, (c + 1) / 2)); ix.push(b, b + 1, b + 2, b, b + 2, b + 3); }); return { v, i: ix };
  }
  function sphT(A, B) { const v = [], ix = []; for (let i = 0; i <= B; i++) for (let j = 0; j <= A; j++) { const th = i / B * Math.PI, ph = j / A * 6.2832, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph); v.push(x, y, z, x, y, z, j / A, i / B); }
    for (let i = 0; i < B; i++) for (let j = 0; j < A; j++) { const a = i * (A + 1) + j, b = a + A + 1; ix.push(a, b, a + 1, b, b + 1, a + 1); } return { v, i: ix }; }
  function frT(r0, r1, seg, ph = 0) {                                   // frustum: base radius r0 at y=0, top radius r1 at y=1 (cone if r1=0)
    const v = [], ix = [], sl = r0 - r1, nl = Math.hypot(1, sl);
    for (let j = 0; j <= seg; j++) { const a = ph + j / seg * 6.2832, c = Math.cos(a), s = Math.sin(a); v.push(c * r0, 0, s * r0, c / nl, sl / nl, s / nl, j / seg, 1, c * r1, 1, s * r1, c / nl, sl / nl, s / nl, j / seg, 0); }
    for (let j = 0; j < seg; j++) { const a = j * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    if (r1 > .001) { const b = v.length / 8; v.push(0, 1, 0, 0, 1, 0, .5, .5); for (let j = 0; j <= seg; j++) { const a = ph + j / seg * 6.2832; v.push(Math.cos(a) * r1, 1, Math.sin(a) * r1, 0, 1, 0, .5, .5); } for (let j = 0; j < seg; j++) ix.push(b, b + 1 + j, b + 2 + j); }
    return { v, i: ix };
  }
  let QUAD, CUBE, SPH, T_CUBE, T_SPH, T_SPHL, T_TRUNK, T_CONE, T_CYL, T_PYR, T_FR;
  function buildMeshes() {
    T_CUBE = cubeT(); T_SPH = sphT(10, 8); T_SPHL = sphT(7, 5); T_TRUNK = frT(1, .62, 7); T_CONE = frT(1, 0, 8); T_CYL = frT(1, 1, 9); T_PYR = frT(.7071, 0, 4, .7854);
    QUAD = mesh(quadT()); CUBE = mesh(T_CUBE); SPH = mesh(T_SPH);
  }
  /* static scenery builder: merges many objects into a few big buffers (vertex colour + wind weight in aC) */
  const newSB = () => ({ v: [], i: [], n: 0, chunks: [] });
  function flush(sb) { if (!sb.n) return; sb.chunks.push(upload(sb.v, sb.i)); sb.v = []; sb.i = []; sb.n = 0; }
  const fr = (a, b) => (a * 12.9898 + b * 78.233);
  function emit(sb, tpl, M, col, sway = 0, y0 = 0, hh = 1) {
    const nv = tpl.v.length / 8; if (sb.n + nv > 64000) flush(sb); const base = sb.n;
    for (let k = 0; k < nv; k++) { const x = tpl.v[k * 8], y = tpl.v[k * 8 + 1], z = tpl.v[k * 8 + 2], nx = tpl.v[k * 8 + 3], ny = tpl.v[k * 8 + 4], nz = tpl.v[k * 8 + 5];
      const px = M[0] * x + M[4] * y + M[8] * z + M[12], py = M[1] * x + M[5] * y + M[9] * z + M[13], pz = M[2] * x + M[6] * y + M[10] * z + M[14];
      let mx = M[0] * nx + M[4] * ny + M[8] * nz, my = M[1] * nx + M[5] * ny + M[9] * nz, mz = M[2] * nx + M[6] * ny + M[10] * nz; const l = Math.hypot(mx, my, mz) || 1;
      const h = Math.sin(fr(px * .37, pz * .53) + py * .11) * 43758.5453, sh = 1 + (h - Math.floor(h) - .5) * .2;
      sb.v.push(px, py, pz, mx / l, my / l, mz / l, tpl.v[k * 8 + 6], tpl.v[k * 8 + 7], col[0] * sh, col[1] * sh, col[2] * sh, sway ? sway * Math.max(0, Math.min(1, (py - y0) / hh)) : 0); }
    for (const ii of tpl.i) sb.i.push(base + ii); sb.n += nv;
  }
  const O = (sb, tpl, x, y, z, sx, sy, sz, col, o2 = {}) => emit(sb, tpl, trs(x, y, z, sx, sy, sz, o2.rx || 0, o2.rz || 0, o2.ry || 0), col, o2.sw || 0, o2.y0 ?? y, o2.hh || sy);

  /* ---------------- textures ---------------- */
  const TX = new WeakMap(), TCV = new Map();
  function tex(img, rep) {
    let t = TX.get(img); if (t) return t; t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const w = rep ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    if (rep) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); const ex = gl.getExtension('EXT_texture_filter_anisotropic'); if (ex) gl.texParameterf(gl.TEXTURE_2D, ex.TEXTURE_MAX_ANISOTROPY_EXT, 8); }
    else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); }
    TX.set(img, t); return t;
  }
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const cached = (k, f) => { if (!TCV.has(k)) TCV.set(k, f()); return TCV.get(k); };
  const glowC = () => cached('glow', () => { const [c, g] = mkc(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; });
  const slashC = () => cached('slash', () => { const [c, g] = mkc(128, 128); g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.strokeStyle = `rgba(255,255,255,${.9 - i * .22})`; g.lineWidth = 16 - i * 4; g.beginPath(); g.arc(20, 64, 90 - i * 3, -1.1, 1.1); g.stroke(); } return c; });
  const ringC = () => cached('ring', () => { const [c, g] = mkc(128, 128); g.lineWidth = 5; g.lineCap = 'round'; ['#7df', '#a6f', '#fff'].forEach((col, i) => { g.strokeStyle = col; g.beginPath(); g.arc(64, 64, 22 + i * 14, i, i + 4.5); g.stroke(); }); return c; });
  const cloudC = () => cached('cloud', () => { const [c, g] = mkc(256, 256); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 9; i++) { const bx = rnd(0, 256), by = rnd(0, 256), r = rnd(50, 100); for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { const gr = g.createRadialGradient(bx + dx, by + dy, 0, bx + dx, by + dy, r); gr.addColorStop(0, 'rgba(110,120,140,.9)'); gr.addColorStop(1, 'rgba(110,120,140,0)'); g.fillStyle = gr; g.fillRect(bx + dx - r, by + dy - r, r * 2, r * 2); } } return c; });
  function groundC() {
    return cached('g' + (A.n == 'PvP Arena' ? 'a' : AI), () => {
      const S = 256, [c, g] = mkc(S, S), arena = A.n == 'PvP Arena', base = arena ? ['#50555f', '#5d636e', '#444952'] : A.g, wd = f => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
      g.fillStyle = base[0]; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) { const bx = rnd(0, S), by = rnd(0, S), r = rnd(30, 75), col = base[1 + (i & 1)]; wd((dx, dy) => { const gr = g.createRadialGradient(bx + dx, by + dy, 0, bx + dx, by + dy, r); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(bx + dx - r, by + dy - r, r * 2, r * 2); }); }
      const dot = (col, n, w, h) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(rnd(0, S) | 0, rnd(0, S) | 0, w, h); };
      if (arena) { g.strokeStyle = '#2c3039'; g.lineWidth = 2; for (let i = 0; i <= S; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); } dot('#6a707c', 40, 3, 2); }
      else if (AI < 2) { for (let i = 0; i < 520; i++) { const bx = rnd(0, S), by = rnd(0, S); g.strokeStyle = Math.random() < .5 ? 'rgba(255,255,170,.22)' : 'rgba(0,30,0,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + rnd(-2, 2), by - rnd(3, 7)); g.stroke(); } dot('#f6e05e', 5, 3, 3); dot('#fff', 5, 3, 3); }
      else if (AI == 2) { for (let i = 0; i < 40; i++) { g.strokeStyle = i & 1 ? 'rgba(255,240,200,.3)' : 'rgba(120,80,30,.24)'; g.beginPath(); g.arc(rnd(0, S), rnd(0, S), rnd(14, 40), 3.4, 5.9); g.stroke(); } dot('rgba(110,80,50,.5)', 22, 3, 2); }
      else if (AI == 3) { dot('rgba(255,255,255,.7)', 70, 2, 2); g.strokeStyle = 'rgba(120,170,210,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); let px = rnd(0, S), py = rnd(0, S); g.moveTo(px, py); for (let j = 0; j < 4; j++) g.lineTo(px += rnd(-22, 22), py += rnd(-22, 22)); g.stroke(); } }
      else { g.strokeStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 14; i++) { g.beginPath(); let px = rnd(0, S), py = rnd(0, S); g.moveTo(px, py); for (let j = 0; j < 4; j++) g.lineTo(px += rnd(-18, 18), py += rnd(-18, 18)); g.stroke(); } dot('rgba(255,120,40,.7)', 20, 2, 2); }
      return c; });
  }

  /* ---------------- scenery (built once per area visit) ---------------- */
  const PAL = [
    { trunk: '#5a3a1c', foliage: null, rock: '#7a7a74', mt: ['#6b7480', '#8a93a0'], cap: true, water: [.18, .42, .62] },
    { trunk: '#3b2a18', foliage: null, rock: '#5d6258', mt: ['#3d4f46', '#566a5e'], cap: true, water: [.14, .3, .4] },
    { trunk: '#7a5a34', foliage: null, rock: '#b08a52', mt: ['#c49a5a', '#d8b06c'], cap: false, water: [.3, .5, .55] },
    { trunk: '#5a4636', foliage: null, rock: '#8fa6b4', mt: ['#9fb4c4', '#cfe0ec'], cap: true, water: [.55, .75, .88] },
    { trunk: '#2a2222', foliage: null, rock: '#4b4242', mt: ['#2f2626', '#4a3a36'], cap: false, water: [.95, .38, .1] }];
  function treeAt(sb, x, z, s, R, big) {
    const tc = A.tc ? A.tc.map(hex) : [[.1, .3, .12], [.16, .42, .18], [.25, .56, .25]], pal = PAL[Math.min(AI, 4)], tr = hex(pal.trunk), j = () => .85 + R() * .3, sw = 3.5 * s;
    if (A.rock) { const rk = hex(pal.rock); O(sb, T_SPHL, x, 6 * s, z, 20 * s, 12 * s, 16 * s, tint(rk, j()), { ry: R() * 6 }); O(sb, T_SPHL, x - 8 * s, 5 * s, z + 6 * s, 11 * s, 8 * s, 9 * s, tint(rk, .8), { ry: R() * 6 }); O(sb, T_SPHL, x + 9 * s, 7 * s, z - 5 * s, 9 * s, 14 * s, 8 * s, tint(rk, 1.2), { ry: R() * 6 }); if (R() < .5) O(sb, T_CONE, x + 4 * s, 0, z - 10 * s, 6 * s, 30 * s, 6 * s, tint(rk, .65)); return; }
    if (AI == 1 || AI == 3) {                                          // conifers (snowy in the glacier)
      const h = (26 + R() * 12) * s; O(sb, T_TRUNK, x, 0, z, 3.6 * s, h * .35, 3.6 * s, tr);
      for (let k = 0; k < 4; k++) { const f = k / 4, r = (19 - k * 4) * s, y = h * (.18 + f * .62); O(sb, T_CONE, x, y, z, r, h * .34, r, tint(tc[1], j() * (1 + f * .2)), { sw: sw * (.3 + f), y0: 0, hh: h * 1.1 }); if (AI == 3) O(sb, T_CONE, x, y + h * .12, z, r * .8, h * .24, r * .8, [.92, .95, 1], { sw: sw * (.3 + f), y0: 0, hh: h * 1.1 }); }
      return; }
    if (AI == 2) {
      if (R() < .55) { const h = (24 + R() * 14) * s, g = tint(tc[1], j()); O(sb, T_CYL, x, 0, z, 4.2 * s, h, 4.2 * s, g); O(sb, T_SPHL, x, h, z, 4.2 * s, 3.5 * s, 4.2 * s, g);
        for (const d of [-1, 1]) { const ay = h * (.35 + R() * .2); O(sb, T_CYL, x + d * 4 * s, ay, z, 3.2 * s, 7 * s, 3.2 * s, g, { rz: -d * 1.5708 }); O(sb, T_CYL, x + d * 11 * s, ay, z, 3 * s, 11 * s, 3 * s, g); O(sb, T_SPHL, x + d * 11 * s, ay + 11 * s, z, 3 * s, 2.5 * s, 3 * s, g); } }
      else { const h = (34 + R() * 10) * s; let px = x, py = 0; for (let k = 0; k < 3; k++) { O(sb, T_TRUNK, px, py, z, 3.4 * s, h / 3, 3.4 * s, tr, { rz: .12 }); px -= Math.sin(.12) * h / 3; py += h / 3; }
        for (let k = 0; k < 7; k++) O(sb, T_CONE, px, py, z, 4.2 * s, 22 * s, 1.4 * s, tint(tc[2], j()), { rz: 1.15, ry: k * .9, sw: sw * 1.4, y0: py - 6, hh: 30 * s }); }
      return; }
    const h = (22 + R() * 8) * s; O(sb, T_TRUNK, x, 0, z, 4.4 * s, h, 4.4 * s, tr, { rz: (R() - .5) * .1 });                   // broadleaf
    const cx = [[0, 0, 0, 15], [-9, -4, 3, 11], [9, -2, -3, 12], [0, 8, 2, 11], [3, -6, -8, 10]];
    for (const [dx, dy, dz, r] of cx) O(sb, T_SPHL, x + dx * s, h + (8 + dy) * s, z + dz * s, r * s, r * .85 * s, r * s, tint(tc[(R() * 3) | 0], j() * 1.1), { sw, y0: h * .6, hh: h });
  }
  function decor(sb, R, G) {
    const pal = PAL[Math.min(AI, 4)], n = Math.round(A.w * A.h / 8500), rk = hex(pal.rock), arena = A.n == 'PvP Arena';
    for (let k = 0; k < n && !arena; k++) {
      const x = SAFE + 30 + R() * (A.w - SAFE - 60), z = 20 + R() * (A.h - 40), r = R(), s = .7 + R() * .8;
      if (AI == 0) { if (r < .35) for (let b = 0; b < 4; b++) O(sb, T_PYR, x + (b - 1.5) * 1.6, 0, z + R() * 2, 1.6, 7 + R() * 5, 1.6, tint(hex(A.g[1]), 1.5 + R() * .4), { sw: 1.6 }); else if (r < .55) { const c = [[1, .9, .3], [1, 1, 1], [.95, .5, .7], [.6, .6, 1]][(R() * 4) | 0]; O(sb, T_CYL, x, 0, z, .5, 7, .5, [.2, .45, .15], { sw: .8 }); O(sb, T_SPHL, x, 7.5, z, 2.2, 2.2, 2.2, c, { sw: .8, y0: 0, hh: 8 }); } else if (r < .75) O(sb, T_SPHL, x, 4 * s, z, 8 * s, 5 * s, 8 * s, tint(hex(A.tc[1]), .9 + R() * .3), { sw: 1 }); else if (r < .9) O(sb, T_SPHL, x, 2 * s, z, 5 * s, 3 * s, 4 * s, tint(rk, .8 + R() * .5)); else { O(sb, T_CYL, x, 0, z, 1.2, 5, 1.2, [.9, .85, .75]); O(sb, T_SPHL, x, 5, z, 3.4, 2, 3.4, [.85, .2, .18]); } }
      else if (AI == 1) { if (r < .4) for (let b = 0; b < 5; b++) O(sb, T_PYR, x, 0, z, 2, 11 + R() * 5, 1.2, tint(hex(A.tc[2]), 1 + R() * .3), { rz: (b - 2) * .35, ry: b * 1.2, sw: 2 }); else if (r < .6) { O(sb, T_CYL, x, 0, z, 1.4, 6, 1.4, [.85, .8, .7]); O(sb, T_SPHL, x, 6, z, 4, 2.4, 4, [.7, .3, .25]); } else if (r < .78) O(sb, T_CYL, x, 4, z, 4 * s, 24 * s, 4 * s, hex(pal.trunk), { rz: 1.5708, ry: R() * 3 }); else O(sb, T_SPHL, x, 3 * s, z, 7 * s, 4 * s, 6 * s, tint(rk, .7 + R() * .4)); }
      else if (AI == 2) { if (r < .4) O(sb, T_PYR, x, 0, z, 2.5, 8 + R() * 4, 1.5, [.65, .55, .25], { sw: 1.5 }); else if (r < .7) O(sb, T_SPHL, x, 3 * s, z, 8 * s, 4.5 * s, 7 * s, tint(rk, .8 + R() * .4)); else if (r < .85) { O(sb, T_SPHL, x, 2.5, z, 3.2, 2.8, 3.8, [.92, .9, .82]); O(sb, T_CUBE, x + 3, 0, z, 1.2, 5, 1.2, [.9, .88, .8], { rz: .5 }); } else O(sb, T_SPHL, x, 5 * s, z, 28 * s, 5 * s, 20 * s, [.86, .72, .42]); }
      else if (AI == 3) { if (r < .45) O(sb, T_SPHL, x, 4 * s, z, 12 * s, 6 * s, 10 * s, [.93, .96, 1]); else if (r < .75) for (let b = 0; b < 3; b++) O(sb, T_CONE, x + b * 3, 0, z + (b % 2) * 3, 3, 9 + R() * 12, 3, [.7, .88, 1], { rz: (b - 1) * .2 }); else O(sb, T_SPHL, x, 3 * s, z, 7 * s, 4 * s, 6 * s, tint(rk, .8 + R() * .5)); }
      else { if (r < .4) O(sb, T_CONE, x, 0, z, 4 + R() * 3, 12 + R() * 22, 4, tint(rk, .6 + R() * .3)); else if (r < .75) O(sb, T_SPHL, x, 3 * s, z, 8 * s, 4.5 * s, 7 * s, tint(rk, .7 + R() * .5)); else { O(sb, T_SPHL, x, 2, z, 4, 3, 4, [.85, .82, .72]); G.push({ x, y: 6, z, s: 26, col: [1, .35, .1], a: .7, p: R() * 6 }); } }
    }
  }
  function village(sb, R, G) {
    const mid = A.h / 2, wood = hex('#6b4a26');
    for (let z = 4; z < A.h; z += 36) { O(sb, T_TRUNK, SAFE, 0, z, 5, 22, 5, wood); if ((z / 36 | 0) % 3 == 0) O(sb, T_CUBE, SAFE + 3.5, 12, z, 1.2, 9, 12, [.75, .15, .12], { sw: 2.5, y0: 12, hh: 9 }); }
    O(sb, T_CUBE, SAFE, 14, A.h / 2, 3, 3, A.h, hex('#7a5a32')); O(sb, T_CUBE, SAFE, 7, A.h / 2, 3, 3, A.h, hex('#7a5a32'));
    O(sb, T_CUBE, 150, 0, mid, 300, .8, 56, hex('#a89a78'));                 // cobbled road
    for (const z of [-250, -90, 90, 250]) { const zz = mid + z, wall = [hex('#cdb88a'), hex('#d8c498'), hex('#c4ae82')][(Math.abs(z) / 90 | 0) % 3];
      O(sb, T_CUBE, 52, 0, zz, 84, 48, 66, wall); O(sb, T_PYR, 52, 46, zz, 112, 38, 94, hex('#8a3a2a')); O(sb, T_CUBE, 52, 44, zz, 90, 4, 72, hex('#5a2a1c'));
      O(sb, T_CUBE, 95, 0, zz, 4, 28, 18, hex('#3a2412')); O(sb, T_CUBE, 94, 24, zz + 24, 3, 14, 14, hex('#ffe9a0')); O(sb, T_CUBE, 94, 24, zz - 24, 3, 14, 14, hex('#ffe9a0')); O(sb, T_CUBE, 30, 46, zz + 18, 10, 30, 10, hex('#8a8680')); G.push({ x: 94, y: 30, z: zz + 24, s: 34, col: [1, .85, .5], a: .35, p: 0 }); }
    O(sb, T_CYL, 70, 0, mid, 20, 12, 20, hex('#8a8680')); O(sb, T_CYL, 70, 1, mid, 16, 11, 16, [.1, .25, .4]); [-1, 1].forEach(d => O(sb, T_CUBE, 70 + d * 17, 0, mid, 3, 36, 3, wood)); O(sb, T_PYR, 70, 34, mid, 50, 16, 36, hex('#8a3a2a'));   // well
    for (const z of [-200, 0, 200]) { const zz = mid + z + 40; O(sb, T_CUBE, 228, 0, zz, 4, 56, 4, [.2, .2, .22]); O(sb, T_SPHL, 228, 60, zz, 5, 5, 5, [1, .9, .6]); G.push({ x: 228, y: 62, z: zz, s: 54, col: [1, .8, .45], a: .5, p: 1, night: 1 }); }
    for (const [x, z] of [[125, mid + 28], [132, mid + 40], [118, mid + 44]]) O(sb, T_CYL, x, 0, z, 7, 14, 7, hex('#6b4a26')); O(sb, T_CUBE, 128, 0, mid - 36, 12, 12, 12, hex('#8a6a3c'), { ry: .3 }); O(sb, T_CUBE, 140, 0, mid - 30, 10, 10, 10, hex('#9a7a46'), { ry: .8 });
    for (let k = 0; k < 6; k++) { const z = mid + (k - 2.5) * 110, x = 120 + R() * 150; O(sb, T_SPHL, x, 3, z + 40, 9, 5, 8, [.2, .45, .2]); }
  }
  function arenaSet(sb, G) {
    const stone = hex('#3b404a'), lt = hex('#6a707c');
    [[A.w / 2, -7, A.w + 28, 14], [A.w / 2, A.h + 7, A.w + 28, 14]].forEach(([x, z, w, d]) => O(sb, T_CUBE, x, 0, z, w, 44, d, stone)); [[-7, A.h / 2, 14, A.h], [A.w + 7, A.h / 2, 14, A.h]].forEach(([x, z, w, d]) => O(sb, T_CUBE, x, 0, z, w, 44, d, stone));
    for (let z = 60; z < A.h; z += 130) [SAFE + 40, A.w - 20].forEach(x => { O(sb, T_CUBE, x, 0, z, 16, 62, 16, lt); O(sb, T_CUBE, x, 62, z, 22, 6, 22, stone); G.push({ x, y: 72, z, s: 56, col: [1, .6, .2], a: .9, p: z }); });
    for (const t of [0, 1, 2]) { O(sb, T_CUBE, A.w / 2, 44 + t * 16, -40 - t * 30, A.w + 60 + t * 60, 16, 34, tint(stone, 1 - t * .12)); O(sb, T_CUBE, A.w / 2, 44 + t * 16, A.h + 40 + t * 30, A.w + 60 + t * 60, 16, 34, tint(stone, 1 - t * .12)); }
    for (let x = 40; x < A.w; x += 60) { const c = [[.8, .2, .2], [.2, .4, .8], [.9, .8, .3], [.3, .7, .4]][(x / 60 | 0) % 4]; O(sb, T_CUBE, x, 50, -42, 14, 14, 10, c); O(sb, T_SPHL, x, 66, -42, 5, 5, 5, hex('#e0b890')); O(sb, T_CUBE, x + 20, 66, A.h + 44, 14, 14, 10, c); O(sb, T_SPHL, x + 20, 82, A.h + 44, 5, 5, 5, hex('#e0b890')); }
  }
  function outside(sb, R, G) {                                         // everything beyond the playable rectangle
    const ai = Math.min(AI, 4), pal = PAL[ai], arena = A.n == 'PvP Arena', rk = hex(pal.rock), water = !arena && (ai == 0 || ai == 3 || ai == 4);
    const inside = (x, z) => x > -60 && x < A.w + 60 && z > -60 && z < A.h + 60, lake = (x, z) => water && z > A.h + 70 && z < A.h + 520;
    for (let k = 0, got = 0; got < 230 && k < 2000; k++) {
      const x = -900 + R() * (A.w + 1800), z = -760 + R() * (A.h + 1500); if (inside(x, z) || lake(x, z)) continue; got++;
      const dEdge = Math.min(Math.abs(x < 0 ? x : x - A.w), Math.abs(z < 0 ? z : z - A.h)), s = 1.2 + R() * 1.4 + Math.min(1.2, dEdge / 500);
      if (arena) { O(sb, T_CUBE, x, 0, z, 18 * s, (50 + R() * 90) * s, 18 * s, tint(rk, .7 + R() * .5), { ry: R() }); continue; }
      if (ai == 4) { if (R() < .6) O(sb, T_CONE, x, 0, z, (10 + R() * 14) * s, (50 + R() * 120) * s, (10 + R() * 14) * s, tint(rk, .6 + R() * .5)); else treeAt(sb, x, z, s, R); }
      else if (ai == 2) { const r = R(); if (r < .5) O(sb, T_SPHL, x, 6 * s, z, (60 + R() * 70) * s, (12 + R() * 14) * s, (40 + R() * 40) * s, tint(hex('#d8b46a'), .85 + R() * .25), { ry: R() * 3 }); else if (r < .75) treeAt(sb, x, z, s, R); else { O(sb, T_CUBE, x, 0, z, 16 * s, (40 + R() * 60) * s, 16 * s, tint(hex('#c49a5a'), .8 + R() * .3), { ry: R() }); } }
      else if (R() < .12) { O(sb, T_SPHL, x, 5 * s, z, 22 * s, 12 * s, 18 * s, tint(rk, .7 + R() * .5)); O(sb, T_SPHL, x + 14 * s, 4 * s, z - 6 * s, 12 * s, 8 * s, 10 * s, tint(rk, .9)); }
      else treeAt(sb, x, z, s, R);
    }
    // distant mountains
    for (let k = 0; k < 26; k++) { const side = k % 4, d = 900 + R() * 700, along = R(); let x, z;
      if (side == 0) { x = -600 + along * (A.w + 1200); z = -d - 120; } else if (side == 1) { x = -d - 300; z = -400 + along * (A.h + 800); } else if (side == 2) { x = A.w + d + 300; z = -400 + along * (A.h + 800); } else { x = -600 + along * (A.w + 1200); z = A.h + d + (water ? 420 : 100); }
      const h = 300 + R() * 520, r = 260 + R() * 260, c = hex(pal.mt[k & 1]);
      if (ai == 2) { O(sb, T_FR, x, 0, z, r, h * .55, r * .8, tint(c, .8 + R() * .3)); } else { O(sb, T_CONE, x, 0, z, r, h, r * .9, tint(c, .8 + R() * .3)); if (pal.cap) O(sb, T_CONE, x, h * .7, z, r * .34, h * .3, r * .3, [.95, .97, 1]); } }
  }
  function buildScene() {
    const sb = newSB(), R = mb(AI * 977 + (A.n == 'PvP Arena' ? 5 : 13)), G = [], arena = A.n == 'PvP Arena';
    T_FR = T_FR || frT(1, .55, 9);
    if (arena) arenaSet(sb, G); else village(sb, R, G);
    for (const tr of T) treeAt(sb, tr.x, tr.y, tr.s * 1.05, mb((tr.x * 7 + tr.y * 13) | 0));
    decor(sb, R, G); outside(sb, R, G); flush(sb);
    SCN = { A, T, chunks: sb.chunks, G, water: !arena && [0, 3, 4].includes(Math.min(AI, 4)) };
  }

  /* ---------------- draw helpers ---------------- */
  let TRK, CON, CYL, PYR, LST = {}, lastMesh = null; const IDM = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const s1 = (n, v) => { if (LST[n] !== v) { LST[n] = v; gl.uniform1f(U[n], v); } };
  function dr(m, M, a = {}) {
    if (lastMesh !== m) { lastMesh = m; gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 48, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 48, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 48, 24); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 48, 32); }
    gl.uniformMatrix4fv(U.uM, false, M); const c = a.col || [1, 1, 1, 1]; gl.uniform4f(U.uCol, c[0], c[1], c[2], c[3] ?? 1);
    s1('uUseTex', a.tex ? 1 : 0); if (a.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex); }
    s1('uLit', a.lit ? 1 : 0); s1('uEmit', a.emit ? 1 : 0); s1('uFlash', a.flash || 0); s1('uAT', a.at ?? .5); s1('uCloudOn', a.cloud ? 1 : 0);
    const u0 = a.uv ? a.uv[0] : 1, u1 = a.uv ? a.uv[1] : 1; if (LST.u0 !== u0 || LST.u1 !== u1) { LST.u0 = u0; LST.u1 = u1; gl.uniform2f(U.uUV, u0, u1); }
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  }
  const later = (mode, m, M, a) => TQ.push([mode, m, M, a]);
  function blob(x, z, w, a = .5) { later('a', QUAD, trs(x, .4, z + w * .25, w, w * .5, 1, -1.5708, 0), { tex: tex(glowC()), col: [0, 0, 0, a], emit: 1, at: 0 }); }
  const glow = (x, y, z, s, col, a = 1) => later('add', QUAD, trs(x, y - s / 2, z, s, s, 1, 0, 0, yaw), { tex: tex(glowC()), col: [col[0], col[1], col[2], a], emit: 1, at: 0 });

  /* ---------------- 3D character / monster models ---------------- */
  const PALS = new WeakMap();
  function pal(img) {
    let p = PALS.get(img); if (p) return p; const w = img.width, h = img.height, [, g] = mkc(w, h); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, w, h).data;
    const band = (y0, y1) => { let r = 0, gg = 0, b = 0, n = 0; for (let y = Math.floor(y0 * h); y < Math.ceil(y1 * h); y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } } return n ? [r / n / 255, gg / n / 255, b / n / 255] : null; };
    const all = band(0, 1) || [.6, .6, .6]; p = { all, top: band(0, .3) || all, mid: band(.3, .65) || all, low: band(.65, 1) || all, face: band(.14, .3) || all, hair: band(0, .12) || all }; PALS.set(img, p); return p;
  }
  const STS = new WeakMap();
  function stateOf(ob, x, y, dt, yawTo) {
    let s = STS.get(ob); if (!s) { s = { px: x, py: y, walk: 0, yaw: yawTo ?? 0, moving: false, ph: x * .017 + y * .011, atk: -1 }; STS.set(ob, s); }
    if (dt > 0) { const dx = x - s.px, dy = y - s.py, sp = Math.hypot(dx, dy) / dt; s.moving = sp > 6 && sp < 600; if (s.moving) s.walk += Math.min(sp, 200) * dt * .12; if (yawTo === undefined && s.moving) yawTo = Math.atan2(dx, dy); s.px = x; s.py = y; }
    if (yawTo !== undefined) { const d = mod(yawTo - s.yaw + 3.1416, 6.2832) - 3.1416; s.yaw += d * .28; } return s;
  }
  const part = (m, B, x, y, z, sx, sy, sz, col, f = 0, rx = 0, rz = 0, emit = 0) => dr(m, mul(B, trs(x, y, z, sx, sy, sz, rx, rz)), { col: [col[0], col[1], col[2], 1], lit: 1, flash: f, emit });
  const limb = (B, px, py, pz, ax, az, w, len, d, col, f, hand, boot) => {
    const Pm = mul(B, trs(px, py, pz, 1, 1, 1, ax, az)); dr(CUBE, mul(Pm, trs(0, -len, 0, w, len, d)), { col: [col[0], col[1], col[2], 1], lit: 1, flash: f });
    if (hand) dr(CUBE, mul(Pm, trs(0, -len - w * .55, 0, w * 1.08, w * 1.1, d * 1.08)), { col: [hand[0], hand[1], hand[2], 1], lit: 1, flash: f });
    if (boot) dr(CUBE, mul(Pm, trs(0, -len, 1.6, w * 1.15, 5, d * 1.7)), { col: [boot[0], boot[1], boot[2], 1], lit: 1, flash: f }); return Pm;
  };
  const METAL = [.62, .66, .72], GOLD = [.9, .72, .25], DARK = [.1, .1, .1], WOOD = [.36, .24, .12];
  const WPN = {
    sword: (m, c, f) => { part(CUBE, m, 0, 6, 0, 3.2, 32, 1.4, c, f); part(CUBE, m, 0, 5, 0, 11, 2.4, 3.6, GOLD, f); part(CUBE, m, 0, -2, 0, 2.4, 7.5, 2.4, WOOD, f); part(SPH, m, 0, -3, 0, 1.8, 1.8, 1.8, GOLD, f); },
    mace: (m, c, f) => { part(CUBE, m, 0, -5, 0, 2.8, 30, 2.8, WOOD, f); part(CUBE, m, 0, 24, 0, 10, 11, 10, c, f); [[-6, 0], [6, 0], [0, -6], [0, 6]].forEach(([a, b]) => part(CUBE, m, a, 27, b, 3, 4, 3, METAL, f)); },
    staff: (m, c, f) => { part(CUBE, m, 0, -8, 0, 2.8, 50, 2.8, WOOD, f); part(SPH, m, 0, 44, 0, 5.5, 5.5, 5.5, c, f, 0, 0, 1); part(CUBE, m, 0, 38, 0, 7, 2, 7, GOLD, f); glow(0, 0, 0, 0, [1, 1, 1], 0); },
    axe: (m, c, f) => { part(CUBE, m, 0, -6, 0, 3.4, 40, 3.4, WOOD, f); part(CUBE, m, 0, 28, 0, 14, 14, 3, c, f); part(CUBE, m, 0, 28, 0, 3, 18, 6, METAL, f); },
    club: (m, c, f) => { part(CUBE, m, 0, -4, 0, 3, 14, 3, WOOD, f); part(SPH, m, 0, 14, 0, 6, 8, 6, c, f); },
    trident: (m, c, f) => { part(CUBE, m, 0, -8, 0, 2, 42, 2, c, f); [-4, 0, 4].forEach(x => part(CON, m, x, 33, 0, 1.6, 12, 1.6, METAL, f)); },
    bow: (m, c, f) => { part(CUBE, m, 0, -5, 0, 2.4, 10, 2.4, WOOD, f); part(CUBE, m, 0, 4, 0, 2, 17, 2, c, f, .55); part(CUBE, m, 0, -4, 0, 2, 17, 2, c, f, 3.14159 - .55); part(CUBE, m, 0, -15, -4.6, .6, 31, .6, [.9, .9, .85], f); } };
  const CONE_ = () => CON;
  function human(B, S, o) {
    const f = o.flash || 0, bg = o.bulk || 1, th = o.thin || 1, bob = S.moving ? Math.abs(Math.sin(S.walk)) * 1.5 : Math.sin(t * 2.2 + S.ph) * .4;
    B = mul(B, trs(0, bob, 0, 1, 1, 1)); const sw = S.moving ? Math.sin(S.walk) * .8 : Math.sin(t * 1.6 + S.ph) * .03, skin = o.skin, torso = o.torso, bw = bg * th;
    limb(B, -4.5 * bg, 18, 0, sw, 0, 6 * bw, 18, 6 * bw, o.legs, f, null, o.boot || DARK); limb(B, 4.5 * bg, 18, 0, -sw, 0, 6 * bw, 18, 6 * bw, o.legs, f, null, o.boot || DARK);
    part(CUBE, B, 0, 18, 0, 16 * bw, 20, 9 * bw, torso, f); part(CUBE, B, 0, 17.5, 0, 16.6 * bw, 3, 9.6 * bw, tint(o.legs, .6), f);
    if (o.plate) part(CUBE, B, 0, 24, .6, 17 * bw, 12, 9.8 * bw, o.plate, f);
    const bowman = o.wpn == 'bow', atk = S.atk, rax = o.armsFwd ? -1.45 : atk >= 0 ? -2.6 + 2.3 * atk : bowman ? -.5 : -sw * .9, lax = o.armsFwd ? -1.45 : bowman ? -1.4 : sw * .9;
    const sl = o.sleeve || torso, Rm = limb(B, 10.5 * bw, 36, 0, rax, 0, 5 * bw, 17, 5 * bw, sl, f, skin); limb(B, -10.5 * bw, 36, 0, lax, 0, 5 * bw, 17, 5 * bw, sl, f, skin);
    const hk = o.headk || 1; part(SPH, B, 0, 45, .4, 7.2 * hk, 7.4 * hk, 7 * hk, skin, f);
    if (!o.bald) part(SPH, B, 0, 48, -1.2, 7.7 * hk, 6.3 * hk, 7.5 * hk, o.hair || DARK, f);
    const ec = o.eye || DARK, es = o.eyeS || 1; [-2.8, 2.8].forEach(x => part(CUBE, B, x * hk, 44.6, 6.5 * hk, 1.7 * es, 1.9 * es, 1, ec, f, 0, 0, o.eyeGlow ? 1 : 0));
    if (o.helm) { part(SPH, B, 0, 48.5, 0, 8.4, 6.6, 8.4, o.helm, f); part(CUBE, B, 0, 52, -1, 1.6, 8, 10, o.crest || [.8, .15, .15], f); }
    if (o.paul) { [-1, 1].forEach(d => part(SPH, B, d * 10.8 * bw, 37.5, 0, 5.4, 4.2, 5.4, o.paul, f)); }
    if (o.cape) { const cm = mul(B, trs(0, 36, -5, 1, 1, 1, .1 + (S.moving ? Math.abs(Math.sin(S.walk)) * .25 : .03))); dr(CUBE, mul(cm, trs(0, -25, 0, 13 * bw, 25, 1.4)), { col: [o.cape[0], o.cape[1], o.cape[2], 1], lit: 1, flash: f }); }
    if (o.wpn && WPN[o.wpn]) { const hand = bowman ? mul(B, trs(-10.5 * bw, 36, 0, 1, 1, 1, lax)) : Rm; WPN[o.wpn](mul(hand, trs(0, -19, 0, 1, 1, 1, bowman ? 0 : .45)), o.wcol || METAL, f); }
    if (o.extra) o.extra(B, S, f);
  }
  const rgbp = (a, d = 1) => a.map(v => Math.min(1, v * d));
  function armorLook(ai) { const p = pal(PL[ai] || PL[0]); return { skin: SKIN, torso: p.mid, legs: p.low, hair: p.hair, sleeve: p.mid, plate: ai >= 3 ? tint(p.mid, 1.25) : null, paul: ai >= 2 ? tint(p.mid, 1.3) : null, helm: ai >= 3 ? [.65, .68, .74] : null, cape: ai >= 5 ? tint(p.mid, .75) : null }; }
  const WCLS = { archer: 'bow', tank: 'mace', mage: 'staff' }, HK = 1.3, MK = 1.4, SKIN = [.93, .74, .6];
  function npcLook(k, img) {
    const p = pal(img), o = { skin: p.face, torso: p.mid, legs: p.low, hair: p.hair, sleeve: p.mid };
    if (k == 'smith') { o.wpn = 'mace'; o.wcol = [.5, .5, .55]; o.plate = [.2, .17, .15]; } else if (k == 'elder') { o.wpn = 'staff'; o.wcol = [.5, .8, 1]; o.extra = (B, S, f) => part(SPH, B, 0, 38, 4.5, 6, 8, 3.5, [.92, .92, .92], f); } else if (k == 'merchant') o.extra = (B, S, f) => part(CUBE, B, 0, 20, -8, 12, 16, 7, [.5, .32, .16], f);
    else if (k == 'hunter') { o.wpn = 'bow'; o.cape = tint(p.mid, .7); } else if (k == 'guide') { o.cape = [.2, .5, .5]; o.extra = (B, S, f) => { part(CUBE, B, 0, 20, -8, 11, 15, 7, [.4, .3, .2], f); part(SPH, B, 0, 52, 0, 9, 3, 9, [.2, .5, .5], f); }; }
    else if (k.startsWith('gear')) { o.paul = [.7, .6, .3]; o.wpn = ['sword', 'mace', 'axe', 'sword'][(+k.slice(4) - 1) % 4]; o.wcol = [.8, .8, .85]; } else if (k.startsWith('arena')) { o.helm = [.7, .2, .2]; o.paul = [.75, .6, .25]; o.plate = [.6, .15, .15]; o.wpn = 'sword'; o.wcol = [.9, .9, .95]; }
    else if (k == 'healer') o.extra = (B, S, f) => part(SPH, B, 0, 51, -1, 9, 4, 8, [1, .8, .85], f);
    return o;
  }
  /* monsters: each plan draws from a base matrix B (feet at origin, facing +z) */
  const EYE = (B, x, y, z, r, f) => { [-1, 1].forEach(d => { part(SPH, B, d * x, y, z, r, r, r, [1, 1, 1], f); part(SPH, B, d * x, y, z + r * .55, r * .55, r * .55, r * .55, DARK, f); }); };
  const PLAN = { slime: 'blob', king: 'blob', mush: 'mush', bee: 'bee', snake: 'snake', wolf: 'quad', scorp: 'scorp', cactus: 'cactus', pengu: 'pengu', ghost: 'ghost', lava: 'golem', frost: 'golem', dragon: 'dragon' };
  function humMob(B, e, S, f) {
    const p = pal(e.img), ty = e.type, k = (e.img.height / 52) || 1, o = { skin: p.face, torso: p.mid, legs: p.low, hair: p.hair, flash: f }, BB = mul(B, trs(0, 0, 0, k, k, k)), ph = S.ph;
    if (ty == 'goblin') { Object.assign(o, { k: .9, wpn: 'club', wcol: [.5, .32, .16], bald: 1, eyeGlow: 1, eye: [1, .9, .2], extra: (B2, S2, f2) => [-1, 1].forEach(d => part(CON, B2, d * 7, 46, 0, 1.8, 11, 3, p.face, f2, 0, -d * 1.35)) }); }
    else if (ty == 'skel') { Object.assign(o, { skin: [.9, .89, .82], torso: [.88, .87, .8], legs: [.85, .84, .77], sleeve: [.88, .87, .8], thin: .6, bald: 1, eyeS: 1.9, boot: [.8, .79, .72], wpn: 'sword', wcol: [.55, .55, .5], extra: (B2, S2, f2) => [0, 1, 2].forEach(i => part(CUBE, B2, 0, 22 + i * 5, 4.5 * .6, 8.5, 1.2, 1, DARK, f2)) }); }
    else if (ty == 'zombie') { Object.assign(o, { armsFwd: 1, eye: [.9, .1, .1], eyeGlow: 1, skin: mix(p.face, [.45, .6, .4], .5), thin: .95, extra: (B2, S2, f2) => part(CUBE, B2, 4, 12, 4.8, 6, 12, 1, tint(p.mid, .5), f2) }); }
    else if (ty == 'mummy') { Object.assign(o, { armsFwd: 1, skin: [.86, .8, .62], torso: [.88, .82, .66], legs: [.84, .78, .6], sleeve: [.86, .8, .62], bald: 1, eye: [.9, .1, .1], eyeGlow: 1, extra: (B2, S2, f2) => { for (let i = 0; i < 6; i++) part(CUBE, B2, 0, 20 + i * 3.2, 0, 17, 1, 10, [.7, .64, .46], f2, 0, (i - 3) * .06); [0, 1, 2].forEach(i => part(CUBE, B2, 0, 38 + i * 3, 0, 8, 1, 8, [.7, .64, .46], f2)); } }); }
    else if (ty == 'imp') { Object.assign(o, { k: .85, bald: 1, eyeGlow: 1, eye: [1, .9, .2], wpn: 'trident', wcol: [.35, .1, .1], extra: (B2, S2, f2) => { [-1, 1].forEach(d => { part(CON, B2, d * 4, 51, 0, 1.8, 8, 1.8, [.2, .05, .05], f2, 0, -d * .3); part(CUBE, B2, d * 9, 38, -5, 18, 1.2, 14, tint(p.mid, .8), f2, .3 + Math.sin(t * 9 + ph) * .35, -d * (.5 + Math.sin(t * 9 + ph) * .3)); }); for (let i = 0; i < 3; i++) part(SPH, B2, 0, 12 - i * 2, -5 - i * 4 - Math.sin(t * 5 + i) * 1, 1.6 - i * .3, 1.6 - i * .3, 1.6 - i * .3, p.mid, f2); } }); }
    else if (ty == 'chief') { Object.assign(o, { bulk: 1.35, headk: 1.1, skin: mix(p.face, [.3, .5, .25], .5), plate: [.35, .33, .33], paul: [.5, .5, .55], bald: 1, eyeGlow: 1, eye: [1, .2, .1], wpn: 'axe', wcol: [.75, .75, .8], extra: (B2, S2, f2) => [-1, 1].forEach(d => part(CON, B2, d * 3.5, 40, 6.8, 1.6, 5, 1.6, [.95, .93, .85], f2, 0, d * .15)) }); }
    else if (ty == 'osiris') { Object.assign(o, { bulk: 1.15, skin: [.85, .65, .4], torso: [.85, .72, .4], legs: [.8, .66, .36], plate: GOLD, paul: GOLD, bald: 1, eyeGlow: 1, eye: [.4, 1, 1], wpn: 'staff', wcol: [.3, 1, .9], extra: (B2, S2, f2) => { part(CON, B2, 0, 50, -1, 9, 14, 9, GOLD, f2); part(CUBE, B2, 0, 44, 0, 15, 5, 14, [.15, .25, .6], f2); part(CUBE, B2, 0, 12, 0, 18, 12, 11, [.9, .78, .45], f2); } }); }
    else if (ty == 'titan') { Object.assign(o, { bulk: 1.5, skin: [.7, .85, .95], torso: [.55, .72, .88], legs: [.5, .66, .82], plate: [.75, .9, 1], bald: 1, eyeGlow: 1, eye: [.4, 1, 1], wpn: 'mace', wcol: [.75, .92, 1], extra: (B2, S2, f2) => [-1, 1].forEach(d => { part(CON, B2, d * 14, 36, 0, 4, 18, 4, [.8, .95, 1], f2, 0, -d * .25); part(CON, B2, d * 9, 38, -2, 3, 12, 3, [.8, .95, 1], f2, 0, -d * .6); }) }); }
    else if (ty == 'yeti') { Object.assign(o, { bulk: 1.5, skin: [.35, .38, .45], torso: [.93, .95, 1], legs: [.9, .93, .98], sleeve: [.93, .95, 1], hair: [.95, .97, 1], boot: [.85, .88, .95], extra: (B2, S2, f2) => { part(SPH, B2, 0, 46, -.4, 8.6, 8.4, 8.2, [.95, .97, 1], f2); part(SPH, B2, 0, 44.5, 1.8, 6.2, 5.6, 5.5, [.28, .3, .36], f2); [-1, 1].forEach(d => part(SPH, B2, d * 11.5, 33, 0, 5.6, 8, 5.6, [.95, .97, 1], f2)); } }); }
    else Object.assign(o, { wpn: 'club', wcol: [.5, .35, .2] });
    human(BB, S, o);
  }
  const MOBP = {
    blob(B, e, S, f, p) { const r = Math.max(10, e.r) * 1.1, sq = .74 + Math.sin(t * 4 + S.ph) * .08, c = p.all; part(SPH, B, 0, r * sq, 0, r, r * sq, r, c, f); part(SPH, B, -r * .3, r * sq * 1.45, r * .25, r * .22, r * .14, r * .22, [1, 1, 1], f, 0, 0, 1); EYE(B, r * .34, r * sq * 1.05, r * .74, r * .2, f);
      if (e.type == 'king') { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.2832; part(CON, B, Math.cos(a) * r * .38, r * sq * 1.8, Math.sin(a) * r * .38, 4, 9, 4, GOLD, f); } part(SPH, B, 0, r * sq * 1.75, r * .4, 3, 3, 3, [.9, .1, .2], f, 0, 0, 1); } },
    mush(B, e, S, f, p) { const r = Math.max(10, e.r) * 1.2, bo = Math.sin(t * 5 + S.ph) * .8; part(CYL, B, 0, 0, 0, r * .45, 13 + bo, r * .45, [.95, .9, .8], f); part(SPH, B, 0, 15 + bo, 0, r * 1.15, r * .75, r * 1.15, p.all, f); for (let i = 0; i < 6; i++) { const a = i * 1.05; part(SPH, B, Math.cos(a) * r * .75, 17 + bo + (i % 2) * 2, Math.sin(a) * r * .75, 2.2, 1.4, 2.2, [1, 1, 1], f); } EYE(B, r * .17, 8, r * .43, 1.9, f); },
    bee(B, e, S, f, p) { const y = 20 + Math.sin(t * 6 + S.ph) * 2.5; for (let i = 0; i < 4; i++) part(SPH, B, 0, y, 8 - i * 5, 5.2 - i * .4, 5.2 - i * .4, 3.6, i % 2 ? [.1, .1, .1] : [1, .85, .15], f); part(SPH, B, 0, y + 1, 12, 4.4, 4.4, 4.4, [.12, .1, .1], f); part(CON, B, 0, y, -14, 1.6, 6, 1.6, [.2, .2, .2], f, 1.57); EYE(B, 2.2, y + 2, 14.5, 1.5, f);
      [-1, 1].forEach(d => part(CUBE, B, d * 3, y + 5, 2, 12, .6, 8, [.85, .95, 1], f, 0, d * (.4 + Math.sin(t * 45 + S.ph) * .5))); },
    snake(B, e, S, f, p) { for (let i = 0; i < 7; i++) { const r = 5.2 - i * .45, wv = Math.sin(t * 5 - i * .9 + S.ph) * 5 * (i / 3 + .3); part(SPH, B, wv, r, 8 - i * 7, r, r * .9, r * 1.2, i % 2 ? tint(p.all, .8) : p.all, f); } part(SPH, B, 0, 6.4, 11, 5, 4.4, 5.6, p.all, f); EYE(B, 2.4, 8.4, 14, 1.3, f); part(CUBE, B, 0, 4.8, 16.5, .7, .4, 4, [.9, .1, .2], f); },
    quad(B, e, S, f, p) { const sw = S.moving ? Math.sin(S.walk * 1.4) * .7 : 0, c = p.all, dk = tint(c, .7), bo = S.moving ? Math.abs(Math.sin(S.walk * 1.4)) * 1.2 : 0; B = mul(B, trs(0, bo, 0, 1, 1, 1));
      part(CUBE, B, 0, 11, -2, 12, 12, 26, c, f); part(CUBE, B, 0, 14, 12, 10, 10, 9, c, f); part(CUBE, B, 0, 14, 19, 6, 5, 7, dk, f); [-1, 1].forEach(d => { part(CON, B, d * 3.5, 24, 10, 2.6, 6, 2.6, dk, f); }); part(CUBE, B, 0, 16.5, 22.4, 2, 2, 1, DARK, f); EYE(B, 3, 18, 15.5, 1.4, f);
      [[-1, 8, sw], [1, 8, -sw], [-1, -10, -sw], [1, -10, sw]].forEach(([d, z, a]) => limb(B, d * 4.2, 9, z, a, 0, 4, 9, 4, dk, f)); const tm = mul(B, trs(0, 14, -14, 1, 1, 1, 2.4 + Math.sin(t * 6 + S.ph) * .25)); dr(CUBE, mul(tm, trs(0, 0, 0, 4, 14, 4)), { col: [c[0], c[1], c[2], 1], lit: 1, flash: f }); },
    scorp(B, e, S, f, p) { const c = p.all, sw = S.moving ? Math.sin(S.walk * 1.6) * .5 : 0; part(SPH, B, 0, 7, 0, 10, 5.5, 13, c, f); part(SPH, B, 0, 7.5, 12, 6, 4.5, 5, tint(c, .85), f); EYE(B, 2, 10, 15.5, 1.2, f);
      for (let i = 0; i < 4; i++) part(SPH, B, 0, 8 + i * 4.2 + (i > 1 ? -1 : 0), -12 - Math.sin(i * .9) * 5 + (i > 2 ? 4 : 0), 3.6 - i * .3, 3.4 - i * .3, 3.6 - i * .3, c, f); part(CON, B, 0, 22, -9, 1.8, 6, 1.8, [.3, .1, .1], f, 3.0);
      [-1, 1].forEach(d => { part(CUBE, B, d * 9, 6, 14, 3, 3, 10, c, f, 0, 0); part(SPH, B, d * 10, 6.5, 20, 4.4, 2.6, 4.4, tint(c, 1.2), f); [-5, 0, 5].forEach((z, i) => part(CUBE, B, d * 8, 3, z, 9, 1.4, 1.4, tint(c, .7), f, 0, d * (.3 + sw * (i % 2 ? 1 : -1)))); }); },
    cactus(B, e, S, f, p) { const g = p.all, r = Math.max(10, e.r) * .8, bo = Math.sin(t * 3 + S.ph) * .8; part(CYL, B, 0, 0, 0, r, 26 + bo, r, g, f); part(SPH, B, 0, 26 + bo, 0, r, 5, r, g, f); [-1, 1].forEach(d => { part(CYL, B, d * (r + 1), 12, 0, 3.2, 8, 3.2, g, f, 0, -d * 1.5708); part(CYL, B, d * (r + 8), 12, 0, 3, 10, 3, g, f); }); part(SPH, B, 0, 32 + bo, 0, 3, 3, 3, [.95, .35, .6], f); EYE(B, r * .38, 17, r * .85, 2.2, f); for (let i = 0; i < 8; i++) part(CON, B, Math.cos(i * 2.2) * r * .95, 6 + i * 2.6, Math.sin(i * 2.2) * r * .95, .7, 3, .7, [.95, .95, .85], f); },
    pengu(B, e, S, f, p) { const sw = S.moving ? Math.sin(S.walk * 1.3) * .45 : 0; B = mul(B, trs(0, 0, 0, 1, 1, 1, 0, sw * .12)); part(SPH, B, 0, 13, 0, 10, 14, 8.5, [.12, .14, .2], f); part(SPH, B, 0, 12, 3.2, 7, 11, 6, [.96, .96, 1], f); part(SPH, B, 0, 27, .5, 7, 7, 6.6, [.12, .14, .2], f); part(CON, B, 0, 26, 7, 3, 5, 1.8, [1, .65, .15], f, 1.57); EYE(B, 2.8, 28.5, 5.2, 1.5, f);
      [-1, 1].forEach(d => { part(CUBE, B, d * 10, 14, 0, 2, 12, 6, [.12, .14, .2], f, 0, -d * (.35 + sw)); part(CUBE, B, d * 3.5, 0, 2 + (d * sw) * 4, 6, 2, 8, [1, .65, .15], f); }); },
    ghost(B, e, S, f, p) { const y = 8 + Math.sin(t * 2.4 + S.ph) * 3, c = [.82, .9, 1]; part(SPH, B, 0, y + 22, 0, 10, 11, 9, c, f, 0, 0, 1); part(CON, B, 0, y, 0, 11, 24, 10, c, f, 3.1416 * 0 , 0, 1); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832; part(SPH, B, Math.cos(a) * 8, y + 1 + Math.sin(t * 4 + i) * 1.4, Math.sin(a) * 7.5, 3.4, 3.4, 3.4, c, f, 0, 0, 1); }
      [-1, 1].forEach(d => { part(SPH, B, d * 4, y + 24, 8.2, 2.4, 3.6, 1.6, DARK, f); part(CUBE, B, d * 11, y + 14, 2, 3, 9, 3, c, f, 0, -d * .5 + Math.sin(t * 3 + S.ph) * .2, 1); }); glow(B[12], B[13] + 22, B[14], 46, [.5, .7, 1], .35); },
    golem(B, e, S, f, p) { const lava = e.type == 'lava', c = p.all, rk = lava ? [.26, .2, .2] : [.62, .78, .9], gl2 = lava ? [1, .45, .1] : [.5, .95, 1], sw = S.moving ? Math.sin(S.walk) * .5 : Math.sin(t * 1.6 + S.ph) * .03, bo = S.moving ? Math.abs(Math.sin(S.walk)) * 1.2 : 0; B = mul(B, trs(0, bo, 0, 1, 1, 1));
      limb(B, -7, 16, 0, sw, 0, 9, 16, 9, rk, f, null, tint(rk, .7)); limb(B, 7, 16, 0, -sw, 0, 9, 16, 9, rk, f, null, tint(rk, .7)); part(CUBE, B, 0, 14, 0, 24, 22, 14, rk, f); part(SPH, B, 0, 38, 0, 8, 7, 7, tint(rk, 1.15), f); part(SPH, B, -13, 33, 0, 7.5, 6, 7.5, tint(rk, 1.1), f); part(SPH, B, 13, 33, 0, 7.5, 6, 7.5, tint(rk, 1.1), f);
      limb(B, -16, 33, 0, -sw * 1.3, 0, 8, 20, 8, rk, f, tint(rk, 1.2)); limb(B, 16, 33, 0, sw * 1.3, 0, 8, 20, 8, rk, f, tint(rk, 1.2)); [-1, 1].forEach(d => part(CUBE, B, d * 3, 38.5, 6.2, 2.6, 1.8, 1, gl2, f, 0, 0, 1)); for (let i = 0; i < 4; i++) part(CUBE, B, -8 + i * 5, 14 + (i % 2) * 7, 7.2, 1.2, 8, .8, gl2, f, 0, (i - 1.5) * .25, 1);
      if (!lava) [-1, 1].forEach(d => part(CON, B, d * 13, 36, 0, 3.5, 13, 3.5, [.85, .97, 1], f, 0, -d * .3)); else glow(B[12], B[13] + 20, B[14], 60, [1, .4, .1], .3); },
    dragon(B, e, S, f, p) {
      const R = [.7, .12, .1], RL = [.85, .35, .2], fl = Math.sin(t * 5) * .55, tail = i => Math.sin(t * 2.4 - i * .7) * 4 * (i + 1) / 3; B = mul(B, trs(0, Math.sin(t * 2) * 1.5, 0, 1.5, 1.5, 1.5));
      part(SPH, B, 0, 28, 0, 15, 12, 20, R, f); part(SPH, B, 0, 24, 5, 11, 8, 14, RL, f); [[-1, 12], [1, 12], [-1, -12], [1, -12]].forEach(([d, z]) => { part(CUBE, B, d * 12, 0, z, 6, 18, 8, tint(R, .85), f); part(CUBE, B, d * 12, 0, z + 1.5, 7, 3, 11, DARK, f); });
      const nk = mul(B, trs(0, 34, 14, 1, 1, 1, -.7)); dr(TRK, mul(nk, trs(0, 0, 0, 7, 20, 7)), { col: [R[0], R[1], R[2], 1], lit: 1, flash: f }); part(SPH, B, 0, 53, 25, 8.8, 7.6, 11, R, f); part(CUBE, B, 0, 49.5, 33, 7, 5, 9, RL, f); part(CUBE, B, 0, 54, 32, 4, 1.5, 3, [1, .5, .1], f, 0, 0, 1); EYE(B, 4.2, 56, 28.5, 2.3, f); [-1, 1].forEach(d => { part(SPH, B, d * 4.2, 57, 28.5, 1.6, 2.6, 1.2, [1, .85, .1], f, 0, 0, 1); part(CON, B, d * 4.5, 58, 20, 1.8, 11, 1.8, [.95, .9, .75], f, -.9, -d * .4); });
      for (let i = 0; i < 6; i++) part(CON, B, 0, 38 - i * 1.4, 10 - i * 5, 1.6, 7 - i * .5, 1.6, tint(R, .7), f);
      for (let i = 0; i < 5; i++) part(SPH, B, tail(i), 24 - i * 1.4, -22 - i * 9, 7.2 - i * 1.1, 6.4 - i * 1, 7.2 - i * 1.1, R, f); part(CON, B, tail(5), 18, -64, 2.2, 10, 2.2, [.95, .6, .1], f, -1.57);
      [-1, 1].forEach(d => { const wm = mul(B, trs(d * 12, 40, -2, 1, 1, 1, 0, d * (.45 + fl))); dr(CUBE, mul(wm, trs(d * 24, 0, -8, 48, 1.4, 34)), { col: [.5, .08, .1, 1], lit: 1, flash: f }); dr(CUBE, mul(wm, trs(d * 22, 0, -22, 46, 2.4, 3)), { col: [.3, .05, .05, 1], lit: 1, flash: f }); dr(CON, mul(wm, trs(d * 48, 0, 0, 3, 30, 3, 0, d * -1.45)), { col: [.9, .85, .7, 1], lit: 1, flash: f }); });
      glow(B[12], B[13] + 70, B[14] + 40, 90, [1, .35, .1], .35); } };
  function mobDraw(e, S, f) {
    const yaw = S.yaw, B = trs(e.x, 0, e.y, e.dragon ? 1 : MK, e.dragon ? 1 : MK, e.dragon ? 1 : MK, 0, 0, yaw), plan = e.dragon ? 'dragon' : PLAN[e.type] || 'hum';
    if (plan == 'hum') humMob(B, e, S, f); else MOBP[plan](B, e, S, f, pal(e.img || PL[0]));
    blob(e.x, e.y, e.dragon ? 130 : Math.max(30, e.r * 3.4), .55);
  }

  /* ---------------- lighting ---------------- */
  const KF = [[0, [255, 255, 255]], [.45, [255, 252, 240]], [.58, [255, 175, 115]], [.7, [110, 124, 190]], [.86, [104, 118, 184]], [.95, [255, 190, 170]], [1, [255, 255, 255]]];
  const AT = [[255, 255, 255], [235, 255, 235], [255, 242, 215], [225, 240, 255], [255, 255, 255]];
  const FOGC = [[.62, .8, .95], [.5, .66, .58], [.95, .82, .6], [.8, .9, 1], [.16, .09, .08]];
  function ambient() {
    const ai = Math.min(AI, 4); if (ai == 4) return [135, 112, 120];
    const p = (t / 200) % 1; let c = KF[0][1];
    for (let i = 1; i < KF.length; i++) if (p <= KF[i][0]) { const [a, ca] = KF[i - 1], [b, cb] = KF[i], f = (p - a) / (b - a); c = ca.map((v, j) => v + (cb[j] - v) * f); break; }
    return c.map((v, j) => v * AT[ai][j] / 255);
  }
  const WX = [{ c: [1, .98, .75], vx: 6, vy: -4, s: 2.2 }, { c: [.8, .92, .45], vx: 18, vy: -9, s: 3 }, { c: [.95, .85, .65], vx: 90, vy: 2, s: 2.4 }, { c: [1, 1, 1], vx: -8, vy: -34, s: 2.6 }, { c: [1, .55, .2], vx: 4, vy: 26, s: 2.4 }];
  const dragonPlan = e => e.dragon;

  /* ---------------- the frame ---------------- */
  function scene() {
    const dpr = Math.min(innerWidth < 900 ? 1.25 : 1.5, devicePixelRatio || 1), cw = Math.round(glc.clientWidth * dpr), ch = Math.round(glc.clientHeight * dpr);
    if (glc.width != cw || glc.height != ch) { glc.width = ov.width = cw; glc.height = ov.height = ch; }
    if (cw < 2 || ch < 2) return null; gl.viewport(0, 0, cw, ch); const dt = Math.min(.1, Math.max(0, t - lastT)); lastT = t; LST = {}; lastMesh = null;
    if (!SCN || SCN.A !== A || SCN.T !== T) buildScene();
    const tgt = [cl(P.x, -60, A.w + 60), 14, cl(P.y, -40, A.h + 40)]; if (!cam) cam = tgt.slice(); const fl = Math.min(1, dt * 7); cam[0] += (tgt[0] - cam[0]) * fl; cam[2] += (tgt[2] - cam[2]) * fl;
    if (KEYS3.z) yawT -= dt * 2; if (KEYS3.x) yawT += dt * 2; const sm = Math.min(1, dt * 10); yaw += (yawT - yaw) * sm; pitch += (pitchT - pitch) * sm;
    const D = H * 1.163 * zoom, cp = Math.cos(pitch), shk = sh * .5, eye = [cam[0] + D * cp * Math.sin(yaw) + rnd(-shk, shk), cam[1] + D * Math.sin(pitch), cam[2] + D * cp * Math.cos(yaw) + rnd(-shk, shk)];
    VP = mul(persp(.66, cw / ch, 30, 4200), look(eye, [cam[0], cam[1], cam[2]]));
    const amb = ambient(), dk = 1 - (amb[0] + amb[1] + amb[2]) / 765, ai = Math.min(AI, 4), fc = FOGC[ai].map(v => v * (1 - dk * .72)), bright = ai == 4 ? 1.3 : 1.12;
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uAmb, amb[0] / 255 * bright, amb[1] / 255 * bright, amb[2] / 255 * bright); gl.uniform3f(U.uFog, fc[0], fc[1], fc[2]);
    gl.uniform3f(U.uCam, eye[0], eye[1], eye[2]); gl.uniform2f(U.uFogR, D * 1.2, D * 3.6); gl.uniform4f(U.uBounds, 0, 0, A.w, A.h); gl.uniform1f(U.uT, t);
    const L = [{ x: P.x, y: 26, z: P.y, r: 170 + 90 * dk, c: [1, .84, .59].map(v => v * (.1 + .7 * dk)) }];
    for (const e of E) { const k = e.dragon ? [1, .3, .12, 260, 1.1] : e.type == 'lava' ? [1, .45, .15, 130, .8] : e.type == 'imp' ? [1, .5, .25, 110, .7] : e.type == 'ghost' ? [.5, .75, .95, 110, .6] : 0; if (k) L.push({ x: e.x, y: 20, z: e.y, r: k[3], c: k.slice(0, 3).map(v => v * k[4]) }); }
    for (const b of B) L.push({ x: b.x, y: 16, z: b.y + 10, r: 130, c: [.9, .45, .12] }); for (const p of window.PRJ || []) if (p.k == 'bolt') L.push({ x: p.x, y: 16, z: p.y + 10, r: 110, c: [.7, .45, .25] });
    if (portal) L.push({ x: portal.x, y: 24, z: portal.y, r: 170, c: [.45, .55, .9] });
    L.sort((a, b) => Math.hypot(a.x - cam[0], a.z - cam[2]) - Math.hypot(b.x - cam[0], b.z - cam[2])); const lp = new Float32Array(24).map((_, i) => i % 4 == 3 ? 1 : 0), lc = new Float32Array(18);
    L.slice(0, 6).forEach((l, i) => { lp.set([l.x, l.y, l.z, l.r], i * 4); lc.set(l.c, i * 3); }); gl.uniform4fv(U.uLP, lp); gl.uniform3fv(U.uLC, lc);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex(cloudC(), true)); gl.activeTexture(gl.TEXTURE0);
    gl.clearColor(fc[0], fc[1], fc[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.depthMask(true); TQ = [];
    const arena = A.n == 'PvP Arena', X0 = -1700, X1 = A.w + 1700, Z0 = -1400, Z1 = A.h + 1400;
    dr(QUAD, trs((X0 + X1) / 2, 0, Z1, X1 - X0, Z1 - Z0, 1, -1.5708, 0), { tex: tex(groundC(), true), uv: [(X1 - X0) / 256, (Z1 - Z0) / 256], cloud: !arena && AI < 4, at: 0 });
    for (const ck of SCN.chunks) dr(ck, IDM, { lit: 1, at: 0 });
    later('a', QUAD, trs(SAFE / 2, .3, A.h, SAFE, A.h, 1, -1.5708, 0), { col: [.6, .48, .31, .3], at: 0 });
    if (A.gx < A.w) { later('a', QUAD, trs((A.gx + A.w) / 2, .3, A.h, A.w - A.gx, A.h, 1, -1.5708, 0), { col: [0, 0, 0, .3], at: 0 });
      if (!A.open || A.locked) for (let z = 0; z < A.h; z += 22) dr(CUBE, trs(A.gx, 0, z + 8, 8, 44 + (z % 44 ? 0 : 10), 8), { col: [.35, .23, .11, 1], lit: 1 });
      else later('add', CUBE, trs(A.gx, 0, A.h / 2, 3, 90, A.h), { col: [.96, .77, .26, .28], emit: 1, at: 0 }); }
    if (SCN.water) { const pw = PAL[ai].water, pu = .88 + Math.sin(t * 1.3) * .12; later('a', QUAD, trs((X0 + X1) / 2, -1.5, A.h + 520, X1 - X0, 450, 1, -1.5708, 0), { col: [pw[0] * pu, pw[1] * pu, pw[2] * pu, .93], emit: ai == 4 ? 1 : 0, at: 0 }); }
    for (const g of SCN.G) if (Math.hypot(g.x - cam[0], g.z - cam[2]) < 1400 && (!g.night || dk > .12)) glow(g.x, g.y, g.z, g.s * (1 + Math.sin(t * 5 + g.p) * .08), g.col, g.a);

    const dt2 = dt, names = [], bars = [], peers = [], NL = NPCS(), px = P.x, pz = P.y;
    for (const n of NL) { const S = stateOf(n, n.x, n.y, dt2, Math.hypot(px - n.x, pz - n.y) < 130 ? Math.atan2(px - n.x, pz - n.y) : .25); const img = NP[n.k], o = npcLook(n.k, img); human(trs(n.x, 0, n.y, HK, HK, HK, 0, 0, S.yaw), S, o); blob(n.x, n.y, 40, .5); names.push([n.n, n.x, 53 * HK + 12, n.y, '#fff']); }
    for (const e of E) { if (Math.hypot(e.x - cam[0], e.y - cam[2]) > 1200) continue; const S = stateOf(e, e.x, e.y, dt2, Math.atan2(px - e.x, pz - e.y)); mobDraw(e, S, e.fl > 0 ? 1 : 0); bars.push([e, e.dragon ? 122 : (e.boss ? Math.max(e.img.height, 70) : Math.max(e.img.height, 34)) * MK + 12]); }
    const PS = stateOf(P, P.x, P.y, dt2, Math.atan2(P.fx, P.fy)); PS.atk = P.sw > 0 ? 1 - Math.min(1, P.sw / .2) : -1; const blink = P.inv > 0 && ((P.inv * 20) | 0) % 2;
    const al = armorLook(P.ai), wc = WEAP[P.wi]; const pk = HK;
    if (!blink) human(trs(P.x, 0, P.y, pk, pk, pk, 0, 0, PS.yaw), PS, { ...al, wpn: WCLS[wc.cls] || 'sword', wcol: hex(wc.c) }); blob(P.x, P.y, 44, .55);
    if (P.sw > 0) { const c = hex(wc.c), side = (P.fx * Math.cos(yaw) - P.fy * Math.sin(yaw)) < 0 ? -1 : 1; later('add', QUAD, trs(P.x + P.fx * 40, 8, P.y + P.fy * 40, side * 112, 84, 1, 0, 0, yaw), { tex: tex(slashC()), col: [c[0], c[1], c[2], Math.min(1, P.sw / .18)], emit: 1, at: 0 }); }
    if (P.fort > 0) glow(P.x, 52, P.y, 74 + Math.sin(t * 8) * 4, [.4, .75, 1], .55);
    const mp = window.mp; if (mp) for (const [id, p] of mp.peers) { if (performance.now() - p.seen > 4000) { mp.peers.delete(id); continue; } p.px += (p.tx - p.px) * .3; p.py += (p.ty - p.py) * .3;
      const S = stateOf(p, p.px, p.py, dt2, p.moving ? undefined : (p.fx < 0 ? -1.57 : 1.57)), w = WEAP[p.wi] || WEAP[0]; S.atk = p.sw ? (t * 5) % 1 : -1; const pk2 = HK;
      human(trs(p.px, 0, p.py, pk2, pk2, pk2, 0, 0, S.yaw), S, { ...armorLook(p.ai), wpn: WCLS[w.cls] || 'sword', wcol: hex(w.c) }); blob(p.px, p.py, 44, .55); peers.push([p, 53 * HK + 6]);
      if (p.sw) { const c = hex(w.c), d2 = p.fx < 0 ? -1 : 1; later('add', QUAD, trs(p.px + d2 * 40, 8, p.py + 8, (d2 * Math.cos(yaw) < 0 ? -1 : 1) * 112, 84, 1, 0, 0, yaw), { tex: tex(slashC()), col: [c[0], c[1], c[2], .8], emit: 1, at: 0 }); } }
    if (portal) { later('add', QUAD, trs(portal.x, 4, portal.y, 90 + Math.sin(t * 4) * 6, 90, 1, 0, t, yaw), { tex: tex(ringC()), emit: 1, at: 0 }); glow(portal.x, 50, portal.y, 120, [.5, .6, 1], .6); }
    for (const b of B) { glow(b.x, 18, b.y + 10, 44, [1, .5, .15], .95); glow(b.x, 18, b.y + 10, 20, [1, .9, .5], 1); }
    for (const p of window.PRJ || []) { const c = hex(p.col || '#ffe9a8'); for (let i = 0; i < 4; i++) glow(p.x - p.vx * .014 * i, 16, p.y + 10 - p.vy * .014 * i, (p.k == 'bolt' ? 34 : 16) - i * 3, c, 1 - i * .22); }
    for (const q of Q) { const c = hex(q.col.length >= 4 ? q.col.slice(0, q.col.length > 4 ? 7 : 4) : '#ffffff'); glow(q.x, 10, q.y + 12, 7, c, Math.min(1, q.l * 3)); }
    const wx = WX[ai]; for (let i = 0; i < (innerWidth < 900 ? 36 : 64); i++) { const sd = i * 12.9898, a = mod(Math.sin(sd) * 43758.5, 1), b = mod(Math.sin(sd * 1.7) * 31415.9, 1), c = mod(Math.sin(sd * 2.3) * 27182.8, 1);
      const bx = cam[0] - 550, bz = cam[2] - 350, x = bx + mod(a * 1100 + wx.vx * t + Math.sin(t * .7 + i) * 14 - bx, 1100), z = bz + mod(b * 700 - bz, 700), y = mod(c * 260 + wx.vy * t, 260); glow(x, y + 4, z, wx.s * 2.2, wx.c, .7); }
    gl.enable(gl.BLEND); gl.depthMask(false);
    for (const [mode, m, M, a] of TQ) { gl.blendFunc(gl.SRC_ALPHA, mode == 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); dr(m, M, a); }
    gl.depthMask(true); gl.disable(gl.BLEND); return { names, bars, peers, cw, ch, amb, dk };
  }

  /* ---------------- 2D overlay: names, bars, numbers, minimap, messages ---------------- */
  function overlay(S) {
    const cw = S.cw, ch = S.ch, dp = cw / glc.clientWidth, k = dp * Math.max(.85, Math.min(1.35, Math.min(glc.clientWidth, glc.clientHeight) / 380)), touch = document.body.classList.contains('touch'); o.clearRect(0, 0, cw, ch); o.textAlign = 'center';
    const pt = (x, y, z) => { const p = proj(x, y, z); return p ? [p[0] * cw, p[1] * ch] : null; };
    const label = (txt, x, y, col, sz = 12) => { o.font = `bold ${sz * k}px system-ui`; o.fillStyle = '#000'; o.fillText(txt, x + k, y + k); o.fillStyle = col; o.fillText(txt, x, y); };
    for (const [n, x, h, z, col] of S.names) { const p = pt(x, h, z); if (p) label(n, p[0], p[1] - 2 * k, col); }
    for (const [e, h] of S.bars) { const p = pt(e.x, h, e.y); if (!p) continue; if (e.lv === undefined) e.lv = mobLv(e); const w = Math.max(30, e.boss ? 70 : e.r * 2.2) * k; o.fillStyle = '#000a'; o.fillRect(p[0] - w / 2, p[1], w, 4.5 * k); o.fillStyle = e.boss ? '#d3f' : '#e44'; o.fillRect(p[0] - w / 2, p[1], w * Math.max(0, e.hp) / e.mh, 4.5 * k);
      const d = e.lv - P.lv, col = e.boss ? '#ffd36a' : d >= 5 ? '#ff5a5a' : d >= 2 ? '#ffa24a' : d >= -2 ? '#ffffff' : d >= -5 ? '#8fe08f' : '#a8a8a8'; label((e.boss ? '☠ ' : '') + 'Lv.' + e.lv + ' ' + (e.n || e.type), p[0], p[1] - 5 * k, col, e.boss ? 13 : 11); }
    for (const [p, h] of S.peers) { const q = pt(p.px, h + 8, p.py); if (!q) continue; label(p.name + ' Lv' + p.lv, q[0], q[1] - 6 * k, '#9fe8ff', 11);
      if (p.mh) { const w = 36 * k; o.fillStyle = '#000a'; o.fillRect(q[0] - w / 2, q[1], w, 4 * k); o.fillStyle = '#e44'; o.fillRect(q[0] - w / 2, q[1], w * cl(p.hp / p.mh, 0, 1), 4 * k); }
      if (p.say && performance.now() < p.say.until) { const tx = p.say.t.length > 44 ? p.say.t.slice(0, 43) + '…' : p.say.t; o.font = `${11 * k}px system-ui`; const w = o.measureText(tx).width + 10 * k; o.fillStyle = '#fffffff2'; o.fillRect(q[0] - w / 2, q[1] - 34 * k, w, 16 * k); o.fillStyle = '#111'; o.fillText(tx, q[0], q[1] - 22 * k); } }
    for (const d of D) { const p = pt(d.x, 30, d.y + 24); if (!p) continue; o.globalAlpha = Math.min(1, d.l); label(String(d.t), p[0], p[1], d.col, 14); } o.globalAlpha = 1;
    const mw = 104 * dp, mh = Math.max(28 * dp, mw * A.h / A.w), mx = cw - mw - 10 * dp, my = (touch ? 10 : 56) * dp, m = mw / A.w;     // minimap: top-right, below the buttons on PC
    o.fillStyle = '#000b'; o.fillRect(mx - 2 * dp, my - 2 * dp, mw + 4 * dp, mh + 4 * dp); o.fillStyle = A.g[0]; o.fillRect(mx, my, mw, mh); o.fillStyle = '#4f46'; o.fillRect(mx, my, SAFE * m, mh);
    if (A.gx < A.w) { o.fillStyle = '#0006'; o.fillRect(mx + A.gx * m, my, (A.w - A.gx) * m, mh); o.fillStyle = A.open && !A.locked ? '#f5c542' : '#c33'; o.fillRect(mx + A.gx * m, my, 2 * dp, mh); }
    const dot = (q, col, r) => { o.fillStyle = col; o.fillRect(mx + q.x * m - r * dp / 2, my + q.y * m - r * dp / 2, r * dp, r * dp); };
    NPCS().forEach(n => dot(n, '#ff0', 3)); E.forEach(e => dot(e, e.boss ? '#d3f' : '#f55', e.boss ? 5 : 2)); if (portal) dot(portal, '#7df', 5); dot(P, ((t * 4) | 0) % 2 ? '#fff' : '#39f', 4);
    mmBottom((touch ? 10 : 56) + mh / dp + 6);
    if (mt > 0) { const bw = Math.min(380 * k, cw * (touch ? .4 : .5)), by = ch - (touch ? 150 : 90) * k; o.fillStyle = '#000a'; o.fillRect(cw / 2 - bw / 2, by, bw, 26 * k); o.fillStyle = '#fff'; o.font = `bold ${12 * k}px system-ui`; o.fillText(String(msg).slice(0, Math.floor(bw / (6.6 * k))), cw / 2, by + 18 * k); }
    if (P.hp < lastHp - .5) flashR = .55; lastHp = P.hp; if (flashR > 0) { const g = o.createRadialGradient(cw / 2, ch / 2, ch * .3, cw / 2, ch / 2, Math.hypot(cw, ch) * .6); g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${flashR})`); o.fillStyle = g; o.fillRect(0, 0, cw, ch); flashR = Math.max(0, flashR - .03); }
    if (over == 1) { o.fillStyle = '#000a'; o.fillRect(0, 0, cw, ch); o.fillStyle = '#f55'; o.font = `bold ${28 * k}px Georgia,serif`; o.fillText('YOU DIED', cw / 2, ch / 2); o.fillStyle = '#fff'; o.font = `${13 * k}px system-ui`; o.fillText('Tap or press any key to respawn', cw / 2, ch / 2 + 26 * k); }
    if (over == 2) { o.fillStyle = '#000b'; o.fillRect(0, 0, cw, ch); o.fillStyle = '#f2c35b'; o.font = `bold ${28 * k}px Georgia,serif`; o.fillText('VICTORY!', cw / 2, ch / 2); o.fillStyle = '#fff'; o.font = `${13 * k}px system-ui`; o.fillText('Tap or press any key to play again', cw / 2, ch / 2 + 26 * k); }
  }
  const AREA_LV = [1, 7, 14, 21, 28], mobLv = e => AREA_LV[Math.min(AI, 4)] + (e.boss ? 6 : Math.max(0, (A.mobs || []).indexOf(e.type)));
  let lastMM = '';
  const mmBottom = px => { const v = Math.round(px) + 'px'; if (v != lastMM) { lastMM = v; document.documentElement.style.setProperty('--mmb', v); } };

  /* ---------------- switch 2D / 3D + tidy UI ---------------- */
  function apply() { document.body.classList.toggle('r3d', on && ok); }
  window.draw = () => {
    if (!(on && ok)) { draw2d(); mmBottom((60 + Math.max(24, 100 * A.h / A.w) + 8) * (c2.clientHeight / H)); return; }
    try { const S = scene(); if (S) overlay(S); fails = 0; }
    catch (e) { console.error('3D error', e); if (++fails > 3) { on = false; apply(); try { say('3D failed: back to 2D view'); } catch (e2) {} } }
  };
  try { ok = initGL(); if (ok) { buildMeshes(); TRK = mesh(T_TRUNK); CON = mesh(T_CONE); CYL = mesh(T_CYL); PYR = mesh(T_PYR); } } catch (e) { console.error('WebGL init failed', e); ok = false; }
  apply();
  const b = document.createElement('button'); b.id = 'b3d'; b.className = 'round'; b.title = '3D view (V)'; b.textContent = '🧊'; document.querySelector('.topbtns').append(b);
  const toggle = () => { if (!ok) { say('3D is not supported on this device'); return; } on = !on; localStorage.setItem(KEY, on ? '1' : '0'); apply(); say('3D view: ' + (on ? 'ON' : 'OFF')); };
  b.onclick = () => { au(); toggle(); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() == 'v' && !e.ctrlKey && !e.metaKey) toggle(); });
  c2.addEventListener('wheel', e => { if (on && ok) zoom = cl(zoom * (e.deltaY > 0 ? 1.08 : .93), .8, 2.8); }, { passive: true });
  glc.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; apply(); });
  const KEYS3 = {}, tp = new Map(); let drag = null, pinchD = 0;
  const resetCam = () => { yawT = 0; pitchT = 1.02; zoom = 1.6; };
  addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k == 'z' || k == 'x') KEYS3[k] = 1; if (e.key == 'Home') resetCam(); });
  addEventListener('keyup', e => { KEYS3[e.key.toLowerCase()] = 0; });
  wrap.addEventListener('pointerdown', e => { if (!(on && ok)) return; if (e.pointerType == 'mouse' && e.button == 2) { e.stopPropagation(); drag = { x: e.clientX, y: e.clientY }; } else if (e.pointerType == 'touch' && e.target === c2) { tp.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinchD = 0; } }, true);
  addEventListener('pointermove', e => {
    if (drag && (e.buttons & 2)) { yawT -= (e.clientX - drag.x) * .008; pitchT = cl(pitchT + (e.clientY - drag.y) * .004, .6, 1.3); drag = { x: e.clientX, y: e.clientY }; return; }
    const p = tp.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (tp.size == 1) { yawT -= dx * .008; pitchT = cl(pitchT + dy * .004, .6, 1.3); }
    else if (tp.size == 2) { const [a, b2] = [...tp.values()], d = Math.hypot(a.x - b2.x, a.y - b2.y); if (pinchD) zoom = cl(zoom * pinchD / d, .8, 2.8); pinchD = d; } });
  const endp = e => { if (e.pointerType == 'mouse') drag = null; tp.delete(e.pointerId); pinchD = 0; }; addEventListener('pointerup', endp); addEventListener('pointercancel', endp);
  c2.addEventListener('contextmenu', e => { if (on && ok) e.preventDefault(); });
  const upd1 = update;                                                   // WASD / joystick / click-walk stay relative to the camera
  window.update = dt => {
    if (!(on && ok) || Math.abs(yaw) < .002 || over || ui) return upd1(dt);
    let mx = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0), my = (K.s || K.arrowdown ? 1 : 0) - (K.w || K.arrowup ? 1 : 0);
    if (ptr) { const dx = ptr.x - W / 2, dy = ptr.y - H / 2; if (Math.hypot(dx, dy) > 12) { mx = dx; my = dy; } }
    if (JS.on) { mx = JS.x; my = JS.y; }
    const m = Math.hypot(mx, my); if (!m) return upd1(dt);
    const c = Math.cos(yaw), s2 = Math.sin(yaw), sv = [JS.on, JS.x, JS.y];
    JS.on = 1; JS.x = (mx * c + my * s2) / m; JS.y = (-mx * s2 + my * c) / m;   // the game reads the analog stick last, so this wins
    try { upd1(dt); } finally { JS.on = sv[0]; JS.x = sv[1]; JS.y = sv[2]; }
  };
  { const top = document.querySelector('.topbtns');                    // fewer buttons on screen: rarely used ones go into a ☰ menu
    if (top && !$('bmenu')) { const keep = new Set(['binv', 'bst', 'bq', 'bch']), pop = document.createElement('div'), mb2 = document.createElement('button'); pop.id = 'menuPop';
      const cb = document.createElement('button'); cb.id = 'bcam'; cb.className = 'round'; cb.title = 'Reset camera (Home)'; cb.textContent = '🎥'; cb.onclick = () => { au(); resetCam(); };
      [...top.children].forEach(x => { if (!keep.has(x.id)) pop.append(x); }); pop.append(cb); mb2.id = 'bmenu'; mb2.className = 'round'; mb2.title = 'More'; mb2.textContent = '☰'; top.append(mb2, pop);
      mb2.onclick = () => { au(); pop.classList.toggle('open'); }; pop.addEventListener('click', e => { if (e.target.closest('button')) setTimeout(() => pop.classList.remove('open'), 60); });
      document.addEventListener('pointerdown', e => { if (!pop.contains(e.target) && e.target !== mb2) pop.classList.remove('open'); }); } }
})();

/* ================= Auto farm (works in 2D and 3D) =================
   Hunts the nearest monsters, uses skills and potions, optionally spends stat points. Manual movement stops it. Press T to start/stop. */
(() => {
  const KEY = 'emberfall.af', DEF = { skills: 1, potion: 50, boss: 0, gap: 5, stat: '' };
  let cfg = { ...DEF }; try { cfg = { ...DEF, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) {}
  let on = false, potCd = 0, skCd = 0, idle = 0, warned = 0, retreat = false;
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} };
  const AREA_LV = [1, 7, 14, 21, 28], lvOf = e => AREA_LV[Math.min(AI, 4)] + (e.boss ? 6 : Math.max(0, (A.mobs || []).indexOf(e.type)));
  const css = document.createElement('style');
  css.textContent = '#afpill{position:absolute;top:calc(8px + var(--sat));left:50%;transform:translateX(-50%);z-index:7;padding:6px 14px;background:#143014ee;border:1px solid #6c6;color:#cfc;border-radius:16px;font:700 11px system-ui;display:none;cursor:pointer;white-space:nowrap}#afpill.on{display:block}body:not(.touch) #afpill{top:calc(62px + var(--sat))}';
  document.head.append(css);
  const pill = document.createElement('div'); pill.id = 'afpill'; pill.textContent = '🤖 AUTO FARM ON · tap to stop'; $('wrap').append(pill);
  const show = () => pill.classList.toggle('on', on);
  function stop(msg) { if (!on) return; on = false; show(); say(msg ? 'Auto farm stopped: ' + msg : 'Auto farm stopped'); }
  function start() {
    if (over) return; if (window.pvpArena) { say('Auto farm is disabled in the PvP arena'); return; }
    on = true; idle = 0; warned = 0; retreat = false; show(); closeP(); say('Auto farm ON. Move manually or press T to stop');
  }
  pill.onclick = () => stop();
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k == 't' && !e.ctrlKey && !e.metaKey) { on ? stop() : start(); return; }
    if (on && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) stop('manual control');
  });
  $('joy').addEventListener('pointerdown', () => stop('manual control'));
  $('c').addEventListener('pointerdown', e => { if (e.pointerType == 'mouse' && e.button == 0) stop('manual control'); });

  /* ---- settings panel ---- */
  const NAMES = { '': 'Off', str: 'STR', dex: 'DEX', vit: 'HP', sp: 'SP', luk: 'LUK' }, nextOf = (arr, v) => arr[(arr.indexOf(v) + 1) % arr.length];
  function afPanel() {
    $('pb').innerHTML = '';
    line('Auto Farm hunts nearby monsters for you. Moving manually stops it. Press T to start or stop.', 'txt');
    row('Auto farm: ' + (on ? 'ON' : 'OFF'), on ? 'Stop' : 'Start', () => { if (on) { stop(); afPanel(); } else start(); });
    const R = (t, b, f) => row(t, b, () => { f(); store(); afPanel(); });
    R('Use skills: ' + (cfg.skills ? 'ON' : 'OFF'), 'Toggle', () => { cfg.skills ^= 1; });
    R('Drink Red Potion below ' + cfg.potion + '% HP (have ' + (P.bag['Red Potion'] || 0) + ')', 'Change', () => { cfg.potion = nextOf([30, 50, 70], cfg.potion); });
    R('Fight bosses: ' + (cfg.boss ? 'ON' : 'OFF'), 'Toggle', () => { cfg.boss ^= 1; });
    R('Skip monsters ' + (cfg.gap >= 99 ? 'never (fight everything)' : 'more than ' + cfg.gap + ' levels above you'), 'Change', () => { cfg.gap = nextOf([3, 5, 8, 99], cfg.gap); });
    R('Auto-spend stat points on: ' + NAMES[cfg.stat], 'Change', () => { cfg.stat = nextOf(['', 'str', 'dex', 'vit', 'sp', 'luk'], cfg.stat); });
    line('Stops automatically when you are low on HP with no potions, in the PvP arena, or when no suitable monsters are left.', 'txt');
  }
  const ab = document.createElement('button'); ab.id = 'bauto'; ab.className = 'round'; ab.title = 'Auto farm (T)'; ab.textContent = '🤖';
  (document.getElementById('menuPop') || document.querySelector('.topbtns')).append(ab); ab.onclick = () => { au(); toggleP('Auto Farm', afPanel); };

  /* ---- the bot ---- */
  function step(dt) {
    if (over || ui) return; if (window.pvpArena) { stop('not available in the PvP arena'); return; }
    potCd -= dt; skCd -= dt; const hpP = P.hp / P.mhp * 100, spP = P.sp / P.msp;
    if (potCd <= 0) { if (hpP < cfg.potion && (P.bag['Red Potion'] || 0) > 0) { drink(); potCd = .7; } else if (spP < .2 && (P.bag['Blue Potion'] || 0) > 0) { drinkSp(); potCd = .7; } }
    if (cfg.stat && P.pts > 0 && P.st) for (let i = 0; i < 20 && P.pts > 0; i++) { P.pts--; P.st[cfg.stat]++; if (cfg.stat == 'vit') { P.mhp += 15; P.hp += 15; } if (cfg.stat == 'sp') { P.msp += 5; P.sp += 5; } }
    const move0 = (dx, dy, sp) => { const d = Math.hypot(dx, dy) || 1, s = Math.min(sp * dt, d); P.x = cl(P.x + dx / d * s, 10, A.w - 10); P.y = cl(P.y + dy / d * s, 10, A.h - 10); P.fx = dx / d; P.fy = dy / d; P.mv = 1; };
    if (hpP < 40 && !(P.bag['Red Potion'] > 0)) retreat = true;         // out of potions and hurt: run back to the safe village, then stop
    if (retreat) { move0(110 - P.x, A.h / 2 - P.y, 135); if (P.x < SAFE - 30) { retreat = false; stop('low HP and no potions. Retreated to the village'); } return; }
    const c = P.cls || 'sword', ranged = c == 'archer' || c == 'mage', alive = E.filter(e => e.hp > 0);
    const ok = alive.filter(e => (cfg.boss || !e.boss) && (cfg.gap >= 99 || lvOf(e) - P.lv <= cfg.gap)), bossOnly = !cfg.boss && alive.length && alive.every(e => e.boss);
    let tg = null, best = 1e9; for (const e of ok) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < best) { best = d; tg = e; } }
    const move = (dx, dy, sp) => { const d = Math.hypot(dx, dy) || 1, s = Math.min(sp * dt, d); P.x = cl(P.x + dx / d * s, 10, A.w - 10); P.y = cl(P.y + dy / d * s, 10, A.h - 10); P.fx = dx / d; P.fy = dy / d; P.mv = 1; };
    if (!tg) {                                                          // nothing to hit: head to the field and wait
      idle += dt; if (P.x < SAFE + 60) move(SAFE + 160 - P.x, A.h / 2 - P.y, 130);
      if (idle > 8 && !warned) { warned = 1; say(bossOnly ? 'Only the boss is left. Enable "Fight bosses" or stop.' : alive.length ? 'No suitable monsters (too strong). Waiting…' : 'Waiting for monsters…'); }
      if (idle > 25) stop(alive.length ? 'only monsters you chose to skip are left' : 'no monsters found'); return;
    }
    idle = 0; warned = 0; const dx = tg.x - P.x, dy = tg.y - P.y, d = Math.hypot(dx, dy), want = ranged ? 190 : 40 + (tg.r || 12) * .6, reach = ranged ? 290 : 60 + (tg.r || 12) * .5;
    P.fx = dx / (d || 1); P.fy = dy / (d || 1);
    if (d > want) move(dx, dy, 130); else if (ranged && d < 90) move(-dx, -dy, 100);
    if (!cfg.boss && A.gx < A.w && !A.locked && P.x > A.gx - 30) P.x = A.gx - 30;                  // stay out of the boss arena
    if (d <= reach) {
      if (cfg.skills && P.job != 'Novice' && P.cd <= 0 && skCd <= 0) {
        const near = alive.filter(e => Math.hypot(e.x - P.x, e.y - P.y) < 120).length;
        if (c == 'tank') { if (hpP < 65 && P.fort <= 0 && near >= 1 && P.sp >= 34) { skill(2); skCd = 1.4; } else if (near >= 1 && d < 70 && spP > .3 && P.sp >= 18) { skill(1); skCd = 1.4; } }
        else if (near >= 3 && P.sp >= 34 && spP > .35) { skill(2); skCd = 1.4; } else if (P.sp >= 18 && spP > .5 && (tg.boss || tg.hp > 60)) { skill(1); skCd = 1.4; }
      }
      if (P.cd <= 0) attack();
    }
  }
  const u0 = update; window.update = dt => { u0(dt); if (on) { try { step(dt); } catch (e) { console.error(e); on = false; show(); } } };
})();
