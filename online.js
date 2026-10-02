/* Emberfall online layer (Supabase): accounts, cloud saves, leaderboard, live multiplayer.
   Fill in the two values below (Supabase > Project Settings > API). The anon key is meant to be public:
   Row Level Security in supabase.sql is what protects the data. */
(() => {
  const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
  const SUPABASE_KEY = 'YOUR-ANON-PUBLIC-KEY';

  const $a = id => document.getElementById(id);
  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  let me = null, hero = '', wins = 0, ready = false, lastJson = '', lastCloud = 0;
  const emailOf = n => n.toLowerCase() + '@emberfall.game';
  const toast = m => { try { say(m); } catch {} };
  ['an', 'ap'].forEach(id => ['keydown', 'keyup'].forEach(ev => $a(id).addEventListener(ev, e => e.stopPropagation())));

  /* ---------- snapshot / restore ---------- */
  const TRANSIENT = ['x', 'y', 'cd', 'sw', 'inv', 'fx', 'fy', 'mv'];
  function snapshot() {
    const p = { ...P }; TRANSIENT.forEach(k => delete p[k]);
    return { v: 1, P: p, AI, wins, qs: A.qs, open: A.open, done: A.done, k: A.k };
  }
  function restore(s) {
    Object.assign(P, s.P, { inv: 1.5 });
    loadArea(s.AI); P.x = 90; P.y = A.h / 2;
    if (s.qs && s.qs.length === A.qs.length) A.qs = s.qs;
    A.k = s.k || 0;
    if (s.open) {
      A.open = 1;
      if (s.done) { A.done = 1; portal = { x: A.w - 70, y: A.h / 2 }; }
      else E.push(mk(A.boss, A.w - 170, A.h / 2));
    }
    wins = s.wins || 0; over = 0; ui = false;
  }

  /* ---------- cloud save (throttled: 15s, or immediately on milestones) ---------- */
  function save(force) {
    if (!ready || over === 3) return;
    const s = snapshot(), j = JSON.stringify(s), now = Date.now();
    if (!force && (j === lastJson || now - lastCloud < 15000)) return;
    lastJson = j; lastCloud = now;
    sb.from('saves').upsert({ id: me.id, data: s, updated_at: new Date().toISOString() }).then(({ error }) => { if (error) toast('Save failed: ' + error.message); });
    sb.from('players').update({ lv: P.lv, area: AI, wins }).eq('id', me.id).then(({ error }) => { if (error) toast('Rejected: ' + error.message); });
  }
  setInterval(() => save(), 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
  addEventListener('pagehide', () => { save(true); sendBye(); });
  let lastAI = -1, lastLv = -1, lastOver = 0;
  setInterval(() => {
    if (!ready) return;
    if (over === 2 && lastOver !== 2) wins++;
    if (AI !== lastAI || P.lv !== lastLv || (over === 2 && lastOver !== 2)) { lastAI = AI; lastLv = P.lv; save(true); }
    lastOver = over;
  }, 1000);

  /* ---------- multiplayer: one realtime channel per area, broadcast positions ---------- */
  let ch = null, chReady = false, chArea = -1, lastPayload = '', lastSend = 0;
  const peers = new Map();
  function sendBye() { if (ch && chReady && me) ch.send({ type: 'broadcast', event: 'bye', payload: { id: me.id } }); }
  function joinArea(a) {
    if (ch) { sendBye(); sb.removeChannel(ch); }
    peers.clear(); chReady = false; chArea = a;
    ch = sb.channel('area-' + a, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'p' }, ({ payload: m }) => {
      if (!m || m.id === me.id) return;
      const p = peers.get(m.id) || { px: m.x, py: m.y };
      Object.assign(p, m, { tx: m.x, ty: m.y, seen: performance.now() }); peers.set(m.id, p);
    });
    ch.on('broadcast', { event: 'bye' }, ({ payload }) => peers.delete(payload.id));
    ch.subscribe(st => { chReady = st === 'SUBSCRIBED'; });
  }
  setInterval(() => {                       // 5 updates/sec keeps a free project well under Realtime limits
    if (!ready || over === 3) return;
    if (AI !== chArea) joinArea(AI);
    if (!chReady) return;
    const pl = { id: me.id, name: hero, lv: P.lv, x: P.x | 0, y: P.y | 0, fx: P.fx, sw: P.sw > 0 ? 1 : 0, ai: P.ai, wi: P.wi };
    const key = JSON.stringify({ ...pl, sw: 0 }), now = performance.now();
    if (key === lastPayload && now - lastSend < 2000 && !pl.sw) return;   // idle heartbeat every 2s
    lastPayload = key; lastSend = now;
    ch.send({ type: 'broadcast', event: 'p', payload: pl });
  }, 200);
  window.drawPeers = ctx => {               // called from game.js inside the world transform
    const now = performance.now();
    for (const [id, p] of peers) {
      if (now - p.seen > 4000) { peers.delete(id); continue; }
      p.px += (p.tx - p.px) * .3; p.py += (p.ty - p.py) * .3;
      const img = PL[p.ai] || PL[0];
      sprite(img, p.px, p.py, p.fx < 0, 0);
      if (p.sw) {
        ctx.strokeStyle = (WEAP[p.wi] || WEAP[0]).c; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.globalAlpha = .8;
        ctx.beginPath(); const a = p.fx < 0 ? Math.PI : 0; ctx.arc(p.px, p.py - 14, 44, a - 1, a + 1); ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
      const t = p.name + ' Lv' + p.lv, ty = p.py - img.height - 5;
      ctx.fillStyle = '#000'; ctx.fillText(t, p.px + 1, ty + 1); ctx.fillStyle = '#9fe8ff'; ctx.fillText(t, p.px, ty);
    }
  };

  /* ---------- auth ---------- */
  function showAuth(msg) { $a('auth').hidden = false; ui = true; $a('ae').textContent = msg || ''; ready = false; }
  async function enter(user, isNew) {
    me = user;
    if (isNew) {
      const { error } = await sb.from('players').insert({ id: user.id, name: hero });
      if (error) throw error;
    } else {
      const { data } = await sb.from('players').select('name,wins').eq('id', user.id).maybeSingle();
      if (data) { hero = data.name; wins = data.wins; }
    }
    const { data: sv } = await sb.from('saves').select('data').eq('id', user.id).maybeSingle();
    sv ? restore(sv.data) : (newGame(), wins = 0);
    lastAI = AI; lastLv = P.lv; lastJson = ''; lastCloud = 0; ready = true;
    $a('auth').hidden = true; ui = false; $a('ap').value = '';
    if (!sv) save(true);
  }
  async function submit(kind) {
    const name = $a('an').value.trim(), pass = $a('ap').value, btns = [$a('lg'), $a('rg')];
    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return ($a('ae').textContent = 'Username: 3-16 letters, numbers or _');
    if (pass.length < 6) return ($a('ae').textContent = 'Password must be 6+ characters');
    btns.forEach(b => b.disabled = true); $a('ae').textContent = '';
    try {
      const creds = { email: emailOf(name), password: pass };
      const r = kind === 'register' ? await sb.auth.signUp(creds) : await sb.auth.signInWithPassword(creds);
      if (r.error) throw r.error;
      if (!r.data.session) throw new Error('Username taken, or email confirmation is still ON in Supabase.');
      hero = name; await enter(r.data.user, kind === 'register');
    } catch (e) { $a('ae').textContent = /invalid login/i.test(e.message) ? 'Wrong username or password' : e.message; }
    finally { btns.forEach(b => b.disabled = false); }
  }
  $a('lg').onclick = () => submit('login'); $a('rg').onclick = () => submit('register');
  $a('ap').addEventListener('keydown', e => { if (e.key === 'Enter') submit('login'); });
  async function logout() { save(true); sendBye(); await sb.auth.signOut(); me = null; ready = false; showAuth('Logged out'); }

  /* ---------- leaderboard ---------- */
  function board() {
    $a('pb').innerHTML = '<div class="txt">Loading…</div>';
    sb.from('players').select('name,lv,area,wins').order('wins', { ascending: false }).order('area', { ascending: false }).order('lv', { ascending: false }).limit(20)
      .then(({ data, error }) => {
        $a('pb').innerHTML = '';
        if (error) return line('Could not load leaderboard.', 'txt');
        line('Ranked by clears, then area, then level · ' + (peers.size + 1) + ' in this area', 'gold');
        data.forEach((r, i) => row((i + 1) + '. ' + r.name + (r.name === hero ? ' (you)' : ''), 'Lv ' + r.lv + ' · Area ' + (r.area + 1) + (r.wins ? ' · ★' + r.wins : ''), () => {}, true));
        const out = document.createElement('div'); out.className = 'row';
        const bt = document.createElement('button'); bt.textContent = 'Log out'; bt.onclick = () => { closeP(); logout(); };
        out.append(bt); $a('pb').append(out);
      });
  }
  $a('blb').onclick = () => { au(); toggleP('Leaderboard', board); };

  /* ---------- boot: resume session if one exists ---------- */
  showAuth();
  sb.auth.getSession().then(({ data }) => { if (data.session) enter(data.session.user, false).catch(() => showAuth()); });
})();
