// ============ 神力 / 天气 / 天灾系统 ============
"use strict";

const lavaSet = new Set();

// ---------------- 粒子与瞬时特效 ----------------
const FX = {
  parts: [], rings: [], bolts: [], meteors: [], tornados: [], floods: [], cracks: [], beams: [],
  shake: 0, shakeX: 0, shakeY: 0,
  add(p){ if (this.parts.length < 1400) this.parts.push(p); },
  burst(x,y,n,col,spd=60){
    for (let i=0;i<n;i++){ const a=Math.random()*7, v=spd*(.3+Math.random()*.7);
      this.add({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:0,max:.6+Math.random()*.7,type:'dot',col,size:1+Math.random()*2.5}); }
  },
  ring(x,y,r,col){ this.rings.push({x,y,r:6,R:r,t:0,col}); },
  bolt(x,y){
    const pts=[[x,y]];
    let cx=x, cy=y-460;
    while (cy < y-8){ cx += (Math.random()-.5)*34; cy += 40+Math.random()*30; pts.push([cx,cy]); }
    pts.push([x,y]);
    this.bolts.push({pts,t:0});
    AU.thunder();
    flashT = .18;
    this.burst(x,y,14,'#ffef9a',90);
    this.add({x,y,vx:0,vy:-14,life:0,max:1.4,type:'glow',col:'rgba(255,240,160,.5)',size:26});
  },
  smoke(x,y,n=1,col='rgba(70,70,75,.5)'){
    for (let i=0;i<n;i++) this.add({x:x+(Math.random()-.5)*6, y:y+(Math.random()-.5)*4,
      vx:(Math.random()-.5)*8, vy:-14-Math.random()*12, life:0, max:1.6+Math.random()*1.4,
      type:'smoke', col, size:3+Math.random()*4});
  },
  heal(x,y){
    for (let i=0;i<26;i++) this.add({x:x+(Math.random()-.5)*70, y:y+30, vx:0, vy:-38-Math.random()*30,
      life:0, max:1.2, type:'healP', col:'#ffe9a8', size:1.5+Math.random()*2});
  },
  beam(x,y){ this.beams.push({x,y,t:0}); },
  update(dt){
    // 粒子
    for (let i=this.parts.length-1;i>=0;i--){
      const p=this.parts[i];
      p.life+=dt; p.x+=p.vx*dt; p.y+=p.vy*dt;
      if (p.type==='debris') p.vy+=170*dt;
      if (p.type==='ember'||p.type==='spark2') p.vy-=40*dt;
      if (p.life>=p.max) this.parts.splice(i,1);
    }
    for (let i=this.rings.length-1;i>=0;i--){ const r=this.rings[i]; r.t+=dt;
      if (r.t>1.1) this.rings.splice(i,1); }
    for (let i=this.bolts.length-1;i>=0;i--){ const b=this.bolts[i]; b.t+=dt;
      if (b.t>.42) this.bolts.splice(i,1); }
    for (let i=this.beams.length-1;i>=0;i--){ const b=this.beams[i]; b.t+=dt;
      if (b.t>1.5) this.beams.splice(i,1); }
    for (let i=this.cracks.length-1;i>=0;i--){ const c=this.cracks[i]; c.t+=dt;
      if (c.t>3) this.cracks.splice(i,1); }
    // 屏震
    if (this.shake>0){ this.shake=Math.max(0,this.shake-dt);
      const m=this.shake*this.shake*22;
      this.shakeX=(Math.random()-.5)*m; this.shakeY=(Math.random()-.5)*m;
    } else { this.shakeX=this.shakeY=0; }
    // 天气区域计时
    if (G){
      for (let i=G.weatherZones.length-1;i>=0;i--){
        const z=G.weatherZones[i]; z.t-=dt;
        if (z.t<=0){ if (z.type==='snow') zoneColdEnd(); G.weatherZones.splice(i,1); }
      }
      if (G.ashT>0) G.ashT-=dt;
      if (G.iceT>0){ G.iceT-=dt; if (G.iceT<=0){ G.iceT=0; zoneColdEnd(); log('漫长的冰期终于结束了。幸存的部落比从前更坚韧。', 'lg-sys'); } }
      if (G.windT>0) G.windT-=dt;
    }
    // 陨石飞行
    for (let i=this.meteors.length-1;i>=0;i--){
      const m=this.meteors[i]; m.t+=dt;
      if (m.t>=m.dur){ this.meteors.splice(i,1); meteorImpact(m.tx,m.ty); }
    }
    // 龙卷风游走
    for (let i=this.tornados.length-1;i>=0;i--){
      const t=this.tornados[i]; t.t-=dt;
      if (t.t<=0){ this.tornados.splice(i,1); continue; }
      t.ang += (Math.random()-.5)*1.2*dt*8;
      const sp=34*dt;
      t.x+=Math.cos(t.ang)*sp; t.y+=Math.sin(t.ang)*sp;
      if (t.x<20||t.x>WORLD_PW-20||t.y<20||t.y>WORLD_PH-20) t.ang+=Math.PI*.5;
      // 吸起碎片
      if (Math.random()<.5) this.add({x:t.x+(Math.random()-.5)*16, y:t.y+(Math.random()-.5)*10,
        vx:(Math.random()-.5)*30, vy:-60-Math.random()*50, life:0, max:.8, type:'debris', col:'#8a7a5a', size:1.5+Math.random()*2});
      const sx=t.x/TILE-.5, sy=t.y/TILE-.5;
      for (const s of aliveSettlements()){
        if (Math.hypot(s.x-sx,s.y-sy) < 2 && (!t.hitCd[s.id] || t.hitCd[s.id]<performance.now()-2500)){
          t.hitCd[s.id]=performance.now();
          const ok = damageSettlement(s, .16, 'tornado', 2);
          if (ok) disasterSurvived(s, 'tornado', 1);
          this.burst(s.tx,s.ty,16,'#b09a72',80);
        }
      }
    }
    // 洪水推进
    for (let i=this.floods.length-1;i>=0;i--){
      const f=this.floods[i]; f.t+=dt;
      if (f.phase===0){ f.r = f.R*Math.min(1,f.t/2.6);
        if (f.t>=2.6){ f.phase=1; f.t=0; floodPeak(f); } }
      else if (f.phase===1){ if (f.t>=4.4){ f.phase=2; f.t=0; } }
      else { f.r = f.R*Math.max(0,1-f.t/3.2);
        if (f.t>=3.2) this.floods.splice(i,1); }
    }
    // 火山活跃
    for (const v of W.volcanos){
      if (v.t>0){ v.t-=dt; v.acc=(v.acc||0)+dt;
        if (v.acc>.42){ v.acc=0; eruptStep(v); } }
    }
    // 火箭发射倒计时
    if (G && G.launchT>0){ G.launchT-=dt;
      if (G.launchT<=0 && !G.winShown){ G.winShown=true; showWin(); } }
  }
};
let flashT = 0;

