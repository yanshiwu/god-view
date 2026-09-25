// ============ UI:工具栏 / HUD / 日志 / 弹窗 ============
"use strict";

const $ = id => document.getElementById(id);
const uiState = { selected:null, hover:null, lastHud:0 };

// ---- 构建神力按钮 ----
function buildToolbar(){
  for (const p of POWERS){
    const btn = document.createElement('div');
    btn.className = 'pbtn'; btn.dataset.id = p.id;
    btn.innerHTML = `<span class="cost">${p.cost}</span><span class="ic">${p.icon}</span><span class="nm">${p.name}</span><div class="cd"></div>`;
    btn.addEventListener('click', ()=>{
      AU.init(); AU.click();
      if (uiState.selected === p.id){ uiState.selected=null; }
      else { uiState.selected = p.id; }
      refreshPbtns();
      cv.classList.toggle('aiming', !!uiState.selected);
    });
    btn.addEventListener('mouseenter', e=>{
      const tip = $('power-tip');
      tip.innerHTML = `<b>${p.icon} ${p.name}</b> <span style="color:#7fb8e8">✨${p.cost}</span>
        <span style="color:#6b6355">· 冷却 ${p.cd}s</span><br>${p.desc}`;
      const r = btn.getBoundingClientRect();
      tip.style.display='block';
      tip.style.left = (r.left - tip.offsetWidth - 10) + 'px';
      tip.style.top = Math.min(r.top, window.innerHeight - tip.offsetHeight - 10) + 'px';
    });
    btn.addEventListener('mouseleave', ()=> $('power-tip').style.display='none');
    $('pg-'+p.group).appendChild(btn);
  }
}
function refreshPbtns(){
  document.querySelectorAll('.pbtn').forEach(b=>{
    b.classList.toggle('sel', b.dataset.id===uiState.selected);
  });
}
// 冷却与神力不足置灰(每帧节流)
function uiRefreshPowerBar(){
  document.querySelectorAll('.pbtn').forEach(b=>{
    const p = POWERS.find(q=>q.id===b.dataset.id);
    const cd = Math.max(0, (G.cooldowns[p.id]||0) - performance.now())/1000;
    const frac = cd>0 ? cd/p.cd : 0;
    b.querySelector('.cd').style.height = (frac*100)+'%';
    b.classList.toggle('dis', !canCast(p));
  });
}

// ---- HUD 刷新 ----
function uiHUD(){
  if (!G || performance.now()-uiState.lastHud < 200) return;
  uiState.lastHud = performance.now();
  const p = totalPop();
  $('st-pop').textContent = fmt(p);
  $('st-kn').textContent = fmt(G.knowledge);
  let stTxt = '—';
  const al = aliveSettlements();
  if (al.length){
    let s=0, c=0;
    for (const x of al){ s += x.store/storeCap(x); c++; }
    stTxt = Math.round(s/c*100)+'%';
  }
  $('st-food').textContent = stTxt;
  const SS = SEASONS[G.season];
  const sn=$('st-nature');
  if (sn){ sn.textContent = G.nature>30?'😇和平':G.nature<-30?'😈好战':'😐中庸';
           sn.style.color = G.nature>30?'#8fe08f':G.nature<-30?'#e08f8f':''; }
  $('st-season').textContent = SS.icon + SS.name;
  $('bar-pow').style.transform = `scaleX(${G.power/POWER_MAX})`;
  $('st-pow').textContent = Math.floor(G.power);
  $('bar-faith').style.transform = `scaleX(${G.faith/100})`;
  $('st-faith').textContent = Math.floor(G.faith);
  // 时代进度
  const E = ERAS[G.era], N = ERAS[G.era+1];
  $('era-name').textContent = E.name;
  $('era-sub').textContent = E.en;
  if (N){
    const knPct = Math.min(1, G.knowledge/N.kn);
    $('bar-era').style.transform = `scaleX(${knPct})`;
    $('era-pct').textContent = Math.floor(knPct*100)+'%';
    let need = `知识 ${fmt(G.knowledge)} / ${fmt(N.kn)}`;
    if (N.pop) need += ` · 人口 ${fmt(p)}/${fmt(N.pop)}`;
    if (N.flag && !G.flags[N.flag]) need += ' · 等待火种⚡';
    $('era-info').textContent = need;
  } else {
    $('bar-era').style.transform='scaleX(1)'; $('era-pct').textContent='MAX';
    $('era-info').textContent = '文明已抵达星辰 ✦';
  }
  uiRefreshPowerBar();
}

