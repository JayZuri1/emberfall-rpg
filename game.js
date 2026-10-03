/* ===== EMBERFALL RPG =====
   Loop: kill monsters -> level up -> buy gear -> finish all quests -> gate opens -> beat the boss -> portal to next area */
const c=document.getElementById('c'),x=c.getContext('2d');let W=640,H=400;
function resize(){const a=innerWidth/innerHeight;H=a>=1?400:Math.min(700,Math.round(480/a));W=Math.round(H*a);c.width=W;c.height=H;x.imageSmoothingEnabled=false}
if(matchMedia('(pointer:coarse)').matches||'ontouchstart' in window||navigator.maxTouchPoints>0||innerWidth<900||location.search.includes('touch'))document.body.classList.add('touch');
if(matchMedia('(pointer:coarse)').matches||'ontouchstart' in window)document.body.classList.add('touch');
const $=id=>document.getElementById(id);
const rnd=(a,b)=>a+Math.random()*(b-a),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
let K={},ptr=null,last=performance.now(),t=0,sh=0,over=3,ot=0,ui=false,msg='',mt=0;
let P,A,AI=0,E=[],D=[],T=[],Q=[],B=[],portal=null,spawnT=0,pat,cur;

/* ---------- SOUND (synthesized) ---------- */
let AC,mute=0;
function au(){if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();if(AC.state=='suspended')AC.resume()}
function tone(f,f2,d,ty='square',v=.1,dl=0){if(mute||!AC)return;const s=AC.currentTime+dl,o=AC.createOscillator(),g=AC.createGain();
o.type=ty;o.frequency.setValueAtTime(f,s);o.frequency.exponentialRampToValueAtTime(f2,s+d);
g.gain.setValueAtTime(v,s);g.gain.exponentialRampToValueAtTime(.001,s+d);o.connect(g).connect(AC.destination);o.start(s);o.stop(s+d)}
function noise(d,v=.1){if(mute||!AC)return;const n=AC.sampleRate*d|0,b=AC.createBuffer(1,n,AC.sampleRate),a=b.getChannelData(0);
for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);const s=AC.createBufferSource(),g=AC.createGain();g.gain.value=v;s.buffer=b;s.connect(g).connect(AC.destination);s.start()}
const arp=(fs,ty,v,gap,len)=>fs.forEach((f,i)=>tone(f,f,len,ty,v,i*gap));
const S={swing:()=>{noise(.12,.07);tone(500,180,.1,'sawtooth',.04)},hit:()=>{tone(220,70,.12,'square',.1);noise(.06,.09)},
hurt:()=>tone(160,50,.25,'sawtooth',.14),coin:()=>{tone(880,880,.07,'square',.07);tone(1320,1320,.12,'square',.07,.07)},
lvl:()=>arp([523,659,784,1047],'square',.09,.09,.15),heal:()=>tone(400,900,.25,'sine',.15),
fire:()=>{noise(.25,.1);tone(300,100,.25,'sawtooth',.06)},boss:()=>{tone(70,40,1.2,'sawtooth',.2);tone(90,45,1.2,'square',.08)},
win:()=>arp([523,659,784,1047,1319],'triangle',.15,.12,.25),lose:()=>arp([392,330,262,196],'sawtooth',.1,.2,.3)};
function toggleMute(){mute^=1;$('mu').textContent=mute?'🔇':'🔊'}
function toggleFS(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()}

