/* Emberfall: stat points (STR / DEX / HP), harder monsters, and the Wayfarer NPC who travels you back to reached areas.
   Loads after fx.js. Needs game.js with `let dmg` and `let NPCS` (included). */
(() => {
  const PTS = 3, VIT = 15, SPV = 5;
  let god = false, oneHit = false, arena = false, stash = null;   // admin test toggles
  const ensure = () => {
    if (!P) return;
    P.st = P.st || { str: 0, dex: 0, vit: 0 }; P.st.sp = P.st.sp || 0; P.st.luk = P.st.luk || 0;
    P.pts = Math.max(0, PTS * (P.lv - 1) + (P.bonus || 0) - Object.values(P.st).reduce((a, v) => a + v, 0));   // always derived: 3 per level minus spent (old saves get theirs too)
    P.maxA = Math.max(P.maxA || 0, AI);
  };

  /* ---- stat effects ---- */
  const base = dmg, calc = () => { ensure(); return Math.max(1, Math.floor(base() * (1 + .04 * P.st.str) + 1.5 * P.st.str)); };
  dmg = () => { let d = oneHit ? 99999 : calc(); if (Math.random() < .01 * (P.st.dex + P.st.luk)) { d = Math.floor(d * 1.8); pop('CRIT!', P.x, P.y - 54, '#ffd36a'); } return d; };
  const atk0 = attack; window.attack = () => { ensure(); const c0 = P.cd; atk0(); if (P.cd > c0) { P.cd /= 1 + .03 * P.st.dex; pvpStrike(58, 1, true); } };
  const REC = [1, 7, 14, 21, 28], MUL = [2.6, 3.4, 4.4, 5.6, 7], mit = a => a / (a + 50);   // recommended level per area, base damage multiplier per area
  const hurt0 = hurt;
  window.hurt = d => {
    ensure(); if (P.x < SAFE || god) return;
    if (Math.random() < Math.min(.25, .01 * P.st.dex)) { P.inv = .5; pop('MISS', P.x, P.y - 40, '#9df'); return; }
    const gap = REC[AI] - P.lv, f = MUL[AI] * (gap > 0 ? Math.min(3.5, 1 + .18 * gap) : 1), a = ARM[P.ai].a;      // under-level: up to 3.5x more damage
    hurt0(Math.max(1, Math.round(d * f * (1 - mit(a)))) + a);                                                      // game subtracts `a`, leaving our value
  };
  const drp0 = drop; window.drop = e => { drp0(e); ensure(); const L = LOOT[e.type]; if (L && Math.random() < .02 * P.st.luk) { add(L); pop('+' + L + ' (luck)', e.x, e.y - 48, '#ffe36a'); } };
  const lvl0 = lvlcheck; window.lvlcheck = () => { const l0 = P.lv; lvl0(); ensure(); if (P.lv > l0) { say('+' + PTS * (P.lv - l0) + ' stat points! Press C or tap 📊'); } };
  const nw0 = newGame; window.newGame = () => { nw0(); P.st = { str: 0, dex: 0, vit: 0, sp: 0, luk: 0 }; ensure(); };
  const ld0 = loadArea; window.loadArea = i => { if (arena) { arena = false; window.pvpArena = false; stash = null; } ld0(i); ensure(); if (P.lv < REC[AI]) say('⚠ Recommended Lv ' + REC[AI] + ' (you are Lv ' + P.lv + '): monsters hit MUCH harder!'); };

  /* ---- harder monsters (scale with area) ---- */
  const mk0 = mk;
  window.mk = (ty, px, py) => { const e = mk0(ty, px, py), f = 1.4 + AI * .08; e.mh = e.hp = Math.round(e.mh * (e.boss ? 1.5 : f)); e.sp *= 1.05; return e; };

  /* ---- stat panel ---- */
  const resetCost = () => 200 * P.lv;
  function statPanel() {
    ensure(); $('pb').innerHTML = '';
    line('Stat points: ' + P.pts, 'gold'); line('Lv ' + P.lv + ' ' + P.job + ' · +' + PTS + ' points per level', 'txt');
    [['str', 'STR', '+4% and +1.5 damage'], ['dex', 'DEX', '+3% attack speed, +1% crit, +1% dodge (max 25%)'], ['vit', 'HP', '+' + VIT + ' max HP'], ['sp', 'SP', '+' + SPV + ' max SP'], ['luk', 'LUK', '+1% crit, +2% bonus loot drops']].forEach(([k, n, d]) =>
      row(n + ' ' + P.st[k] + ' · ' + d, '+1', () => { if (P.pts < 1) return; P.pts--; P.st[k]++; if (k == 'vit') { P.mhp += VIT; P.hp += VIT; } if (k == 'sp') { P.msp += SPV; P.sp += SPV; } S.coin(); statPanel(); }, P.pts < 1));
    line('Damage ' + calc() + ' · Max HP ' + P.mhp + ' · Max SP ' + P.msp + ' · Crit ' + (P.st.dex + P.st.luk) + '% · Bonus loot ' + 2 * P.st.luk + '% · Dodge ' + Math.min(25, P.st.dex) + '%', 'txt');
    const spent = Object.values(P.st).reduce((a, v) => a + v, 0);
    row('Reset all stats', resetCost() + 'z', () => { if (P.g < resetCost()) return; P.g -= resetCost(); P.mhp -= VIT * P.st.vit; P.msp -= SPV * P.st.sp; P.hp = Math.min(P.hp, P.mhp); P.sp = Math.min(P.sp, P.msp); P.pts += spent; P.st = { str: 0, dex: 0, vit: 0, sp: 0, luk: 0 }; S.coin(); statPanel(); }, !spent || P.g < resetCost());
  }
  window.statPanel = statPanel;

  /* ---- Wayfarer NPC: travel back to any area you have reached ---- */
  NP.guide = spr(PM, { h: '#2a5a6a', s: '#e0b890', e: '#222', b: '#2e8b8b', y: '#fff', l: '#345' }, 3);
  const GN = { 1: ['Ranger Sylva', { h: '#5a3a1a', s: '#e0b890', e: '#222', b: '#3a7a3a', y: '#cfe', l: '#432' }], 2: ['Khalid the Armorer', { h: '#222', s: '#c8905a', e: '#222', b: '#c89b4a', y: '#fff', l: '#531' }],
    3: ['Bjorn Frostforge', { h: '#ddd', s: '#f0d0b0', e: '#222', b: '#7fb6d6', y: '#fff', l: '#345' }], 4: ['Ignis the Forgemaster', { h: '#111', s: '#d09070', e: '#222', b: '#8a2a1a', y: '#f80', l: '#311' }] };
  Object.entries(GN).forEach(([k, [, pal]]) => { NP['gear' + k] = spr(PM, pal, 3); });
  NP.arena = NP.arenaexit = spr(PM, { h: '#111', s: '#e0b890', e: '#222', b: '#b03030', y: '#ffd36a', l: '#222' }, 3);
  const n0 = NPCS; NPCS = () => { if (arena) return [{ k: 'arenaexit', n: 'Arena Master', x: 170, y: A.h / 2 }]; const l = [...n0(), { k: 'guide', n: 'Wayfarer', x: 270, y: A.h / 2 - 160 }]; if (AI >= 1) l.push({ k: 'gear' + AI, n: GN[AI][0], x: 170, y: A.h / 2 - 80 }); else l.push({ k: 'arena', n: 'Arena Master', x: 170, y: A.h / 2 - 80 }); return l; };
  function travel() {
    ensure(); $('pb').innerHTML = ''; line('Wayfarer: I can take you back to any area you have reached.', 'txt');
    for (let i = 0; i <= P.maxA; i++) row(AREAS[i].n + (i == AI ? ' (here)' : ''), 'Travel', () => { closeP(); loadArea(i); say('Travelled to ' + AREAS[i].n); }, i == AI);
  }
  const talk0 = talk;
  window.talk = () => { if (over || ui) return talk0(); const g = NPCS().find(n => (n.k == 'guide' || n.k.startsWith('gear') || n.k.startsWith('arena')) && Math.hypot(n.x - P.x, n.y - P.y) < 70); if (g) { openP(g.n, g.k == 'guide' ? travel : g.k.startsWith('arena') ? arenaPanel : gearShop); return; } talk0(); };


  /* ---- nerfed gear + new area gear (sold by the area NPCs) ---- */
  [0, 4, 8, 15, 24].forEach((d, i) => { WEAP[i].d = d; });
  [0, 1, 3, 6, 9].forEach((a, i) => { ARM[i].a = a; });
  [[1, 'Ranger Saber', 12, 250, 7, '#9be36a'], [1, 'Wolfbane Blade', 18, 450, 10, '#6fd0a0'], [2, 'Dune Scimitar', 26, 700, 14, '#ffd36a'], [2, 'Sun Blade', 33, 1200, 17, '#ffb02e'],
   [3, 'Frostbrand', 42, 1800, 21, '#9fe3ff'], [3, 'Glacier Edge', 52, 2800, 24, '#c9f1ff'], [4, 'Magma Cleaver', 65, 3800, 28, '#ff6a2a'], [4, 'Dragonbone Sword', 80, 6000, 32, '#ffe9c0']]
    .forEach(([area, n, d, p, lv, c]) => WEAP.push({ n, d, p, c, lv, area }));
  [[1, 'Hide Jerkin', 8, 200, 7, '#4f8a3a'], [1, 'Ranger Mail', 12, 420, 10, '#2f6b4a'], [2, 'Nomad Robe', 17, 650, 14, '#c89b4a'], [2, 'Sunscale Armor', 22, 1100, 17, '#e0c36a'],
   [3, 'Fur Mantle', 28, 1600, 21, '#9fd0e8'], [3, 'Frostplate', 34, 2600, 24, '#d6eefc'], [4, 'Ashen Mail', 42, 3500, 28, '#7a2a22'], [4, 'Dragonscale Armor', 52, 5500, 32, '#c0391b']]
    .forEach(([area, n, a, p, lv, c]) => { ARM.push({ n, a, p, lv, area }); PL.push(spr(PM, { ...skin, b: c }, 3)); });   // PL[i] = look for armor i
  const pct = a => Math.round(100 * mit(a));
  function wRow(i) { const w = WEAP[i], own = P.ow[i], ok = P.lv >= (w.lv || 1);
    row(w.n + ' (+' + w.d + ' ATK' + (w.lv ? ', Lv ' + w.lv : '') + ')', own ? (i == P.wi ? 'Equipped' : 'Equip') : ok ? w.p + 'z' : 'Lv ' + w.lv,
      () => own ? (P.wi = i, cur()) : buy(w.p, () => { P.ow[i] = 1; P.wi = i; }), own ? i == P.wi : (!ok || P.g < w.p)); }
  function aRow(i) { const a = ARM[i], own = P.oa[i], ok = P.lv >= (a.lv || 1);
    row(a.n + ' (-' + pct(a.a) + '% damage' + (a.lv ? ', Lv ' + a.lv : '') + ')', own ? (i == P.ai ? 'Equipped' : 'Equip') : ok ? a.p + 'z' : 'Lv ' + a.lv,
      () => own ? (P.ai = i, cur()) : buy(a.p, () => { P.oa[i] = 1; P.ai = i; }), own ? i == P.ai : (!ok || P.g < a.p)); }
  window.shop = () => {
    $('pb').innerHTML = ''; line('Zeny: ' + P.g + 'z', 'gold');
    for (let i = 0; i < 5; i++) wRow(i); for (let i = 0; i < 5; i++) aRow(i);
    row('Red Potion (HP 60) · have ' + (P.bag['Red Potion'] || 0), '20z', () => buy(20, () => add('Red Potion')), P.g < 20);
    row('Blue Potion (SP 30) · have ' + (P.bag['Blue Potion'] || 0), '30z', () => buy(30, () => add('Blue Potion')), P.g < 30);
    const n = Object.values(LOOT).reduce((a, k) => a + (P.bag[k] || 0), 0);
    row('Sell all loot (' + n + ' items)', '+' + n * 10 + 'z', () => { Object.values(LOOT).forEach(k => P.bag[k] = 0); P.g += n * 10; S.coin(); cur(); }, !n);
  };
  const FLAV = { 1: 'Sylva: Wolves ignore cheap steel. Buy better, hunter.', 2: 'Khalid: Desert-tempered gear. The sun forgives no one.', 3: 'Bjorn: Frostforged. Only for the hardy.', 4: 'Ignis: Forged in dragon fire. Are you ready?' };
  function gearShop() { $('pb').innerHTML = ''; line('Zeny: ' + P.g + 'z · Your Lv ' + P.lv, 'gold'); line(FLAV[AI], 'txt'); WEAP.forEach((w, i) => w.area == AI && wRow(i)); ARM.forEach((a, i) => a.area == AI && aRow(i)); }


  /* ---- admin tools: only for accounts with is_admin = true in Supabase (see SQL) ---- */
  const SB_URL = 'https://nswobppwfcxzrjnkfwsd.supabase.co', SB_KEY = 'sb_publishable_I5YuxD3JK8blBdv_pPjU1g_H1CRFUVx';
  let isAdmin = false, adminUid = null, sb2 = null;
  const ab = document.createElement('button'); ab.id = 'badm'; ab.className = 'round'; ab.title = 'Admin tools'; ab.textContent = '🛠'; ab.hidden = true; $('binv').after(ab);
  async function checkAdmin() {
    try {
      sb2 = sb2 || supabase.createClient(SB_URL, SB_KEY, { auth: { autoRefreshToken: false } });
      const { data } = await sb2.auth.getSession(), uid = data.session ? data.session.user.id : null;
      if (uid === adminUid) return; adminUid = uid; isAdmin = false;
      if (uid) { const r = await sb2.from('players').select('is_admin').eq('id', uid).maybeSingle(); if (r.error) adminUid = null; else isAdmin = !!(r.data && r.data.is_admin); }
      ab.hidden = !isAdmin; if (!isAdmin) god = oneHit = false;
    } catch (e) {}
  }
  setInterval(checkAdmin, 3000);
  function setLv(n) { n = cl(n, 1, 99); const d = n - P.lv; P.lv = n; P.xp = 0; P.mhp = Math.max(20, P.mhp + 10 * d); P.msp = Math.max(10, P.msp + 3 * d); P.hp = P.mhp; P.sp = P.msp; }
  function adminPanel() {
    if (!isAdmin) { closeP(); return; }
    $('pb').innerHTML = ''; line('Admin tools (test account)', 'gold');
    const R = (t, b, f) => row(t, b, () => { f(); adminPanel(); });
    R('Level ' + P.lv, '+5', () => setLv(P.lv + 5)); R('Level down', '-5', () => setLv(P.lv - 5));
    R('Zeny ' + P.g, '+10,000', () => { P.g += 10000; }); R('Bonus stat points', '+10', () => { P.bonus = (P.bonus || 0) + 10; });
    R('Potions (Red + Blue)', '+10', () => { add('Red Potion', 10); add('Blue Potion', 10); });
    R('Unlock all weapons and armor', 'Unlock', () => { WEAP.forEach((_, i) => P.ow[i] = 1); ARM.forEach((_, i) => P.oa[i] = 1); });
    R('Full heal (HP and SP)', 'Heal', () => { P.hp = P.mhp; P.sp = P.msp; });
    R('God mode: ' + (god ? 'ON' : 'OFF'), 'Toggle', () => { god = !god; }); R('One-hit kills: ' + (oneHit ? 'ON' : 'OFF'), 'Toggle', () => { oneHit = !oneHit; });
    R("Spawn this area's boss", 'Spawn', () => { E.push(mk(A.boss, P.x + 90, P.y)); }); R('Clear all monsters', 'Clear', () => { E.length = 0; });
    line('Teleport', 'gold');
    AREAS.forEach((a, i) => row(a.n + (i == AI ? ' (here)' : ''), 'Go', () => { P.maxA = Math.max(P.maxA || 0, i); closeP(); loadArea(i); }, i == AI));
  }
  ab.onclick = () => { au(); toggleP('Admin', adminPanel); };


  /* ---- PvP arena (Arena Master in the first village) ---- */
  const PVP = .55;                                                   // PvP damage multiplier
  const ARENA = Object.create(AREAS[0]); Object.assign(ARENA, { n: 'PvP Arena', w: 1100, h: 640, mobs: [], gx: 3100, locked: 0 });   // reads quests/gate state from area 0, so saves stay correct
  const stone = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#50555f'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 90; i++) { g.fillStyle = Math.random() < .5 ? '#5d636e' : '#444952'; g.fillRect(Math.random() * 62 | 0, Math.random() * 62 | 0, 3, 2); }
    g.strokeStyle = '#2c3039'; g.lineWidth = 2; g.strokeRect(1, 1, 62, 62); g.strokeStyle = '#383d47'; g.beginPath(); g.moveTo(8, 40); g.lineTo(20, 46); g.lineTo(30, 44); g.stroke(); return c; })();
  const MP = () => window.mp, sp0 = spawn;
  window.spawn = () => { if (!arena) sp0(); };
  function enterArena() {
    if (arena) return;
    stash = { A, E, D, T, Q, B, portal, pat }; arena = true; window.pvpArena = true;
    A = ARENA; E = []; D = []; T = []; Q = []; B = []; portal = null; pat = x.createPattern(stone, 'repeat');
    P.x = 100; P.y = A.h / 2; P.hp = P.mhp; P.sp = P.msp; P.inv = 1.5; ui = false; closeP(); say('⚔ PvP ARENA: other players can attack you outside the lobby!');
  }
  function exitArena() {
    if (!arena || !stash) return;
    ({ A, E, D, T, Q, B, portal, pat } = stash); stash = null; arena = false; window.pvpArena = false;
    P.x = 225; P.y = A.h / 2 - 40; P.hp = P.mhp; P.inv = 1.5; closeP(); say('You left the arena');
  }
  function arenaPanel() {
    $('pb').innerHTML = '';
    line('Arena Master: Test your strength against other heroes.', 'txt');
    line('⚔ PvP is ON outside the lobby. No gold or item loss on death. Record: ' + (P.pk || 0) + ' wins / ' + (P.pd || 0) + ' deaths', 'gold');
    if (arena) { const n = MP() ? [...MP().peers.values()].length : 0; line('Heroes visible in the arena: ' + n, 'txt'); row('Leave the arena', 'Leave', exitArena); }
    else row('Enter the PvP Arena', 'Enter', enterArena);
  }
  function pvpStrike(R, M, front) {                                   // attacker side: find peers in range, tell them
    if (!arena || P.x < SAFE || !MP() || !MP().id() || god && false) return;
    const list = [...MP().peers].map(([id, p]) => [id, p, Math.hypot(p.tx - P.x, p.ty - P.y)]).filter(([, p, d]) => d <= R && p.tx >= SAFE && performance.now() - p.seen < 3000 && (!front || (p.tx - P.x) * P.fx + (p.ty - P.y) * P.fy >= -8)).sort((a, b) => a[2] - b[2]);
    for (const [id, p] of list) {
      const dm = Math.max(1, Math.round(dmg() * M * PVP)); MP().send('pvp', { t: 'hit', to: id, from: MP().id(), name: MP().name(), d: dm });
      pop(dm, p.px, p.py - 30, '#fd5'); burst(p.px, p.py - 10, '#fd5', 6); if (front) break;
    }
  }
  const lastHit = new Map();
  window.onPvp = m => {                                               // defender side
    if (!m || !arena || !MP()) return;
    if (m.t == 'kill' && m.by === MP().id()) { P.pk = (P.pk || 0) + 1; say('You defeated ' + String(m.vn).slice(0, 16) + '!'); return; }
    if (m.t != 'hit' || m.to !== MP().id() || P.x < SAFE || P.inv > 0 || over || god) return;
    const a = MP().peers.get(m.from), now = performance.now(); if (!a || a.tx < SAFE || Math.hypot(a.tx - P.x, a.ty - P.y) > 180) return;   // must really be nearby
    if (now - (lastHit.get(m.from) || 0) < 200) return; lastHit.set(m.from, now);
    const d = Math.min(+m.d || 0, 40 * (a.lv || 1) + 80); if (!(d > 0)) return;
    if (Math.random() < Math.min(.25, .01 * P.st.dex)) { P.inv = .3; pop('MISS', P.x, P.y - 40, '#9df'); return; }
    const r = Math.max(1, Math.round(d * (1 - mit(ARM[P.ai].a)))); P.hp -= r; P.inv = .35; sh = 6; pop('-' + r, P.x, P.y - 40, '#f55'); burst(P.x, P.y - 10, '#e44', 8); S.hurt();
    if (P.hp <= 0) { P.pd = (P.pd || 0) + 1; MP().send('pvp', { t: 'kill', by: m.from, vn: MP().name() }); P.hp = P.mhp; P.sp = P.msp; P.x = 90; P.y = A.h / 2; P.inv = 2.5; say('Defeated by ' + String(m.name).slice(0, 16) + '. Back to the lobby.'); }
  };
  const sk0 = skill; window.skill = n => { const s0 = P.sp; sk0(n); if (P.sp < s0) pvpStrike(n == 1 ? 64 : 100, n == 1 ? 2.5 : 1.8, n == 1); };

  /* ---- UI: 📊 button + C key ---- */
  const b = document.createElement('button'); b.id = 'bst'; b.className = 'round'; b.title = 'Stats (C)'; b.textContent = '📊'; $('binv').after(b);
  const st = document.createElement('style'); st.textContent = '#bst{position:relative}#bst.unread:after{content:"";position:absolute;top:3px;right:3px;width:10px;height:10px;border-radius:50%;background:#5f5;border:1px solid #000}'; document.head.append(st);
  b.onclick = () => { au(); toggleP('Stats', statPanel); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() == 'c' && !e.ctrlKey && !e.metaKey && !over) toggleP('Stats', statPanel); });
  const help = document.querySelector('.controls-help'); if (help) { const s = document.createElement('span'); s.innerHTML = '<kbd>C</kbd> Stats &nbsp; <kbd>G</kbd> Graphics'; help.append(s); }
  setInterval(() => { if (!P) return; ensure(); b.classList.toggle('unread', P.pts > 0); }, 500);
})();