// ---- 日志 ----
const logs = [];
function log(msg, cls='lg-sys'){
  if (!G) return;
  logs.push({y:G.year, msg, cls});
  if (logs.length>200) logs.shift();
  const el = $('log-line');
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = `${fmtY(G.year)} ${msg}`;
  el.prepend(d);
  while (el.children.length>4) el.removeChild(el.lastChild);
  if (el.children.length>3) el.lastChild.style.opacity=.45;
}

// ---- 提示 ----
function toast(html, dur=4){
  const t = document.createElement('div');
  t.className='toast'; t.innerHTML=html;
  $('toasts').appendChild(t);
  setTimeout(()=>{ t.style.transition='opacity .6s'; t.style.opacity=0;
    setTimeout(()=>t.remove(), 650); }, dur*1000);
}
function bigToast(title, sub, victoryStyle){
  const t = document.createElement('div');
  t.className='toast big'; t.innerHTML = `${title}<div style="font-size:11px;letter-spacing:4px;margin-top:6px;color:#c9b88a">${sub||''}</div>`;
  $('toasts').appendChild(t);
  setTimeout(()=>{ t.style.transition='all .8s'; t.style.opacity=0; t.style.transform='translateY(-20px)';
    setTimeout(()=>t.remove(), 850); }, 3400);
}

// ---- 文明长卷 ----
function openChronicle(){
  const el = $('chron-list');
  const items = [...G.chronicle].reverse();
  el.innerHTML = items.length
    ? items.map(e=>`<div class="ch-row k-${e.k}"><span class="y">${fmtY(e.y)}</span><span>${e.t}</span></div>`).join('')
    : '<div style="color:#9a917c;font-style:italic;padding:20px;text-align:center">长卷还是空白的——历史正等待发生。</div>';
  $('ov-chron').classList.remove('hide');
}

// ---- 文明适应面板 ----
function uiRefreshAdapt(){
  const el = $('adapt-list'); el.innerHTML='';
  for (const [id,A] of Object.entries(ADAPT)){
    const got = !!G.adaptations[id];
    const d = document.createElement('div');
    d.className = 'adapt'+(got?' got':'');
    d.innerHTML = `<span class="ic">${A.icon}</span><span><span class="nm">${A.name.trim()}</span>
      <span class="rq">${got ? A.fx : '未解锁 · '+A.req}</span></span>`;
    el.appendChild(d);
  }
}

