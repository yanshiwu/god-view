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