/* ---------- PIXEL ART ---------- */
function spr(rows,pal,s){const cv=document.createElement('canvas');cv.width=rows[0].length*s;cv.height=rows.length*s;const g=cv.getContext('2d');
rows.forEach((r,j)=>[...r].forEach((ch,i)=>{if(pal[ch]){g.fillStyle=pal[ch];g.fillRect(i*s,j*s,s,s)}}));return cv}
const PM=["..hhhh..",".hhhhhh.",".hseesh.","..ssss..",".bbbbbb.","sbbyybbs","s.bbbb.s","..bbbb..","..llll..",".ll..ll."];
const SL=["...gggg...","..gggggg..",".ggwkggwkg",".gggggggg.","gggggggggg","dddddddddd"];
const GB=[".gggggg.","ggkggkgg","gggggggg",".gwggwg.","..rrrr..",".rrrrrr.","g.rrrr.g","..rrrr..","..b..b.."];
const WF=["..g.......",".ggg.....g","ggkggggggg","gggggggggg",".g.g..g.g.",".g.g..g.g."];
const skin={h:'#5a3418',s:'#f1c27d',e:'#222',y:'#f5c542',l:'#4a3a2a'};
const PL=['#3a7bd5','#8a5a2b','#8e9aa6','#d9dde3','#f5c542'].map(b=>spr(PM,{...skin,b},3)); // player look changes with armor
const NP={merchant:spr(PM,{h:'#7a4a1a',s:'#e0b080',e:'#222',b:'#a33',y:'#fc3',l:'#432'},3),
healer:spr(PM,{h:'#eee',s:'#f1c27d',e:'#222',b:'#2fa88a',y:'#fff',l:'#355'},3),
elder:spr(PM,{h:'#cfcfcf',s:'#e8c9a0',e:'#222',b:'#6a5a8a',y:'#ccc',l:'#444'},3),
smith:spr(PM,{h:'#222',s:'#d9a066',e:'#222',b:'#555',y:'#f93',l:'#333'},3),
hunter:spr(PM,{h:'#7a3a1a',s:'#f1c27d',e:'#222',b:'#3a7a3a',y:'#ccb',l:'#4a3a2a'},3)};
const MOB={
slime:{n:'Poring',hp:20,sp:42,d:5,xp:9,g:[5,10],r:12,img:spr(SL,{g:'#ff9ec7',d:'#d96a98',w:'#fff',k:'#111'},3)},
goblin:{n:'Goblin',hp:40,sp:62,d:8,xp:16,g:[8,14],r:14,img:spr(GB,{g:'#7fb83a',k:'#111',w:'#fff',r:'#8a4b2a',b:'#4a3a2a'},3)},
wolf:{n:'Wolf',hp:60,sp:95,d:11,xp:24,g:[12,20],r:14,img:spr(WF,{g:'#8d8d94',k:'#f44'},3)},
skel:{n:'Skeleton',hp:85,sp:60,d:14,xp:32,g:[16,26],r:14,img:spr(GB,{g:'#e8e8e0',k:'#111',w:'#555',r:'#bbb',b:'#999'},3)},
imp:{n:'Imp',hp:120,sp:78,d:18,xp:44,g:[22,34],r:14,img:spr(GB,{g:'#d94a3a',k:'#ffe',w:'#fc3',r:'#7a1f1f',b:'#411'},3)},
king:{boss:1,n:'Slime King',hp:220,sp:45,d:10,xp:90,g:[80,80],r:34,img:spr(SL,{g:'#9b5de5',d:'#6a3aa8',w:'#fff',k:'#111'},7)},
chief:{boss:1,n:'Orc Chief',hp:480,sp:60,d:17,xp:180,g:[150,150],r:30,img:spr(GB,{g:'#4d7a2a',k:'#f33',w:'#fff',r:'#5a2a1a',b:'#222'},6)},
dragon:{boss:1,dragon:1,n:'Ember Dragon',hp:950,sp:50,d:24,xp:0,g:[300,300],r:30}};
MOB.scorp={n:'Scorpion',hp:140,sp:80,d:22,xp:52,g:[26,40],r:14,img:spr(WF,{g:'#d9a441',k:'#a00'},3)};
MOB.mummy={n:'Mummy',hp:170,sp:55,d:26,xp:60,g:[30,46],r:14,img:spr(GB,{g:'#d8cfa8',k:'#111',w:'#7a6a3a',r:'#e8e0c0',b:'#a89868'},3)};
MOB.frost={n:'Frost Wolf',hp:210,sp:100,d:30,xp:72,g:[36,54],r:14,img:spr(WF,{g:'#bfe6ff',k:'#06c'},3)};
MOB.yeti={n:'Yeti',hp:260,sp:58,d:34,xp:85,g:[42,62],r:15,img:spr(GB,{g:'#f2f8ff',k:'#06c',w:'#9cf',r:'#cde',b:'#89a'},3)};
MOB.osiris={boss:1,n:'Osiris',hp:700,sp:62,d:28,xp:260,g:[220,220],r:30,img:spr(GB,{g:'#c9b26a',k:'#f33',w:'#fff',r:'#3a8a8a',b:'#222'},6)};
MOB.titan={boss:1,n:'Ice Titan',hp:1100,sp:55,d:36,xp:360,g:[320,320],r:34,img:spr(GB,{g:'#8fd0ff',k:'#fff',w:'#036',r:'#2a6a9a',b:'#123'},7)};
MOB.mush={n:'Spore',hp:32,sp:36,d:6,xp:12,g:[6,11],r:12,img:spr(SL,{g:'#e0503a',d:'#a02a1a',w:'#fff',k:'#111'},3)};
MOB.bee={n:'Hornet',hp:26,sp:92,d:7,xp:13,g:[7,12],r:11,img:spr(GB,{g:'#f2c53a',k:'#222',w:'#fff',r:'#d89a1a',b:'#555'},2)};
MOB.snake={n:'Viper',hp:72,sp:86,d:12,xp:27,g:[13,21],r:13,img:spr(WF,{g:'#4aa04a',k:'#f33'},3)};
MOB.zombie={n:'Zombie',hp:115,sp:44,d:15,xp:34,g:[17,27],r:14,img:spr(GB,{g:'#7f9a7a',k:'#300',w:'#9a9',r:'#4a5a4a',b:'#333'},3)};
MOB.cactus={n:'Cactus',hp:130,sp:38,d:21,xp:54,g:[27,42],r:14,img:spr(SL,{g:'#4aa04a',d:'#2a6a2a',w:'#ff9',k:'#111'},3)};
MOB.pengu={n:'Penguin',hp:200,sp:70,d:29,xp:70,g:[34,52],r:13,img:spr(SL,{g:'#2a4a7a',d:'#e8f0ff',w:'#fff',k:'#111'},3)};
MOB.ghost={n:'Ghost',hp:160,sp:72,d:30,xp:78,g:[40,58],r:14,img:spr(GB,{g:'#cfd8ff',k:'#003',w:'#88f',r:'#aab4ee',b:'#889'},3)};
MOB.lava={n:'Magma Slime',hp:230,sp:48,d:37,xp:90,g:[46,66],r:13,img:spr(SL,{g:'#ff6a1a',d:'#a02a00',w:'#ffe',k:'#300'},3)};
MOB.dragon.hp=1600;MOB.dragon.d=40;MOB.dragon.xp=500;
const LOOT={slime:'Jellopy',goblin:'Goblin Ear',wolf:'Wolf Fang',skel:'Bone Piece',imp:'Imp Tail',scorp:'Scorpion Tail',mummy:'Rotten Bandage',frost:'Ice Shard',yeti:'Yeti Fur',mush:'Mushroom Spore',bee:'Honey',snake:'Snake Scale',zombie:'Zombie Finger',cactus:'Cactus Needle',pengu:'Penguin Feather',ghost:'Ectoplasm',lava:'Magma Core'};
const AREAS=[
{n:'Prontera Field',w:2000,h:700,mobs:['slime','goblin','mush','bee'],boss:'king',g:['#3b7d3a','#33702f','#459044'],tc:['#1b4d20','#2a6b2d','#3f8f3f']},
{n:'Payon Forest',w:2300,h:760,mobs:['goblin','wolf','snake','skel','zombie'],boss:'chief',g:['#24402a','#1d3523','#2c4d33'],tc:['#0f2a18','#173d22','#215a31']},
{n:'Sograt Desert',w:2400,h:780,mobs:['scorp','mummy','cactus','wolf'],boss:'osiris',g:['#d9b96a','#c9a85a','#e6c97e'],tc:['#2a5a1a','#3a7a2a','#5aa03a']},
{n:'Glacier Peak',w:2500,h:800,mobs:['frost','yeti','pengu','skel'],boss:'titan',g:['#dcecf5','#c8dcea','#eef7fb'],tc:['#5f87a4','#86b0cc','#cfe8f5']},
{n:'Ember Caverns',w:2700,h:820,mobs:['skel','imp','ghost','lava','mummy'],boss:'dragon',g:['#4a3a3a','#3d2f2f','#5a4747'],rock:1}];
const WEAP=[{n:'Wooden Sword',d:0,p:0,c:'#ddd'},{n:'Iron Sword',d:6,p:40,c:'#cfd8dc'},{n:'Steel Sword',d:14,p:120,c:'#80d8ff'},{n:'Flame Blade',d:26,p:300,c:'#ff8a3d'},{n:'Rune Blade',d:42,p:700,c:'#d58aff'}];
const ARM=[{n:'Cloth Tunic',a:0,p:0},{n:'Leather Armor',a:2,p:35},{n:'Chain Mail',a:5,p:110},{n:'Plate Armor',a:10,p:280},{n:'Rune Mail',a:16,p:650}];

