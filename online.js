/* Emberfall online layer (Supabase): accounts, cloud saves, leaderboard, live multiplayer.
   Fill in the two values below (Supabase > Project Settings > API). The anon key is meant to be public:
   Row Level Security in supabase.sql is what protects the data. */
(() => {
  const SUPABASE_URL = 'https://nswobppwfcxzrjnkfwsd.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_I5YuxD3JK8blBdv_pPjU1g_H1CRFUVx';

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
    sb.from('players').update({ lv: P.lv, area: Math.min(4, Math.max(P.maxA || 0, AI)), wins }).eq('id', me.id).then(({ error }) => { if (error) toast('Rejected: ' + error.message); });
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
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => onChat(payload, 'area'));
    ch.subscribe(st => { chReady = st === 'SUBSCRIBED'; });
  }
  setInterval(() => {                       // 5 updates/sec keeps a free project well under Realtime limits
    if (!ready || over === 3) return;
    if (AI !== chArea) { joinArea(AI); pushMsg('', 'You entered ' + A.n, 'sys'); }
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
      if (p.say && now < p.say.until) drawBubble(ctx, p.px, ty - 12, p.say.t);
    }
    if (selfSay && ready && performance.now() < selfSay.until) drawBubble(ctx, P.x, P.y - (PL[P.ai] || PL[0]).height - 8, selfSay.t);
  };
  let selfSay = null;
  function drawBubble(ctx, x, y, text) {
    const t = text.length > 44 ? text.slice(0, 43) + '…' : text;
    ctx.font = '11px system-ui'; ctx.textAlign = 'center';
    const w = ctx.measureText(t).width + 10;
    ctx.fillStyle = '#fffffff2'; ctx.fillRect(x - w / 2, y - 12, w, 15);
    ctx.fillStyle = '#111'; ctx.fillText(t, x, y - 1);
  }


  /* ---------- chat: "Area" (same area only) and "World" (everyone online) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #chat:not(.on){display:none}
  #chatlog{position:absolute;z-index:6;top:calc(60px + var(--sat));right:calc(10px + var(--sar));width:min(270px,46%);max-height:150px;overflow-y:auto;
    display:flex;flex-direction:column;gap:2px;pointer-events:none;font:12px/1.3 system-ui,sans-serif;color:#fff;text-shadow:0 1px 2px #000}
  #chat.open #chatlog{pointer-events:auto;background:#0b0f15d9;border:1px solid #2f3643;border-radius:6px;padding:6px;user-select:text;-webkit-user-select:text}
  #chatlog div{padding:2px 6px;background:#0b0f1599;border-radius:4px;word-break:break-word}
  #chat.open #chatlog div{background:none}
  #chatlog b{color:#9fe8ff}#chatlog .w b{color:#ffd27a}#chatlog .s{color:#9da6b5;font-style:italic}
  #chatbar{display:none;position:absolute;z-index:15;left:50%;transform:translateX(-50%);bottom:calc(92px + var(--sab));width:min(480px,92%);gap:6px}
  #chat.open #chatbar{display:flex}
  #chatbar input{flex:1;min-width:0;padding:10px;font-size:16px;background:#0b0f15;border:1px solid var(--gold);border-radius:6px;color:var(--text);outline:none;user-select:text;-webkit-user-select:text}
  #chatbar button{padding:0 12px;min-height:42px;background:#242b36;border:1px solid #3e4654;border-radius:6px;font-size:13px}
  #chatscope{min-width:62px;color:var(--gold)}
  body.touch #chatbar{bottom:auto;top:calc(10px + var(--sat));left:calc(10px + var(--sal));right:calc(10px + var(--sar));transform:none;width:auto}
  body.touch #chatlog{top:calc(62px + var(--sat))}
  #bch{position:relative}#bch.unread:after{content:"";position:absolute;top:3px;right:3px;width:10px;height:10px;border-radius:50%;background:#f55;border:1px solid #000}`;
  document.head.append(css);

  const chat = document.createElement('div'); chat.id = 'chat';
  chat.innerHTML = '<div id="chatlog"></div><div id="chatbar"><button id="chatscope" title="Switch Area / World">Area</button>' +
    '<input id="chatin" maxlength="120" placeholder="Say something…" autocomplete="off" enterkeyhint="send"><button id="chatsend">➤</button><button id="chatx">✕</button></div>';
  $a('wrap').append(chat);
  const log = $a('chatlog'), inp = $a('chatin'), cbtn = document.createElement('button');
  cbtn.id = 'bch'; cbtn.className = 'round'; cbtn.title = 'Chat (Enter)'; cbtn.textContent = '💬'; $a('bq').after(cbtn);
  let chatOpen = false, scope = 'area', lastChat = 0, wch = null, wReady = false;

  function pushMsg(name, text, kind) {
    const d = document.createElement('div'); d.className = kind === 'world' ? 'w' : kind === 'sys' ? 's' : ''; d.dataset.t = Date.now();
    if (kind === 'sys') d.textContent = text;
    else { const b = document.createElement('b'); b.textContent = (kind === 'world' ? '[World] ' : '') + name + ': '; d.append(b, document.createTextNode(text)); }
    log.append(d); while (log.children.length > 50) log.firstChild.remove(); log.scrollTop = 1e6;
  }
  setInterval(() => { const n = Date.now(); for (const d of log.children) d.style.display = (chatOpen || n - d.dataset.t < 8000) ? '' : 'none'; }, 500);

  function onChat(m, kind) {
    if (!m || typeof m.text !== 'string' || typeof m.name !== 'string' || (me && m.id === me.id)) return;
    const text = m.text.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120), name = m.name.slice(0, 16);
    if (!text) return;
    pushMsg(name, text, kind);
    if (!chatOpen) cbtn.classList.add('unread');
    if (kind === 'area') { const p = peers.get(m.id); if (p) p.say = { t: text, until: performance.now() + 5000 }; }
  }
  function joinWorld() {
    if (wch) return;
    wch = sb.channel('world', { config: { broadcast: { self: false } } });
    wch.on('broadcast', { event: 'chat' }, ({ payload }) => onChat(payload, 'world'));
    wch.subscribe(st => { wReady = st === 'SUBSCRIBED'; });
  }
  function leaveWorld() { if (wch) { sb.removeChannel(wch); wch = null; wReady = false; } }

  function openChat() {
    if (!ready || chatOpen) return;
    chatOpen = true; chat.classList.add('open'); cbtn.classList.remove('unread');
    for (const k in K) K[k] = 0;            // release any held movement keys
    for (const d of log.children) d.style.display = ''; log.scrollTop = 1e6;
    inp.focus();
  }
  function closeChat() { chatOpen = false; chat.classList.remove('open'); inp.blur(); }
  function sendChat() {
    const t = inp.value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120);
    if (!t) return closeChat();
    if (Date.now() - lastChat < 1200) return pushMsg('', 'Slow down a little.', 'sys');
    const payload = { id: me.id, name: hero, text: t };
    if (scope === 'world') {
      if (!(wch && wReady)) return pushMsg('', 'World chat is still connecting…', 'sys');
      wch.send({ type: 'broadcast', event: 'chat', payload });
    } else {
      if (!(ch && chReady)) return pushMsg('', 'Area chat is still connecting…', 'sys');
      ch.send({ type: 'broadcast', event: 'chat', payload });
      selfSay = { t, until: performance.now() + 5000 };
    }
    lastChat = Date.now(); inp.value = '';
    pushMsg(hero, t, scope); closeChat();
  }
  cbtn.onclick = () => { au(); chatOpen ? closeChat() : openChat(); };
  $a('chatsend').onclick = sendChat; $a('chatx').onclick = closeChat;
  $a('chatscope').onclick = () => { scope = scope === 'area' ? 'world' : 'area'; $a('chatscope').textContent = scope === 'area' ? 'Area' : 'World'; inp.focus(); };
  $a('c').addEventListener('pointerdown', () => { if (chatOpen) closeChat(); });
  ['keydown', 'keyup'].forEach(ev => inp.addEventListener(ev, e => e.stopPropagation()));   // typing must not move the hero
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } else if (e.key === 'Escape') closeChat(); });
  addEventListener('keydown', e => {
    if (e.key === 'Enter' && ready && !chatOpen && over !== 3 && $a('panel').hidden && $a('auth').hidden) { e.preventDefault(); openChat(); }
  });

  /* ---------- auth ---------- */
  function showAuth(msg) { $a('auth').hidden = false; ui = true; $a('ae').textContent = msg || ''; ready = false; }
  async function enter(user, isNew) {
    me = user;
    if (isNew) {
      const { error } = await sb.from('players').insert({ id: user.id, name: hero });
      if (error) throw error;
    } else {
      const { data, error: pe } = await sb.from('players').select('name,wins').eq('id', user.id).maybeSingle();
      if (pe) throw pe;
      if (data) { hero = data.name; wins = data.wins; }
      else { const { error } = await sb.from('players').insert({ id: user.id, name: hero }); if (error) throw error; }   // repair half-registered accounts
    }
    const { data: sv } = await sb.from('saves').select('data').eq('id', user.id).maybeSingle();
    sv ? restore(sv.data) : (newGame(), wins = 0);
    lastAI = AI; lastLv = P.lv; lastJson = ''; lastCloud = 0; ready = true;
    joinWorld(); chat.classList.add('on'); log.innerHTML = ''; pushMsg('', 'Press Enter or tap 💬 to chat. Switch Area/World in the chat bar.', 'sys');
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
  async function logout() {
    if (!me) return;
    save(true); sendBye();
    if (ch) { sb.removeChannel(ch); ch = null; chReady = false; }
    chArea = -1; peers.clear(); closeP();
    leaveWorld(); closeChat(); chat.classList.remove('on'); selfSay = null;
    await sb.auth.signOut(); me = null; ready = false; showAuth('Logged out');
  }
  $a('blo').onclick = () => { au(); if (confirm('Log out? Your progress is saved.')) logout(); };

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
