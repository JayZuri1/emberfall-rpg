/* Emberfall FX: HD-2D visual layer. Loads after game.js, changes no game logic.
   Lighting, soft + cast shadows, depth scaling, shaded sprites, animation, trees/rocks, ground texture, weather particles, hit effects.
   Quality button ✨ (or key G): Off / Medium / High. Defaults to Medium on phones. Every hook falls back to the original on error. */
(() => {
  const QK = 'emberfall.fx'; let quality = +(localStorage.getItem(QK) ?? (document.body.classList.contains('touch') ? 1 : 2));
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return { c, g: c.getContext('2d') }; };
  const o = { sprite, shadow, tree, loadArea, burst, hurt, kill, lvlcheck, skill, minimap };
  const ps = py => .95 + .1 * cl(py / A.h, 0, 1);                         // fake perspective: lower on screen = closer = bigger
  const safe = (fn, fb) => (...a) => { if (!quality) return fb(...a); try { return fn(...a); } catch (e) { return fb(...a); } };

  /* ---------- shadows + shaded sprites ---------- */
  const SB = cv(64, 64); { const g = SB.g.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); SB.g.fillStyle = g; SB.g.fillRect(0, 0, 64, 64); }
  const blob = (px, py, r) => { const ga = x.globalAlpha; x.globalAlpha = ga * .8; x.drawImage(SB.c, px - r * 1.25, py - r * .55, r * 2.5, r * 1.1); x.globalAlpha = ga; };
  const EN = new WeakMap(), SIL = new WeakMap();
  function enhance(img) {
    let e = EN.get(img); if (e) return e;
    const w = img.width, h = img.height, t0 = cv(w, h); t0.g.drawImage(img, 0, 0); t0.g.globalCompositeOperation = 'source-in'; t0.g.fillStyle = '#120c0a'; t0.g.fillRect(0, 0, w, h);
    const { c, g } = cv(w + 4, h + 4);
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) g.drawImage(t0.c, 2 + dx, 2 + dy);   // dark outline
    g.drawImage(img, 2, 2); g.globalCompositeOperation = 'source-atop';
    let gr = g.createLinearGradient(0, 2, 0, h + 2); gr.addColorStop(0, 'rgba(255,240,200,.22)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,0,30,.32)'); g.fillStyle = gr; g.fillRect(0, 0, w + 4, h + 4);
    gr = g.createLinearGradient(0, 0, w + 4, 0); gr.addColorStop(0, 'rgba(255,255,255,.15)'); gr.addColorStop(.55, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,30,.22)'); g.fillStyle = gr; g.fillRect(0, 0, w + 4, h + 4);
    t0.g.globalCompositeOperation = 'source-over'; SIL.set(img, t0.c); EN.set(img, c); return c;
  }
  const shadowF = (px, py, r) => blob(px, py, r);
  function spriteF(img, px, py, flip, bob = 0) {
    const e = enhance(img), sil = SIL.get(img), w = img.width, h = img.height, k = ps(py), me = px === P.x && py === P.y, ph = px * .021 + py * .017;
    let sx = 1, sy = 1, lean = 0, lx = 0;
    if (bob > 0) { const s = Math.sin(t * 12); sy = 1 + s * .05; sx = 1 - s * .04; lean = s * .07 * (flip ? -1 : 1); }
    else { sy = 1 + Math.sin(t * 2.6 + ph) * .025; sx = 1 - (sy - 1) * .6; }
    if (me && P.sw > 0) { const a = Math.min(1, P.sw / .25); lx = (P.fx < 0 ? -1 : 1) * a * 7; sx *= 1 + .12 * a; sy *= 1 - .08 * a; }
    blob(px, py, w / 2.2 * k);
    const ga = x.globalAlpha; x.save(); x.translate(px, py); x.transform(1, 0, -.7, -.32, 0, 0); x.globalAlpha = ga * .3; x.scale(k, k); x.drawImage(sil, -w / 2, -h); x.restore();   // cast shadow
    x.save(); x.translate(px + lx, py - bob); x.rotate(lean); x.scale((flip ? -1 : 1) * sx * k, sy * k); x.drawImage(e, -w / 2 - 2, -h - 2); x.restore();
  }

  /* ---------- trees, rocks ---------- */
  const rgba = (c, a) => `rgba(${c},${a})`;
  function canopy(cols, snow) {
    const S = 96, { c, g } = cv(S, S), b = [];
    for (let i = 0; i < 16; i++) { const a = rnd(0, 6.28), d = rnd(0, 26); b.push([48 + Math.cos(a) * d, 54 + Math.sin(a) * d * .8, rnd(14, 22)]); }
    b.sort((p, q) => q[1] - p[1]);
    for (const [bx, by, r] of b) { const gr = g.createRadialGradient(bx - r * .35, by - r * .4, r * .1, bx, by, r); gr.addColorStop(0, cols[2]); gr.addColorStop(.55, cols[1]); gr.addColorStop(1, cols[0]); g.fillStyle = gr; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill(); }
    for (let i = 0; i < 70; i++) { const a = rnd(0, 6.28), d = rnd(0, 34); g.fillStyle = Math.random() < .5 ? 'rgba(255,255,200,.14)' : 'rgba(0,20,0,.18)'; g.fillRect(48 + Math.cos(a) * d, 54 + Math.sin(a) * d * .85, 2, 2); }
    g.globalCompositeOperation = 'source-atop'; let s = g.createLinearGradient(0, 10, 0, 96); s.addColorStop(0, 'rgba(255,255,210,.18)'); s.addColorStop(1, 'rgba(0,0,20,.35)'); g.fillStyle = s; g.fillRect(0, 0, S, S);
    if (snow) { s = g.createLinearGradient(0, 10, 0, 60); s.addColorStop(0, 'rgba(255,255,255,.75)'); s.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = s; g.fillRect(0, 0, S, S); }
    return c;
  }
  function rockImg() {
    const { c, g } = cv(96, 96);
    for (const [bx, by, rx, ry] of [[48, 66, 30, 20], [34, 60, 18, 14], [62, 60, 20, 15]]) { const gr = g.createRadialGradient(bx - 8, by - 10, 2, bx, by, rx); gr.addColorStop(0, '#9a8c8c'); gr.addColorStop(.6, '#5a4e4e'); gr.addColorStop(1, '#241d1d'); g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by, rx, ry, 0, 0, 7); g.fill(); }
    g.strokeStyle = '#ff7a30'; g.lineWidth = 1.5; g.shadowColor = '#f60'; g.shadowBlur = 6;
    for (let i = 0; i < 4; i++) { let px = rnd(30, 66), py = rnd(52, 76); g.beginPath(); g.moveTo(px, py); for (let j = 0; j < 3; j++) { px += rnd(-6, 6); py += rnd(2, 7); g.lineTo(px, py); } g.stroke(); }
    return c;
  }
  const trunk = (() => { const { c, g } = cv(14, 34), gr = g.createLinearGradient(0, 0, 14, 0); gr.addColorStop(0, '#2e1c0c'); gr.addColorStop(.45, '#7a5230'); gr.addColorStop(1, '#2a190b'); g.fillStyle = gr; g.fillRect(2, 0, 10, 34); return c; })();
  const TS = new Map();
  const treeSet = () => { if (!TS.has(AI)) TS.set(AI, A.rock ? [rockImg(), rockImg(), rockImg()] : [0, 1, 2].map(() => canopy(A.tc, AI == 3))); return TS.get(AI); };
  function treeF(ob) {
    const s = ob.s * ps(ob.y), v = treeSet()[Math.abs((ob.x * 13 + ob.y * 7) | 0) % 3];
    blob(ob.x + 12 * s, ob.y + 2 * s, 22 * s); blob(ob.x, ob.y, 10 * s);
    if (A.rock) { x.drawImage(v, ob.x - 30 * s, ob.y - 54 * s, 60 * s, 60 * s); return; }
    x.drawImage(trunk, ob.x - 5 * s, ob.y - 26 * s, 10 * s, 28 * s);
    x.save(); x.translate(ob.x, ob.y - 12 * s); x.transform(1, 0, Math.sin(t * 1.4 + ob.x * .013) * .06, 1, 0, 0); x.drawImage(v, -26 * s, -47 * s, 52 * s, 52 * s); x.restore();
  }

  /* ---------- ground texture ---------- */
  function buildGround() {
    const S = 256, { c, g } = cv(S, S), base = A.g, wrap = f => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) f(dx, dy); };
    g.fillStyle = base[0]; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) { const bx = rnd(0, S), by = rnd(0, S), r = rnd(30, 75), col = base[1 + (i & 1)];
      wrap((dx, dy) => { const gr = g.createRadialGradient(bx + dx, by + dy, 0, bx + dx, by + dy, r); gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(bx + dx - r, by + dy - r, r * 2, r * 2); }); }
    const dot = (col, n, w, h) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(rnd(0, S) | 0, rnd(0, S) | 0, w, h); };
    if (AI < 2) { for (let i = 0; i < 380; i++) { const bx = rnd(0, S), by = rnd(0, S); g.strokeStyle = Math.random() < .5 ? 'rgba(255,255,170,.22)' : 'rgba(0,30,0,.28)'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + rnd(-2, 2), by - rnd(3, 6)); g.stroke(); }
      ['#f6e05e', '#ffffff', '#f48fb1'].forEach(f => dot(f, 4, 3, 3)); }
    else if (AI == 2) { for (let i = 0; i < 40; i++) { const bx = rnd(0, S), by = rnd(0, S); g.strokeStyle = i & 1 ? 'rgba(255,240,200,.3)' : 'rgba(120,80,30,.22)'; g.beginPath(); g.arc(bx, by, rnd(14, 40), 3.4, 5.9); g.stroke(); } dot('rgba(110,80,50,.5)', 20, 3, 2); }
    else if (AI == 3) { dot('rgba(255,255,255,.7)', 60, 2, 2); g.strokeStyle = 'rgba(120,170,210,.3)'; for (let i = 0; i < 6; i++) { g.beginPath(); let px = rnd(0, S), py = rnd(0, S); g.moveTo(px, py); for (let j = 0; j < 4; j++) g.lineTo(px += rnd(-22, 22), py += rnd(-22, 22)); g.stroke(); } }
    else { g.strokeStyle = 'rgba(0,0,0,.4)'; for (let i = 0; i < 14; i++) { g.beginPath(); let px = rnd(0, S), py = rnd(0, S); g.moveTo(px, py); for (let j = 0; j < 4; j++) g.lineTo(px += rnd(-18, 18), py += rnd(-18, 18)); g.stroke(); } dot('rgba(255,120,40,.6)', 18, 2, 2); }
    pat = x.createPattern(c, 'repeat');
  }
  const loadAreaF = i => { o.loadArea(i); try { buildGround(); PA = []; } catch (e) {} };

  /* ---------- lighting, clouds, vignette, weather ---------- */
  const KF = [[0, [255, 255, 255]], [.45, [255, 252, 240]], [.58, [255, 175, 115]], [.7, [110, 124, 190]], [.86, [104, 118, 184]], [.95, [255, 190, 170]], [1, [255, 255, 255]]];
  const AT = [[255, 255, 255], [235, 255, 235], [255, 242, 215], [225, 240, 255], [255, 255, 255]];
  function ambient() {
    if (AI == 4) return [135, 112, 120];
    const p = (t / 200) % 1; let c = KF[0][1];
    for (let i = 1; i < KF.length; i++) if (p <= KF[i][0]) { const [a, ca] = KF[i - 1], [b, cb] = KF[i], f = (p - a) / (b - a); c = ca.map((v, j) => v + (cb[j] - v) * f); break; }
    return c.map((v, j) => v * AT[AI][j] / 255);
  }
  function light(sx, sy, r, col, a) { const g = x.createRadialGradient(sx, sy, 0, sx, sy, r); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); x.fillStyle = g; x.fillRect(sx - r, sy - r, r * 2, r * 2); }
  const cloud = (() => { const { c, g } = cv(512, 512); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12; i++) { const bx = rnd(0, 512), by = rnd(0, 512), r = rnd(80, 160); for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) { const gr = g.createRadialGradient(bx + dx, by + dy, 0, bx + dx, by + dy, r); gr.addColorStop(0, 'rgba(120,130,150,.9)'); gr.addColorStop(1, 'rgba(120,130,150,0)'); g.fillStyle = gr; g.fillRect(bx + dx - r, by + dy - r, r * 2, r * 2); } }
    return c; })();
  let cloudPat = null, vig = null, vigK = '', flash = 0, PA = [], lastT = 0;
  const WX = [{ c: '255,250,190', vx: 4, vy: -5, n: 1 }, { c: '200,230,120', vx: 14, vy: 8, n: 1.4 }, { c: '240,215,170', vx: 70, vy: 4, n: 1.6 }, { c: '255,255,255', vx: -6, vy: 28, n: 1.8 }, { c: '255,140,50', vx: 3, vy: -22, n: 1.4 }];
  const mod = (a, m) => ((a % m) + m) % m;
  function post() {
    const cx = cl(P.x - W / 2, 0, A.w - W), cy = cl(P.y - H / 2, 0, A.h - H), amb = ambient(), dk = 1 - (amb[0] + amb[1] + amb[2]) / 765, dtt = Math.min(.1, t - lastT); lastT = t;
    x.save();
    x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${amb[0] | 0},${amb[1] | 0},${amb[2] | 0})`; x.fillRect(0, 0, W, H);       // ambient tint (day/dusk/night/area)
    if (quality > 1 && AI < 4) { cloudPat = cloudPat || x.createPattern(cloud, 'repeat'); x.save(); x.globalAlpha = .2; x.translate(-mod(cx * .9 - t * 9, 512), -mod(cy * .9 - t * 3, 512)); x.fillStyle = cloudPat; x.fillRect(0, 0, W + 512, H + 512); x.restore(); }
    x.globalCompositeOperation = 'lighter';
    light(P.x - cx, P.y - cy - 14, 120 + 70 * dk, '255,214,150', .12 + .5 * dk);                                                 // hero lantern
    for (const e of E) { const lc = e.dragon ? '255,80,30' : e.type == 'lava' ? '255,110,40' : e.type == 'imp' ? '255,120,60' : e.type == 'ghost' ? '130,190,230' : 0; if (lc) light(e.x - cx, e.y - cy - 14, e.dragon ? 150 : 70, lc, .35); }
    for (const b of B) light(b.x - cx, b.y - cy, 60, '255,150,60', .55);
    if (portal) light(portal.x - cx, portal.y - cy - 20, 90, '150,170,255', .5 + Math.sin(t * 4) * .1);
    if (AI < 4 && dk < .15) { const g = x.createLinearGradient(0, 0, W * .8, H * .8); g.addColorStop(0, 'rgba(255,240,190,.13)'); g.addColorStop(1, 'rgba(255,240,190,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }   // sun glow
    x.globalCompositeOperation = 'source-over';
    const vk = W + 'x' + H; if (vigK != vk) { vigK = vk; vig = cv(W, H); const g = vig.g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .55); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,12,.55)'); vig.g.fillStyle = g; vig.g.fillRect(0, 0, W, H); }
    x.drawImage(vig.c, 0, 0);
    const wx = WX[AI], n = quality > 1 ? 64 : 28;                                                                                 // weather / ambient particles
    if (PA.length != n) PA = Array.from({ length: n }, () => ({ x: rnd(0, 999), y: rnd(0, 999), z: rnd(.3, 1), f: rnd(.5, 2), ph: rnd(0, 6) }));
    x.fillStyle = `rgb(${wx.c})`;
    for (const p of PA) { const px = mod(p.x + wx.vx * p.z * t + Math.sin(t * p.f + p.ph) * 8 - cx * p.z * .6, W), py = mod(p.y + wx.vy * p.z * t - cy * p.z * .6, H), s = (AI == 2 ? 2 : p.z * wx.n * 1.8 + .6);
      x.globalAlpha = .35 + .5 * p.z; AI == 2 ? x.fillRect(px, py, 5 * p.z + 2, 1) : x.fillRect(px, py, s, s); }
    x.globalAlpha = 1;
    if (flash > 0) { const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.hypot(W, H) * .6); g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${flash})`); x.fillStyle = g; x.fillRect(0, 0, W, H); flash = Math.max(0, flash - dtt * 1.4); }
    x.restore();
  }
  const minimapF = () => { if (quality) { try { post(); } catch (e) { x.restore(); } } o.minimap(); };

  /* ---------- world effects: sparks, rings, smoke, light pillars ---------- */
  const FX = []; let lw = performance.now();
  const add = f => { if (FX.length < (quality > 1 ? 220 : 90)) FX.push(f); };
  const sparks = (px, py, col, n) => { for (let i = 0; i < n * (quality > 1 ? 1.5 : 1); i++) add({ k: 's', x: px, y: py, vx: rnd(-110, 110), vy: rnd(-150, 20), l: rnd(.3, .7), m: .7, c: col }); };
  const ring = (px, py, R, col, l = .4) => add({ k: 'r', x: px, y: py, R, l, m: l, c: col });
  const smoke = (px, py, n) => { for (let i = 0; i < n; i++) add({ k: 'm', x: px + rnd(-8, 8), y: py + rnd(-6, 6), vx: rnd(-18, 18), vy: rnd(-40, -12), l: rnd(.5, 1), m: 1, r: rnd(4, 9) }); };
  function fxWorld(ctx) {
    if (!quality) return;
    const now = performance.now(), dt = Math.min(.05, (now - lw) / 1000); lw = now;
    ctx.save();
    if (P.sw > 0) { const a = Math.atan2(P.fy, P.fx); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = WEAP[P.wi].c; ctx.lineCap = 'round'; for (let i = 0; i < 3; i++) { ctx.globalAlpha = Math.min(1, P.sw / .18) * (.35 - i * .1); ctx.lineWidth = 12 - i * 3; ctx.beginPath(); ctx.arc(P.x, P.y - 14, 48 + i * 2, a - 1.1 - i * .25, a + 1.1); ctx.stroke(); } }
    for (let i = FX.length - 1; i >= 0; i--) { const f = FX[i]; f.l -= dt; if (f.l <= 0) { FX.splice(i, 1); continue; } const a = f.l / f.m;
      if (f.k == 's') { f.vy += 320 * dt; f.x += f.vx * dt; f.y += f.vy * dt; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = f.c; ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3); }
      else if (f.k == 'r') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = f.c; ctx.lineWidth = 2 + 6 * a; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.R * (1 - a), f.R * (1 - a) * .55, 0, 0, 7); ctx.stroke(); }
      else if (f.k == 'm') { f.x += f.vx * dt; f.y += f.vy * dt; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a * .45; ctx.fillStyle = '#9a9aa6'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (2 - a), 0, 7); ctx.fill(); }
      else if (f.k == 'p') { const g = ctx.createLinearGradient(0, f.y - 140, 0, f.y); g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(1, 'rgba(160,240,255,.8)'); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(f.x - 14 * a, f.y - 140, 28 * a, 140); } }
    ctx.restore();
  }
  let inner = null;   // chain onto online.js's drawPeers without editing game.js
  Object.defineProperty(window, 'drawPeers', { configurable: true, set(f) { inner = f; }, get() { return c2 => { try { fxWorld(c2); } catch (e) {} if (inner) inner(c2); }; } });

  /* ---------- hooks on game events ---------- */
  window.sprite = safe(spriteF, o.sprite); window.shadow = safe(shadowF, o.shadow); window.tree = safe(treeF, o.tree); window.loadArea = loadAreaF; window.minimap = minimapF;
  window.burst = (px, py, col, n = 8) => { o.burst(px, py, col, n); if (quality) { sparks(px, py, col, Math.min(n, 10)); if (n >= 8) ring(px, py, 26, '#ffffff', .2); } };
  window.hurt = d => { const h0 = P.hp; o.hurt(d); if (quality && P.hp < h0) flash = .55; };
  window.kill = e => { const px = e.x, py = e.y - 10, b = !!e.boss; o.kill(e); if (quality) { smoke(px, py, b ? 10 : 5); sparks(px, py, '#ffd36a', b ? 24 : 10); } };
  window.lvlcheck = () => { const l0 = P.lv; o.lvlcheck(); if (quality && P.lv > l0) { add({ k: 'p', x: P.x, y: P.y, l: 1.2, m: 1.2 }); ring(P.x, P.y, 80, '#7df', .7); sparks(P.x, P.y - 20, '#9ef', 20); } };
  window.skill = n => { const s0 = P.sp; o.skill(n); if (quality && P.sp < s0) { if (n == 2) { ring(P.x, P.y - 6, 105, '#ff8a3a', .5); ring(P.x, P.y - 6, 65, '#ffd36a', .4); sparks(P.x, P.y - 10, '#ff9a4a', 20); sh = Math.max(sh, 6); } else { ring(P.x + (P.fx < 0 ? -34 : 34), P.y - 16, 34, '#9df', .25); sparks(P.x, P.y - 12, '#bfe8ff', 8); } } };

  /* ---------- quality button ---------- */
  const names = ['Graphics: Off', 'Graphics: Medium', 'Graphics: High'];
  const b = document.createElement('button'); b.id = 'bfx'; b.className = 'round'; b.title = 'Graphics quality (G)'; b.textContent = '✨';
  document.querySelector('.topbtns').append(b);
  const st = document.createElement('style'); st.textContent = 'body.touch .topbtns{flex-wrap:wrap;max-width:calc(100% - 20px)}'; document.head.append(st);
  const cycle = () => { quality = (quality + 1) % 3; localStorage.setItem(QK, quality); say(names[quality]); };
  b.onclick = () => { au(); cycle(); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() == 'g' && !e.ctrlKey && !e.metaKey) cycle(); });
  if (A) buildGround();
})();