/* ---------- SETUP ---------- */
function newGame(){P={x:0,y:0,hp:115,mhp:115,sp:30,msp:30,xp:0,lv:1,g:0,wi:0,ai:0,ow:[1,0,0,0,0],oa:[1,0,0,0,0],ref:0,card:0,job:'Novice',bag:{'Red Potion':3,'Blue Potion':1},cd:0,sw:0,inv:0,fx:1,fy:0,mv:0};loadArea(0);over=0}
const prog=q=>q.type=='kill'?q.c:(P.bag[LOOT[q.mob]]||0);
const qt=q=>q.type=='kill'?'Hunt '+MOB[q.mob].n+'s':'Bring '+LOOT[q.mob];
function genQuests(){const m=A.mobs,s=AI+1,g=i=>m[i%m.length],q2=(npc,type,i,n)=>({npc,type,mob:g(i),n:Math.ceil(n*1.25),c:0,st:0,z:n*8*s+30,xp:n*7*s});
return[q2('elder','kill',0,8),q2('elder','collect',1,5),q2('elder','kill',2,6),q2('hunter','kill',3,6),q2('hunter','collect',2,5),q2('hunter','collect',0,8)]}
const qDone=()=>A.qs.filter(q=>q.st==2).length;
function checkGate(){if(!A.open&&qDone()==A.qs.length){A.open=1;E.push(mk(A.boss,A.w-170,A.h/2));say('All quests complete! The boss gate is open.');S.boss()}}
function loadArea(i){AI=i;A=AREAS[i];A.k=0;A.open=0;A.done=0;A.locked=0;A.qs=genQuests();A.gx=A.w-420;E=[];D=[];Q=[];B=[];T=[];portal=null;ui=false;$('panel').hidden=true;
const g0=document.createElement('canvas');g0.width=g0.height=64;const g=g0.getContext('2d');g.fillStyle=A.g[0];g.fillRect(0,0,64,64);
for(let j=0;j<40;j++){g.fillStyle=A.g[1+(Math.random()<.5)];g.fillRect(rnd(0,62)|0,rnd(0,62)|0,3,2)}
if(!A.rock)['#f6e05e','#fff','#f48fb1'].forEach(f=>{g.fillStyle=f;g.fillRect(rnd(2,60)|0,rnd(2,60)|0,3,3)});
pat=x.createPattern(g0,'repeat');
for(let j=0;j<70;j++)T.push({x:rnd(340,A.w-10),y:rnd(20,A.h),s:rnd(.8,1.3)});
P.x=90;P.y=A.h/2;P.hp=P.mhp;
for(let j=0;j<12;j++)spawn();
say('Entered '+A.n)}
function mk(type,px,py){const m=MOB[type];const boss=!!m.boss;const hp=Math.round(m.hp*(boss?3:1.8));return{...m,type,x:px,y:py,mh:hp,hp,fl:0,wt:0,vx:0,vy:0,bt:2,sp:m.sp*(boss?1.15:1.1),d:m.d*(boss?.9:.65)}}
function spawn(){if(E.filter(e=>!e.boss).length>=12)return;const ty=A.mobs[Math.random()*A.mobs.length|0];let a,b;
do{a=rnd(430,A.gx-70);b=rnd(30,A.h-30)}while(Math.hypot(a-P.x,b-P.y)<300);E.push(mk(ty,a,b))}
function say(s){msg=s;mt=3.5}
function pop(s,px,py,col){D.push({t:s,x:px,y:py,col,l:1})}
function burst(px,py,col,n=8){for(let i=0;i<n;i++)Q.push({x:px,y:py,vx:rnd(-90,90),vy:rnd(-110,40),l:rnd(.3,.6),col})}
const SAFE=330,need=l=>Math.round(55*Math.pow(l,1.9));
const MOB_AGG=0.5, SPAWN_LIMIT=12;
let dmg=()=>Math.max(7,Math.floor((8+(P.lv-1)*2+WEAP[P.wi].d+P.ref*3+P.card*2)*1.05));

