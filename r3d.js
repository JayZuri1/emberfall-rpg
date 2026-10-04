/* Emberfall 3D: Ragnarok-Online style world. Plain WebGL, no libraries.
   Game logic stays 2D (x,y); the world is drawn as a 3D scene: perspective camera, lit ground, fog, 3D houses/fences/trees,
   upright billboard sprites, dynamic lights. Button 🧊 or key V toggles back to the classic 2D view. Mouse wheel zooms. */
(() => {
  const KEY = 'emberfall.3d', draw2d = draw;
  let on = localStorage.getItem(KEY) !== '0', gl = null, ok = false, fails = 0, zoom = 1, cam = null, flashR = 0, lastHp = 0, lastT = 0, VP = null, U = {};
  const wrap = $('wrap'), c2 = $('c'), glc = document.createElement('canvas'), ov = document.createElement('canvas'), o = ov.getContext('2d'), vg = document.createElement('div');
  glc.id = 'gl'; ov.id = 'ov'; vg.id = 'vg3d'; wrap.insertBefore(glc, c2); c2.after(vg); vg.after(ov);
  const st = document.createElement('style');
  st.textContent = '#gl,#ov,#vg3d{position:absolute;inset:0;width:100%;height:100%;display:none}#ov,#vg3d{pointer-events:none}#vg3d{background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,12,.5) 100%)}body.r3d #gl,body.r3d #ov,body.r3d #vg3d{display:block}body.r3d #c{opacity:0}';
  document.head.append(st);

  /* ---------------- math ---------------- */
  const mul = (a, b) => { const r = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
  const persp = (f, a, n, fa) => { const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]); };
  function look(e, c) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xz); xx /= l; xz /= l;                       // up = (0,1,0)
    const yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  }
  const trs = (tx, ty, tz, sx, sy, sz, rx = 0, rz = 0) => {           // T * Rz * Rx * S
    const cx = Math.cos(rx), sxn = Math.sin(rx), cz = Math.cos(rz), szn = Math.sin(rz);
    const Rx = new Float32Array([1, 0, 0, 0, 0, cx, sxn, 0, 0, -sxn, cx, 0, 0, 0, 0, 1]), Rz = new Float32Array([cz, szn, 0, 0, -szn, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const R = mul(Rz, Rx); R[0] *= sx; R[1] *= sx; R[2] *= sx; R[4] *= sy; R[5] *= sy; R[6] *= sy; R[8] *= sz; R[9] *= sz; R[10] *= sz; R[12] = tx; R[13] = ty; R[14] = tz; return R;
  };
  const proj = (px, py, pz) => { const m = VP, w = m[3] * px + m[7] * py + m[11] * pz + m[15]; if (w <= 0) return null; return [(m[0] * px + m[4] * py + m[8] * pz + m[12]) / w * .5 + .5, .5 - (m[1] * px + m[5] * py + m[9] * pz + m[13]) / w * .5, w]; };
  const mod = (a, m) => ((a % m) + m) % m;

  /* ---------------- GL setup ---------------- */
  const VS = `attribute vec3 aP;attribute vec3 aN;attribute vec2 aT;uniform mat4 uM,uVP;uniform float uSway;varying vec3 vW,vN;varying vec2 vT;
  void main(){vec3 p=aP;p.x+=uSway*aP.y;vec4 w=uM*vec4(p,1.);vW=w.xyz;vN=mat3(uM)*aN;vT=aT;gl_Position=uVP*w;}`;
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  varying vec3 vW,vN;varying vec2 vT;uniform sampler2D uTex,uCloud;uniform vec4 uCol,uBounds,uLP[6];uniform vec3 uAmb,uFog,uCam,uLC[6];uniform vec2 uFogR,uUV;
  uniform float uUseTex,uLit,uEmit,uFlash,uAT,uCloudOn,uT;
  void main(){
    vec4 c=uCol;if(uUseTex>.5)c*=texture2D(uTex,vT*uUV);if(c.a<uAT)discard;
    vec3 l=vec3(1.);
    if(uEmit<.5){l=uAmb;if(uLit>.5){float d=max(dot(normalize(vN),normalize(vec3(-.4,.8,.45))),0.);l+=vec3(1.,.95,.85)*d*.5;}
      for(int i=0;i<6;i++){float d=length(uLP[i].xyz-vW);float f=clamp(1.-d/uLP[i].w,0.,1.);l+=uLC[i]*f*f;}}
    vec3 col=c.rgb*l;
    if(uCloudOn>.5){float k=texture2D(uCloud,vW.xz/1100.+vec2(uT*.012,uT*.004)).r;col*=.8+.2*k;}
    col=mix(col,vec3(1.),uFlash*.7);
    float ox=max(max(uBounds.x-vW.x,vW.x-uBounds.z),0.),oz=max(max(uBounds.y-vW.z,vW.z-uBounds.w),0.);col*=1.-.85*clamp(length(vec2(ox,oz))/240.,0.,1.);
    float fg=clamp((length(vW-uCam)-uFogR.x)/(uFogR.y-uFogR.x),0.,1.);col=mix(col,uFog,fg*.92);
    gl_FragColor=vec4(col,c.a);}`;
  function initGL() {
    gl = glc.getContext('webgl', { antialias: true, alpha: false }) || glc.getContext('experimental-webgl'); if (!gl) return false;
    const sh = (t, s) => { const h = gl.createShader(t); gl.shaderSource(h, s); gl.compileShader(h); if (!gl.getShaderParameter(h, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(h)); return h; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); ['aP', 'aN', 'aT'].forEach((n, i) => gl.bindAttribLocation(pr, i, n)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr)); gl.useProgram(pr);
    ['uM', 'uVP', 'uSway', 'uTex', 'uCloud', 'uCol', 'uBounds', 'uAmb', 'uFog', 'uCam', 'uFogR', 'uUV', 'uUseTex', 'uLit', 'uEmit', 'uFlash', 'uAT', 'uCloudOn', 'uT'].forEach(n => U[n] = gl.getUniformLocation(pr, n));
    U.uLP = gl.getUniformLocation(pr, 'uLP[0]'); U.uLC = gl.getUniformLocation(pr, 'uLC[0]');
    [0, 1, 2].forEach(i => gl.enableVertexAttribArray(i));
    gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uCloud, 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); return true;
  }
  const mesh = (v, idx) => { const vb = gl.createBuffer(), ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW); return { vb, ib, n: idx.length }; };
  let QUAD, CUBE, SPH, PYR;
  function buildMeshes() {
    QUAD = mesh([-.5, 0, 0, 0, 0, 1, 0, 1, .5, 0, 0, 0, 0, 1, 1, 1, .5, 1, 0, 0, 0, 1, 1, 0, -.5, 1, 0, 0, 0, 1, 0, 0], [0, 1, 2, 0, 2, 3]);
    const cv = [], ci = [];                                             // unit cube, base at y=0, footprint +-.5
    [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]].forEach(n => {
      const u = n[1] ? [1, 0, 0] : [0, 1, 0], w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], b = cv.length / 8;
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, c]) => cv.push(n[0] * .5 + u[0] * a * .5 + w[0] * c * .5, n[1] * .5 + .5 + u[1] * a * .5 + w[1] * c * .5, n[2] * .5 + u[2] * a * .5 + w[2] * c * .5, n[0], n[1], n[2], (a + 1) / 2, (c + 1) / 2));
      ci.push(b, b + 1, b + 2, b, b + 2, b + 3); }); CUBE = mesh(cv, ci);
    const sv = [], si = [], A = 10, B = 8;                              // unit sphere (radius 1)
    for (let i = 0; i <= B; i++) for (let j = 0; j <= A; j++) { const th = i / B * Math.PI, ph = j / A * 6.2832, nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph); sv.push(nx, ny, nz, nx, ny, nz, j / A, i / B); }
    for (let i = 0; i < B; i++) for (let j = 0; j < A; j++) { const a = i * (A + 1) + j, b = a + A + 1; si.push(a, b, a + 1, b, b + 1, a + 1); } SPH = mesh(sv, si);
    const pv = [], pi = [];                                             // pyramid (roof): base y=0 +-.5, apex y=1
    [[-.5, -.5, .5, -.5], [.5, -.5, .5, .5], [.5, .5, -.5, .5], [-.5, .5, -.5, -.5]].forEach(([x1, z1, x2, z2], i) => { const dx = x2 - x1, dz = z2 - z1, nx = dz, nz = -dx, l = Math.hypot(nx, 1, nz), b = i * 3;
      pv.push(x1, 0, z1, nx / l, .5 / l, nz / l, 0, 1, x2, 0, z2, nx / l, .5 / l, nz / l, 1, 1, 0, 1, 0, nx / l, .5 / l, nz / l, .5, 0); pi.push(b, b + 1, b + 2); }); PYR = mesh(pv, pi);
  }
  const TX = new WeakMap(), TCV = new Map();
  function tex(img, rep) {
    let t = TX.get(img); if (t) return t; t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const w = rep ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
    if (rep) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const ex = gl.getExtension('EXT_texture_filter_anisotropic'); if (ex) gl.texParameterf(gl.TEXTURE_2D, ex.TEXTURE_MAX_ANISOTROPY_EXT, 8); }
    else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); }
    TX.set(img, t); return t;
  }
  const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  const cached = (k, f) => { if (!TCV.has(k)) TCV.set(k, f()); return TCV.get(k); };

  /* ---------------- generated textures ---------------- */
  const glowC = () => cached('glow', () => { const [c, g] = mkc(64, 64), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; });
  const slashC = () => cached('slash', () => { const [c, g] = mkc(128, 128); g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.strokeStyle = `rgba(255,255,255,${.9 - i * .22})`; g.lineWidth = 16 - i * 4; g.beginPath(); g.arc(20, 64, 90 - i * 3, -1.1, 1.1); g.stroke(); } return c; });
  const ringC = () => cached('ring', () => { const [c, g] = mkc(128, 128); g.lineWidth = 5; g.lineCap = 'round'; ['#7df', '#a6f', '#fff'].forEach((col, i) => { g.strokeStyle = col; g.beginPath(); g.arc(64, 64, 22 + i * 14, i, i + 4.5); g.stroke(); }); return c; });
  const cloudC = () => cached('cloud', () => { const [c, g] = mkc(256, 256); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 9; i++) { const bx = rnd(0, 256), by = rnd(0, 256), r = rnd(50, 100); for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { const gr = g.createRadialGradient(bx + dx, by + dy, 0, bx + dx, by + dy, r); gr.addColorStop(0, 'rgba(110,120,140,.9)'); gr.addColorStop(1, 'rgba(110,120,140,0)'); g.fillStyle = gr; g.fillRect(bx + dx - r, by + dy - r, r * 2, r * 2); } } return c; });
  function groundC() {
    return cached('g' + (A.n == 'PvP Arena' ? 'a' : AI), () => {
      const S = 256, [c, g] = mkc(S, S), arena = A.n == 'PvP Arena', base = arena ? ['#50555f', '#5d636e', '#444952'] : A.g, wrapD = f => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
      g.fillStyle = base[0]; g.fillRect(0, 0, S, S);
      for (let i = 0; i < 26; i++) { const bx = rnd(0, S), by = rnd(0, S), r = rnd(30, 75), col = base[1 + (i & 1)]; wrapD((dx, dy) => { const gr = g.createRadialGradient(bx + dx, by + dy, 0, bx + dx, by + dy, r); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(bx + dx - r, by + dy - r, r * 2, r * 2); }); }
      const dot = (col, n, w, h) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(rnd(0, S) | 0, rnd(0, S) | 0, w, h); };
      if (arena) { g.strokeStyle = '#2c3039'; g.lineWidth = 2; for (let i = 0; i <= S; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); } dot('#6a707c', 40, 3, 2); }
      else if (AI < 2) { for (let i = 0; i < 520; i++) { const bx = rnd(0, S), by = rnd(0, S); g.strokeStyle = Math.random() < .5 ? 'rgba(255,255,170,.25)' : 'rgba(0,30,0,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + rnd(-2, 2), by - rnd(3, 7)); g.stroke(); } dot('#f6e05e', 5, 3, 3); dot('#fff', 5, 3, 3); dot('#f48fb1', 4, 3, 3); }
      else if (AI == 2) { for (let i = 0; i < 40; i++) { g.strokeStyle = i & 1 ? 'rgba(255,240,200,.3)' : 'rgba(120,80,30,.24)'; g.beginPath(); g.arc(rnd(0, S), rnd(0, S), rnd(14, 40), 3.4, 5.9); g.stroke(); } dot('rgba(110,80,50,.5)', 22, 3, 2); }
      else if (AI == 3) { dot('rgba(255,255,255,.7)', 70, 2, 2); g.strokeStyle = 'rgba(120,170,210,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); let px = rnd(0, S), py = rnd(0, S); g.moveTo(px, py); for (let j = 0; j < 4; j++) g.lineTo(px += rnd(-22, 22), py += rnd(-22, 22)); g.stroke(); } }
      else { g.strokeStyle = 'rgba(0,0,0,.45)'; for (let i = 0; i < 14; i++) { g.beginPath(); let px = rnd(0, S), py = rnd(0, S); g.moveTo(px, py); for (let j = 0; j < 4; j++) g.lineTo(px += rnd(-18, 18), py += rnd(-18, 18)); g.stroke(); } dot('rgba(255,120,40,.7)', 20, 2, 2); }
      return c; });
  }
  const canopyC = i => cached('c' + AI + '_' + i, () => {
    const S = 96, [c, g] = mkc(S, S), b = [];
    for (let k = 0; k < 16; k++) { const a = rnd(0, 6.28), d = rnd(0, 26); b.push([48 + Math.cos(a) * d, 54 + Math.sin(a) * d * .8, rnd(14, 22)]); } b.sort((p, q) => q[1] - p[1]);
    for (const [bx, by, r] of b) { const gr = g.createRadialGradient(bx - r * .35, by - r * .4, r * .1, bx, by, r); gr.addColorStop(0, A.tc[2]); gr.addColorStop(.55, A.tc[1]); gr.addColorStop(1, A.tc[0]); g.fillStyle = gr; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill(); }
    for (let k = 0; k < 70; k++) { const a = rnd(0, 6.28), d = rnd(0, 34); g.fillStyle = Math.random() < .5 ? 'rgba(255,255,200,.14)' : 'rgba(0,20,0,.18)'; g.fillRect(48 + Math.cos(a) * d, 54 + Math.sin(a) * d * .85, 2, 2); }
    g.globalCompositeOperation = 'source-atop'; let s = g.createLinearGradient(0, 10, 0, 96); s.addColorStop(0, 'rgba(255,255,210,.18)'); s.addColorStop(1, 'rgba(0,0,20,.35)'); g.fillStyle = s; g.fillRect(0, 0, S, S);
    if (AI == 3) { s = g.createLinearGradient(0, 10, 0, 60); s.addColorStop(0, 'rgba(255,255,255,.75)'); s.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = s; g.fillRect(0, 0, S, S); } return c; });
  const dragonCv = mkc(200, 140);
  function paintDragon() {                                              // same art as the 2D dragon, painted into its own texture each frame
    const g = dragonCv[1], px = 100, py = 120; g.clearRect(0, 0, 200, 140); const w = Math.sin(t * 6) * 10;
    g.fillStyle = '#8f1d1d'; [-1, 1].forEach(d => { g.beginPath(); g.moveTo(px + d * 10, py - 30); g.lineTo(px + d * 56, py - 62 + w); g.lineTo(px + d * 34, py - 34); g.lineTo(px + d * 50, py - 14); g.lineTo(px + d * 12, py - 14); g.fill(); });
    g.fillStyle = '#d33'; g.beginPath(); g.arc(px, py - 24, 30, 0, 7); g.fill(); g.fillStyle = '#f48a5a'; g.beginPath(); g.ellipse(px, py - 14, 18, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#fd5'; [-1, 1].forEach(d => { g.beginPath(); g.moveTo(px + d * 14, py - 46); g.lineTo(px + d * 22, py - 64); g.lineTo(px + d * 6, py - 50); g.fill(); g.fillRect(px + d * 11 - 3, py - 32, 6, 6); });
    gl.bindTexture(gl.TEXTURE_2D, tex(dragonCv[0])); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, dragonCv[0]);
  }

  /* ---------------- drawing helpers ---------------- */
  let TQ = [];                                                          // transparent draw queue
  function dr(m, M, a = {}) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
    gl.uniformMatrix4fv(U.uM, false, M); const c = a.col || [1, 1, 1, 1]; gl.uniform4f(U.uCol, c[0], c[1], c[2], c[3] ?? 1);
    gl.uniform1f(U.uUseTex, a.tex ? 1 : 0); if (a.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex); }
    gl.uniform1f(U.uLit, a.lit ? 1 : 0); gl.uniform1f(U.uEmit, a.emit ? 1 : 0); gl.uniform1f(U.uFlash, a.flash || 0); gl.uniform1f(U.uAT, a.at ?? .5);
    gl.uniform1f(U.uSway, a.sway || 0); gl.uniform1f(U.uCloudOn, a.cloud ? 1 : 0); gl.uniform2f(U.uUV, a.uv ? a.uv[0] : 1, a.uv ? a.uv[1] : 1);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  }
  const later = (mode, m, M, a) => TQ.push([mode, m, M, a]);
  const rgb = (h, a = 1) => { if (h.length == 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]; return rgb6(h, a); };
  const rgb6 = (h, a = 1) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, a];
  function blob(x, z, w, a = .55) { later('a', QUAD, trs(x, .4, z + w * .25, w, w * .5, 1, -1.5708, 0), { tex: tex(glowC()), col: [0, 0, 0, a], emit: 1, at: 0 }); }
  function bill(img, x, z, o = {}) {                                    // upright sprite
    const w = img.width, h = img.height, k = o.k || 1, sx = (o.sx || 1) * k, sy = (o.sy || 1) * k;
    const M = trs(x + (o.dx || 0), o.y || 0, z, (o.flip ? -w : w) * sx, h * sy, 1, 0, o.rot || 0), a = { tex: tex(img), flash: o.flash, col: [1, 1, 1, o.alpha ?? 1], sway: o.sway };
    if (o.noShadow !== true) blob(x, z, w * 1.15 * k, .5);
    if ((o.alpha ?? 1) < 1) later('a', QUAD, M, { ...a, at: 0 }); else dr(QUAD, M, a);
  }
  const glow = (x, y, z, s, col, a = 1) => later('add', QUAD, trs(x, y - s / 2, z, s, s, 1), { tex: tex(glowC()), col: [col[0], col[1], col[2], a], emit: 1, at: 0 });

  /* ---------------- lighting ---------------- */
  const KF = [[0, [255, 255, 255]], [.45, [255, 252, 240]], [.58, [255, 175, 115]], [.7, [110, 124, 190]], [.86, [104, 118, 184]], [.95, [255, 190, 170]], [1, [255, 255, 255]]];
  const AT = [[255, 255, 255], [235, 255, 235], [255, 242, 215], [225, 240, 255], [255, 255, 255]];
  const FOGC = [[.62, .8, .95], [.55, .72, .6], [.95, .82, .6], [.8, .9, 1], [.14, .08, .08]];
  function ambient() {
    const ai = Math.min(AI, 4); if (ai == 4) return [135, 112, 120];
    const p = (t / 200) % 1; let c = KF[0][1];
    for (let i = 1; i < KF.length; i++) if (p <= KF[i][0]) { const [a, ca] = KF[i - 1], [b, cb] = KF[i], f = (p - a) / (b - a); c = ca.map((v, j) => v + (cb[j] - v) * f); break; }
    return c.map((v, j) => v * AT[ai][j] / 255);
  }
  const WX = [{ c: [1, .98, .75], vx: 6, vy: -4, s: 2.2 }, { c: [.8, .92, .45], vx: 18, vy: -9, s: 3 }, { c: [.95, .85, .65], vx: 90, vy: 2, s: 2.4 }, { c: [1, 1, 1], vx: -8, vy: -34, s: 2.6 }, { c: [1, .55, .2], vx: 4, vy: 26, s: 2.4 }];

  /* ---------------- the scene ---------------- */
  function scene() {
    const dpr = Math.min(innerWidth < 900 ? 1.25 : 1.5, devicePixelRatio || 1), cw = Math.round(glc.clientWidth * dpr), ch = Math.round(glc.clientHeight * dpr);
    if (glc.width != cw || glc.height != ch) { glc.width = ov.width = cw; glc.height = ov.height = ch; }
    if (cw < 2 || ch < 2) return null; gl.viewport(0, 0, cw, ch); const dt = Math.min(.1, Math.max(0, t - lastT)); lastT = t;
    // camera: tilted perspective behind/above the hero
    const tgt = [cl(P.x, -60, A.w + 60), 14, cl(P.y, -40, A.h + 40)]; if (!cam) cam = tgt.slice(); const f = Math.min(1, dt * 7); cam[0] += (tgt[0] - cam[0]) * f; cam[2] += (tgt[2] - cam[2]) * f;
    const D = H * 1.163 * zoom, pitch = .87, shk = sh * .5, eye = [cam[0] + rnd(-shk, shk), cam[1] + D * Math.sin(pitch), cam[2] + D * Math.cos(pitch) + rnd(-shk, shk)];
    VP = mul(persp(.66, cw / ch, 30, 3200), look(eye, [cam[0], cam[1], cam[2]]));
    const amb = ambient(), dk = 1 - (amb[0] + amb[1] + amb[2]) / 765, fc = FOGC[Math.min(AI, 4)], bright = AI == 4 ? 1.25 : 1.08;
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uAmb, amb[0] / 255 * bright, amb[1] / 255 * bright, amb[2] / 255 * bright); gl.uniform3f(U.uFog, fc[0] * (1 - dk * .75), fc[1] * (1 - dk * .75), fc[2] * (1 - dk * .7));
    gl.uniform3f(U.uCam, eye[0], eye[1], eye[2]); gl.uniform2f(U.uFogR, D * 1.1, D * 3.1); gl.uniform4f(U.uBounds, 0, 0, A.w, A.h); gl.uniform1f(U.uT, t);
    // lights (nearest 6)
    const L = [{ x: P.x, y: 26, z: P.y, r: 170 + 90 * dk, c: [1, .84, .59].map(v => v * (.1 + .7 * dk)) }];
    for (const e of E) { const k = e.dragon ? [1, .3, .12, 230, 1.1] : e.type == 'lava' ? [1, .45, .15, 120, .8] : e.type == 'imp' ? [1, .5, .25, 110, .7] : e.type == 'ghost' ? [.5, .75, .95, 110, .6] : 0; if (k) L.push({ x: e.x, y: 20, z: e.y, r: k[3], c: k.slice(0, 3).map(v => v * k[4]) }); }
    for (const b of B) L.push({ x: b.x, y: 16, z: b.y + 10, r: 130, c: [.9, .45, .12] });
    for (const p of window.PRJ || []) if (p.k == 'bolt') L.push({ x: p.x, y: 16, z: p.y + 10, r: 110, c: [.7, .45, .25] });
    if (portal) L.push({ x: portal.x, y: 24, z: portal.y, r: 170, c: [.45, .55, .9] });
    L.sort((a, b) => Math.hypot(a.x - cam[0], a.z - cam[2]) - Math.hypot(b.x - cam[0], b.z - cam[2])); const lp = new Float32Array(24).map((_, i) => i % 4 == 3 ? 1 : 0), lc = new Float32Array(18);
    L.slice(0, 6).forEach((l, i) => { lp.set([l.x, l.y, l.z, l.r], i * 4); lc.set(l.c, i * 3); }); gl.uniform4fv(U.uLP, lp); gl.uniform3fv(U.uLC, lc);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex(cloudC(), true)); gl.activeTexture(gl.TEXTURE0);
    gl.clearColor(fc[0] * (1 - dk * .75), fc[1] * (1 - dk * .75), fc[2] * (1 - dk * .7), 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.BLEND); gl.depthMask(true); TQ = [];

    const arena = A.n == 'PvP Arena', W0 = -900, W1 = A.w + 900, Z0 = -700, Z1 = A.h + 700;
    dr(QUAD, trs((W0 + W1) / 2, 0, Z1, W1 - W0, Z1 - Z0, 1, -1.5708, 0), { tex: tex(groundC(), true), uv: [(W1 - W0) / 256, (Z1 - Z0) / 256], cloud: !arena && AI < 4, at: 0 });
    // village ground tint, boss arena shade, gate
    later('a', QUAD, trs(SAFE / 2, .3, A.h, SAFE, A.h, 1, -1.5708, 0), { col: [.6, .48, .31, .38], at: 0 });
    if (A.gx < A.w) { later('a', QUAD, trs((A.gx + A.w) / 2, .3, A.h, A.w - A.gx, A.h, 1, -1.5708, 0), { col: [0, 0, 0, .3], at: 0 });
      if (!A.open || A.locked) for (let z = 0; z < A.h; z += 22) dr(CUBE, trs(A.gx, 0, z + 8, 8, 44 + (z % 44 ? 0 : 10), 8), { col: rgb('#5a3a1c'), lit: 1 });
      else later('add', CUBE, trs(A.gx, 0, A.h / 2, 3, 90, A.h), { col: [.96, .77, .26, .28], emit: 1, at: 0 }); }
    // village: fence, houses, lamps
    for (let z = 4; z < A.h; z += 36) dr(CUBE, trs(SAFE, 0, z, 5, 22, 5), { col: rgb('#6b4a26'), lit: 1 });
    dr(CUBE, trs(SAFE, 14, A.h / 2, 3, 3, A.h), { col: rgb('#7a5a32'), lit: 1 }); dr(CUBE, trs(SAFE, 7, A.h / 2, 3, 3, A.h), { col: rgb('#7a5a32'), lit: 1 });
    if (arena) {
      [[A.w / 2, -7, A.w + 28, 14], [A.w / 2, A.h + 7, A.w + 28, 14]].forEach(([x, z, w, d]) => dr(CUBE, trs(x, 0, z, w, 40, d), { col: rgb('#3b404a'), lit: 1 }));
      [[-7, A.h / 2, 14, A.h], [A.w + 7, A.h / 2, 14, A.h]].forEach(([x, z, w, d]) => dr(CUBE, trs(x, 0, z, w, 40, d), { col: rgb('#3b404a'), lit: 1 }));
      for (let z = 60; z < A.h; z += 130) [SAFE + 40, A.w - 20].forEach(x => { dr(CUBE, trs(x, 0, z, 16, 60, 16), { col: rgb('#6a707c'), lit: 1 }); glow(x, 70, z, 46, [1, .6, .2], .9); });
    } else {
      for (const z of [-250, -90, 90, 250]) { const zz = A.h / 2 + z;
        dr(CUBE, trs(52, 0, zz, 84, 48, 66), { col: rgb('#cdb88a'), lit: 1 }); dr(PYR, trs(52, 48, zz, 104, 36, 86), { col: rgb('#8a3a2a'), lit: 1 });
        dr(CUBE, trs(95, 0, zz, 4, 28, 18), { col: rgb('#3a2412'), lit: 1 }); dr(CUBE, trs(94, 26, zz + 24, 3, 14, 14), { col: rgb('#ffe9a0'), emit: 1 }); }
      for (const z of [-200, 0, 200]) { const zz = A.h / 2 + z + 40; dr(CUBE, trs(228, 0, zz, 4, 56, 4), { col: rgb('#3a3a3a'), lit: 1 }); glow(228, 62, zz, 54, [1, .8, .45], .55 + .35 * dk); }
    }
    // trees / rocks
    const ps = Math.min(AI, 4), sway0 = t * 1.4;
    for (const tr of T) { if (Math.hypot(tr.x - cam[0], tr.y - cam[2]) > 1500) continue; const s = tr.s;
      if (A.rock) { dr(SPH, trs(tr.x, 8 * s, tr.y, 21 * s, 13 * s, 17 * s), { col: rgb('#4b4242'), lit: 1 }); dr(SPH, trs(tr.x - 5 * s, 13 * s, tr.y, 11 * s, 8 * s, 9 * s), { col: rgb('#6a5f5f'), lit: 1 }); blob(tr.x, tr.y, 38 * s, .45); continue; }
      dr(CUBE, trs(tr.x, 0, tr.y, 7 * s, 22 * s, 7 * s), { col: rgb('#5a3a1c'), lit: 1 }); blob(tr.x + 8 * s, tr.y, 44 * s, .5);
      const v = Math.abs((tr.x * 13 + tr.y * 7) | 0) % 3, cs = 62 * s; dr(QUAD, trs(tr.x, 10 * s, tr.y + 2, cs, cs, 1), { tex: tex(canopyC(v)), sway: Math.sin(sway0 + tr.x * .013) * .07 }); }
    // NPCs
    const names = [], NL = NPCS(); for (const n of NL) { bill(NP[n.k], n.x, n.y, { sy: 1 + Math.sin(t * 2.6 + n.x) * .02 }); names.push([n.n, n.x, NP[n.k].height + 8, n.y, '#fff']); }
    // monsters
    const bars = [];
    for (const e of E) {
      if (e.dragon) { paintDragon(); dr(QUAD, trs(e.x, -26, e.y, 200 * 1.3, 140 * 1.3, 1), { tex: tex(dragonCv[0]), flash: e.fl > 0 ? 1 : 0 }); blob(e.x, e.y, 90, .6); bars.push([e, 108]); }
      else { const ph = e.x * .021 + e.y * .017, sy = 1 + Math.sin(t * 2.6 + ph) * .03; bill(e.img, e.x, e.y, { flip: e.face, sy, sx: 1 - (sy - 1) * .6, flash: e.fl > 0 ? 1 : 0 }); bars.push([e, e.img.height + 8]); } }
    // hero
    const img = PL[P.ai] || PL[0], run = P.mv ? Math.sin(t * 12) : 0, ph = P.x * .021 + P.y * .017; let sx = 1, sy = 1, lx = 0;
    if (P.mv) { sy = 1 + run * .05; sx = 1 - run * .04; } else { sy = 1 + Math.sin(t * 2.6 + ph) * .025; sx = 1 - (sy - 1) * .6; }
    if (P.sw > 0) { const a = Math.min(1, P.sw / .25); lx = (P.fx < 0 ? -1 : 1) * a * 8; sx *= 1 + .12 * a; sy *= 1 - .08 * a; }
    const blink = P.inv > 0 && ((P.inv * 20) | 0) % 2; bill(img, P.x, P.y, { flip: P.fx < 0, y: P.mv ? Math.abs(run) * 3 : 0, sx, sy, dx: lx, rot: run * .06 * (P.fx < 0 ? -1 : 1), alpha: blink ? .4 : 1 });
    if (P.sw > 0) { const w = WEAP[P.wi].c, c = rgb(w); later('add', QUAD, trs(P.x + (P.fx < 0 ? -34 : 34), 2, P.y + 4, (P.fx < 0 ? -1 : 1) * 78, 60, 1), { tex: tex(slashC()), col: [c[0], c[1], c[2], Math.min(1, P.sw / .18)], emit: 1, at: 0 }); }
    if (P.fort > 0) glow(P.x, 52, P.y, 74 + Math.sin(t * 8) * 4, [.4, .75, 1], .55);
    // other players
    const mp = window.mp, peers = [];
    if (mp) for (const [id, p] of mp.peers) { if (performance.now() - p.seen > 4000) { mp.peers.delete(id); continue; } p.px += (p.tx - p.px) * .3; p.py += (p.ty - p.py) * .3; const im = PL[p.ai] || PL[0];
      bill(im, p.px, p.py, { flip: p.fx < 0, sy: 1 + Math.sin(t * 2.6 + p.px * .02) * .025 }); peers.push([p, im.height]);
      if (p.sw) { const c = rgb((WEAP[p.wi] || WEAP[0]).c); later('add', QUAD, trs(p.px + (p.fx < 0 ? -34 : 34), 2, p.py + 4, (p.fx < 0 ? -1 : 1) * 78, 60, 1), { tex: tex(slashC()), col: [c[0], c[1], c[2], .8], emit: 1, at: 0 }); } }
    if (portal) later('add', QUAD, trs(portal.x, 4, portal.y, 90 + Math.sin(t * 4) * 6, 90, 1, 0, t), { tex: tex(ringC()), emit: 1, at: 0 }), glow(portal.x, 50, portal.y, 120, [.5, .6, 1], .6);
    for (const b of B) { glow(b.x, 18, b.y + 10, 44, [1, .5, .15], .95); glow(b.x, 18, b.y + 10, 20, [1, .9, .5], 1); }
    for (const p of window.PRJ || []) { const c = rgb(p.col || '#ffe9a8'); for (let i = 0; i < 4; i++) glow(p.x - p.vx * .014 * i, 16, p.y + 10 - p.vy * .014 * i, (p.k == 'bolt' ? 34 : 16) - i * 3, c, 1 - i * .22); }
    for (const q of Q) { const c = rgb(q.col.length >= 4 ? q.col.slice(0, q.col.length > 4 ? 7 : 4) : '#ffffff'); glow(q.x, 10, q.y + 12, 7, c, Math.min(1, q.l * 3)); }
    // weather / ambient motes (parallax comes free from the 3D camera)
    const wx = WX[ps]; for (let i = 0; i < (innerWidth < 900 ? 36 : 64); i++) { const sd = i * 12.9898, a = mod(Math.sin(sd) * 43758.5, 1), b = mod(Math.sin(sd * 1.7) * 31415.9, 1), c = mod(Math.sin(sd * 2.3) * 27182.8, 1);
      const bx = cam[0] - 550, bz = cam[2] - 350, x = bx + mod(a * 1100 + wx.vx * t + Math.sin(t * .7 + i) * 14 - bx, 1100), z = bz + mod(b * 700 - bz, 700), y = mod(c * 260 + wx.vy * t, 260);
      glow(x, y + 4, z, wx.s * 2.2, wx.c, .7); }
    // flush transparent queue
    gl.enable(gl.BLEND); gl.depthMask(false);
    for (const [mode, m, M, a] of TQ) { gl.blendFunc(mode == 'add' ? gl.SRC_ALPHA : gl.SRC_ALPHA, mode == 'add' ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); dr(m, M, a); }
    gl.depthMask(true); gl.disable(gl.BLEND);
    return { names, bars, peers, cw, ch, amb, dk };
  }

  /* ---------------- 2D overlay: names, bars, numbers, minimap, messages ---------------- */
  function overlay(S) {
    const k = S.ch / H, cw = S.cw, ch = S.ch; o.clearRect(0, 0, cw, ch); o.textAlign = 'center';
    const pt = (x, y, z) => { const p = proj(x, y, z); return p ? [p[0] * cw, p[1] * ch] : null; };
    const label = (txt, x, y, col, sz = 12) => { o.font = `bold ${sz * k}px system-ui`; o.fillStyle = '#000'; o.fillText(txt, x + k, y + k); o.fillStyle = col; o.fillText(txt, x, y); };
    for (const [n, x, h, z, col] of S.names) { const p = pt(x, h * 1.0, z); if (p) label(n, p[0], p[1] - 2 * k, col); }
    for (const [e, h] of S.bars) { const p = pt(e.x, h, e.y); if (!p) continue; const w = (e.boss ? 70 : e.r * 2) * k; o.fillStyle = '#000a'; o.fillRect(p[0] - w / 2, p[1], w, 4 * k); o.fillStyle = e.boss ? '#d3f' : '#e44'; o.fillRect(p[0] - w / 2, p[1], w * Math.max(0, e.hp) / e.mh, 4 * k); }
    for (const [p, h] of S.peers) { const q = pt(p.px, h + 6, p.py); if (!q) continue; label(p.name + ' Lv' + p.lv, q[0], q[1] - 6 * k, '#9fe8ff', 11);
      if (p.mh) { const w = 36 * k; o.fillStyle = '#000a'; o.fillRect(q[0] - w / 2, q[1], w, 4 * k); o.fillStyle = '#e44'; o.fillRect(q[0] - w / 2, q[1], w * cl(p.hp / p.mh, 0, 1), 4 * k); }
      if (p.say && performance.now() < p.say.until) { const tx = p.say.t.length > 44 ? p.say.t.slice(0, 43) + '…' : p.say.t; o.font = `${11 * k}px system-ui`; const w = o.measureText(tx).width + 10 * k; o.fillStyle = '#fffffff2'; o.fillRect(q[0] - w / 2, q[1] - 34 * k, w, 16 * k); o.fillStyle = '#111'; o.fillText(tx, q[0], q[1] - 22 * k); } }
    for (const d of D) { const p = pt(d.x, 30, d.y + 24); if (!p) continue; o.globalAlpha = Math.min(1, d.l); label(String(d.t), p[0], p[1], d.col, 14); } o.globalAlpha = 1;
    // minimap (same as the 2D one)
    const w = 100 * k, h = Math.max(24 * k, w * A.h / A.w), mx = cw - w - 8 * k, my = 60 * k, m = w / A.w;
    o.fillStyle = '#000b'; o.fillRect(mx - 2 * k, my - 2 * k, w + 4 * k, h + 4 * k); o.fillStyle = A.g[0]; o.fillRect(mx, my, w, h); o.fillStyle = '#4f46'; o.fillRect(mx, my, SAFE * m, h);
    if (A.gx < A.w) { o.fillStyle = '#0006'; o.fillRect(mx + A.gx * m, my, (A.w - A.gx) * m, h); o.fillStyle = A.open && !A.locked ? '#f5c542' : '#c33'; o.fillRect(mx + A.gx * m, my, 2 * k, h); }
    const dot = (q, col, r) => { o.fillStyle = col; o.fillRect(mx + q.x * m - r * k / 2, my + q.y * m - r * k / 2, r * k, r * k); };
    NPCS().forEach(n => dot(n, '#ff0', 3)); E.forEach(e => dot(e, e.boss ? '#d3f' : '#f55', e.boss ? 5 : 2)); if (portal) dot(portal, '#7df', 5); dot(P, ((t * 4) | 0) % 2 ? '#fff' : '#39f', 4);
    if (mt > 0) { const my2 = ch - (document.body.classList.contains('touch') ? 150 : 90) * (ch / H) / k * k; o.fillStyle = '#000a'; o.fillRect(cw / 2 - 190 * k, my2, 380 * k, 26 * k); o.fillStyle = '#fff'; o.font = `bold ${13 * k}px system-ui`; o.fillText(msg, cw / 2, my2 + 18 * k); }
    if (P.hp < lastHp - .5) flashR = .55; lastHp = P.hp; if (flashR > 0) { const g = o.createRadialGradient(cw / 2, ch / 2, ch * .3, cw / 2, ch / 2, Math.hypot(cw, ch) * .6); g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${flashR})`); o.fillStyle = g; o.fillRect(0, 0, cw, ch); flashR = Math.max(0, flashR - .03); }
    if (over == 1) { o.fillStyle = '#000a'; o.fillRect(0, 0, cw, ch); o.fillStyle = '#f55'; o.font = `bold ${28 * k}px Georgia,serif`; o.fillText('YOU DIED', cw / 2, ch / 2); o.fillStyle = '#fff'; o.font = `${13 * k}px system-ui`; o.fillText('Tap or press any key to respawn', cw / 2, ch / 2 + 26 * k); }
    if (over == 2) { o.fillStyle = '#000b'; o.fillRect(0, 0, cw, ch); o.fillStyle = '#f2c35b'; o.font = `bold ${28 * k}px Georgia,serif`; o.fillText('VICTORY!', cw / 2, ch / 2); o.fillStyle = '#fff'; o.font = `${13 * k}px system-ui`; o.fillText('Tap or press any key to play again', cw / 2, ch / 2 + 26 * k); }
  }

  /* ---------------- switch 2D / 3D ---------------- */
  function apply() { document.body.classList.toggle('r3d', on && ok); }
  window.draw = () => {
    if (!(on && ok)) return draw2d();
    try { const S = scene(); if (S) overlay(S); fails = 0; }
    catch (e) { console.error('3D error', e); if (++fails > 3) { on = false; apply(); try { say('3D failed: back to 2D view'); } catch (e2) {} } }
  };
  try { ok = initGL(); if (ok) buildMeshes(); } catch (e) { console.error('WebGL init failed', e); ok = false; }
  apply();
  const b = document.createElement('button'); b.id = 'b3d'; b.className = 'round'; b.title = '3D view (V)'; b.textContent = '🧊'; document.querySelector('.topbtns').append(b);
  const toggle = () => { if (!ok) { say('3D is not supported on this device'); return; } on = !on; localStorage.setItem(KEY, on ? '1' : '0'); apply(); say('3D view: ' + (on ? 'ON' : 'OFF')); };
  b.onclick = () => { au(); toggle(); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() == 'v' && !e.ctrlKey && !e.metaKey) toggle(); });
  c2.addEventListener('wheel', e => { if (on && ok) zoom = cl(zoom * (e.deltaY > 0 ? 1.08 : .93), .65, 1.6); }, { passive: true });
  glc.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; apply(); });
})();