// ---------------- 施放神力 ----------------
function canCast(p){ return G.power>=p.cost && !(G.cooldowns[p.id]>performance.now()); }
function castPower(id, wx, wy){ // wx,wy = 格坐标(浮点)
  const p = POWERS.find(q=>q.id===id);
  if (!p || !canCast(p)) return false;
  G.power -= p.cost;
  G.cooldowns[id] = performance.now() + p.cd*1000;
  G.stats.cast++;
  if (p.group==='disaster'){ G.faith = Math.max(0, G.faith-1.6); chron(`神之怒 · ${p.name}降临大地`, 'god'); }
  else if (p.group==='bless'){ chron(`神恩 · ${p.name}眷顾子民`, 'god'); }
  switch(id){
    case 'sun': case 'rain': case 'snow':
      G.weatherZones.push({type:id, x:wx, y:wy, r:8, t:p.dur});
      if (id==='snow'){ AU.whoosh(); log('一股酷寒降临大地。', 'lg-god'); }
      else log(id==='sun'?'阳光破云而出,万物欢欣。':'细雨润泽大地。', 'lg-god');
      break;
    case 'iceage':
      G.iceT = p.dur; AU.quake(); flashT=.12;
      bigToast('🧊 冰河世纪', '大冰期降临,严冬将考验每一个聚落');
      log('天地失色,大冰期开始了。', 'lg-god');
      break;
    case 'wind':
      G.windT = p.dur; AU.whoosh();
      log('长风掠过山海,携带着草木的种子。', 'lg-god');
      break;
    case 'lightning': castLightning(wx,wy); break;
    case 'wildfire': {
      let n=0;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++)
        if (igniteFire(wx+dx, wy+dy, 1)) n++;
      if (n===0){ toast('这里没有可以燃烧的东西', 2.5); }
      else log('燎原之火被点燃了。', 'lg-god');
      break; }
    case 'quake': castQuake(wx,wy); break;
    case 'tornado':
      FX.tornados.push({x:wx*TILE, y:wy*TILE, ang:Math.random()*7, t:20, hitCd:{}});
      AU.whoosh(); FX.shake=.4;
      log('毁灭之风自天际而降。', 'lg-god');
      break;
    case 'flood':
      FX.floods.push({x:wx, y:wy, r:0, R:4.6, t:0, phase:0, peakDone:false});
      AU.whoosh();
      log('大水正在汇聚……', 'lg-god');
      break;
    case 'volcano': castVolcano(wx,wy); break;
    case 'plague': {
      const s = nearestSettlement(wx,wy,5);
      if (!s){ toast('附近没有聚落', 2.5); return true; }
      s.plague = {sev:2+Math.random(), t:0};
      AU.plague();
      log(`疫病在 ${s.name} 的水源中滋生。`, 'lg-god');
      break; }
    case 'meteor':
      FX.meteors.push({tx:wx*TILE, ty:wy*TILE, t:0, dur:2.3,
        x:wx*TILE-700, y:wy*TILE-900});
      AU.whoosh();
      log('一颗陨星划破苍穹!!', 'lg-god');
      break;
    case 'heal': {
      G.stats.miracles++; G.faith=Math.min(100,G.faith+6);
      let healed=0;
      for (const s of aliveSettlements())
        if (Math.hypot(s.x-wx,s.y-wy)<6){
          if (s.plague){ s.plague=null; healed++; log(`${s.name} 的瘟疫被圣光涤净!`, 'lg-good'); }
          s.pop *= 1.05; s.damaged = Math.max(0, s.damaged-.5); s.famine=false;
          FX.heal(s.tx,s.ty);
        }
      AU.sparkle();
      FX.ring(wx*TILE, wy*TILE, 100, '#ffe9a8');
      if (!healed) log('圣光眷顾了你的子民。', 'lg-god');
      break; }
    case 'harvest': {
      G.stats.miracles++; G.faith=Math.min(100,G.faith+4);
      G.weatherZones.push({type:'harvest', x:wx, y:wy, r:6.5, t:p.dur});
      for (const s of aliveSettlements())
        if (Math.hypot(s.x-wx,s.y-wy)<7){ s.store = storeCap(s); FX.heal(s.tx,s.ty); }
      AU.sparkle(); FX.ring(wx*TILE,wy*TILE,110,'#ffd86b');
      log('金色的祝福洒满田野,粮仓满溢。', 'lg-god');
      break; }
    case 'insight': {
      G.stats.miracles++; G.faith=Math.min(100,G.faith+3);
      const alive = aliveSettlements(); if (!alive.length) break;
      const s = alive.reduce((a,b)=> a.pop>b.pop?a:b);
      const nxt = ERAS[G.era+1];
      const b = nxt&&nxt.kn ? (nxt.kn-G.knowledge)*.08 : s.pop*20;
      G.knowledge += Math.max(30,b);
      FX.beam(s.tx,s.ty); AU.sparkle();
      log(`神启降临 ${s.name}:知识 +${fmt(Math.max(30,b))}。`, 'lg-god');
      break; }
  }
  uiRefreshPowerBar();
  return true;
}