/* ---------- COMBAT ---------- */
function attack(){if(over||ui||P.cd>0)return;P.cd=.4;P.sw=.18;S.swing();
for(const e of [...E]){const dx=e.x-P.x,dy=e.y-P.y,d=Math.hypot(dx,dy)||1;
if(d<52+e.r){const dm=dmg();e.hp-=dm;e.fl=.1;if(!e.boss){e.x+=dx/d*22;e.y+=dy/d*22}pop(dm,e.x,e.y-24,'#fff');burst(e.x,e.y-10,'#fff',5);S.hit();if(e.hp<=0)kill(e)}}}
function kill(e){E.splice(E.indexOf(e),1);const g=Math.round(rnd(e.g[0],e.g[1]));P.g+=g;P.xp+=e.xp;drop(e);qkill(e.type);pop('+'+g+'z',e.x,e.y-14,'#fc3');S.coin();burst(e.x,e.y-10,e.boss?'#f84':'#6e6',e.boss?30:12);
lvlcheck();
if(e.boss){A.done=1;portal={x:A.w-70,y:A.h/2};say(AI==AREAS.length-1?'The Ember Dragon is slain! Enter the portal.':'Boss defeated! Enter the portal.');S.win();return}
A.k++}
function hurt(d){if(P.x<SAFE)return;const r=Math.max(1,d-ARM[P.ai].a);P.hp-=r;P.inv=.7;sh=8;pop('-'+r,P.x,P.y-40,'#f55');burst(P.x,P.y-10,'#e44',8);S.hurt();
if(P.hp<=0){P.hp=0;over=1;ot=1;S.lose()}}
function add(n,q=1){P.bag[n]=(P.bag[n]||0)+q}
function drink(){if(over||!P.bag['Red Potion']||P.hp>=P.mhp)return;P.bag['Red Potion']--;P.hp=Math.min(P.mhp,P.hp+60);pop('+60 HP',P.x,P.y-40,'#6f6');S.heal()}
function drinkSp(){if(over||!P.bag['Blue Potion']||P.sp>=P.msp)return;P.bag['Blue Potion']--;P.sp=Math.min(P.msp,P.sp+30);pop('+30 SP',P.x,P.y-40,'#6cf');S.heal()}
function use(k){if(k=='Red Potion')drink();else if(k=='Blue Potion')drinkSp();else if(/Card$/.test(k)){P.bag[k]--;P.card++;pop('ATK +2!',P.x,P.y-40,'#fd5');S.lvl()}cur()}
function drop(e){const L=LOOT[e.type];if(L&&Math.random()<.55){add(L);pop('+'+L,e.x,e.y-34,'#9df')}
if(Math.random()<(e.boss?.6:.04)){add(e.n+' Card');pop(e.n+' Card!',e.x,e.y-48,'#fd5')}}
function lvlcheck(){while(P.xp>=need(P.lv)){P.xp-=need(P.lv);P.lv++;P.mhp+=10;P.hp=P.mhp;P.msp+=3;P.sp=P.msp;pop('LEVEL UP!',P.x,P.y-44,'#6cf');S.lvl()}
if(P.lv>=5&&P.job=='Novice'){P.job='Swordsman';say('Job change! Swordsman skills: Bash, Magnum Break')}}
function qkill(ty){A.qs.forEach(q=>{if(q.st==1&&q.type=='kill'&&q.mob==ty&&q.c<q.n){q.c++;if(q.c==q.n)say('Quest ready: '+qt(q))}})}
function skill(n){if(over||ui||P.cd>0)return;if(P.job=='Novice'){say('Reach Lv 5 to become a Swordsman');return}
const cost=n==1?8:15;if(P.sp<cost){say('Not enough SP');return}P.sp-=cost;P.cd=.5;P.sw=.25;S.swing();
const R=n==1?64:100,M=n==1?2.5:1.8,kb=n==1?25:45,dist=e=>Math.hypot(e.x-P.x,e.y-P.y);let hit=0;
for(const e of [...E].sort((a,b)=>dist(a)-dist(b))){const d=dist(e)||1;if(d<R+e.r&&(n==2||!hit)){hit++;const dm=Math.round(dmg()*M);e.hp-=dm;e.fl=.15;
if(!e.boss){e.x+=(e.x-P.x)/d*kb;e.y+=(e.y-P.y)/d*kb}pop(dm,e.x,e.y-24,n==1?'#fd5':'#f9c');burst(e.x,e.y-10,'#fd5',8);S.hit();if(e.hp<=0)kill(e)}}}
function minimap(){const w=100,h=Math.max(24,w*A.h/A.w),mx=W-w-8,my=60,k=w/A.w;x.fillStyle='#000b';x.fillRect(mx-2,my-2,w+4,h+4);x.fillStyle=A.g[0];x.fillRect(mx,my,w,h);x.fillStyle='#4f46';x.fillRect(mx,my,SAFE*k,h);
x.fillStyle='#0006';x.fillRect(mx+A.gx*k,my,(A.w-A.gx)*k,h);x.fillStyle=A.open&&!A.locked?'#f5c542':'#c33';x.fillRect(mx+A.gx*k,my,2,h);
const dot=(o,col,r)=>{x.fillStyle=col;x.fillRect(mx+o.x*k-r/2,my+o.y*k-r/2,r,r)};
NPCS().forEach(n=>dot(n,'#ff0',3));E.forEach(e=>dot(e,e.boss?'#d3f':'#f55',e.boss?5:2));if(portal)dot(portal,'#7df',5);dot(P,((t*4)|0)%2?'#fff':'#39f',4)}

