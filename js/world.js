// ============ 世界生成 & 地形渲染 ============
"use strict";

// ---- 随机 & 噪声 ----
function mulberry32(a){ return function(){ a|=0; a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }
let RNG = mulberry32(20260924);
const rnd = (a=1,b)=> b===undefined ? RNG()*a : a+RNG()*(b-a);
const hash2 = (x,y)=>{ let h = (x*374761393 + y*668265263)|0; h=(h^(h>>>13))|0; h=Math.imul(h,1274126177); return ((h^(h>>>16))>>>0)/4294967296; };

function makeNoise(seed){
  const R = mulberry32(seed), perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i=255;i>0;i--){ const j=(R()*(i+1))|0; [p[i],p[j]]=[p[j],p[i]]; }
  for (let i=0;i<512;i++) perm[i]=p[i&255];
  const fade = t=>t*t*(3-2*t);
  return function(x,y){
    const xi=Math.floor(x)&255, yi=Math.floor(y)&255, xf=x-Math.floor(x), yf=y-Math.floor(y);
    const tl=perm[perm[xi]+yi]/255, tr=perm[perm[xi+1]+yi]/255;
    const bl=perm[perm[xi]+yi+1]/255, br=perm[perm[xi+1]+yi+1]/255;
    const u=fade(xf), v=fade(yf);
    return (tl+(tr-tl)*u) + ((bl+(br-bl)*u) - (tl+(tr-tl)*u))*v;
  };
}
function fbm(noise,x,y,oct=4){ let v=0,a=.5,f=1,s=0;
  for(let i=0;i<oct;i++){ v+=noise(x*f,y*f)*a; s+=a; a*=.5; f*=2; } return v/s; }

// ---- 世界数据 ----
let W = null;      // 世界数组集
let tctx = null, tcan = null;   // 地形离屏画布