function nearestSettlement(wx,wy,maxD){
  let best=null, bd=maxD;
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-wx, s.y-wy);
    if (d<bd){ bd=d; best=s; }
  }
  return best;
}

// ---- 雷击 ----
function castLightning(wx,wy){
  const x=wx|0, y=wy|0;
  FX.bolt(wx*TILE, wy*TILE);
  if (inW(x,y) && W.TR[y*WORLD_W+x]>0) igniteFire(x,y,2);
  else if (inW(x,y) && tAt(x,y)===TER.GRASS && Math.random()<.3) igniteFire(x,y,1);
  // 附近部落目睹天火
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-wx, s.y-wy);
    if (d < 2.6){
      if (!G.flags.fire && G.era < 2 && Math.random() < .68){
        damageSettlement(s, .03, 'fire', 1);
        if (s.alive){ grantAdapt('fire', s);
          log('部落从雷击的余烬中保存了火种——他们学会了让火种不灭!', 'lg-good'); }
      } else {
        const ok = damageSettlement(s, .04, 'fire', 1);
        if (ok) disasterSurvived(s, 'fire', 1);
      }
    } else if (d < 6 && !G.flags.fire && G.era<2 && Math.random()<.25){
      grantAdapt('fire', s);
      log('远处的雷火让部落懂得了敬畏,并学会了保存火种。', 'lg-good');
    }
  }
}