/* ---------- NPCs & SHOP ---------- */
let NPCS=()=>[{k:'merchant',n:'Merchant',x:170,y:A.h/2-160},{k:'healer',n:'Kafra',x:270,y:A.h/2-80},{k:'smith',n:'Blacksmith',x:170,y:A.h/2},{k:'elder',n:'Elder',x:270,y:A.h/2+80},{k:'hunter',n:'Hunter',x:170,y:A.h/2+160}];
function row(txt,btn,fn,dis){const r=document.createElement('div');r.className='row';const s=document.createElement('span');s.textContent=txt;
const b=document.createElement('button');b.textContent=btn;b.disabled=!!dis;b.onclick=()=>{au();fn()};r.append(s,b);$('pb').append(r)}
function line(txt,cls){const d=document.createElement('div');d.className=cls;d.textContent=txt;$('pb').append(d)}
function openP(title,fn){ui=true;$('panel').hidden=false;$('pt').textContent=title;cur=fn;fn()}
function closeP(){ui=false;$('panel').hidden=true}
function buy(p,f){if(P.g<p)return;P.g-=p;f();S.coin();cur()}
function shop(){$('pb').innerHTML='';line('Zeny: '+P.g+'z','gold');
WEAP.forEach((w,i)=>row(w.n+' (+'+w.d+' ATK)',P.ow[i]?(i==P.wi?'Equipped':'Equip'):w.p+'z',()=>P.ow[i]?(P.wi=i,cur()):buy(w.p,()=>{P.ow[i]=1;P.wi=i}),P.ow[i]?i==P.wi:P.g<w.p));
ARM.forEach((a,i)=>row(a.n+' (-'+a.a+' damage)',P.oa[i]?(i==P.ai?'Equipped':'Equip'):a.p+'z',()=>P.oa[i]?(P.ai=i,cur()):buy(a.p,()=>{P.oa[i]=1;P.ai=i}),P.oa[i]?i==P.ai:P.g<a.p));
row('Red Potion (HP 60) · have '+(P.bag['Red Potion']||0),'20z',()=>buy(20,()=>add('Red Potion')),P.g<20);
row('Blue Potion (SP 30) · have '+(P.bag['Blue Potion']||0),'30z',()=>buy(30,()=>add('Blue Potion')),P.g<30);
const n=Object.values(LOOT).reduce((a,k)=>a+(P.bag[k]||0),0);
row('Sell all loot ('+n+' items)','+'+n*10+'z',()=>{Object.values(LOOT).forEach(k=>P.bag[k]=0);P.g+=n*10;S.coin();cur()},!n)}
function healer(){$('pb').innerHTML='';line('Zeny: '+P.g+'z','gold');line('Kafra Services: heal HP and SP.','txt');
row('Restore HP and SP','15z',()=>buy(15,()=>{P.hp=P.mhp;P.sp=P.msp;S.heal()}),P.g<15||(P.hp>=P.mhp&&P.sp>=P.msp))}
function smith(){$('pb').innerHTML='';line('Zeny: '+P.g+'z','gold');line('Weapon refine +'+P.ref+' (each level +3 ATK, up to +7). Higher levels can fail.','txt');
const c=70*(P.ref+1);row('Refine to +'+(P.ref+1),c+'z',()=>{if(P.g<c)return;P.g-=c;if(Math.random()<Math.max(.35,1-P.ref*.12)){P.ref++;S.lvl();say('Refine success! +'+P.ref)}else{S.hurt();say('Refine failed... zeny lost')}cur()},P.g<c||P.ref>=7)}
function qpanel(npc){$('pb').innerHTML='';line(npc=='elder'?'Elder: Help our village and be rewarded.':'Hunter: Show me your skill.','txt');
line('Quests done '+qDone()+'/'+A.qs.length+(A.open?' - boss gate open':' - finish all to open the boss gate'),'gold');
A.qs.filter(q=>q.npc==npc).forEach(q=>{const p=prog(q),ok=p>=q.n;
row(qt(q)+' ('+Math.min(p,q.n)+'/'+q.n+') +'+q.z+'z +'+q.xp+'xp',q.st==2?'Done':q.st==0?'Accept':ok?'Turn in':'Active',()=>{if(q.st==0)q.st=1;else{if(q.type=='collect')P.bag[LOOT[q.mob]]-=q.n;P.g+=q.z;P.xp+=q.xp;q.st=2;S.coin();lvlcheck();checkGate()}cur()},q.st==2||(q.st==1&&!ok))})}
function qlog(){$('pb').innerHTML='';const a=A.qs.filter(q=>q.st==1);if(!a.length)line('No active quests. Talk to the Elder and Hunter in the village.','txt');
a.forEach(q=>line(qt(q)+' '+Math.min(prog(q),q.n)+'/'+q.n+' - turn in to the '+q.npc,'txt'))}
let invTab='items',sel=null;
const ICON={'Red Potion':'🧪','Blue Potion':'🔷','Jellopy':'🫧','Goblin Ear':'👂','Wolf Fang':'🦷','Bone Piece':'🦴','Imp Tail':'😈','Scorpion Tail':'🦂','Rotten Bandage':'🩹','Ice Shard':'🧊','Yeti Fur':'🧶','Mushroom Spore':'🍄','Honey':'🍯','Snake Scale':'🐍','Zombie Finger':'🖐️','Cactus Needle':'🌵','Penguin Feather':'🪶','Ectoplasm':'👻','Magma Core':'🔥'};
const icon=k=>/Card$/.test(k)?'🃏':ICON[k]||'📦';
const DESC=k=>k=='Red Potion'?'Restores 60 HP.':k=='Blue Potion'?'Restores 30 SP.':/Card$/.test(k)?'Use to gain a permanent +2 ATK.':'Loot. Sell to the Merchant (10z each) or hand in for quests.';
function slot(ic,n,on,fn,lab){const d=document.createElement('div');d.className='slot'+(on?' on':'');d.innerHTML='<span>'+ic+'</span>'+(lab?'<small>'+lab+'</small>':'')+(n>1?'<b>'+n+'</b>':'');d.onclick=()=>{au();fn()};return d}
function invPanel(){const pb=$('pb');pb.innerHTML='';const tb=document.createElement('div');tb.className='tabs';
[['items','Items'],['gear','Gear'],['stats','Stats']].forEach(([k,l])=>{const b=document.createElement('button');b.textContent=l;if(k==invTab)b.className='act';b.onclick=()=>{invTab=k;sel=null;cur()};tb.append(b)});
pb.append(tb);line(P.g+' zeny','gold');const g=document.createElement('div');g.className='grid';
if(invTab=='items'){const it=Object.entries(P.bag).filter(e=>e[1]>0);
 for(let i=0;i<20;i++){const e=it[i];g.append(e?slot(icon(e[0]),e[1],sel==e[0],()=>{sel=e[0];cur()}):slot('',0,0,()=>{}))}pb.append(g);
 if(sel&&P.bag[sel]>0){line(sel+' x'+P.bag[sel],'gold');line(DESC(sel),'txt');if(/Potion|Card/.test(sel))row('','Use',()=>use(sel))}else line('Select an item.','txt')}
else if(invTab=='gear'){line('Weapon: '+WEAP[P.wi].n+(P.ref?' +'+P.ref:'')+' (+'+(WEAP[P.wi].d+P.ref*3)+' ATK) · Armor: '+ARM[P.ai].n+' (-'+ARM[P.ai].a+' damage)','txt');
 WEAP.forEach((w,i)=>P.ow[i]&&g.append(slot('⚔️',0,i==P.wi,()=>{P.wi=i;cur()},w.n)));
 ARM.forEach((a,i)=>P.oa[i]&&g.append(slot('🛡️',0,i==P.ai,()=>{P.ai=i;cur()},a.n)));pb.append(g)}
else{[['Job',P.job],['Level',P.lv+' (XP '+P.xp+'/'+need(P.lv)+')'],['HP',(P.hp|0)+'/'+P.mhp],['SP',(P.sp|0)+'/'+P.msp],
 ['ATK',dmg()+' (base '+(8+(P.lv-1)*2)+', weapon '+WEAP[P.wi].d+', refine '+P.ref*3+', cards '+P.card*2+')'],['DEF',ARM[P.ai].a],['Area',A.n+' · quests '+qDone()+'/'+A.qs.length]]
 .forEach(([a,b])=>{const d=document.createElement('div');d.className='row';d.innerHTML='<span>'+a+'</span><span>'+b+'</span>';pb.append(d)})}}
