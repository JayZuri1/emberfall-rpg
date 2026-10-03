/* Emberfall: stat points (STR / DEX / HP), harder monsters, and the Wayfarer NPC who travels you back to reached areas.
   Loads after fx.js. Needs game.js with `let dmg` and `let NPCS` (included). */
(() => {
  const PTS = 3, VIT = 15, SPV = 5;
  let god = false, oneHit = false, arena = false, stash = null;
  const CLS = {
    sword: { n: 'Swordsman', job: 'Swordsman', icon: '⚔', hp: 1, sp: 1, dm: 1, lh: 0, ls: 0, cost: [8, 15], skills: ['Bash', 'Magnum Break'], lab: [['⚔', 'Bash'], ['🔥', 'Magnum']], role: 'Balanced melee fighter', wp: 'Swords', perk: 'Strong all-rounder. No weaknesses.' },
    archer: { n: 'Archer', job: 'Archer', icon: '🏹', hp: .9, sp: 1.2, dm: 1, lh: 0, ls: 1, cost: [8, 18], skills: ['Double Strafe', 'Arrow Rain'], lab: [['🏹', 'Strafe'], ['🌧', 'Rain']], role: 'Ranged damage dealer', wp: 'Bows', perk: 'Fast arrows with aim assist, +8% dodge, +5% crit. Lower HP.' },
    tank: { n: 'Tank', job: 'Knight', icon: '🛡', hp: 1.35, sp: .8, dm: .85, lh: 6, ls: 0, cost: [8, 15], skills: ['Shield Bash (stun)', 'Fortify (-65% damage, 5s)'], lab: [['🛡', 'S.Bash'], ['🏰', 'Fortify']], role: 'Frontline defender', wp: 'Maces and Hammers', perk: '+35% HP, -15% damage taken. Lower damage.' },
    mage: { n: 'Mage', job: 'Mage', icon: '🔮', hp: .8, sp: 1.8, dm: 1.1, lh: 0, ls: 3, cost: [10, 20], skills: ['Fire Bolt', 'Frost Nova (freeze)'], lab: [['🔥', 'Firebolt'], ['❄', 'Nova']], role: 'Ranged spell caster', wp: 'Staves', perk: '+80% SP and SP regen, strong spells. Fragile.' } };
  const cls = () => P.cls || 'sword', dmx = () => CLS[cls()].dm, tkf = () => (P.cls === 'tank' ? .85 : 1) * (P.fort > 0 ? .35 : 1);
  const dodge = () => Math.min(.25, .01 * P.st.dex + (P.cls === 'archer' ? .08 : 0));   // admin test toggles
  const ensure = () => {
    if (!P) return;
    P.st = P.st || { str: 0, dex: 0, vit: 0 }; P.st.sp = P.st.sp || 0; P.st.luk = P.st.luk || 0;
    P.pts = Math.max(0, PTS * (P.lv - 1) + (P.bonus || 0) - Object.values(P.st).reduce((a, v) => a + v, 0));   // always derived: 3 per level minus spent (old saves get theirs too)
    P.maxA = Math.max(P.maxA || 0, AI);
  };

  /* ---- stat effects ---- */
  const base = dmg, calc = () => { ensure(); return Math.max(1, Math.floor(base() * dmx() * (1 + .04 * P.st.str) + 1.5 * P.st.str)); };
  dmg = () => { let d = oneHit ? 99999 : calc(); if (Math.random() < .01 * (P.st.dex + P.st.luk) + (P.cls === 'archer' ? .05 : 0)) { d = Math.floor(d * 1.8); pop('CRIT!', P.x, P.y - 54, '#ffd36a'); } return d; };
  const atk0 = attack; window.attack = () => { ensure(); const c = cls(); if (c == 'archer' || c == 'mage') return shoot(c); const c0 = P.cd; atk0(); if (P.cd > c0) { P.cd *= (c == 'tank' ? 1.15 : 1) / (1 + .03 * P.st.dex); pvpStrike(58, 1, true); } };
  const REC = [1, 7, 14, 21, 28], MUL = [2.6, 3.4, 4.4, 5.6, 7], mit = a => a / (a + 50);   // recommended level per area, base damage multiplier per area
  const hurt0 = hurt;
  window.hurt = d => {
    ensure(); if (!d || P.x < SAFE || god) return;
    if (Math.random() < dodge()) { P.inv = .5; pop('MISS', P.x, P.y - 40, '#9df'); return; }
    const gap = REC[AI] - P.lv, f = MUL[AI] * (gap > 0 ? Math.min(3.5, 1 + .18 * gap) : 1) * tkf(), a = ARM[P.ai].a;      // under-level: up to 3.5x more damage
    hurt0(Math.max(1, Math.round(d * f * (1 - mit(a)))) + a);                                                      // game subtracts `a`, leaving our value
  };
  const drp0 = drop; window.drop = e => { drp0(e); ensure(); const L = LOOT[e.type]; if (L && Math.random() < .02 * P.st.luk) { add(L); pop('+' + L + ' (luck)', e.x, e.y - 48, '#ffe36a'); } };
  const lvl0 = lvlcheck; window.lvlcheck = () => { const l0 = P.lv, j0 = P.job; lvl0(); ensure(); jobFix(j0, l0); if (P.lv > l0) { say('+' + PTS * (P.lv - l0) + ' stat points! Press C or tap 📊'); } };
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
    for (const i of CW[cls()].base) wRow(i); for (let i = 0; i < 5; i++) aRow(i);
    row('Red Potion (HP 60) · have ' + (P.bag['Red Potion'] || 0), '20z', () => buy(20, () => add('Red Potion')), P.g < 20);
    row('Blue Potion (SP 30) · have ' + (P.bag['Blue Potion'] || 0), '30z', () => buy(30, () => add('Blue Potion')), P.g < 30);
    const n = Object.values(LOOT).reduce((a, k) => a + (P.bag[k] || 0), 0);
    row('Sell all loot (' + n + ' items)', '+' + n * 10 + 'z', () => { Object.values(LOOT).forEach(k => P.bag[k] = 0); P.g += n * 10; S.coin(); cur(); }, !n);
  };
  const FLAV = { 1: 'Sylva: Wolves ignore cheap steel. Buy better, hunter.', 2: 'Khalid: Desert-tempered gear. The sun forgives no one.', 3: 'Bjorn: Frostforged. Only for the hardy.', 4: 'Ignis: Forged in dragon fire. Are you ready?' };
  function gearShop() { $('pb').innerHTML = ''; line('Zeny: ' + P.g + 'z · Your Lv ' + P.lv, 'gold'); line(FLAV[AI], 'txt'); WEAP.forEach((w, i) => w.area == AI && (w.cls || 'sword') == cls() && wRow(i)); ARM.forEach((a, i) => a.area == AI && aRow(i)); }


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
    R('Reset class (test: shows picker again)', 'Reset', () => { delete P.cls; closeP(); });
    R('Unlock all weapons (your class) and armor', 'Unlock', () => { WEAP.forEach((w, i) => { if ((w.cls || 'sword') == cls()) P.ow[i] = 1; }); ARM.forEach((_, i) => P.oa[i] = 1); });
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
  function pvpStrike(R, M, front, o = {}) {                           // attacker side: find peers in range, tell them
    if (!arena || P.x < SAFE || !MP() || !MP().id()) return;
    const ox = o.ox ?? P.x, oy = o.oy ?? P.y, fdx = o.dx ?? P.fx, fdy = o.dy ?? P.fy, now = performance.now();
    const list = [...MP().peers].map(([id, p]) => [id, p, Math.hypot(p.tx - ox, p.ty - oy)]).filter(([, p, d]) => {
      if (d > R || p.tx < SAFE || now - p.seen > 3000) return false;
      const rx = p.tx - ox, ry = p.ty - oy;
      return o.beam ? rx * fdx + ry * fdy > 0 && Math.abs(rx * fdy - ry * fdx) <= 30 : !front || rx * fdx + ry * fdy >= -8;
    }).sort((a, b) => a[2] - b[2]);
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
    const a = MP().peers.get(m.from), now = performance.now(); if (!a || a.tx < SAFE || Math.hypot(a.tx - P.x, a.ty - P.y) > 340) return;   // must really be nearby
    if (now - (lastHit.get(m.from) || 0) < 200) return; lastHit.set(m.from, now);
    const d = Math.min(+m.d || 0, 40 * (a.lv || 1) + 80); if (!(d > 0)) return;
    if (Math.random() < dodge()) { P.inv = .3; pop('MISS', P.x, P.y - 40, '#9df'); return; }
    const r = Math.max(1, Math.round(d * tkf() * (1 - mit(ARM[P.ai].a)))); P.hp -= r; P.inv = .35; sh = 6; pop('-' + r, P.x, P.y - 40, '#f55'); burst(P.x, P.y - 10, '#e44', 8); S.hurt();
    if (P.hp <= 0) { P.pd = (P.pd || 0) + 1; MP().send('pvp', { t: 'kill', by: m.from, vn: MP().name() }); P.hp = P.mhp; P.sp = P.msp; P.x = 90; P.y = A.h / 2; P.inv = 2.5; say('Defeated by ' + String(m.name).slice(0, 16) + '. Back to the lobby.'); }
  };
  const sk0 = skill; window.skill = n => { if (cls() != 'sword') return classSkill(cls(), n); const s0 = P.sp; sk0(n); if (P.sp < s0) pvpStrike(n == 1 ? 64 : 100, n == 1 ? 2.5 : 1.8, n == 1); };


  /* ---- CLASSES: Swordsman / Archer / Tank / Mage (chosen once, permanent) ---- */
  const CW = { sword: { base: [0, 1, 2, 3, 4] } };
  const WN = {
    archer: [['Short Bow', 'Hunter Bow', 'Composite Bow', 'Elven Bow', 'Rune Bow'], ['Ranger Longbow', 'Wolfbane Bow', 'Dune Recurve', 'Sun Bow', 'Frost Bow', 'Glacier Bow', 'Magma Bow', 'Dragonbone Bow']],
    tank: [['Wooden Club', 'Iron Mace', 'Steel Hammer', 'Flame Maul', 'Rune Warhammer'], ['Hunter Maul', 'Wolfcrusher', 'Dune Hammer', 'Sunforged Maul', 'Frostbreaker', 'Glacier Hammer', 'Magma Maul', 'Dragonbone Hammer']],
    mage: [['Wooden Rod', 'Oak Staff', 'Crystal Staff', 'Flame Staff', 'Rune Staff'], ['Ranger Wand', 'Wolfspirit Staff', 'Dune Staff', 'Sun Staff', 'Frost Staff', 'Glacier Staff', 'Magma Staff', 'Dragonbone Staff']] };
  const WM = { archer: .95, tank: .8, mage: 1.05 }, SW = WEAP.length;           // SW = number of sword-line weapons (5 base + 8 area)
  Object.keys(WN).forEach(c => {
    CW[c] = { base: [] };
    for (let i = 0; i < SW; i++) { const src = WEAP[i], base = i < 5; if (base) CW[c].base.push(WEAP.length);
      WEAP.push({ n: WN[c][base ? 0 : 1][base ? i : i - 5], d: Math.round(src.d * WM[c]), p: src.p, c: src.c, lv: src.lv, area: src.area, cls: c }); }
  });
  function setClass(c) {
    const m = CLS[c]; P.cls = c; P.mhp = Math.round(P.mhp * m.hp); P.msp = Math.round(P.msp * m.sp); P.hp = P.mhp; P.sp = P.msp;
    const w = CW[c].base[0]; P.ow[w] = 1; P.wi = w; if (P.job != 'Novice') P.job = m.job;
    say('You are now a ' + m.n + '!');
  }
  function jobFix(j0, l0) {                                           // class job name at Lv 5 + per-level class growth
    const m = CLS[cls()];
    if (j0 == 'Novice' && P.job == 'Swordsman' && cls() != 'sword') { P.job = m.job; setTimeout(() => say('Job change! ' + m.job + ' skills: ' + m.skills.join(', ')), 1800); }
    if (P.lv > l0) { P.mhp += m.lh * (P.lv - l0); P.msp += m.ls * (P.lv - l0); }
  }

  /* picker overlay (shown after login until a class is chosen) */
  const pcss = document.createElement('style'); pcss.textContent = `
  #clsPick{position:absolute;inset:0;z-index:40;display:none;place-items:center;background:radial-gradient(circle at 50% 30%,#1b1c25,#06070a);padding:10px;overflow:auto}
  #clsPick .pk{width:min(640px,100%);display:flex;flex-direction:column;gap:8px;text-align:center}
  #clsPick h2{margin:0;font:700 22px Georgia,serif;letter-spacing:3px;color:var(--gold2)}#clsPick p{margin:0;font-size:12px;color:#f88}
  .pkg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .pkc{background:#11161e;border:2px solid #343b49;border-radius:9px;padding:9px;text-align:left;cursor:pointer;color:var(--text);font-size:11px;line-height:1.35}
  .pkc.on{border-color:var(--gold);background:#2a2214;box-shadow:0 0 14px #f2c35b44}.pkc b{display:block;font-size:14px;color:var(--gold)}.pkc i{font-size:26px;font-style:normal;float:right}.pkc u{text-decoration:none;color:#9fd}
  #pkgo{padding:12px;font-weight:700;border-radius:7px;background:#6e4c20;border:1px solid var(--gold);color:#ffe4a0;font-size:14px}#pkgo:disabled{opacity:.4}
  @media (max-height:420px){#clsPick h2{font-size:16px}.pkg{grid-template-columns:repeat(4,1fr)}.pkc{font-size:9px;padding:6px}.pkc i{font-size:18px}}`;
  document.head.append(pcss);
  const pk = document.createElement('div'); pk.id = 'clsPick';
  pk.innerHTML = '<div class="pk"><h2>CHOOSE YOUR CLASS</h2><p>This choice is permanent and cannot be changed.</p><div class="pkg">' +
    Object.entries(CLS).map(([k, m]) => `<div class="pkc" data-c="${k}"><i>${m.icon}</i><b>${m.n}</b>${m.role}<br><u>Weapons:</u> ${m.wp}<br><u>Skills:</u> ${m.skills.join(', ')}<br>${m.perk}</div>`).join('') +
    '</div><button id="pkgo" disabled>Confirm class</button></div>';
  $('wrap').append(pk);
  let picked = null;
  pk.querySelectorAll('.pkc').forEach(c => c.onclick = () => { picked = c.dataset.c; pk.querySelectorAll('.pkc').forEach(o => o.classList.toggle('on', o == c)); $('pkgo').disabled = false; $('pkgo').textContent = 'Confirm: ' + CLS[picked].n; });
  $('pkgo').onclick = () => { if (!picked || P.cls) return; setClass(picked); picked = null; pk.style.display = 'none'; ui = false; };
  setInterval(() => {
    if (!P) return;
    const need = $('auth').hidden && !P.cls;
    if (need) { pk.style.display = 'grid'; ui = true; } else if (pk.style.display != 'none') pk.style.display = 'none';
    const m = CLS[cls()];                                              // skill button labels follow the class
    [['bsh', 0], ['bmb', 1]].forEach(([id, i]) => { const b = $(id), sp = b.querySelector('span'), sm = b.querySelector('small'); if (sp.textContent != m.lab[i][0]) { sp.textContent = m.lab[i][0]; sm.textContent = m.lab[i][1]; } });
    const h = document.querySelector('.controls-help span:nth-child(4)'); if (h && !h.dataset.c) { h.dataset.c = 1; h.innerHTML = '<kbd>1</kbd> ' + m.lab[0][1] + ' &nbsp; <kbd>2</kbd> ' + m.lab[1][1]; }
  }, 400);

  /* ranged attacks, class skills, stun, projectiles */
  const PR = [];
  function aim(range) {                                               // aim assist: nearest enemy (or arena peer) within range, else facing
    let dx = P.fx, dy = P.fy, best = range, found = null;
    const c = E.map(e => [e.x, e.y]); if (arena && MP()) for (const p of MP().peers.values()) if (p.tx >= SAFE && performance.now() - p.seen < 3000) c.push([p.tx, p.ty]);
    for (const [ex, ey] of c) { const d = Math.hypot(ex - P.x, ey - P.y); if (d > 1 && d < best) { best = d; dx = (ex - P.x) / d; dy = (ey - P.y) / d; found = d; } }
    return [dx, dy, found];
  }
  function shoot(c) {
    if (over || ui || P.cd > 0) return;
    P.cd = (c == 'mage' ? .55 : .32) / (1 + .03 * P.st.dex); P.sw = .18; S.swing();
    const [dx, dy] = aim(300), sp = c == 'mage' ? 330 : 470;
    PR.push({ k: c == 'mage' ? 'bolt' : 'arrow', x: P.x, y: P.y - 14, vx: dx * sp, vy: dy * sp, l: .75, M: 1, col: c == 'mage' ? '#8bf' : '#ffe9a8', kb: 10, sp: c == 'mage' ? 36 : 0 });
    pvpStrike(300, 1, true, { beam: 1, dx, dy });
  }
  function hitMob(e, p, M) {
    const dm = Math.round(dmg() * (M ?? p.M)); e.hp -= dm; e.fl = .12;
    if (!e.boss) { const d = Math.hypot(e.x - P.x, e.y - P.y) || 1; e.x += (e.x - P.x) / d * (p.kb || 10); e.y += (e.y - P.y) / d * (p.kb || 10); }
    if (p.st) e.stun = Math.max(e.stun || 0, e.boss ? p.st * .4 : p.st);
    pop(dm, e.x, e.y - 24, p.col || '#fff'); burst(e.x, e.y - 10, p.col || '#fff', 6); S.hit(); if (e.hp <= 0) kill(e);
  }
  function classSkill(c, n) {
    if (over || ui || P.cd > 0) return;
    if (P.job == 'Novice') { say('Reach Lv 5 to unlock your class skills'); return; }
    const cost = CLS[c].cost[n - 1]; if (P.sp < cost) { say('Not enough SP'); return; }
    P.sp -= cost; P.cd = .5 / (1 + .03 * P.st.dex); P.sw = .25; S.swing();
    const dist = e => Math.hypot(e.x - P.x, e.y - P.y), front = e => (e.x - P.x) * P.fx + (e.y - P.y) * P.fy >= -8;
    if (c == 'archer') {
      if (n == 1) { const [dx, dy] = aim(320); for (let k = 0; k < 2; k++) PR.push({ k: 'arrow', x: P.x - dx * k * 16, y: P.y - 14 - dy * k * 16, vx: dx * 520, vy: dy * 520, l: .7, M: 1.3, col: '#fd5', kb: 14 }); pvpStrike(320, 2.2, true, { beam: 1, dx, dy }); }
      else { const [dx, dy, f] = aim(260), cx = P.x + dx * (f || 140), cy = P.y + dy * (f || 140);
        for (let i = 0; i < 28; i++) Q.push({ x: cx + rnd(-85, 85), y: cy + rnd(-85, 85) - 50, vx: 0, vy: 260, l: .3, col: '#ffe08a' });
        for (const e of [...E]) if (Math.hypot(e.x - cx, e.y - cy) < 85 + e.r) hitMob(e, { M: 1.6, col: '#fd5', kb: 8 });
        pvpStrike(85, 1.6, false, { ox: cx, oy: cy }); }
    } else if (c == 'tank') {
      if (n == 1) { const t = [...E].filter(e => dist(e) < 64 + e.r && front(e)).sort((a, b) => dist(a) - dist(b))[0]; if (t) hitMob(t, { M: 1.6, st: 1.2, kb: 40, col: '#9df' }); pvpStrike(64, 1.6, true); }
      else { P.fort = 5; P.hp = Math.min(P.mhp, P.hp + Math.round(P.mhp * .1)); say('Fortify! -65% damage taken for 5s'); burst(P.x, P.y - 10, '#6cf', 20); }
    } else if (c == 'mage') {
      if (n == 1) { const [dx, dy] = aim(340); PR.push({ k: 'bolt', x: P.x, y: P.y - 14, vx: dx * 380, vy: dy * 380, l: .9, M: 2.4, col: '#f84', kb: 25, sp: 48 }); pvpStrike(340, 2.4, true, { beam: 1, dx, dy }); S.fire(); }
      else { for (let i = 0; i < 28; i++) { const a = i / 28 * 6.28; Q.push({ x: P.x + Math.cos(a) * 20, y: P.y - 10 + Math.sin(a) * 12, vx: Math.cos(a) * 150, vy: Math.sin(a) * 90, l: .5, col: '#8df' }); }
        for (const e of [...E]) if (dist(e) < 120 + e.r) hitMob(e, { M: 1.5, st: 1.5, kb: 30, col: '#8df' });
        pvpStrike(120, 1.5, false); }
    }
  }
  const upd0 = update;
  window.update = dt => {
    for (const e of E) if (e.stun > 0) { if (!e.o) e.o = [e.sp, e.d]; e.sp = 0; e.d = 0; e.stun -= dt; if (e.dragon) e.bt += dt; if (e.stun <= 0) { e.sp = e.o[0]; e.d = e.o[1]; e.o = null; } }
    upd0(dt);
    if (P.fort > 0) P.fort -= dt;
    if (P.cls == 'mage' && P.sp < P.msp && !over) P.sp = Math.min(P.msp, P.sp + 1.2 * dt);
    for (let i = PR.length - 1; i >= 0; i--) {
      const p = PR[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; let dead = p.l <= 0 || p.x < 0 || p.y < 0 || p.x > A.w || p.y > A.h;
      if (!dead) for (const e of E) if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 10) { hitMob(e, p); if (p.sp) for (const o of [...E]) if (o !== e && Math.hypot(o.x - p.x, o.y - p.y) < p.sp) hitMob(o, p, p.M * .5); dead = true; break; }
      if (dead) PR.splice(i, 1);
    }
  };
  const mm0 = minimap;
  window.minimap = () => {
    try {
      const cx = cl(P.x - W / 2, 0, A.w - W), cy = cl(P.y - H / 2, 0, A.h - H); x.save(); x.globalCompositeOperation = 'lighter';
      if (P.fort > 0) { x.strokeStyle = `rgba(110,200,255,${.5 + .3 * Math.sin(t * 8)})`; x.lineWidth = 3; x.beginPath(); x.ellipse(P.x - cx, P.y - cy - 12, 24, 30, 0, 0, 7); x.stroke(); }
      for (const p of PR) { const sx = p.x - cx, sy = p.y - cy;
        if (p.k == 'arrow') { const a = Math.atan2(p.vy, p.vx); x.strokeStyle = p.col; x.lineWidth = 2.5; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx - Math.cos(a) * 16, sy - Math.sin(a) * 16); x.lineTo(sx, sy); x.stroke(); }
        else { const g = x.createRadialGradient(sx, sy, 1, sx, sy, 13); g.addColorStop(0, '#fff'); g.addColorStop(.4, p.col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(sx, sy, 13, 0, 7); x.fill(); } }
      x.restore();
    } catch (e) { try { x.restore(); } catch (e2) {} }
    mm0();
  };

  /* ---- UI: 📊 button + C key ---- */
  const b = document.createElement('button'); b.id = 'bst'; b.className = 'round'; b.title = 'Stats (C)'; b.textContent = '📊'; $('binv').after(b);
  const st = document.createElement('style'); st.textContent = '#bst{position:relative}#bst.unread:after{content:"";position:absolute;top:3px;right:3px;width:10px;height:10px;border-radius:50%;background:#5f5;border:1px solid #000}'; document.head.append(st);
  b.onclick = () => { au(); toggleP('Stats', statPanel); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() == 'c' && !e.ctrlKey && !e.metaKey && !over) toggleP('Stats', statPanel); });
  const help = document.querySelector('.controls-help'); if (help) { const s = document.createElement('span'); s.innerHTML = '<kbd>C</kbd> Stats &nbsp; <kbd>G</kbd> Graphics'; help.append(s); }
  setInterval(() => { if (!P) return; ensure(); b.classList.toggle('unread', P.pts > 0); }, 500);
})();
