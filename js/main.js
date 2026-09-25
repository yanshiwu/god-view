// ============ 主控:输入 / 游戏循环 / 创世流程 ============
"use strict";

newGame();
genWorld((Math.random()*1e9)|0);
buildToolbar();
bindControls();
uiRefreshAdapt();
log('世界已就绪。', 'lg-sys');

// 标题界面:镜头缓慢漂移
cam.x = WORLD_PW/2; cam.y = WORLD_PH/2; cam.z = .9;

function startCreation(){
  AU.init(); AU.chime(); MUS.start(); MUS.setEra(G.era);
  $('ov-title').classList.add('hide');
  G.phase = 'seed';
  seedSpots = bestSeedSpots(30);
  cam.z = .62; cam.x = WORLD_PW/2; cam.y = WORLD_PH/2;
  bigToast('播种生命', '点击地图上任何一个金色光点');
  log('洪荒初开。选择一片肥沃的土地,播下生命的种子。', 'lg-god');
}

function placeFirstTribe(x,y){
  const s = spawnSettlement(x, y, 12, 0, TRIBE_FIRST);
  G.seedYear = G.year;
  G.phase = 'play';
  AU.sparkle();
  FX.burst(s.tx, s.ty, 40, '#ffe9a8', 90);
  FX.ring(s.tx, s.ty, 120, '#ffd86b');
  FX.heal(s.tx, s.ty);
  camTarget = {x:s.tx, y:s.ty, z:1.7};
  bigToast('生命诞生', '十二只古猿睁开了眼睛');
  log(`生命在「${TRIBE_FIRST}」诞生了。十二只古猿在河畔睁开了眼睛。`, 'lg-story');
  spawnFaunaInit();
  // 引导
  setTimeout(()=>{ if(G.phase==='play') toast('🖱️ 点选右侧神力,再点击大地即可施放 · 右键拖拽移动视角', 6); }, 2500);
  setTimeout(()=>{ if(G.phase==='play' && G.era===0) toast('知识会随时间积累 · ☀️阳光与🌧️甘霖能让部落更快繁衍', 7); }, 26000);
  setTimeout(()=>{ if(G.phase==='play' && !G.flags.fire) toast('提示:「火焰时代」需要部落亲眼见证天火——在部落附近降下 ⚡雷击 试试', 9); }, 50000);
}

// ---------------- 输入 ----------------
let dragging=false, dragMoved=0, lastMX=0, lastMY=0, panBtn=-1;
let camTarget = null;

cv.addEventListener('contextmenu', e=> e.preventDefault());
window.addEventListener('pointerdown', ()=> AU.init(), {once:true});

cv.addEventListener('pointerdown', e=>{
  if (e.target !== cv) return;
  dragging=true; dragMoved=0; lastMX=e.clientX; lastMY=e.clientY;
  panBtn = (e.button===2 || e.button===1 || !uiState.selected) ? e.button : -1;
  cv.classList.add('panning');
});
window.addEventListener('pointermove', e=>{
  // 悬停位置(世界坐标)
  const w = s2w(e.clientX, e.clientY);
  uiState.hover = {x:w.x/TILE, y:w.y/TILE};
  if (!dragging) return;
  const dx=e.clientX-lastMX, dy=e.clientY-lastMY;
  dragMoved += Math.abs(dx)+Math.abs(dy);
  lastMX=e.clientX; lastMY=e.clientY;
  if (panBtn>=0){
    cam.x -= dx/cam.z; cam.y -= dy/cam.z; clampCam(); camTarget=null;
  }
});
window.addEventListener('pointerup', e=>{
  if (!dragging) return;
  dragging=false; cv.classList.remove('panning');
  if (dragMoved>6 || e.target!==cv) return; // 拖拽不算点击
  const w = s2w(e.clientX, e.clientY);
  const tx = w.x/TILE-.5, ty = w.y/TILE-.5;

  if (G.phase==='seed'){
    // 命中候选点或任意宜居地
    let hit = seedSpots.find(s=> Math.hypot(s.x-tx, s.y-ty)<3);
    if (!hit){
      const t = inW(tx|0,ty|0) ? tAt(tx|0,ty|0) : TER.DEEP;
      if (t===TER.GRASS || t===TER.FOREST) hit = {x:tx|0, y:ty|0};
    }
    if (hit) placeFirstTribe(hit.x, hit.y);
    else toast('那里无法孕育生命——请选择金色光点处的草原或森林', 3.5);
    return;
  }
  if (G.phase==='play' && uiState.selected){
    AU.click();
    castPower(uiState.selected, tx+.5, ty+.5);
    return;
  }
  // 检视部落:点击聚落基地
  if (G.phase==='play'){
    let hit = null, hd = 3.4;
    for (const s of G.settlements){
      if (!s.alive) continue;
      const d = Math.hypot(s.x-.5-tx, s.y-.5-ty);
      if (d<hd){ hd=d; hit=s; }
    }
    if (hit){ AU.click(); openTribe(hit.id); }
    else closeTribe();
  }
});
window.addEventListener('keydown', e=>{
  if (e.key==='Escape' && tribeOpenId>=0) closeTribe();
});
cv.addEventListener('wheel', e=>{
  e.preventDefault();
  const before = s2w(e.clientX, e.clientY);
  cam.z *= e.deltaY<0 ? 1.13 : 1/1.13;
  clampCam();
  const after = s2w(e.clientX, e.clientY);
  cam.x += before.x-after.x; cam.y += before.y-after.y; clampCam();
}, {passive:false});