function toggleP(t,f){if(ui&&cur==f)closeP();else if(!ui&&!over)openP(t,f)}
function talk(){if(over)return;if(ui){closeP();return}
for(const n of NPCS())if(Math.hypot(n.x-P.x,n.y-P.y)<70){openP(n.n,({merchant:shop,healer:healer,smith:smith,elder:()=>qpanel('elder'),hunter:()=>qpanel('hunter')})[n.k]);return}
say('Nobody nearby to talk to')}

/* ---------- INPUT ---------- */
function go(){if(over&&ot<=0){if(over==1){over=0;P.hp=P.mhp;P.g=P.g*.75|0;P.sp=P.msp;P.x=90;P.y=A.h/2;P.inv=1.5;A.locked=0;const bb=E.find(e=>e.boss);if(bb){bb.hp=bb.mh;bb.x=A.w-170;bb.y=A.h/2};say('You wake up in the village (lost 25% gold)')}else newGame()}}
addEventListener('keydown',e=>{const k=e.key.toLowerCase();au();K[k]=1;if(k==' '||k.startsWith('arrow'))e.preventDefault();
if(over){go();return}if(k=='e')talk();if(k=='escape')closeP();if(k=='q')drink();if(k=='r')drinkSp();if(k=='i')toggleP('Inventory',invPanel);if(k=='j')toggleP('Quest Log',qlog);if(k=='1')skill(1);if(k=='2')skill(2);if(k=='m')toggleMute();if(k=='f')toggleFS()});
addEventListener('keyup',e=>K[e.key.toLowerCase()]=0);
// Mouse: hold click to walk toward the cursor (touch uses the joystick instead)
c.addEventListener('pointerdown',e=>{au();if(over){go();return}if(e.pointerType=='mouse')ptr=pp(e)});
c.addEventListener('pointermove',e=>{if(ptr&&e.pointerType=='mouse')ptr=pp(e)});addEventListener('pointerup',()=>ptr=null);
function pp(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}

// Virtual joystick (mobile)
const JS={x:0,y:0,on:0},jz=$('joy'),jk=$('joyk');let jid=null;
function jmove(e){const r=jz.getBoundingClientRect(),R=r.width/2;let dx=e.clientX-r.left-R,dy=e.clientY-r.top-R;const d=Math.hypot(dx,dy),m=Math.min(d,R*.6);if(d>0){dx*=m/d;dy*=m/d}jk.style.transform=`translate(${dx}px,${dy}px)`;JS.on=m>R*.12;JS.x=dx/(R*.6);JS.y=dy/(R*.6)}
jz.addEventListener('pointerdown',e=>{au();if(over){go();return}jid=e.pointerId;jz.setPointerCapture(jid);jmove(e);e.preventDefault()});
jz.addEventListener('pointermove',e=>{if(e.pointerId==jid)jmove(e)});
const jend=e=>{if(e.pointerId==jid){jid=null;JS.on=0;JS.x=JS.y=0;jk.style.transform=''}};
jz.addEventListener('pointerup',jend);jz.addEventListener('pointercancel',jend);

// Attack button: hold to keep attacking
const ah=$('atk');ah.onpointerdown=e=>{au();if(over){go();return}K[' ']=1;e.preventDefault()};
['pointerup','pointerleave','pointercancel'].forEach(n=>ah['on'+n]=()=>K[' ']=0);

$('talk').onclick=()=>{au();talk()};$('pot').onclick=()=>{au();drink()};$('bsh').onclick=()=>{au();skill(1)};$('bmb').onclick=()=>{au();skill(2)};
$('binv').onclick=()=>{au();toggleP('Inventory',invPanel)};$('bq').onclick=()=>{au();toggleP('Quest Log',qlog)};$('mu').onclick=toggleMute;$('fs').onclick=toggleFS;$('px').onclick=closeP;