// ---- 结算统计 ----
// ---- 部落检视面板 ----
let tribeOpenId = -1;
function openTribe(id){
  tribeOpenId = id;
  fillTribe();
  $('ov-tribe').classList.remove('hide');
}
function closeTribe(){ tribeOpenId = -1; $('ov-tribe').classList.add('hide'); }
function fillTribe(){
  const s = G.settlements[tribeOpenId];
  if (!s || !s.alive){ closeTribe(); return; }
  const lv = LEVELS[s.level];
  const r = lv.r + 4;
  const cx = s.x|0, cy = s.y|0;
  // 附近资源清点
  let berry=0, oreC=0, oreI=0, oreG=0, water=0, forest=0;
  for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++){
    const x=cx+dx, y=cy+dy;
    if (!inW(x,y)) continue;
    const i=y*WORLD_W+x;
    if (W.BERRY && W.BERRY[i]) berry++;
    if (W.ORE && W.ORE[i]===1) oreC++; else if (W.ORE&&W.ORE[i]===2) oreI++; else if (W.ORE&&W.ORE[i]===3) oreG++;
    if (W.T[i]===TER.RIVER||W.T[i]===TER.OASIS||W.T[i]===TER.SEA) water++;
    if (W.T[i]===TER.FOREST) forest++;
  }
  // 农田与作物
  const crops = {};
  let farmN = 0, ripe = 0;
  for (let i=0;i<W.FARM.length;i++){
    if (W.FARM[i]!==s.id+1) continue;
    farmN++;
    if (W.FS[i]>=3 && W.FS[i]<6) ripe++;
    const t = W.T[i];
    const cr = CROPS[t] || CROPS[TER.GRASS];
    crops[cr.name] = (crops[cr.name]||0)+1;
  }
  const cropStr = Object.keys(crops).length
    ? Object.keys(crops).map(k=>`${k}×${crops[k]}块`).join('、')
    : '<span style="color:var(--ink-dim)">尚未开垦</span>';
  // 职业
  const jobs = {};
  for (const w of G.walkers){
    if (w.home!==s.id || w.kind==='dead') continue;
    jobs[JOBS[w.kind] ? JOBS[w.kind].name : w.kind] = (jobs[JOBS[w.kind]?JOBS[w.kind].name:w.kind]||0)+1;
  }
  const jobStr = Object.keys(jobs).length
    ? Object.keys(jobs).map(k=>`${k}×${jobs[k]}`).join(' · ')
    : '<span style="color:var(--ink-dim)">无人劳作</span>';
  // 关系
  const rels = [];
  for (const k in G.relations){
    const r2 = G.relations[k];
    if (!r2 || (r2.grudge||0)<=0 && !(r2.ally)) continue;
    const [a,b] = k.split(',').map(Number);
    if (a!==s.id && b!==s.id) continue;
    const o = G.settlements[a===s.id?b:a];
    if (!o || !o.alive) continue;
    if (r2.ally) rels.push(`🤝 与 ${o.name} 结盟`);
    else if (r2.grudge>0) rels.push(`💢 与 ${o.name} 有旧怨(${Math.round(r2.grudge)})`);
  }
  const warsNow = G.wars.filter(w=>w.a===s.id||w.b===s.id)
    .map(w=>`⚔️ 正与 ${G.settlements[w.a===s.id?w.b:w.a].name} 交战`);
  const geoName = {river:'河谷',coast:'海滨',grass:'草原',forest:'林地',mountain:'山地',desert:'荒漠',swamp:'沼泽',tundra:'苔原'}[s.geo]||s.geo;
  const traitStr = s.traits ? Object.keys(s.traits).map(t=>TRAITS[t]?TRAITS[t].name:t).join('、') : '—';
  const status = [];
  if (s.famine) status.push('<span style="color:#e08f8f">饥荒中</span>');
  if (s.plague) status.push('<span style="color:#e08f8f">瘟疫蔓延</span>');
  if (s.damaged>.2) status.push('<span style="color:#e0c88f">建筑受损</span>');
  if (s.armory) status.push('⚒️ 设武器作坊');
  if (s.arsenal) status.push('🏭 设军工厂');
  const rows = [
    ['🏛 部落', `<b style="color:${s.col}">${s.name}</b>(建立于 纪元 ${s.foundY} 年)`],
    ['📜 时代', ERAS[G.era].name],
    ['🏞 地理', geoName + '部落 · ' + lv.name],
    ['👥 人口', `${fmt(s.pop)} / ${fmt(lv.cap)}(房屋 ${s.houses||Math.ceil(s.pop/4)} 间)`],
    ['🌾 存粮', `${fmt(s.store)} / ${fmt(storeCap(s))}(季收 ${fmt(s.income||0)} · 季食 ${fmt(s.eat||0)})`],
    ['🌱 农田', `${farmN} 块,待收 ${ripe} 块:${cropStr}`],
    ['⛏ 矿脉', `铜 ${oreC} · 铁 ${oreI} · 金 ${oreG}(领地内)`],
    ['🫐 浆果丛', `${berry} 处 · 林地 ${forest} 块 · 水域 ${water} 块`],
    ['🧑‍🌾 劳作', jobStr],
    ['🧬 部落特质', traitStr],
    ['🤝 关系', rels.length?rels.join('<br>'):'<span style="color:var(--ink-dim)">与世无争</span>'],
    status.length?['⚠ 状态', status.join(' · ')]:null,
    warsNow.length?['🔥 战况', warsNow.join('<br>')]:null,
  ].filter(Boolean);
  $('tribe-name').textContent = s.name;
  $('tribe-name').style.color = s.col;
  $('tribe-sub').textContent = ERAS[G.era].en + ' · ' + lv.name.toUpperCase();
  $('tribe-body').innerHTML = rows.map(r2=>`<div style="display:flex"><span style="width:96px;flex:none;color:var(--ink-dim)">${r2[0]}</span><span>${r2[1]}</span></div>`).join('');
}
function fillStats(elId){
  const mins = Math.round((performance.now()-bootT)/1000);
  const rows = [
    ['历经岁月', fmtY(G.year).replace('纪元 ','')],
    ['幸存人口', fmt(totalPop())],
    ['文明时代', ERAS[G.era].name],
    ['文明适应', Object.keys(G.adaptations).length+' / '+Object.keys(ADAPT).length],
    ['施放神力', G.stats.cast+' 次'],
    ['扛过灾难', G.stats.survived+' 场'],
    ['降下神迹', G.stats.miracles+' 次'],
    ['部落战争', G.stats.wars+' 场'],
    ['诞生新魂', fmt(G.stats.born)],
    ['逝去生灵', fmt(G.stats.deaths)+' (天灾 '+(G.stats.natDisaster||0)+')'],
  ];
  $(elId).innerHTML = rows.map(r=>`<div>${r[0]}<b>${r[1]}</b></div>`).join('');
}
let bootT = performance.now();