function genWorld(seed){
  RNG = mulberry32(seed);
  const nE = makeNoise(seed*7+1), nM = makeNoise(seed*13+5), nT = makeNoise(seed*31+9);
  W = {
    seed, w:WORLD_W, h:WORLD_H,
    T : new Uint8Array(WORLD_W*WORLD_H),   // 地形
    E : new Float32Array(WORLD_W*WORLD_H), // 海拔
    M : new Float32Array(WORLD_W*WORLD_H), // 湿度
    TP: 0,                                  // 树木相位(摇曳)
    TR: new Uint8Array(WORLD_W*WORLD_H),   // 树木密度 0-3
    SC: new Float32Array(WORLD_W*WORLD_H), // 焦黑度 0-1(复原中)
    FB: new Float32Array(WORLD_W*WORLD_H), // 灾后肥沃加成(灰烬/泥沙, 随年衰减)
    FARM: new Uint8Array(WORLD_W*WORLD_H), // 农田标记(属于哪个聚落+1)
    FS: new Uint8Array(WORLD_W*WORLD_H),   // 农田生长阶段 0荒 1破土 2青苗 3成熟(>3=过熟计时)
    LAVA: new Float32Array(WORLD_W*WORLD_H),// 熔岩热度>0 为熔岩
    volcanos: [],
  };
  // 群大陆:几个大陆中心散布在世界各处,大世界拥有多个大洲
  const centers = [];
  const nc = 3 + (RNG()*3|0);
  for (let c=0;c<nc;c++)
    centers.push({x: WORLD_W*(.22+RNG()*.56), y: WORLD_H*(.22+RNG()*.56),
      w: WORLD_W*(.26+RNG()*.14), h: WORLD_H*(.26+RNG()*.14)});
  for (let y=0;y<WORLD_H;y++) for (let x=0;x<WORLD_W;x++){
    const i = y*WORLD_W+x;
    // 大陆形状: fbm + 群大陆边缘衰减
    const e1 = fbm(nE, x*.045, y*.045, 5);
    const e2 = fbm(nE, x*.012+40, y*.012+40, 3);
    let e = e1*.72 + e2*.28;
    let df = 1e9;
    for (const c of centers){
      const ddx=(x-c.x)/c.w, ddy=(y-c.y)/c.h;
      df = Math.min(df, ddx*ddx+ddy*ddy);
    }
    e -= df*.5;
    e += (hash2(x,y)-.5)*.02;
    // 温度: 纬度 + 海拔
    const lat = Math.abs(y/WORLD_H - .5)*2;         // 0 赤道 → 1 极地
    const t = 1 - lat*.75 - Math.max(0,e-.45)*.9 + (nT(x*.08,y*.08)-.5)*.25;
    const m = fbm(nM, x*.06, y*.06, 4);
    W.E[i]=Math.max(0,Math.min(1,e));
    W.M[i]=m;
    let ter;
    if (e < .30) ter = TER.DEEP;
    else if (e < .385) ter = TER.SEA;
    else if (e < .41) ter = TER.BEACH;
    else if (e > .80) ter = TER.PEAK;
    else if (e > .70) ter = TER.MOUNT;
    else if (e > .585) ter = TER.HILL;
    else if (t < .18) ter = TER.TUNDRA;
    else if (m < .32 && t > .62) ter = TER.DESERT;
    else if (m > .72 && e < .50 && t > .3) ter = TER.SWAMP;
    else if (m > .55) ter = TER.FOREST;
    else ter = TER.GRASS;
    W.T[i]=ter;
    // 树木
    let tr=0;
    if (ter===TER.FOREST) tr = 2 + (hash2(x+7,y+3)>.55?1:0);
    else if (ter===TER.SWAMP) tr = hash2(x,y)>.5?1:0;
    else if (ter===TER.GRASS && hash2(x+13,y+29)>.88) tr=1;
    else if (ter===TER.HILL && hash2(x+5,y+11)>.8) tr=1;
    W.TR[i]=tr;
  }
  // ---- 河流:自高山奔流入海,支流汇入干流,滞留处冲积成湖 ----
  for (let n=0;n<18;n++){
    let x=0, y=0, ok=false;
    for (let tries=0;tries<300;tries++){
      x=(RNG()*WORLD_W)|0; y=(RNG()*WORLD_H)|0;
      const t=W.T[y*WORLD_W+x];
      if (t===TER.MOUNT || t===TER.PEAK || (!TERR[t].water && W.E[y*WORLD_W+x]>.58)){ ok=true; break; }
    }
    if (!ok) continue;
    let px=x, py=y;
    for (let step=0; step<260; step++){
      const i=py*WORLD_W+px;
      if (TERR[W.T[i]].water) break;               // 已入海/汇入干流
      W.T[i]=TER.RIVER; W.TR[i]=0; W.FARM[i]=0;
      let bx=-1, by=-1, be=1e9;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
        if (!dx && !dy) continue;
        const xx=px+dx, yy=py+dy;
        if (!inW(xx,yy)) continue;
        const e=W.E[yy*WORLD_W+xx] + (RNG()-.5)*.018;  // 扰动让河道蜿蜒
        if (e<be){ be=e; bx=xx; by=yy; }
      }
      if (bx<0) break;
      if (be >= W.E[i] + .008){                    // 流不动了:冲积成小湖后止
        if (RNG()<.45){
          for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++){
            const xx=px+dx, yy=py+dy;
            if (inW(xx,yy) && !TERR[W.T[yy*WORLD_W+xx]].water && W.T[yy*WORLD_W+xx]!==TER.RIVER){
              W.T[yy*WORLD_W+xx]=TER.RIVER; W.TR[yy*WORLD_W+xx]=0;
            }
          }
        }
        break;
      }
      px=bx; py=by;
    }
  }
  // ---- 绿洲:荒漠中的生命之泉 ----
  const deserts = [];
  for (let i=0;i<W.T.length;i++) if (W.T[i]===TER.DESERT) deserts.push(i);
  for (let n=0;n<Math.min(60, deserts.length);n++){
    const i = deserts[(RNG()*deserts.length)|0];
    W.T[i]=TER.OASIS; W.TR[i]=1;
  }
  // ---- 河谷肥力:大河两岸是文明的摇篮 ----
  W.RIVB = new Float32Array(WORLD_W*WORLD_H);
  for (let y=0;y<WORLD_H;y++) for (let x=0;x<WORLD_W;x++){
    const i=y*WORLD_W+x;
    if (W.T[i]!==TER.RIVER) continue;
    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){
      const xx=x+dx, yy=y+dy;
      if (!inW(xx,yy)) continue;
      const j=yy*WORLD_W+xx;
      if (!TERR[W.T[j]].water){
        const d=Math.max(Math.abs(dx),Math.abs(dy));
        W.RIVB[j] += d===1 ? .55 : .3;
      }
    }
  }
  // ---- 浆果丛:林缘的四季口粮 ----
  W.BERRY = new Uint8Array(WORLD_W*WORLD_H);
  for (let n=0;n<900;n++){
    const x=(RNG()*WORLD_W)|0, y=(RNG()*WORLD_H)|0, i=y*WORLD_W+x;
    if ((W.T[i]===TER.GRASS || W.T[i]===TER.FOREST) && W.BERRY[i]===0 && W.FARM[i]===0){
      W.BERRY[i]=1;
    }
  }
  // ---- 矿脉:群山中的铜铁金 ----
  W.ORE = new Uint8Array(WORLD_W*WORLD_H); // 1铜 2铁 3金
  let oreN=0;
  for (let n=0;n<8000 && oreN<70;n++){
    const x=(RNG()*WORLD_W)|0, y=(RNG()*WORLD_H)|0, i=y*WORLD_W+x;
    const t=W.T[i];
    if ((t===TER.MOUNT || t===TER.HILL || t===TER.PEAK) && W.ORE[i]===0){
      const r2=RNG();
      W.ORE[i] = r2<.55 ? 1 : r2<.87 ? 2 : 3;
      oreN++;
    }
  }
  bakeAll();
}