/* ---------- UPDATE ---------- */
function update(dt){t+=dt;ot-=dt;mt-=dt;sh=Math.max(0,sh-dt*30);
for(const d of D){d.l-=dt;d.y-=20*dt}D=D.filter(d=>d.l>0);
for(const q of Q){q.l-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=300*dt}Q=Q.filter(q=>q.l>0);
if(over||ui)return;
let mx=(K.d||K.arrowright?1:0)-(K.a||K.arrowleft?1:0),my=(K.s||K.arrowdown?1:0)-(K.w||K.arrowup?1:0);
if(ptr){const dx=ptr.x-W/2,dy=ptr.y-H/2;if(Math.hypot(dx,dy)>12){mx=dx;my=dy}}
if(JS.on){mx=JS.x;my=JS.y}
const m=Math.hypot(mx,my);P.mv=m>0;
if(m){mx/=m;my/=m;P.fx=mx;P.fy=my;P.x=cl(P.x+mx*130*dt,10,A.w-10);P.y=cl(P.y+my*130*dt,10,A.h-10)}
if(!A.open&&P.x>A.gx-10){P.x=A.gx-10;if(mt<=0)say('Finish all quests ('+(A.qs.length-qDone())+' left) to open the boss gate')} // closed gate
if(A.open&&!A.done){if(!A.locked&&P.x>A.gx+30){A.locked=1;say('The gate seals behind you! Defeat the boss!');S.boss()}if(A.locked&&P.x<A.gx+12)P.x=A.gx+12} // no escape
if(K[' '])attack();P.sp=Math.min(P.msp,P.sp+(P.x<SAFE?3:1)*dt);if(P.x<SAFE)P.hp=Math.min(P.mhp,P.hp+3*dt);P.cd-=dt;P.sw-=dt;P.inv-=dt;
spawnT-=dt;if(E.filter(e=>!e.boss).length<SPAWN_LIMIT&&spawnT<=0){spawn();spawnT=2.5}
for(const e of E){const dx=P.x-e.x,dy=P.y-e.y,d=Math.hypot(dx,dy)||1;e.fl-=dt;
if(d<(e.boss?400:230*MOB_AGG)){e.x+=dx/d*e.sp*dt;e.y+=dy/d*e.sp*dt;e.face=dx<0}
else{e.wt-=dt;if(e.wt<=0){e.wt=rnd(1,3);e.vx=rnd(-20,20);e.vy=rnd(-20,20)}e.x+=e.vx*dt;e.y+=e.vy*dt}
e.x=cl(e.x,e.boss?A.gx+30:SAFE+55,e.boss?A.w-20:A.gx-80);e.y=cl(e.y,20,A.h-10);
if(e.dragon&&d<460){e.bt-=dt;if(e.bt<=0){e.bt=2.2;B.push({x:e.x,y:e.y-24,vx:dx/d*170,vy:dy/d*170,l:3});S.fire()}}
if(d<e.r+10&&P.inv<=0)hurt(e.d)}
for(const b of B){b.x+=b.vx*dt;b.y+=b.vy*dt;b.l-=dt;Q.push({x:b.x,y:b.y,vx:rnd(-20,20),vy:rnd(-20,20),l:.25,col:'#f94'});
if(Math.hypot(P.x-b.x,P.y-10-b.y)<14&&P.inv<=0){b.l=0;hurt(14)}}
B=B.filter(b=>b.l>0);
if(portal&&Math.hypot(P.x-portal.x,P.y-portal.y)<34){if(AI==AREAS.length-1){over=2;ot=1;S.win()}else{loadArea(AI+1);S.lvl()}}}

