// ============ 渲染引擎 ============
"use strict";

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let VW=0, VH=0, DPR=1;
const cam = { x: WORLD_PW/2, y: WORLD_PH/2, z: 1 };

function resize(){
  DPR = Math.min(2, window.devicePixelRatio||1);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = VW*DPR; cv.height = VH*DPR;
}
window.addEventListener('resize', resize); resize();

const s2w = (sx,sy)=> ({ x:(sx-VW/2)/cam.z + cam.x, y:(sy-VH/2)/cam.z + cam.y });
function w2s(wx,wy){ return { x:(wx-cam.x)*cam.z + VW/2, y:(wy-cam.y)*cam.z + VH/2 }; }
function clampCam(){
  cam.z = Math.max(.42, Math.min(3, cam.z));
  cam.x = Math.max(-80, Math.min(WORLD_PW+80, cam.x));
  cam.y = Math.max(-80, Math.min(WORLD_PH+80, cam.y));
}

// ---- 地形查找 ----
function findTileNear(s, pred, r){
  const cx=s.x|0, cy=s.y|0;
  for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++){
    const x=cx+dx, y=cy+dy;
    if (!inW(x,y)) continue;
    if (pred(tAt(x,y))) return {x,y};
  }
  return null;
}

// ---- 部落颜色工具 ----
function hexRGB(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function shade(h,f){ const [r,g,b]=hexRGB(h); return `rgb(${r*f|0},${g*f|0},${b*f|0})`; }
function hexA(h,a){ const [r,g,b]=hexRGB(h); return `rgba(${r},${g},${b},${a})`; }

// ---- 小地图 ----
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
let miniDirty = true, miniCan = null;
function rebuildMini(){
  if (!miniCan){ miniCan = document.createElement('canvas'); miniCan.width=WORLD_W; miniCan.height=WORLD_H; }
  const c = miniCan.getContext('2d');
  c.clearRect(0,0,WORLD_W,WORLD_H);
  if (tcan){ // 直接缩放烘焙地形画布:与主视图一致且极快
    c.imageSmoothingEnabled = false;
    c.drawImage(tcan, 0,0,WORLD_PW,WORLD_PH, 0,0,WORLD_W,WORLD_H);
  }
  miniDirty=false;
}
function drawMini(){
  if (!miniCan || miniDirty) rebuildMini();
  mctx.imageSmoothingEnabled = false;
  mctx.clearRect(0,0,mini.width,mini.height);
  mctx.drawImage(miniCan,0,0,mini.width,mini.height);
  const sx = mini.width/WORLD_W, sy = mini.height/WORLD_H;
  if (G){
    for (const s of G.settlements) if (s.alive){
      mctx.fillStyle = s.plague ? '#7ce07c' : (s.col || '#ffe9a8');
      const r = 1.5 + s.level;
      mctx.fillRect(s.x*sx-r/2, s.y*sy-r/2, r, r);
    }
    for (const [i] of G.fires){ mctx.fillStyle='#ff5a2c';
      mctx.fillRect((i%WORLD_W)*sx, ((i/WORLD_W)|0)*sy, 2,2); }
    for (const t of FX.tornados){ mctx.fillStyle='#e0d0ff'; mctx.fillRect(t.x/TILE*sx-1,t.y/TILE*sy-1,3,3); }
    for (const f of FX.floods){ mctx.strokeStyle='rgba(120,190,240,.8)'; mctx.beginPath();
      mctx.arc(f.x*sx,f.y*sy,f.r*(sx+sy)/2,0,7); mctx.stroke(); }
    for (const m of FX.meteors){ mctx.fillStyle='#fff'; mctx.beginPath();
      mctx.arc(m.tx/TILE*sx, m.ty/TILE*sy, 3,0,7); mctx.fill(); }
  }
  // 视野框
  const tl = s2w(0,0), br = s2w(VW,VH);
  mctx.strokeStyle = 'rgba(212,175,55,.9)'; mctx.lineWidth=1;
  mctx.strokeRect(tl.x/TILE*sx, tl.y/TILE*sy, (br.x-tl.x)/TILE*sx, (br.y-tl.y)/TILE*sy);
}
mini.addEventListener('pointerdown', e=>{
  const r = mini.getBoundingClientRect();
  cam.x = (e.clientX-r.left)/mini.width * WORLD_PW;
  cam.y = (e.clientY-r.top)/mini.height * WORLD_PH;
  clampCam();
});

// ---- 云影 ----
const clouds = [];
for (let i=0;i<9;i++) clouds.push({x:Math.random()*WORLD_PW, y:Math.random()*WORLD_PH,
  r:60+Math.random()*120, vx:4+Math.random()*7});

// ---- 主渲染 ----
let T_ = 0; // 全局动画时间(秒)
function render(dt){
  T_ += dt;
  const z = cam.z;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle = '#07090f'; ctx.fillRect(0,0,VW,VH);
  ctx.save();
  ctx.translate(VW/2 + FX.shakeX, VH/2 + FX.shakeY);
  ctx.scale(z,z);
  ctx.translate(-cam.x, -cam.y);

  // 地形
  if (tcan) ctx.drawImage(tcan, 0, 0);

  const tl = s2w(0,0), br = s2w(VW,VH);
  const x0 = Math.max(0,(tl.x/TILE)|0), y0 = Math.max(0,(tl.y/TILE)|0);
  const x1 = Math.min(WORLD_W-1,(br.x/TILE)|0), y1 = Math.min(WORLD_H-1,(br.y/TILE)|0);

  drawWater(x0,y0,x1,y1);
  if (G){
    drawFarms(x0,y0,x1,y1);
    if (G.era>=4) drawRoads();
    drawLavaGlow(x0,y0,x1,y1);
    drawFauna(x0,y0,x1,y1);
    if (G.era>=3) drawTradeRoutes();
    drawLifeProps(x0,y0,x1,y1);
    drawSettlements();
    drawWalkers();
    drawFires();
    drawFloods();
    drawBoltsBeams();
  }
  drawTornados();
  drawMeteors();
  drawParticles('world');
  drawWeather(dt);
  drawClouds();
  if (G){
    drawVolcanoGlow();
    drawNight(x0,y0,x1,y1);
    drawSeedSpots();
  }
  ctx.restore();

  drawScreenFX();
}

// 水面波光
function drawWater(x0,y0,x1,y1){
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const i=y*WORLD_W+x;
    if (!TERR[W.T[i]].water) continue;
    const ph = hash2(x,y)*7;
    const a = Math.sin(T_*1.6+ph);
    if (a>.55){
      ctx.globalAlpha = (a-.55)*.9;
      ctx.fillRect(x*TILE+3+(hash2(x+9,y)*7|0), y*TILE+4+(hash2(x,y+9)*7|0), 5, 1);
    }
  }
  ctx.globalAlpha = 1;
}