const inW = (x,y)=> x>=0 && y>=0 && x<WORLD_W && y<WORLD_H;
const tAt = (x,y)=> W.T[(y|0)*WORLD_W+(x|0)];
const isWaterT = t => TERR[t].water;
const fertOf = i => TERR[W.T[i]].fert + W.FB[i] + (W.RIVB ? W.RIVB[i] : 0);

// ---- 地形烘焙(离屏) ----
function bakeAll(){
  tcan = document.createElement('canvas');
  tcan.width = WORLD_PW; tcan.height = WORLD_PH;
  tctx = tcan.getContext('2d');
  for (let y=0;y<WORLD_H;y++) for (let x=0;x<WORLD_W;x++) bakeTile(x,y);
}
function bakeTile(x,y){
  const i = y*WORLD_W+x, t = W.T[i], px=x*TILE, py=y*TILE, c=tctx;
  const info = TERR[t], h = hash2(x,y), h2 = hash2(x+91,y+37);
  c.fillStyle = h>.5 ? info.col : info.col2;
  c.fillRect(px,py,TILE,TILE);
  if (info.water){ // 水下渐变
    c.fillStyle = t===TER.DEEP ? 'rgba(4,16,32,.35)' : 'rgba(230,240,255,.10)';
    c.fillRect(px,py,TILE,TILE);
    if (h>.7){ c.fillStyle='rgba(255,255,255,.10)'; c.fillRect(px+3+(h2*8|0), py+4+(h*5|0), 5,1); }
  } else {
    // 陆地细节纹理
    c.fillStyle = 'rgba(0,0,0,.08)';
    if (h>.6) c.fillRect(px+(h2*10|0), py+(h*10|0), 3,2);
    if (t===TER.GRASS||t===TER.FOREST||t===TER.SWAMP){
      c.fillStyle='rgba(255,255,255,.06)';
      if (h2>.45) c.fillRect(px+(h*9|0), py+(h2*11|0), 2,3);
    }
    if (t===TER.MOUNT||t===TER.PEAK||t===TER.HILL){ // 山岩:随海拔起伏,雪线以上戴雪冠
      const ee = W.E[i];
      const pk = 3+(h*3|0)+(t===TER.HILL?1:ee>.72?2:0);
      c.fillStyle = t===TER.PEAK?'rgba(255,255,255,.5)':'rgba(255,255,255,.16)';
      c.beginPath(); c.moveTo(px+2,py+11); c.lineTo(px+7,py+pk); c.lineTo(px+12,py+11); c.closePath(); c.fill();
      c.fillStyle='rgba(0,0,0,.22)';
      c.beginPath(); c.moveTo(px+7,py+pk); c.lineTo(px+12,py+11); c.lineTo(px+7,py+11); c.closePath(); c.fill();
      if ((t===TER.MOUNT&&ee>.78)||t===TER.PEAK){
        c.fillStyle='rgba(255,255,255,.9)';
        c.beginPath(); c.moveTo(px+5.2,py+pk-1.6); c.lineTo(px+7,py+pk-4.2); c.lineTo(px+8.8,py+pk-1.6); c.closePath(); c.fill();
      }
    }
    if (t===TER.DESERT && h>.5){ c.fillStyle='rgba(255,255,255,.10)'; c.fillRect(px+1,py+(h2*12|0),9,1); }
    if (t===TER.BASALT){ c.fillStyle='rgba(255,255,255,.07)';
      if (h>.4) c.fillRect(px+(h2*9|0),py+(h*9|0),3,1); }
    if (t===TER.RUBBLE){ c.fillStyle='rgba(0,0,0,.25)';
      c.fillRect(px+(h2*8|0),py+(h*8|0),4,3); }
  }
  // 树木
  const tr = W.TR[i];
  for (let k=0;k<tr;k++){
    const tx = px + 2 + hash2(x*3+k, y*7)*9, ty = py + 2 + hash2(x*5, y*11+k)*9;
    const dark = t===TER.SWAMP;
    c.fillStyle = dark? '#3a5232' : '#31582a';
    c.beginPath(); c.arc(tx, ty+1, 2.6, 0, 7); c.fill();
    c.fillStyle = dark? '#4e6b40' : '#417a36';
    c.beginPath(); c.arc(tx-.6, ty-.3, 2.0, 0, 7); c.fill();
  }
  // 浆果丛
  if (W.BERRY && W.BERRY[i]){
    ctx.fillStyle='#4a7a3a';
    ctx.beginPath(); ctx.arc(px+7,py+8,3.4,0,7); ctx.fill();
    ctx.fillStyle='#c04a5a';
    for(let k=0;k<3;k++) { ctx.beginPath(); ctx.arc(px+5.4+k*1.7, py+7+(k%2)*1.4, .7, 0, 7); ctx.fill(); }
  }
  // 矿脉:岩上矿斑(铜橙/铁灰/金黄)
  if (W.ORE && W.ORE[i]){
    const oc = W.ORE[i]===1 ? '#d08a4a' : W.ORE[i]===2 ? '#9aa2ac' : '#e8c84a';
    ctx.fillStyle='#6e6a66';
    ctx.beginPath(); ctx.arc(px+7,py+8,3,0,7); ctx.fill();
    ctx.fillStyle=oc;
    ctx.fillRect(px+5.4,py+6.6,1.4,1.4);
    ctx.fillRect(px+7.6,py+8.2,1.2,1.2);
  }
  // 焦黑
  if (W.SC[i] > .02){
    c.fillStyle = `rgba(18,12,8,${Math.min(.85, W.SC[i])})`;
    c.fillRect(px,py,TILE,TILE);
  }
  // 熔岩
  if (W.LAVA[i] > 0){
    c.fillStyle = '#3a1510'; c.fillRect(px,py,TILE,TILE);
    c.fillStyle = 'rgba(255,120,30,.85)';
    if (hash2(x,y)>.3) c.fillRect(px+2,py+2,10,10);
    c.fillStyle = 'rgba(255,220,80,.8)';
    c.fillRect(px+(h2*8|0)+1, py+(h*8|0)+1, 4,2);
  }
}