/* ---------- DRAW ---------- */
function shadow(px,py,r){x.fillStyle='#0004';x.beginPath();x.ellipse(px,py,r,r/2.5,0,0,7);x.fill()}
function sprite(img,px,py,flip,bob=0){shadow(px,py,img.width/2.2);x.save();x.translate(px,py-bob);if(flip)x.scale(-1,1);x.drawImage(img,-img.width/2,-img.height);x.restore()}
function tree(o){const s=o.s;shadow(o.x,o.y,16*s);
if(A.rock){x.fillStyle='#4b4242';x.beginPath();x.ellipse(o.x,o.y-8*s,18*s,12*s,0,0,7);x.fill();x.fillStyle='#6a5f5f';x.beginPath();x.ellipse(o.x-4*s,o.y-12*s,10*s,7*s,0,0,7);x.fill();return}
x.fillStyle='#5a3a1c';x.fillRect(o.x-3*s,o.y-12*s,6*s,12*s);
[[A.tc[0],0,-24,18],[A.tc[1],-5,-28,14],[A.tc[2],-6,-32,8]].forEach(([cc,dx,dy,r])=>{x.fillStyle=cc;x.beginPath();x.arc(o.x+dx*s,o.y+dy*s,r*s,0,7);x.fill()})}
function dragon(e){const px=e.x,py=e.y;shadow(px,py,36);const w=Math.sin(t*6)*10;
x.fillStyle='#8f1d1d';[-1,1].forEach(d=>{x.beginPath();x.moveTo(px+d*10,py-30);x.lineTo(px+d*56,py-62+w);x.lineTo(px+d*34,py-34);x.lineTo(px+d*50,py-14);x.lineTo(px+d*12,py-14);x.fill()});
x.fillStyle='#d33';x.beginPath();x.arc(px,py-24,30,0,7);x.fill();x.fillStyle='#f48a5a';x.beginPath();x.ellipse(px,py-14,18,16,0,0,7);x.fill();
x.fillStyle='#fd5';[-1,1].forEach(d=>{x.beginPath();x.moveTo(px+d*14,py-46);x.lineTo(px+d*22,py-64);x.lineTo(px+d*6,py-50);x.fill();x.fillRect(px+d*11-3,py-32,6,6)})}
function draw(){const cx=cl(P.x-W/2,0,A.w-W),cy=cl(P.y-H/2,0,A.h-H);
x.save();x.translate(-cx+rnd(-sh,sh)/3,-cy+rnd(-sh,sh)/3);
x.fillStyle=pat;x.fillRect(cx-8,cy-8,W+16,H+16);
x.fillStyle='#9a7a4f55';x.fillRect(0,0,SAFE,A.h);x.strokeStyle='#7f7a';x.lineWidth=2;x.setLineDash([10,8]);x.strokeRect(1,1,SAFE-1,A.h-2);x.setLineDash([]);               // village ground
x.fillStyle='#0004';x.fillRect(A.gx,0,A.w-A.gx,A.h);            // boss arena shade
if(!A.open||A.locked){x.fillStyle='#5a3a1c';for(let y=0;y<A.h;y+=22)x.fillRect(A.gx-4,y,8,16)}else{x.fillStyle='#f5c54255';x.fillRect(A.gx-2,0,4,A.h)}
const L=[];T.forEach(o=>L.push([o.y,()=>tree(o)]));
NPCS().forEach(n=>L.push([n.y,()=>{sprite(NP[n.k],n.x,n.y,false);x.font='bold 12px system-ui';x.textAlign='center';x.fillStyle='#fff';x.fillText(n.n,n.x,n.y-38)}]));
E.forEach(e=>L.push([e.y,()=>{if(e.dragon)dragon(e);else sprite(e.img,e.x,e.y,e.face);
 if(e.fl>0){x.fillStyle='#fff8';x.beginPath();x.arc(e.x,e.y-(e.dragon?24:e.img.height/2),e.dragon?30:e.r,0,7);x.fill()}
 const w=e.boss?70:e.r*2,ty=e.y-(e.dragon?68:e.img.height+8);x.fillStyle='#000a';x.fillRect(e.x-w/2,ty,w,4);x.fillStyle=e.boss?'#d3f':'#e44';x.fillRect(e.x-w/2,ty,w*Math.max(0,e.hp)/e.mh,4)}]));
L.push([P.y,()=>{if(P.inv>0&&((P.inv*20)|0)%2)x.globalAlpha=.4;sprite(PL[P.ai],P.x,P.y,P.fx<0,P.mv?Math.abs(Math.sin(t*12))*3:0);x.globalAlpha=1}]);
L.sort((a,b)=>a[0]-b[0]).forEach(l=>l[1]());
if(portal){for(let i=0;i<3;i++){x.strokeStyle=['#7df','#a6f','#fff'][i];x.lineWidth=3;x.beginPath();x.arc(portal.x,portal.y-20,16+i*7+Math.sin(t*4+i)*3,t+i,t+i+4.5);x.stroke()}}
if(P.sw>0){const a=Math.atan2(P.fy,P.fx);x.strokeStyle=WEAP[P.wi].c;x.globalAlpha=P.sw/.18;x.lineWidth=5;x.lineCap='round';x.beginPath();x.arc(P.x,P.y-14,48,a-1.1,a+1.1);x.stroke();x.globalAlpha=1}
for(const b of B){x.fillStyle='#f60';x.beginPath();x.arc(b.x,b.y,8,0,7);x.fill();x.fillStyle='#fe6';x.beginPath();x.arc(b.x,b.y,4,0,7);x.fill()}
for(const q of Q){x.fillStyle=q.col;x.globalAlpha=Math.min(1,q.l*3);x.fillRect(q.x,q.y,3,3)}x.globalAlpha=1;
x.font='bold 13px system-ui';x.textAlign='center';for(const d of D){x.globalAlpha=d.l;x.fillStyle='#000';x.fillText(d.t,d.x+1,d.y+1);x.fillStyle=d.col;x.fillText(d.t,d.x,d.y)}x.globalAlpha=1;
if(window.drawPeers)drawPeers(x); // multiplayer: other heroes (online.js)
x.restore();
// Canvas only renders the world. The HTML frontend owns the HUD.
minimap();
if(mt>0){const my=H-(document.body.classList.contains('touch')?150:90);x.fillStyle='#000a';x.fillRect(W/2-190,my,380,26);x.fillStyle='#fff';x.textAlign='center';x.font='bold 13px system-ui';x.fillText(msg,W/2,my+18)}
if(over==1){x.fillStyle='#000a';x.fillRect(0,0,W,H);x.fillStyle='#f55';x.textAlign='center';x.font='bold 28px Georgia,serif';x.fillText('YOU DIED',W/2,H/2);x.fillStyle='#fff';x.font='13px system-ui';x.fillText('Tap or press any key to respawn',W/2,H/2+26)}
if(over==2){x.fillStyle='#000b';x.fillRect(0,0,W,H);x.fillStyle='#f2c35b';x.textAlign='center';x.font='bold 28px Georgia,serif';x.fillText('VICTORY!',W/2,H/2);x.fillStyle='#fff';x.font='13px system-ui';x.fillText('Tap or press any key to play again',W/2,H/2+26)}
}

/* DOM FRONTEND HUD SYNC */
function syncFrontend(){
  const hp=document.querySelector('.bar.hp i'),sp=document.querySelector('.bar.sp i'),xp=document.querySelector('.bar.xp i');
  if(hp)hp.style.width=(100*P.hp/P.mhp)+'%';
  if(sp)sp.style.width=(100*P.sp/P.msp)+'%';
  if(xp)xp.style.width=(100*P.xp/need(P.lv))+'%';
  const l=$('hudLevel'),h=$('hudHp'),spn=$('hudSp'),j=$('hudJob');
  if(l)l.textContent=P.lv;if(h)h.textContent=(P.hp|0)+'/'+P.mhp;if(spn)spn.textContent=(P.sp|0)+'/'+P.msp;if(j)j.textContent=P.job;
  const zn=document.querySelector('.zone-name'),zs=document.querySelector('.zone-sub');
  if(zn)zn.textContent=A.n.toUpperCase();if(zs)zs.textContent='Quests '+qDone()+'/'+A.qs.length+(A.open?' · Gate open':'');
}
function loop(n){const dt=Math.min(.05,(n-last)/1000);last=n;update(dt);draw();syncFrontend();requestAnimationFrame(loop)}
newGame();over=0;requestAnimationFrame(loop);