// ---- 野火系统 ----
function igniteFire(x,y,pow){
  if (!inW(x,y)) return false;
  const i=y*WORLD_W+x, t=W.T[i];
  if (W.LAVA[i]>0 || G.fires.has(i)) return false;
  if (pow<2 && G.fires.size>=260) return false; // 全场火点上限,防止失控
  const flam = W.TR[i]>0 || t===TER.GRASS || t===TER.SWAMP || t===TER.TUNDRA;
  if (!flam) return false;
  G.fires.set(i, {x, y, t:0, pow});
  return true;
}
function tickFires(){ // 每年
  const windMul = G.windT>0 ? 2.2 : 1;
  for (const [i,f] of [...G.fires]){
    f.t++;
    // 灭于雨
    let rained=false;
    for (const z of G.weatherZones)
      if (z.type==='rain' && Math.hypot(z.x-f.x, z.y-f.y)<z.r){ rained=true; break; }
    if (rained){ G.fires.delete(i); continue; }
    // 蔓延
    if (f.t>1 && f.t<6){
      for (let k=0;k<2;k++){
        const dx=(Math.random()*3|0)-1, dy=(Math.random()*3|0)-1;
        if (Math.random() < (G.windT>0 ? .14*windMul : .05))
          igniteFire(f.x+dx, f.y+dy, 1);
      }
    }
    // 燃尽
    if (f.t > 5 + W.TR[f.y*WORLD_W+f.x]*1.5){
      G.fires.delete(i);
      scorch(f.x, f.y, .8);
      W.FB[i] += .15; // 灰烬肥沃
    }
  }
  // 火焰灼烧邻近聚落(每聚落 8 年冷却,小部落可以逃离火线)
  for (const s of aliveSettlements()){
    let near=false;
    for (const [i,f] of G.fires)
      if (Math.hypot(f.x-s.x, f.y-s.y)<2.2){ near=true; break; }
    if (near && G.year - (s.fireHitY===undefined?-999:s.fireHitY) > 8){
      s.fireHitY = G.year; s.fireHit = true;
      const ok = damageSettlement(s, .06, 'fire', 1);
      if (ok && G.year - (s.fireSurvY||0) > 160){ s.fireSurvY=G.year; disasterSurvived(s,'fire',1); }
    }
  }
}

// ---- 地震 ----
function castQuake(wx,wy){
  AU.quake(); FX.shake=1.3; flashT=.1;
  // 裂缝视觉
  let cx=wx*TILE, cy=wy*TILE;
  const pts=[[cx,cy]];
  for (let k=0;k<7;k++){ cx+=(Math.random()-.5)*60; cy+=(Math.random()-.5)*60; pts.push([cx,cy]); }
  FX.cracks.push({pts, t:0});
  FX.burst(wx*TILE, wy*TILE, 22, '#a8967c', 70);
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-wx, s.y-wy);
    if (d < 4.4){
      s.damaged = Math.min(1, s.damaged+.5);
      const ok = damageSettlement(s, .3, 'quake', 2);
      if (ok) disasterSurvived(s, 'quake', 2);
    } else if (d < 7){
      damageSettlement(s, .07, 'quake', 1);
    }
  }
  log('大地在震怒中崩裂!', 'lg-god');
}