// ---- 地形变化 ----
function setTile(x,y,t){ if(!inW(x,y))return; const i=y*WORLD_W+x; W.T[i]=t; bakeTile(x,y); miniDirty=true; }
function scorch(x,y,v){ if(!inW(x,y))return; const i=y*WORLD_W+x;
  W.SC[i]=Math.min(1,W.SC[i]+v); if(W.TR[i]){W.TR[i]=0;} bakeTile(x,y); miniDirty=true; }
function setTrees(x,y,v){ if(!inW(x,y))return; W.TR[y*WORLD_W+x]=v; bakeTile(x,y); miniDirty=true; }
function setLava(x,y){ if(!inW(x,y))return; W.LAVA[y*WORLD_W+x]=1; bakeTile(x,y); miniDirty=true; }
function coolLava(x,y){ if(!inW(x,y))return; const i=y*WORLD_W+x;
  if(W.LAVA[i]>0){ W.LAVA[i]=0; W.T[i]=TER.BASALT; W.FB[i]+=.4; bakeTile(x,y); miniDirty=true; } }

// 自然复原(每年调用)
function natureHeal(){
  const n = WORLD_W*WORLD_H;
  for (let k=0;k<220;k++){ // 抽样恢复,避免全图遍历
    const i = (RNG()*n)|0;
    if (W.SC[i] > 0){ W.SC[i]-=.012; if (W.SC[i]<.03) W.SC[i]=0; bakeTile(i%WORLD_W,(i/WORLD_W)|0); }
    if (W.FB[i] > 0) W.FB[i]=Math.max(0,W.FB[i]-.0006);
    const t = W.T[i];
    if (t===TER.RUBBLE && RNG()<.02){ W.T[i]=TER.GRASS; bakeTile(i%WORLD_W,(i/WORLD_W)|0); miniDirty=true; }
    // 无人农田撂荒
    if (W.FARM[i] && (!G || !G.settlements[W.FARM[i]-1] || !G.settlements[W.FARM[i]-1].alive)) W.FARM[i]=0;
  }
}

// 找适合降下生命种子的肥沃地块
function bestSeedSpots(n=28){
  const spots=[];
  for (let y=6;y<WORLD_H-6;y+=2) for (let x=6;x<WORLD_W-6;x+=2){
    const t=tAt(x,y);
    if (t!==TER.GRASS && t!==TER.FOREST) continue;
    let f=0;
    for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++)
      if (inW(x+dx,y+dy)) f += TERR[tAt(x+dx,y+dy)].fert;
    spots.push({x,y,f});
  }
  spots.sort((a,b)=>b.f-a.f);
  // 分散取点
  const picked=[];
  for (const s of spots){
    if (picked.every(p=>Math.hypot(p.x-s.x,p.y-s.y)>11)) picked.push(s);
    if (picked.length>=n) break;
  }
  return picked;
}