// 农田(按地形长不同作物:草原-麦 / 沼泽-稻 / 丘陵-粟 / 苔原-青稞 / 荒漠-椰枣 / 火山土-火山豆)
function drawFarms(x0,y0,x1,y1){
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++){
    const i=y*WORLD_W+x;
    if (!W.FARM[i]) continue;
    const t=W.T[i];
    const crop = CROPS[t] || CROPS[TER.GRASS];
    const st = W.FS ? W.FS[i] : 3;
    const px=x*TILE, py=y*TILE;
    // 土壤底色 + 垄沟
    ctx.fillStyle = st===0 ? '#7a6647' : '#8a744a';
    ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
    if (t===TER.HILL){
      // 梯田:层层同心弧
      ctx.strokeStyle = 'rgba(60,45,20,.35)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(px+7, py+13, 4.5, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(px+7, py+15, 7.5, Math.PI, 0); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,.22)';
      for (let k=2;k<TILE-1;k+=3) ctx.fillRect(px+1, py+k, TILE-2, 1);
    }
    // 作物随阶段由青转金
    if (st>=1){
      ctx.globalAlpha = Math.min(1, .25+st*.25);
      ctx.fillStyle = st>=3 ? crop.col : '#7da35a';
      ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
      ctx.globalAlpha = 1;
    }
    if (st>=3){
      // 金熟:麦浪微光
      if ((T_*1.5+hash2(x,y)*7)%3 < 1.2){
        ctx.fillStyle='rgba(255,255,220,.55)';
        ctx.fillRect(px+3+(hash2(x+3,y)*7|0), py+3, 1.5, 1.5);
      }
      ctx.fillStyle='rgba(255,220,120,.25)';
      ctx.fillRect(px+1,py+1,TILE-2,TILE-2);
    }
    // 穗粒闪光
    if ((T_*1.5+hash2(x,y)*7)%3 < 1.2){
      ctx.fillStyle='rgba(255,255,220,.4)';
      ctx.fillRect(px+3+(hash2(x+3,y)*7|0), py+3, 1.5, 1.5);
    }
  }
}