// ---- 火山 ----
function castVolcano(wx,wy){
  const x=wx|0, y=wy|0;
  AU.boom(true); FX.shake=1.6; flashT=.15;
  // 隆起火山地形
  for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
    const xx=x+dx, yy=y+dy;
    if (!inW(xx,yy)) continue;
    const i=yy*WORLD_W+xx;
    if (TERR[W.T[i]].water){ W.T[i]=TER.BASALT; W.E[i]=Math.max(W.E[i],.5); bakeTile(xx,yy); }
    W.TR[i]=0;
  }
  setTile(x,y,TER.MOUNT);
  W.volcanos.push({x, y, t:13, glow:1});
  miniDirty=true;
  // 直接伤害
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-wx, s.y-wy);
    if (d < 3.6){
      const ok = damageSettlement(s, .55, 'volcano', 3);
      if (ok) disasterSurvived(s, 'volcano', 3);
    } else if (d < 8){
      const ok = damageSettlement(s, .14, 'volcano', 2);
      if (ok) disasterSurvived(s, 'volcano', 2);
    } else if (d < 11 && !G.flags.fire && G.era<2 && s.alive){
      grantAdapt('fire', s);
      log('火山的光芒教会了人类:火,可以被带回家。', 'lg-good');
    }
  }
  G.ashT = 36;
  log('火山轰然喷发,火山灰遮蔽了天空。', 'lg-god');
}
function eruptStep(v){ // 喷发期间抛出熔岩
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]];
  let x=v.x, y=v.y;
  for (let step=0; step<6; step++){
    // 向低处流动
    let best=null, be=W.E[y*WORLD_W+x];
    for (const [dx,dy] of dirs){
      const xx=x+dx, yy=y+dy;
      if (!inW(xx,yy)) continue;
      const e=W.E[yy*WORLD_W+xx];
      if (e<=be && W.LAVA[yy*WORLD_W+xx]<=0 && !TERR[W.T[yy*WORLD_W+xx]].water){ best=[xx,yy]; be=e; }
    }
    if (best && Math.random()<.8){ x=best[0]; y=best[1]; }
    else break;
  }
  igniteLava(x,y);
  // 火山弹
  const a=Math.random()*7, d=30+Math.random()*60;
  FX.add({x:v.x*TILE, y:v.y*TILE, vx:Math.cos(a)*d, vy:Math.sin(a)*d-60,
    life:0, max:1.1, type:'ember', col:'#ff9a3c', size:2.5});
  FX.smoke(v.x*TILE, v.y*TILE-6, 2, 'rgba(60,55,60,.6)');
}
function igniteLava(x,y){
  if (!inW(x,y)) return;
  const i=y*WORLD_W+x;
  if (W.LAVA[i]>0) return;
  setLava(x,y); lavaSet.add(i);
  const s = nearestSettlement(x,y,1.6);
  if (s) damageSettlement(s, .08, 'volcano', 1);
}

// ---- 洪水 ----
function floodPeak(f){
  AU.boom(false); FX.shake=.7;
  FX.ring(f.x*TILE, f.y*TILE, f.R*TILE, '#7fb8e8');
  // 淹没低地: 农田尽毁,泥沙淤积
  const R2 = f.R*f.R;
  for (let dy=-5;dy<=5;dy++) for (let dx=-5;dx<=5;dx++){
    const xx=(f.x+dx)|0, yy=(f.y+dy)|0;
    if (!inW(xx,yy) || dx*dx+dy*dy > R2) continue;
    const i=yy*WORLD_W+xx;
    if (W.E[i] < .52){ W.FARM[i]=0; W.FB[i]+=.22;
      if (W.TR[i] && Math.random()<.3) setTrees(xx,yy,0); }
  }
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-f.x, s.y-f.y);
    if (d < f.R+1){
      s.damaged = Math.min(1, s.damaged+.45);
      const ok = damageSettlement(s, .38, 'flood', 2);
      if (ok) disasterSurvived(s, 'flood', 2);
    } else if (d < f.R+3){
      damageSettlement(s, .08, 'flood', 1);
    }
  }
  log('洪水漫过大地,泥沙之下,是更肥沃的土壤。', 'lg-god');
}

