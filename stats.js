/* Emberfall: stat points (STR / DEX / HP), harder monsters, and the Wayfarer NPC who travels you back to reached areas.
   Loads after fx.js. Needs game.js with `let dmg` and `let NPCS` (included). */
(() => {
  const PTS = 3, VIT = 15, SPV = 5;
  const ensure = () => {
    if (!P) return;
    P.st = P.st || { str: 0, dex: 0, vit: 0 }; P.st.sp = P.st.sp || 0; P.st.luk = P.st.luk || 0;
    P.pts = Math.max(0, PTS * (P.lv - 1) - Object.values(P.st).reduce((a, v) => a + v, 0));   // always derived: 3 per level minus spent (old saves get theirs too)
    P.maxA = Math.max(P.maxA || 0, AI);
  };

  /* ---- stat effects ---- */
  const base = dmg, calc = () => { ensure(); return Math.max(1, Math.floor(base() * (1 + .04 * P.st.str) + 1.5 * P.st.str)); };
  dmg = () => { let d = calc(); if (Math.random() < .01 * (P.st.dex + P.st.luk)) { d = Math.floor(d * 1.8); pop('CRIT!', P.x, P.y - 54, '#ffd36a'); } return d; };
  const atk0 = attack; window.attack = () => { ensure(); const c0 = P.cd; atk0(); if (P.cd > c0) P.cd /= 1 + .03 * P.st.dex; };
  const hurt0 = hurt; window.hurt = d => { ensure(); if (P.x >= SAFE && Math.random() < Math.min(.25, .01 * P.st.dex)) { P.inv = .5; pop('MISS', P.x, P.y - 40, '#9df'); return; } hurt0(d); };
  const drp0 = drop; window.drop = e => { drp0(e); ensure(); const L = LOOT[e.type]; if (L && Math.random() < .02 * P.st.luk) { add(L); pop('+' + L + ' (luck)', e.x, e.y - 48, '#ffe36a'); } };
  const lvl0 = lvlcheck; window.lvlcheck = () => { const l0 = P.lv; lvl0(); ensure(); if (P.lv > l0) { say('+' + PTS * (P.lv - l0) + ' stat points! Press C or tap 📊'); } };
  const nw0 = newGame; window.newGame = () => { nw0(); P.st = { str: 0, dex: 0, vit: 0, sp: 0, luk: 0 }; ensure(); };
  const ld0 = loadArea; window.loadArea = i => { ld0(i); ensure(); };

  /* ---- harder monsters (scale with area) ---- */
  const mk0 = mk;
  window.mk = (ty, px, py) => { const e = mk0(ty, px, py), f = 1.4 + AI * .08; e.mh = e.hp = Math.round(e.mh * (e.boss ? 1.5 : f)); e.d *= 1.3 + AI * .06; e.sp *= 1.05; return e; };

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
  const n0 = NPCS; NPCS = () => [...n0(), { k: 'guide', n: 'Wayfarer', x: 270, y: A.h / 2 - 160 }];
  function travel() {
    ensure(); $('pb').innerHTML = ''; line('Wayfarer: I can take you back to any area you have reached.', 'txt');
    for (let i = 0; i <= P.maxA; i++) row(AREAS[i].n + (i == AI ? ' (here)' : ''), 'Travel', () => { closeP(); loadArea(i); say('Travelled to ' + AREAS[i].n); }, i == AI);
  }
  const talk0 = talk;
  window.talk = () => { if (over || ui) return talk0(); const g = NPCS().find(n => n.k == 'guide'); if (g && Math.hypot(g.x - P.x, g.y - P.y) < 70) { openP('Wayfarer', travel); return; } talk0(); };

  /* ---- UI: 📊 button + C key ---- */
  const b = document.createElement('button'); b.id = 'bst'; b.className = 'round'; b.title = 'Stats (C)'; b.textContent = '📊'; $('binv').after(b);
  const st = document.createElement('style'); st.textContent = '#bst{position:relative}#bst.unread:after{content:"";position:absolute;top:3px;right:3px;width:10px;height:10px;border-radius:50%;background:#5f5;border:1px solid #000}'; document.head.append(st);
  b.onclick = () => { au(); toggleP('Stats', statPanel); };
  addEventListener('keydown', e => { if (e.key.toLowerCase() == 'c' && !e.ctrlKey && !e.metaKey && !over) toggleP('Stats', statPanel); });
  const help = document.querySelector('.controls-help'); if (help) { const s = document.createElement('span'); s.innerHTML = '<kbd>C</kbd> Stats &nbsp; <kbd>G</kbd> Graphics'; help.append(s); }
  setInterval(() => { if (!P) return; ensure(); b.classList.toggle('unread', P.pts > 0); }, 500);
})();