// 商路:金色驼道虚线
function drawTradeRoutes(){
  if (!G || !G.routes || !G.routes.length) return;
  ctx.setLineDash([3,8]);
  ctx.lineWidth = 1.1;
  for (const r of G.routes){
    const A=G.settlements[r.a], B=G.settlements[r.b];
    if (!A || !B || !A.alive || !B.alive) continue;
    const pulse = .26 + .1*Math.sin(T_*1.5 + r.a);
    ctx.strokeStyle = `rgba(200,170,90,${pulse})`;
    ctx.beginPath();
    const mx=(A.tx+B.tx)/2 + (A.ty-B.ty)*.07, my=(A.ty+B.ty)/2 + (B.tx-A.tx)*.07;
    ctx.moveTo(A.tx,A.ty);
    ctx.quadraticCurveTo(mx,my,B.tx,B.ty);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// 百姓生活:粮垛 / 晾皮(布)架 / 市集
function drawLifeProps(x0,y0,x1,y1){
  for (const s of G.settlements){
    if (!s.alive) continue;
    const {tx,ty} = s;
    if (s.store/storeCap(s) > .55){
      // 粮垛:仓廪充实
      for (let k=0;k<2;k++){
        const gx = tx + (hash2(s.id*7+k, 3)*30-15), gy = ty + (hash2(s.id*11, 5+k)*22-11);
        ctx.fillStyle='rgba(0,0,0,.2)';
        ctx.beginPath(); ctx.ellipse(gx, gy+3, 4, 1.4, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#d8b545';
        ctx.beginPath(); ctx.arc(gx, gy, 3.2, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(120,90,20,.6)'; ctx.lineWidth=.7;
        ctx.beginPath(); ctx.moveTo(gx-3,gy); ctx.lineTo(gx+3,gy); ctx.stroke();
      }
    }
    // 晾皮架(狩猎时代) → 晾布架(农耕后)
    if (G.era < 5){
      const rx = tx+14, ry = ty-10;
      ctx.strokeStyle='#6d5335'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(rx-5,ry+4); ctx.lineTo(rx-5,ry-4);
      ctx.moveTo(rx+5,ry+4); ctx.lineTo(rx+5,ry-4);
      ctx.moveTo(rx-5,ry-4); ctx.lineTo(rx+5,ry-4);
      ctx.stroke();
      ctx.fillStyle = G.era<3 ? '#b98a5e' : '#d8cbb0';
      ctx.fillRect(rx-4, ry-3, 8, 5);
    }
    // 市集摊位(城镇+)
    if (s.level>=2 && G.era>=3){
      const mx=tx-16, my=ty+8;
      ctx.strokeStyle='#7c5a34'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(mx-5,my+3); ctx.lineTo(mx-5,my-5);
      ctx.moveTo(mx+5,my+3); ctx.lineTo(mx+5,my-5);
      ctx.stroke();
      ctx.fillStyle='#c05a4a';
      ctx.beginPath();
      ctx.moveTo(mx-7,my-5); ctx.lineTo(mx+7,my-5);
      ctx.lineTo(mx+5,my-8); ctx.lineTo(mx-5,my-8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle='#d8b545'; ctx.fillRect(mx-2,my-3,4,3);
    }
  }
}

// 动物:鹿/野猪/猛犸/鱼群
function drawFauna(x0,y0,x1,y1){
  if (!G || !G.herds) return;
  for (const h of G.herds){
    const px=h.x*TILE, py=h.y*TILE;
    if (h.kind==='fish'){
      // 水面涟漪与背鳍
      const rip = Math.sin(T_*2.4+h.ph);
      ctx.strokeStyle=`rgba(220,245,255,${.28+.14*rip})`;
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(px, py, 3.2+rip*.8, 0, 7); ctx.stroke();
      if (rip>.4){
        ctx.fillStyle='rgba(190,225,250,.75)';
        ctx.beginPath();
        ctx.moveTo(px-1.6,py); ctx.quadraticCurveTo(px,py-2.6,px+1.6,py);
        ctx.closePath(); ctx.fill();
      }
      continue;
    }
    if (px<x0*TILE-20||px>x1*TILE+20||py<y0*TILE-20||py>y1*TILE+20) continue;
    const bob = Math.sin(T_*5+h.ph)*.5;
    if (h.kind==='mammoth'){
      ctx.fillStyle='rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(px,py+4,6,2.2,0,0,7); ctx.fill();
      ctx.fillStyle='#5f4331';
      ctx.beginPath(); ctx.ellipse(px,py+bob,5.2,3.6,0,0,7); ctx.fill();
      ctx.fillStyle='#6d4d38';
      ctx.beginPath(); ctx.arc(px+4.4,py-1.4+bob,2.4,0,7); ctx.fill();
      ctx.strokeStyle='#e8dcc0'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px+5.6,py+bob); ctx.quadraticCurveTo(px+7.4,py+1.6+bob,px+6.4,py+3.4+bob); ctx.stroke();
    } else if (h.kind==='boar'){
      ctx.fillStyle='rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(px,py+2.2,3,1.3,0,0,7); ctx.fill();
      ctx.fillStyle='#4e4038';
      ctx.beginPath(); ctx.ellipse(px,py+bob*.5,2.8,1.9,0,0,7); ctx.fill();
      ctx.beginPath(); ctx.arc(px+2.4,py-.4+bob*.5,1.3,0,7); ctx.fill();
    } else { // deer
      ctx.fillStyle='rgba(0,0,0,.22)';
      ctx.beginPath(); ctx.ellipse(px,py+2.6,3.2,1.4,0,0,7); ctx.fill();
      ctx.fillStyle='#9a7148';
      ctx.beginPath(); ctx.ellipse(px,py-1+bob,2.8,1.8,0,0,7); ctx.fill();
      ctx.beginPath(); ctx.arc(px+2.6,py-2.6+bob,1.4,0,7); ctx.fill();
      ctx.strokeStyle='#7a5636'; ctx.lineWidth=.8;
      ctx.beginPath(); ctx.moveTo(px+2.8,py-3.6+bob); ctx.lineTo(px+3.6,py-5+bob); ctx.stroke();
      ctx.strokeStyle='#8a6642'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(px-1,py+.6); ctx.lineTo(px-1,py+2.6); ctx.moveTo(px+1,py+.6); ctx.lineTo(px+1,py+2.6); ctx.stroke();
    }
  }
}

// 道路:每个聚落只连最近的邻居,土路虚点,低缩放时淡出(避免满图乱线)
const roadCache = { sig:'', segs:[] };
function drawRoads(){
  const ss = aliveSettlements();
  const sig = ss.length+'_'+ss.reduce((t,s)=>t+s.id,0);
  if (sig !== roadCache.sig){
    roadCache.sig = sig;
    const segs = [], done = new Set();
    for (const a of ss){
      let best=null, bd=22*TILE;
      for (const b of ss){
        if (a===b) continue;
        const d = Math.hypot(a.tx-b.tx, a.ty-b.ty);
        if (d < bd){ bd=d; best=b; }
      }
      if (best){
        const key = Math.min(a.id,best.id)+'|'+Math.max(a.id,best.id);
        if (!done.has(key)){ done.add(key); segs.push([a,best]); }
      }
    }
    roadCache.segs = segs;
  }
  const fade = Math.max(0, Math.min(1, (cam.z-.55)/.3));
  if (fade <= 0 || !roadCache.segs.length) return;
  ctx.setLineDash([2,5]);
  ctx.lineWidth = 1.3;
  for (const [a,b] of roadCache.segs){
    ctx.strokeStyle = `rgba(105,88,62,${.38*fade})`;
    const mx=(a.tx+b.tx)/2 + (a.ty-b.ty)*.06, my=(a.ty+b.ty)/2 + (b.tx-a.tx)*.06;
    ctx.beginPath(); ctx.moveTo(a.tx,a.ty); ctx.quadraticCurveTo(mx,my,b.tx,b.ty); ctx.stroke();
  }
  ctx.setLineDash([]);
}

// 熔岩辉光
function drawLavaGlow(x0,y0,x1,y1){
  ctx.fillStyle = `rgba(255,110,30,${.25+.15*Math.sin(T_*6)})`;
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++)
    if (W.LAVA[y*WORLD_W+x]>0) ctx.fillRect(x*TILE-1,y*TILE-1,TILE+2,TILE+2);
}
function drawVolcanoGlow(){
  for (const v of W.volcanos){
    if (v.t<=0) continue;
    const px=v.x*TILE+TILE/2, py=v.y*TILE+TILE/2;
    const g = ctx.createRadialGradient(px,py,2,px,py,60);
    g.addColorStop(0,`rgba(255,160,60,${.5+.2*Math.sin(T_*9)})`);
    g.addColorStop(1,'rgba(255,100,20,0)');
    ctx.fillStyle=g; ctx.fillRect(px-60,py-60,120,120);
  }
}

// ---------------- 聚落 ----------------
const HOUSE_STYLE = [ // 各时代建筑配色 [墙, 顶]
  ['#8a6a48','#6d5335'],['#8a6a48','#6d5335'],['#a5794a','#7c5a34'],
  ['#c2a06a','#93764a'],['#cbb391','#a08a62'],['#b06a5a','#7e4a40'],
  ['#9fb2c4','#6e8296'],['#a9c4d6','#7c98ad'],['#c4d3de','#98aab8'],
];
function drawSettlements(){
  const era = G.era;
  for (const s of G.settlements){
    if (!s.alive) continue;
    const {tx,ty} = s;
    const pr = Math.min(1, s.pop/LEVELS[s.level].cap);
    const tcol = s.col || '#c9a53f';
    // 聚落疆域:染上部落颜色
    ctx.fillStyle = hexA(tcol, .16);
    ctx.beginPath(); ctx.arc(tx,ty, 8+s.level*5+pr*4, 0, 7); ctx.fill();
    ctx.strokeStyle = hexA(tcol, .35);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(tx,ty, 8+s.level*5+pr*4, 0, 7); ctx.stroke();
    // 部落旗帜
    const fx = tx + 6 + s.level*3, fy = ty - 8 - s.level*2;
    ctx.strokeStyle='#5a4a38'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy-8); ctx.stroke();
    ctx.fillStyle = tcol;
    ctx.beginPath(); ctx.moveTo(fx, fy-8); ctx.lineTo(fx+6+Math.sin(T_*3+s.id)*1.2, fy-6.5); ctx.lineTo(fx, fy-5); ctx.closePath(); ctx.fill();

    const style = HOUSE_STYLE[era];
    const n = [3,5,9,14,18][s.level];
    for (let k=0;k<n;k++){
      const a = hash2(s.id*31+k, k*7)*Math.PI*2;
      const rr = 3 + hash2(k, s.id*13)*(6+s.level*6);
      const bx = tx+Math.cos(a)*rr, by = ty+Math.sin(a)*rr;
      const sc = .8 + hash2(k*3,k*11)*.5 + (s.level>=3?.3:0);
      drawHouse(bx,by,sc,style, era, k, s);
    }
    // 城墙:火焰时代起立起木栅,青铜后为石墙(耶利哥式)
    if (era>=2){
      ctx.strokeStyle = era>=4 ? 'rgba(150,140,120,.8)' : 'rgba(110,90,60,.7)';
      ctx.lineWidth = era>=4 ? 1.6 : 1.2;
      ctx.setLineDash(era>=4 ? [] : [3,3]);
      ctx.beginPath(); ctx.arc(tx,ty, 8+s.level*5, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }
    // 篝火 / 灯塔
    if (era>=2 && s.level<=1){
      const fl = .6+.4*Math.sin(T_*7+s.id);
      ctx.fillStyle=`rgba(255,${140+fl*80|0},40,${.7*fl+.3})`;
      ctx.beginPath(); ctx.arc(tx,ty,2.4,0,7); ctx.fill();
    }
    // 地理智慧造物
    if (s.geo==='river' && era>=3){
      if (!s._wheel) s._wheel = findTileNear(s, t=>t===TER.RIVER, 3);
      if (s._wheel){
        const wx=s._wheel.x*TILE+7, wy=s._wheel.y*TILE+7;
        ctx.strokeStyle='#5a4a38'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(tx,ty); ctx.stroke();
        ctx.strokeStyle='#6d5335'; ctx.lineWidth=1.4;
        ctx.beginPath(); ctx.arc(wx,wy,5,0,7); ctx.stroke();
        for (let k2=0;k2<4;k2++){
          const aa=T_*1.4+s.id+k2*Math.PI/2;
          ctx.beginPath(); ctx.moveTo(wx,wy); ctx.lineTo(wx+Math.cos(aa)*5, wy+Math.sin(aa)*5); ctx.stroke();
        }
      }
    }
    if (s.geo==='coast' && era>=2){
      if (!s._boat) s._boat = findTileNear(s, t=>t===TER.SEA||t===TER.DEEP||t===TER.OASIS, 3);
      if (s._boat){
        const bx2=s._boat.x*TILE+7, by2=s._boat.y*TILE+9 + Math.sin(T_*2+s.id)*1.2;
        ctx.fillStyle='#7c5a34';
        ctx.beginPath(); ctx.moveTo(bx2-4,by2); ctx.quadraticCurveTo(bx2,by2+3,bx2+4,by2);
        ctx.lineTo(bx2+3,by2-1.2); ctx.lineTo(bx2-3,by2-1.2); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='#e8dcc0'; ctx.lineWidth=.8;
        ctx.beginPath(); ctx.moveTo(bx2,by2-1.2); ctx.lineTo(bx2,by2-7); ctx.stroke();
        ctx.fillStyle='#e8dcc0';
        ctx.beginPath(); ctx.moveTo(bx2+.5,by2-7); ctx.lineTo(bx2+4.5,by2-2); ctx.lineTo(bx2+.5,by2-2); ctx.closePath(); ctx.fill();
      }
    }
    if (s.geo==='desert'){
      if (!s._well) s._well = {x:tx+18, y:ty+10};
      ctx.fillStyle='#9a9184';
      ctx.beginPath(); ctx.arc(s._well.x, s._well.y, 3, 0, 7); ctx.fill();
      ctx.fillStyle='#2a2a30';
      ctx.beginPath(); ctx.arc(s._well.x, s._well.y, 1.6, 0, 7); ctx.fill();
      ctx.strokeStyle='#6d5335'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(s._well.x, s._well.y-3); ctx.lineTo(s._well.x+3, s._well.y-7); ctx.stroke();
    }
    // 工业烟囱
    if (era>=5 && s.level>=3 && Math.random()<.25) FX.smoke(tx+(hash2(s.id,3)*14-7), ty-4, 1, 'rgba(90,90,95,.4)');
    // 太空时代:发射台(首都)
    if (era>=8 && s.id===0) drawRocket(s);
    // 状态标记
    if (s.plague){
      ctx.fillStyle='rgba(110,220,110,.8)';
      ctx.font='9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('🦠', tx+12, ty-12-2*Math.sin(T_*3));
    }
    if (s.famine){
      ctx.fillStyle='rgba(240,180,60,.9)';
      ctx.font='9px sans-serif'; ctx.textAlign='center';
      ctx.fillText('❗', tx-12, ty-12-2*Math.sin(T_*3+2));
    }
    if (s.damaged>.25 && Math.random()<.1) FX.smoke(tx+(Math.random()*16-8), ty, 1);
    // 名牌
    if (cam.z>.75){
      ctx.font = `${s.id===0?'bold ':''}10px "Microsoft YaHei",sans-serif`;
      ctx.textAlign='center';
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      const ny = ty - 14 - s.level*3;
      const tw = ctx.measureText(s.name).width;
      ctx.fillRect(tx-tw/2-4, ny-9, tw+8, 12);
      ctx.fillStyle = s.id===0 ? '#ffe9a8' : '#e8dcc0';
      ctx.fillText(s.name, tx, ny+1);
      if (cam.z>1.3){
        ctx.fillStyle='rgba(200,190,160,.75)'; ctx.font='9px sans-serif';
        ctx.fillText(fmt(s.pop)+' 人', tx, ny+11);
      }
    }
  }
}
function drawHouse(x,y,sc,st,era,k,s){
  ctx.save(); ctx.translate(x,y); ctx.scale(sc,sc);
  if (s.level>=4 && era>=6){ // 高楼
    const h = 12 + hash2(k*5,s.id)*16;
    ctx.fillStyle=st[0]; ctx.fillRect(-3.4,-h,6.8,h);
    ctx.fillStyle=st[1]; ctx.fillRect(-3.4,-h,6.8,2);
    if (era>=6){ // 窗
      ctx.fillStyle = nightF>.25 ? `rgba(255,220,120,${.5+.4*Math.sin(T_*2+k)})` : 'rgba(40,60,80,.8)';
      for (let wy=-h+3; wy<-2; wy+=3.4) for (let wx=-2.4; wx<2.4; wx+=2.4)
        if (hash2(k*17+wx,wy)> .3) ctx.fillRect(wx,wy,1.3,1.8);
    }
  } else if (s.level>=3){ // 多层建筑
    ctx.fillStyle=st[0]; ctx.fillRect(-3.5,-7,7,7);
    ctx.fillStyle=shade(s.col||'#c9a53f',.85); ctx.fillRect(-4,-8,8,2);
    ctx.fillStyle='rgba(30,25,20,.55)'; ctx.fillRect(-1,-4,2,4);
  } else if (s.level===0){ // 帐篷
    ctx.fillStyle=shade(s.col||'#b98a5e',.8);
    ctx.beginPath(); ctx.moveTo(0,-5.5); ctx.lineTo(4,3); ctx.lineTo(-4,3); ctx.closePath(); ctx.fill();
  } else { // 小屋
    ctx.fillStyle=st[0]; ctx.fillRect(-3.2,-3.4,6.4,5.4);
    ctx.fillStyle=shade(s.col||'#c9a53f',.85);
    ctx.beginPath(); ctx.moveTo(-4,-3.2); ctx.lineTo(0,-7.5); ctx.lineTo(4,-3.2); ctx.closePath(); ctx.fill();
    if (era>=6){ ctx.fillStyle=`rgba(255,220,120,${.4+.3*Math.sin(T_*2+k)})`; ctx.fillRect(-.8,-2.6,1.6,1.6); }
    else { ctx.fillStyle='rgba(30,25,20,.5)'; ctx.fillRect(-.7,-2,1.4,3.6); }
  }
  ctx.restore();
}
let rocketH = 0;
function drawRocket(s){
  if (G.launchT>0){
    const prog = 1 - G.launchT/9;
    if (prog>.72){
      const lp=(prog-.72)/.28;
      const ry = s.ty-14-lp*240;
      // 火箭
      ctx.save(); ctx.translate(s.tx, ry);
      ctx.fillStyle='#e8e8ee'; ctx.fillRect(-2.5,-10,5,16);
      ctx.fillStyle='#c33'; ctx.beginPath(); ctx.moveTo(-2.5,-10); ctx.lineTo(0,-15); ctx.lineTo(2.5,-10); ctx.fill();
      ctx.fillStyle='#ffb35c'; ctx.fillRect(-2,6+Math.random()*2,4,6);
      ctx.restore();
      FX.smoke(s.tx+(Math.random()*10-5), s.ty+2, 2, 'rgba(200,200,200,.6)');
      if (Math.random()<.3) AU.rocket();
    } else {
      drawRocketPad(s);
    }
  } else drawRocketPad(s);
}
function drawRocketPad(s){
  ctx.strokeStyle='rgba(220,220,230,.8)'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.arc(s.tx+16, s.ty+6, 6, 0, 7); ctx.stroke();
  ctx.fillStyle='#e8e8ee'; ctx.fillRect(s.tx+16-2, s.ty+6-9, 4, 12);
  ctx.fillStyle='#c33'; ctx.beginPath();
  ctx.moveTo(s.tx+14, s.ty-3); ctx.lineTo(s.tx+16, s.ty-7); ctx.lineTo(s.tx+18, s.ty-3); ctx.fill();
}

// ---------------- 小人 ----------------
function drawWalkers(){
  const col = ERAS[G.era].dot;
  for (const w of G.walkers){
    if (w.kind==='dead'){ continue; }
    if (w.kind==='cart'){ // 粮车:车轮+粮袋+推车人
      ctx.fillStyle='rgba(0,0,0,.28)';
      ctx.beginPath(); ctx.ellipse(w.x, w.y+2.6, 5, 1.6, 0, 0, 7); ctx.fill();
      ctx.fillStyle='#7c5a34';
      ctx.fillRect(w.x-4.5, w.y-4, 9, 4.5);
      ctx.fillStyle='#d8b545';
      ctx.beginPath(); ctx.arc(w.x-.5, w.y-4, 2.4, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#4e4038';
      ctx.beginPath(); ctx.arc(w.x-3, w.y+1, 1.3, 0, 7); ctx.arc(w.x+3, w.y+1, 1.3, 0, 7); ctx.fill();
      const origin = G.settlements[w.home];
      ctx.fillStyle = origin && origin.col ? origin.col : ERAS[G.era].dot;
      ctx.beginPath(); ctx.arc(w.x+5.4, w.y-2+Math.sin(T_*8+w.ph)*.5, 1.7, 0, 7); ctx.fill();
      ctx.fillStyle = G.era>=3 ? '#e8d5b5' : '#8a6a48';
      ctx.beginPath(); ctx.arc(w.x+5.4, w.y-4+Math.sin(T_*8+w.ph)*.5, 1, 0, 7); ctx.fill();
      continue;
    }
    const bob = Math.sin(T_*8+w.ph)*.6;
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(w.x, w.y+2.4, 1.8, .9, 0, 0, 7); ctx.fill();
    // 族人穿部落色,职业由工具区分;草原部族骑马
    const homeS = G.settlements[w.home];
    if (homeS && homeS.geo==='grass' && G.era>=3 && (w.kind==='walk'||w.kind==='hunt')){
      ctx.fillStyle='rgba(0,0,0,.25)';
      ctx.beginPath(); ctx.ellipse(w.x, w.y+2.8, 4.6, 1.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle='#7a5638';
      ctx.beginPath(); ctx.ellipse(w.x, w.y+.6, 3.6, 1.8, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(w.x+3.4, w.y-.8, 1.2, 0, 7); ctx.fill();
      ctx.strokeStyle='#5a4028'; ctx.lineWidth=.8;
      ctx.beginPath();
      ctx.moveTo(w.x-2.4, w.y+2); ctx.lineTo(w.x-2.8, w.y+3.8);
      ctx.moveTo(w.x+2.2, w.y+2); ctx.lineTo(w.x+2.6, w.y+3.8);
      ctx.stroke();
    }
    ctx.fillStyle = homeS && homeS.col ? homeS.col : col;
    ctx.beginPath(); ctx.arc(w.x, w.y+bob, 1.9, 0, 7); ctx.fill();
    ctx.fillStyle = G.era>=3 ? '#e8d5b5' : '#8a6a48';
    ctx.beginPath(); ctx.arc(w.x, w.y+bob-2, 1, 0, 7); ctx.fill();
    if (w.kind==='war'){ // 长矛
      ctx.strokeStyle='#d8d0c0'; ctx.lineWidth=.7;
      ctx.beginPath(); ctx.moveTo(w.x+1, w.y+bob); ctx.lineTo(w.x+3.4, w.y+bob-3.4); ctx.stroke();
    } else if (w.kind==='hunt'){ // 猎弓
      ctx.strokeStyle='#c9b183'; ctx.lineWidth=.7;
      ctx.beginPath(); ctx.arc(w.x+2.4, w.y+bob-1, 1.7, -1.2, 1.2); ctx.stroke();
    } else if (w.kind==='farm'){ // 锄头
      ctx.strokeStyle='#8a6a48'; ctx.lineWidth=.8;
      ctx.beginPath(); ctx.moveTo(w.x+1, w.y+bob+1); ctx.lineTo(w.x+3, w.y+bob-2.6); ctx.stroke();
      ctx.fillStyle='#9a8a6a'; ctx.fillRect(w.x+2.4, w.y+bob-3.4, 1.6, 1.2);
    }
  }
}

// ---------------- 火焰 ----------------
function drawFires(){
  for (const [i,f] of G.fires){
    const px=f.x*TILE+TILE/2, py=f.y*TILE+TILE/2;
    const fl = Math.sin(T_*11+f.x*3)*.5+.5;
    ctx.fillStyle=`rgba(255,${90+fl*90|0},20,${.75})`;
    ctx.beginPath();
    ctx.moveTo(px-4, py+3); ctx.quadraticCurveTo(px-3, py-2-fl*4, px, py-5-fl*4);
    ctx.quadraticCurveTo(px+3, py-2-fl*3, px+4, py+3); ctx.closePath(); ctx.fill();
    ctx.fillStyle=`rgba(255,220,90,${.7})`;
    ctx.beginPath(); ctx.arc(px, py+1, 1.6+fl, 0, 7); ctx.fill();
    if (Math.random()<.12) FX.add({x:px,y:py-3,vx:(Math.random()-.5)*10,vy:-24-Math.random()*20,
      life:0,max:.7,type:'spark2',col:'#ffb35c',size:1.4});
    if (Math.random()<.05) FX.smoke(px,py-6,1,'rgba(70,60,55,.45)');
  }
}

// ---------------- 洪水 ----------------
function drawFloods(){
  for (const f of FX.floods){
    const px=f.x*TILE, py=f.y*TILE, r=f.r*TILE;
    if (r<1) continue;
    const g = ctx.createRadialGradient(px,py,r*.2,px,py,r);
    g.addColorStop(0,'rgba(60,140,210,.55)');
    g.addColorStop(.8,'rgba(70,160,225,.45)');
    g.addColorStop(1,'rgba(90,180,240,.15)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(px,py,r,0,7); ctx.fill();
    ctx.strokeStyle=`rgba(220,240,255,${.3+.2*Math.sin(T_*4)})`;
    ctx.lineWidth=1.5; ctx.stroke();
    // 波纹粒子
    if (Math.random()<.4){
      const a=Math.random()*7, d=Math.random()*r;
      FX.add({x:px+Math.cos(a)*d,y:py+Math.sin(a)*d,vx:0,vy:0,life:0,max:.5,type:'dot',
        col:'rgba(220,240,255,.5)',size:1.5});
    }
  }
}

// ---------------- 龙卷风 ----------------
function drawTornados(){
  for (const t of FX.tornados){
    const h=64;
    ctx.strokeStyle='rgba(200,200,215,.75)';
    for (let ly=0; ly<h; ly+=7){
      const w = 3 + ly*.34;
      const wob = Math.sin(T_*10+ly*.35)*w*.5;
      ctx.lineWidth = 2+ly*.08;
      ctx.globalAlpha = .75 - ly/h*.4;
      ctx.beginPath();
      ctx.ellipse(t.x+wob, t.y-ly+h, w, w*.45, 0, 0, 7);
      ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
}

// ---------------- 陨星 ----------------
function drawMeteors(){
  for (const m of FX.meteors){
    const p = m.t/m.dur;
    const x = m.x + (m.tx-m.x)*p, y = m.y + (m.ty-m.y)*p;
    // 落点预警
    ctx.strokeStyle=`rgba(255,120,60,${.4+.3*Math.sin(T_*12)})`;
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(m.tx, m.ty, 3.5*TILE*(1-p*.4), 0, 7); ctx.stroke();
    // 火球与拖尾
    const g = ctx.createRadialGradient(x,y,2,x,y,26);
    g.addColorStop(0,'rgba(255,240,190,.95)');
    g.addColorStop(.3,'rgba(255,150,50,.8)');
    g.addColorStop(1,'rgba(255,80,20,0)');
    ctx.fillStyle=g; ctx.fillRect(x-26,y-26,52,52);
    ctx.strokeStyle='rgba(255,170,80,.5)'; ctx.lineWidth=5;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-46,y-62); ctx.stroke();
    if (Math.random()<.6) FX.add({x,y,vx:(Math.random()-.5)*20,vy:20,life:0,max:.5,type:'spark2',col:'#ffb35c',size:2});
  }
}

// ---------------- 闪电 / 光柱 / 裂缝 / 光环 ----------------
function drawBoltsBeams(){
  for (const b of FX.bolts){
    const a = 1-b.t/.42;
    ctx.strokeStyle=`rgba(255,250,220,${a})`;
    ctx.lineWidth=2.6; ctx.lineJoin='round';
    ctx.beginPath();
    b.pts.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.stroke();
    ctx.strokeStyle=`rgba(200,170,255,${a*.4})`; ctx.lineWidth=7; ctx.stroke();
  }
  for (const b of FX.beams){
    const a = Math.min(1, b.t*3) * Math.max(0, 1-b.t/1.5);
    const g = ctx.createLinearGradient(b.x, b.y-240, b.x, b.y);
    g.addColorStop(0,`rgba(255,230,150,0)`);
    g.addColorStop(1,`rgba(255,230,150,${a*.7})`);
    ctx.fillStyle=g; ctx.fillRect(b.x-14, b.y-240, 28, 240);
  }
  for (const c of FX.cracks){
    const a = Math.max(0, 1-c.t/3);
    ctx.strokeStyle=`rgba(60,40,30,${a})`; ctx.lineWidth=3;
    ctx.beginPath();
    c.pts.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    ctx.stroke();
    ctx.strokeStyle=`rgba(200,90,50,${a*.6})`; ctx.lineWidth=1; ctx.stroke();
  }
  for (const r of FX.rings){
    const p = r.t/1.1, rr = r.r + (r.R-r.r)*Math.min(1,p*1.15);
    ctx.strokeStyle = r.col.replace(')', `,${(1-p)*.9})`).replace('rgb','rgba').replace('#','');
    ctx.globalAlpha = 1-p; ctx.strokeStyle = r.col;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(r.x,r.y,rr,0,7); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// ---------------- 粒子 ----------------
function drawParticles(){
  for (const p of FX.parts){
    const a = 1-p.life/p.max;
    if (p.type==='smoke'){
      ctx.fillStyle=p.col; ctx.globalAlpha=a*.6;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.size*(1+p.life),0,7); ctx.fill();
    } else {
      ctx.globalAlpha=a; ctx.fillStyle=p.col;
      ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
    }
  }
  ctx.globalAlpha=1;
}

// ---------------- 天气区域 ----------------
function drawWeather(dt){
  if (!G) return;
  for (const z of G.weatherZones){
    const px=z.x*TILE, py=z.y*TILE, r=z.r*TILE;
    if (z.type==='sun'){
      const g=ctx.createRadialGradient(px,py,r*.1,px,py,r);
      g.addColorStop(0,'rgba(255,230,140,.22)'); g.addColorStop(1,'rgba(255,220,120,0)');
      ctx.fillStyle=g; ctx.fillRect(px-r,py-r,r*2,r*2);
      if (Math.random()<.2) FX.add({x:px+(Math.random()-.5)*r,y:py+(Math.random()-.5)*r,
        vx:0,vy:-8,life:0,max:.9,type:'healP',col:'#ffe9a8',size:1.6});
    } else if (z.type==='harvest'){
      const g=ctx.createRadialGradient(px,py,r*.1,px,py,r);
      g.addColorStop(0,'rgba(255,215,90,.26)'); g.addColorStop(1,'rgba(255,200,80,0)');
      ctx.fillStyle=g; ctx.fillRect(px-r,py-r,r*2,r*2);
      if (Math.random()<.3) FX.add({x:px+(Math.random()-.5)*r,y:py+r*.6,
        vx:0,vy:-20,life:0,max:1,type:'healP',col:'#ffd86b',size:2});
    } else if (z.type==='rain' || z.type==='snow'){
      // 云盖
      const g=ctx.createRadialGradient(px,py-r*.3,r*.1,px,py,r);
      g.addColorStop(0, z.type==='rain'?'rgba(60,80,110,.34)':'rgba(200,215,235,.32)');
      g.addColorStop(1,'rgba(80,100,130,0)');
      ctx.fillStyle=g; ctx.fillRect(px-r,py-r,r*2,r*2);
      const n = z.type==='rain'? 26 : 20;
      for (let k=0;k<n;k++){
        const a=Math.random()*7, d=Math.random()*r;
        const x=px+Math.cos(a)*d, y=py+Math.sin(a)*d;
        if (z.type==='rain'){
          ctx.strokeStyle='rgba(170,200,240,.5)'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-3,y+9); ctx.stroke();
        } else {
          ctx.fillStyle='rgba(255,255,255,.8)';
          ctx.fillRect(x+Math.sin(T_*2+k)*3, y, 1.6, 1.6);
        }
      }
    }
  }
}

// ---------------- 云影 ----------------
function drawClouds(){
  const t = T_;
  ctx.fillStyle='rgba(10,14,22,.07)';
  for (const c of clouds){
    c.x += c.vx*.016; if (c.x-c.r>WORLD_PW) c.x=-c.r;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y+Math.sin(t*.1+c.x)*8, c.r, c.r*.55, 0, 0, 7);
    ctx.fill();
  }
}

// ---------------- 昼夜 ----------------
let nightF = 0;
function drawNight(x0,y0,x1,y1){
  const day = (T_%150)/150;
  const n = Math.max(0, Math.sin((day-.5)*Math.PI*2)*-.5+.5); // 0白天 → 1深夜
  nightF = n;
  if (n<.03) return;
  ctx.fillStyle=`rgba(10,16,40,${n*.5})`;
  ctx.fillRect(x0*TILE, y0*TILE, (x1-x0+1)*TILE, (y1-y0+1)*TILE);
  // 城市灯火
  if (G.era>=6){
    for (const s of G.settlements){
      if (!s.alive) continue;
      const g = ctx.createRadialGradient(s.tx,s.ty,2,s.tx,s.ty,20+s.level*10);
      g.addColorStop(0,`rgba(255,210,110,${n*.4})`);
      g.addColorStop(1,'rgba(255,200,100,0)');
      ctx.fillStyle=g; ctx.fillRect(s.tx-40,s.ty-40,80,80);
    }
  }
}

// ---------------- 生命种子候选点 ----------------
let seedSpots = [];
function drawSeedSpots(){
  if (!G || G.phase!=='seed') return;
  const pulse = .5+.5*Math.sin(T_*3);
  for (const s of seedSpots){
    const px=s.x*TILE+TILE/2, py=s.y*TILE+TILE/2;
    ctx.strokeStyle=`rgba(255,230,140,${.35+.45*pulse})`;
    ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.arc(px,py, 7+pulse*4, 0, 7); ctx.stroke();
    ctx.fillStyle=`rgba(255,240,180,${.5+.4*pulse})`;
    ctx.beginPath(); ctx.arc(px,py,2.2,0,7); ctx.fill();
  }
}

// ---------------- 屏幕级特效 ----------------
function drawScreenFX(){
  // 神力瞄准指示
  if (G && G.phase==='play' && uiState.selected && uiState.hover){
    const h = uiState.hover;
    const s = w2s(h.x, h.y);
    const p = POWERS.find(q=>q.id===uiState.selected);
    ctx.strokeStyle='rgba(212,175,55,.9)';
    ctx.setLineDash([6,5]); ctx.lineWidth=1.6;
    const rr = (p.group==='weather' || p.id==='harvest' || p.id==='heal') ? 8*TILE*cam.z :
      (p.id==='meteor'? 4.5*TILE*cam.z : p.id==='quake'||p.id==='flood'? 4.5*TILE*cam.z : 2.6*TILE*cam.z);
    ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, 7); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font='20px sans-serif'; ctx.textAlign='center';
    ctx.fillText(p.icon, s.x, s.y-rr-8);
  }
  // 雷闪白光
  if (flashT>0){
    ctx.fillStyle=`rgba(255,255,255,${flashT*2.2})`;
    ctx.fillRect(0,0,VW,VH);
    flashT=Math.max(0,flashT-.06);
  }
  // 火山灰 global dim
  if (G && G.ashT>0){
    const a = Math.min(.5, G.ashT*.04);
    ctx.fillStyle=`rgba(80,60,40,${a})`;
    ctx.fillRect(0,0,VW,VH);
    if (Math.random()<.3){
      const w = s2w(Math.random()*VW, -10);
      FX.add({x:w.x,y:w.y,vx:6,vy:14,life:0,max:3,type:'smoke',col:'rgba(70,60,50,.5)',size:1.6});
    }
  }
  // 四季:全屏色调与冬雪
  if (G && G.phase!=='title' && G.season!==undefined){
    const S = SEASONS[G.season];
    ctx.fillStyle = S.tint;
    ctx.fillRect(0,0,VW,VH);
    if (S.name==='冬'){
      for (let k=0;k<36;k++){
        const sx=(hash2(k,17)*VW + T_*14)%VW, sy=(hash2(k,43)*VH + T_*26)%VH;
        ctx.fillStyle='rgba(245,250,255,.6)';
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
    }
  }
  // 冰河世纪:冷色滤镜 + 全屏飘雪
  if (G && G.iceT>0){
    ctx.fillStyle=`rgba(150,190,230,${Math.min(.22, G.iceT*.02)})`;
    ctx.fillRect(0,0,VW,VH);
    for (let k=0;k<26;k++){
      const sx=(Math.random()*VW), sy=(Math.random()*VH);
      ctx.fillStyle='rgba(240,250,255,.75)';
      ctx.fillRect(sx, sy+Math.sin(T_*2+k)*6, 2, 2);
    }
    const ig = ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.3, VW/2,VH/2, Math.max(VW,VH)*.8);
    ig.addColorStop(0,'rgba(180,220,255,0)'); ig.addColorStop(1,`rgba(140,180,230,${Math.min(.35,G.iceT*.03)})`);
    ctx.fillStyle=ig; ctx.fillRect(0,0,VW,VH);
  }
  // 暗角
  const vg = ctx.createRadialGradient(VW/2,VH/2,Math.min(VW,VH)*.42, VW/2,VH/2, Math.max(VW,VH)*.75);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.42)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,VW,VH);
}