// ---- 陨石 ----
function meteorImpact(px,py){
  const wx=px/TILE, wy=py/TILE;
  AU.boom(true); FX.shake=2.2; flashT=.3;
  FX.ring(px,py,180,'#ffb35c'); FX.ring(px,py,90,'#fff1c9');
  FX.burst(px,py,40,'#ff9a3c',160);
  for (let k=0;k<26;k++)
    FX.add({x:px,y:py,vx:(Math.random()-.5)*200,vy:-Math.random()*180,
      life:0,max:1.6,type:'debris',col:'#6e6259',size:2+Math.random()*3});
  // 坑
  for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++){
    const xx=(wx+dx)|0, yy=(wy+dy)|0;
    if (!inW(xx,yy)) continue;
    const d=Math.hypot(dx,dy), i=yy*WORLD_W+xx;
    if (d<1.7){ setTile(xx,yy,TER.BASALT); setTrees(xx,yy,0); W.FARM[i]=0; W.E[i]=Math.min(W.E[i],.5); }
    else if (d<3.6 && Math.random()<.8-d*.12){ setTile(xx,yy,TER.RUBBLE); setTrees(xx,yy,0); W.FARM[i]=0; }
  }
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-wx, s.y-wy);
    if (d < 4.2){
      const ok = damageSettlement(s, .92, 'meteor', 3);
      if (ok) disasterSurvived(s, 'meteor', 3);
    } else if (d < 7.5){
      const ok = damageSettlement(s, .3, 'meteor', 2);
      if (ok) disasterSurvived(s, 'meteor', 2);
    } else if (d < 14 && s.alive && G.era>=4){
      disasterSurvived(s, 'meteor', 1);
    }
  }
  log('天崩地裂!陨星在大地上留下了深深的伤痕。', 'lg-god');
}

// ---- 严寒伤害(每年结算,区域/冰河) ----
function tickCold(){
  let anyCold=false;
  for (const s of aliveSettlements()){
    let cold=0;
    for (const z of G.weatherZones)
      if (z.type==='snow' && Math.hypot(s.x-z.x, s.y-z.y)<z.r) cold=Math.max(cold,1);
    if (G.iceT>0) cold+=1.5;
    if (cold>0){
      anyCold=true;
      damageSettlement(s, .005*cold, 'cold', 1);
      if (s.alive) s.coldHit = true;
    }
  }
  return anyCold;
}
function zoneColdEnd(){ // 严寒结束:幸存者获得适应
  for (const s of aliveSettlements()){
    if (s.coldHit && s.pop>3){
      s.coldHit=false;
      disasterSurvived(s, 'cold', 1);
    }
  }
}

// ---- 风的馈赠:森林扩散 ----
function tickWind(){
  if (G.windT<=0) return;
  for (let k=0;k<3;k++){
    const x=(Math.random()*WORLD_W)|0, y=(Math.random()*WORLD_H)|0;
    const i=y*WORLD_W+x;
    if (W.T[i]!==TER.GRASS || W.TR[i]>0 || W.FARM[i]) continue;
    // 邻近有树才发芽
    let near=false;
    for (let dy=-1;dy<=1&&!near;dy++) for (let dx=-1;dx<=1;dx++)
      if (inW(x+dx,y+dy) && W.TR[(y+dy)*WORLD_W+x+dx]>0){ near=true; break; }
    if (near && Math.random()<.3){ W.TR[i]=1; bakeTile(x,y); miniDirty=true; }
  }
}

// ---- 冰河世纪:苔原南扩,河流封冻 ----
function tickIce(){
  if (G.iceT<=0) return;
  for (let k=0;k<5;k++){
    const x=(Math.random()*WORLD_W)|0, y=(Math.random()*WORLD_H*.4)|0; // 偏北半球
    const i=y*WORLD_W+x;
    if ((W.T[i]===TER.GRASS || W.T[i]===TER.FOREST) && W.FARM[i]===0 && Math.random()<.4){
      W.T[i]=TER.TUNDRA; bakeTile(x,y); miniDirty=true;
    }
  }
}

// ---- 熔岩冷却 ----
function tickLava(){
  for (const i of [...lavaSet]){
    W.LAVA[i]-= .05;
    if (W.LAVA[i]<=0){ lavaSet.delete(i);
      const x=i%WORLD_W, y=(i/WORLD_W)|0;
      coolLava(x,y);
    }
  }
}

// ---------------- 灾害年度 tick(由 tickSim 调用) ----------------
function tickDisastersSim(){
  tickFires();
  tickCold();
  tickWind();
  tickIce();
  tickLava();
}