const keys = {};
window.addEventListener('keydown', e=>{
  keys[e.key.toLowerCase()] = true;
  if (e.key===' '){ e.preventDefault(); if (G.phase==='play') togglePause(); }
  if (e.key==='Escape'){ uiState.selected=null; refreshPbtns(); cv.classList.remove('aiming'); }
  if (e.key==='1') setSpeed(1);
  if (e.key==='2') setSpeed(2);
  if (e.key==='3') setSpeed(4);
  if (e.key==='4') setSpeed(0.5);
  if (e.key.toLowerCase()==='m') $('btn-mute').click();
  if (e.key.toLowerCase()==='h') $('ov-help').classList.toggle('hide');
  if (e.key.toLowerCase()==='c') openChronicle();
});
window.addEventListener('keyup', e=> keys[e.key.toLowerCase()]=false);
function keyPan(dt){
  const v = 420*dt/cam.z;
  if (keys['w']||keys['arrowup'])    { cam.y-=v; camTarget=null; }
  if (keys['s']||keys['arrowdown'])  { cam.y+=v; camTarget=null; }
  if (keys['a']||keys['arrowleft'])  { cam.x-=v; camTarget=null; }
  if (keys['d']||keys['arrowright']) { cam.x+=v; camTarget=null; }
  if (keys['+']||keys['=']) cam.z*=1.02;
  if (keys['-']) cam.z/=1.02;
  clampCam();
}

// ---------------- 游戏循环 ----------------
let lastT = performance.now(), acc = 0, miniT = 0;
function frame(t){
  const dt = Math.min(.1, (t-lastT)/1000); lastT = t;
  const simDt = dt * (G.paused?0:G.speed);

  if (G.phase==='title'){
    cam.x = WORLD_PW/2 + Math.sin(t*.00008)*WORLD_PW*.22;
    cam.y = WORLD_PH/2 + Math.cos(t*.00006)*WORLD_PH*.18;
  } else {
    keyPan(dt);
    if (camTarget){
      cam.x += (camTarget.x-cam.x)*Math.min(1,dt*2.2);
      cam.y += (camTarget.y-cam.y)*Math.min(1,dt*2.2);
      cam.z += (camTarget.z-cam.z)*Math.min(1,dt*2.2);
      if (Math.abs(camTarget.z-cam.z)<.01) camTarget=null;
    }
  }

  if (G.phase==='play'){
    acc += simDt;
    let guard = 0;
    while (acc >= 1/SIM_TPS && guard++ < 40){ tickSim(); acc -= 1/SIM_TPS; }
    // 神力恢复(真实时间流速 × 倍速)
    G.power = Math.min(POWER_MAX, G.power + (1.35 + G.faith/100*2.6)*simDt);
    if (G.faith < 12 && !G.hints.faithWarn){
      G.hints.faithWarn = true;
      toast('🙏 信仰低落——过度杀戮让神力恢复缓慢,多施神迹、护佑子民吧', 6);
    }
    updateWalkers(simDt || dt*.2);
    updateFauna(simDt || dt*.2);
    // 音乐紧张层:火灾/冰期/火山灰/战争
    MUS.setTension(!!(G.fires.size>25 || G.iceT>0 || G.ashT>0 || G.wars.length));
  }

  FX.update(simDt);
  render(dt);
  uiHUD();
  miniT += dt;
  if (miniT>.3){ miniT=0; drawMini(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