function showGameOver(){
  AU.plague();
  $('over-reason').textContent = `他们最终没能走出 ${ERAS[G.era].name}。毁灭这个世界的,是${G.lastCause === '严酷的自然' ? '严酷的自然' : '你降下的'+G.lastCause}。`;
  fillStats('over-stats');
  $('ov-over').classList.remove('hide');
}
function showWin(){
  fillStats('win-stats');
  $('ov-win').classList.remove('hide');
  $('btn-continue').onclick = ()=>{ $('ov-win').classList.add('hide'); };
}

// ---- 顶部控制 ----
function bindControls(){
  $('btn-pause').onclick = ()=> togglePause();
  for (const [id,sp] of [['spd-05',0.5],['spd-1',1],['spd-2',2],['spd-4',4]]){
    $(id).onclick = ()=> setSpeed(sp);
  }
  $('btn-mute').onclick = ()=>{ AU.init(); AU.muted=!AU.muted;
    $('btn-mute').textContent = AU.muted?'🔇':'🔊'; };
  $('btn-help').onclick = ()=> $('ov-help').classList.remove('hide');
  $('btn-chron').onclick = ()=> openChronicle();
  $('btn-chron-close').onclick = ()=> $('ov-chron').classList.add('hide');
  $('btn-tribe-close').onclick = closeTribe;
  $('btn-help-close').onclick = ()=> $('ov-help').classList.add('hide');
  $('btn-reset').onclick = ()=> location.reload();
  $('btn-start').onclick = startCreation;
}
function togglePause(force){
  G.paused = force!==undefined ? force : !G.paused;
  $('btn-pause').textContent = G.paused?'▶':'⏸';
  $('btn-pause').classList.toggle('on', G.paused);
}
function setSpeed(sp){
  G.speed=sp; if (G.paused) togglePause(false);
  for (const id of ['spd-05','spd-1','spd-2','spd-4']) $(id).classList.remove('on');
  $({'0.5':'spd-05','1':'spd-1','2':'spd-2','4':'spd-4'}[sp]).classList.add('on');
}
