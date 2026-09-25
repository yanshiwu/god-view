// ============ 核心模拟:聚落 / 经济 / 进化 ============
// (从运行中的页面抢救恢复)
"use strict";
let G = null;
const DISK = {}; // 预计算圆盘偏移
function disk(r){ if (DISK[r]) return DISK[r];
  const a=[]; for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++) if (dx*dx+dy*dy<=r*r+r*.5) a.push([dx,dy]);
  return DISK[r]=a; }
function newGame(){
  G = {
    phase:'title', year:0, speed:1, paused:false,
    knowledge:0, faith:20, power:100, era:0,
    flags:{}, adaptations:{},
    settlements:[], walkers:[], pendingMig:[],
    herds:[], wars:[], warSeq:0, nextWarY:80,
    chronicle:[], relations:{}, colSeq:0, routes:[], season:0, clim:null, ruins:[], nature:0, faithHighT:0,
    fires:new Map(), weatherZones:[], ashT:0, iceT:0, windT:0,
    stats:{born:0, deaths:0, cast:0, survived:0, miracles:0, storyPop:0, wars:0, hunted:0, harvests:0},
    cooldowns:{}, lastCause:'严酷的自然',
    seedYear:0, launchT:-1, winShown:false, overShown:false,
    hints:{}, dangerT:0,
  };
}
function chron(t, k){ // k: era/war/adapt/culture/god/doom/story
  if (!G) return;
  G.chronicle.push({y:G.year, t, k:k||'story'});
  if (G.chronicle.length>300) G.chronicle.shift();
}
function relKey(a,b){ return Math.min(a.id,b.id)+'|'+Math.max(a.id,b.id); }
function isAlly(a,b){ const r=G.relations[relKey(a,b)]; return !!(r&&r.ally); }
function formTrait(s, id){
  if (!s.alive) return;
  if (!s.traits) s.traits = {};
  if (s.traits[id]) return;
  s.traits[id] = true;
  const T = TRAITS[id];
  chron(`${s.name} 在经历中变得${T.name}`, 'culture');
  log(`【部落特质】${s.name} 获得了「${T.icon}${T.name}」——${T.fx}`, 'lg-good');
}
function genName(level){
  const suf = ['部落','村','镇','城','都'][level] || '聚落';
  for (let k=0;k<30;k++){
    const n = NAME_PRE[(RNG()*NAME_PRE.length)|0] + suf;
    if (!nameUsed.has(n)){ nameUsed.add(n); return n; }
  }
  return NAME_PRE[(RNG()*NAME_PRE.length)|0] + suf + '·' + ((RNG()*90+10)|0);
}
function spawnSettlement(x,y,pop,level,name,parentCol){
  const s = {
    id: G.settlements.length, x:x+.5, y:y+.5, tx:x*TILE+TILE/2, ty:y*TILE+TILE/2,
    name: name || genName(level), pop, store: 60, level, alive:true, born: G.year,
    col: parentCol || TRIBE_COLORS[G.colSeq++ % TRIBE_COLORS.length],
    plague:null, famine:false, damaged:0, lastMig:G.year, lastLogY:-999, coldY:0,
    seedT: 0,
  };
  G.settlements.push(s);
  s.geo = detectGeo(s);
  if (s.geo && !G.flags['geo_'+s.geo]){
    G.flags['geo_'+s.geo] = true;
    const gg = GEO[s.geo];
    chron(`${s.name} —— ${gg.story}`, 'culture');
    log(`【地理智慧】${s.name}:${gg.story}(${gg.fx})`, 'lg-good');
  }
  return s;
}
const totalPop = ()=> G.settlements.reduce((a,s)=> a + (s.alive?s.pop:0), 0);
const aliveSettlements = ()=> G.settlements.filter(s=>s.alive);
const causeName = c => ({flood:'洪水', quake:'地震', fire:'烈焰', cold:'严寒', meteor:'天陨',
  volcano:'火山', tornado:'龙卷风', plague:'瘟疫', famine:'饥荒'}[c] || c);
function detectGeo(s){
  let river=0, sea=0, grass=0, forest=0, mount=0, desert=0, swamp=0, tundra=0;
  const r=4;
  for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++){
    const x=(s.x+dx)|0, y=(s.y+dy)|0;
    if (!inW(x,y)) continue;
    const t=tAt(x,y);
    if (t===TER.RIVER) river++;
    else if (t===TER.SEA || t===TER.DEEP) sea++;
    else if (t===TER.GRASS) grass++;
    else if (t===TER.FOREST) forest++;
    else if (t===TER.MOUNT || t===TER.PEAK) mount++;
    else if (t===TER.DESERT) desert++;
    else if (t===TER.SWAMP) swamp++;
    else if (t===TER.TUNDRA) tundra++;
  }
  if (river>=2) return 'river';
  if (sea>=6) return 'coast';
  if (swamp>=5) return 'swamp';
  if (tundra>=5) return 'tundra';
  if (grass>=10) return 'grass';
  if (forest>=10) return 'forest';
  if (mount>=3) return 'mountain';
  if (desert>=3) return 'desert';
  return null;
}
function probeGeo(x,y){
  let river=0, sea=0, grass=0, forest=0, mount=0, desert=0, swamp=0, tundra=0;
  for (let dy=-3;dy<=3;dy++) for (let dx=-3;dx<=3;dx++){
    const xx=x+dx, yy=y+dy;
    if (!inW(xx,yy)) continue;
    const t=tAt(xx,yy);
    if (t===TER.RIVER) river++;
    else if (t===TER.SEA||t===TER.DEEP) sea++;
    else if (t===TER.GRASS) grass++;
    else if (t===TER.FOREST) forest++;
    else if (t===TER.MOUNT||t===TER.PEAK) mount++;
    else if (t===TER.DESERT) desert++;
    else if (t===TER.SWAMP) swamp++;
    else if (t===TER.TUNDRA) tundra++;
  }
  if (river>=1) return 'river';
  if (sea>=6) return 'coast';
  if (swamp>=5) return 'swamp';
  if (tundra>=5) return 'tundra';
  if (grass>=10) return 'grass';
  if (forest>=10) return 'forest';
  if (mount>=3) return 'mountain';
  if (desert>=3) return 'desert';
  return null;
}
function landSurvey(s){
  const r = LEVELS[s.level].r, d = disk(r);
  let fert=0, farms=0;
  for (const [dx,dy] of d){
    const x=(s.x+dx)|0, y=(s.y+dy)|0;
    if (!inW(x,y)) continue;
    const i=y*WORLD_W+x;
    fert += TERR[W.T[i]].fert + W.FB[i];
    if (W.FARM[i]===s.id+1) farms++;
  }
  return {fert, farms};
}
function zoneMult(x,y){
  let m=1;
  if (G.iceT>0) m*=.55;
  if (G.ashT>0) m*=.7;
  for (const z of G.weatherZones){
    const d = Math.hypot(x-z.x, y-z.y);
    if (d<z.r) m *= z.type==='sun'?1.5 : z.type==='rain'?1.4 : z.type==='snow'? .35 : z.type==='harvest'? 2.4 : 1;
  }
  return m;
}
function storeCap(s){ return 25*LEVELS[s.level].cap + 200; }
function tickSettlement(s, S){
  if (!s.alive) return;
  S = S || SEASONS[G.season];
  const E = ERAS[G.era], cap = LEVELS[s.level].cap;
  const {fert, farms} = landSurvey(s);
  let income = fert * E.gather * .5 * Math.pow(s.pop,.75) / (1+s.pop/600);
  income *= zoneMult(s.x, s.y);
  income *= 1 + Math.min(farms,20)*.15 * (G.adaptations.irrigation?1.25:1);
  if (G.flags.fire) income *= 1.2;
  if (G.adaptations.ironwork) income *= 1.3;
  if (s.traits && s.traits.rooted) income *= 1.1;
  if (G.flags.cattle) income *= 1.12; // 畜力耕耘
  if (G.flags.plow) income *= 1.08;   // 犁铧
  income += herdIncome(s); // 捕猎与渔获
  income *= S.income;      // 季节收成
  if (G.clim) income *= G.clim.type==='cold' ? .82 : 1.12; // 深度气候
  let eat = s.pop * (G.flags.fire? .85 : 1) * S.eat; // 冬天吃得更多,冬猎所得在 herdIncome 内加成
  s.store = Math.max(0, Math.min(storeCap(s), s.store + income - eat));
  s.income = income; s.eat = eat;
  if (s.store > storeCap(s)*.5 && s.pop < cap && S.growth > 0){
    const g = ((0.0062*s.pop + .2) / (1 + s.level*.5)) * .25 * S.growth * (G.clim ? (G.clim.type==='cold'?.8:1.12) : 1);
    s.pop += g; G.stats.born += g; s.store -= g*2;
    s.famine = false;
    // 房屋随人口而建(每4人一座,受时代规模限制)——房屋能抵御严寒与猛兽
    s.houses = Math.min(Math.ceil(s.pop/4), 6 + s.level*7);
    // 生老病死:寿老与病故(粮食充足时也会有人走到生命尽头)
    const lifeBase = G.era>=2 ? .00018 : .00035; // 医学与温饱延年益寿
    const natd = s.pop * lifeBase * (G.clim&&G.clim.type==='cold'?1.6:1);
    if (natd > 0 && s.pop > 8){
      s.pop -= natd; G.stats.deaths += natd;(G._dsrc=G._dsrc||{})._other=(G._dsrc._other||0)+1;
      if (RNG() < .12 && G.year-(s.deathLogY||0) > 6){
        s.deathLogY = G.year;
        const ways = ['一位老者在篝火旁讲完最后一个故事,安详地闭上了眼。',
          '一位族人染疾不治,族人把他葬在向阳的山坡。',
          '一位猎人 chase 猎物时失足坠崖,再没有回来。'];
        log(`【生死】${s.name}:${ways[(RNG()*ways.length)|0]}`, 'lg-dim');
        FX.burst(s.tx+rnd(-10,10), s.ty+rnd(-10,10), 6, '#c8c8d8', 60);
      }
    }
  } else if (s.store <= .01 && income < eat){
    s.famine = true;
    const d = s.pop*(s.traits&&s.traits.tenacious ? .0015 : .0025);
    s.pop -= d; G.stats.deaths += d;
    if (G.year - s.lastLogY > 120){ s.lastLogY=G.year;
      log(`${s.name} 粮仓见底,族人正在饿死……`, 'lg-bad'); }
    // 生存决策:每 4 年评估一次出路——狩猎/迁徙/战争/灭亡
    s.famY = (s.famY||0)+1;
    if (s.famY % 4 === 0) survivalDecision(s);
  }
  if (!s.famine){
    if (s.famY > 4) formTrait(s, 'tenacious'); // 熬过大饥荒
    s.famY = 0;
  }
  // 长居一地 → 恋土; 以渔为生 → 善渔
  if (G.year - s.born > 400 && s.traits && !s.traits.rooted) formTrait(s, 'rooted');
  if (G.era>=2 && s._fishInc > income*.35) formTrait(s, 'seafaring');
  // 升级聚落
  if (s.pop > cap*.8 && s.level < ERAS[G.era].lv && s.store > storeCap(s)*.4){
    s.level++; s.store *= .45;
    log(`${s.name} 发展为${LEVELS[s.level].name === '营地' ? '村庄' : LEVELS[s.level].name}。`, 'lg-good');
    FX.ring(s.tx, s.ty, 60, '#6fd08c');
    // 开枝散叶:壮大的城镇自立门户,获得新的部族颜色
    if (s.level >= 2){
      const oc = s.col;
      const used = {};
      for (const o of aliveSettlements()) used[o.col] = (used[o.col]||0)+1;
      let best=oc, bs=1e9;
      for (const c of TRIBE_COLORS){ const u = used[c]||0; if (u<bs){ bs=u; best=c; } }
      if (best !== oc){
        s.col = best;
        chron(`${s.name} 开枝散叶,自成一族`, 'culture');
        log(`🏴 ${s.name} 开枝散叶,自成一族——从此有了自己的颜色。`, 'lg-good');
      }
    }
  }
  // 人口压力 → 迁徙
  if (s.pop > cap*.92 && s.level >= ERAS[G.era].lv && G.year - s.lastMig > (s.geo==='grass'?45:70) && RNG() < .4){
    tryMigrate(s);
  }
  // 农田开垦(农业时代+)
  if (G.era >= 3 && s.pop > 30){
    developFarms(s);
  }
  // 瘟疫
  if (s.plague){
    const p = s.plague; p.t++;
    let rate = .001 * p.sev;
    if (G.adaptations.medicine) rate *= .15;
    if (s.traits && s.traits.hygienic) rate *= .4;
    rate *= Math.max(.3, 1 - G.era*.06);
    const d = s.pop * rate; s.pop -= d; G.stats.deaths += d;
    // 向邻近聚落蔓延
    if (p.t % 40 === 0) for (const o of aliveSettlements()){
      if (o!==s && !o.plague && Math.hypot(o.x-s.x,o.y-s.y) < 7 && RNG()<.15*p.sev*(o.traits&&o.traits.hygienic?.4:1)){
        o.plague = {sev:p.sev, t:0};
        log(`瘟疫蔓延到了 ${o.name}!`, 'lg-bad');
      }
    }
    if (s.pop < 3){ s.plague=null; }
    else if (p.t > 160){ // 自然终息(约一年多)
      s.plague = null;
      log(`${s.name} 的瘟疫终于平息了。`, 'lg-sys');
      formTrait(s, 'hygienic');
      if (G.era >= 4) grantAdapt('medicine', s);
    }
  }
  if (s.pop < 1 && s.alive) destroySettlement(s, '衰亡');
}
function destroySettlement(s, why){
  s.alive = false; G.stats.deaths += s.pop; s.pop = 0;(G._dsrc=G._dsrc||{})._other=(G._dsrc._other||0)+1;
  // 留下废墟:断壁残垣随岁月渐渐湮灭,而非凭空消失
  G.ruins.push({x:s.tx, y:s.ty, t:0, col:s.col||'#c9a53f', level:s.level});
  chron(`${s.name}${why==='衰亡'?'在岁月中消逝':'毁灭于'+(causeName(why)||why)}`, 'doom');
  log(`${s.name} 已从地图上${why==='衰亡'?'消逝':'被抹去'}。`, 'lg-bad');
  for (let i=0;i<W.FARM.length;i++) if (W.FARM[i]===s.id+1) W.FARM[i]=0;
  FX.burst(s.tx, s.ty, 26, '#e05c4a');
  checkExtinct();
}
function tryMigrate(s){
  if (!s || !s.alive || s.pop < 6) return false;
  if (aliveSettlements().length >= MAX_SETTLEMENTS + (G.flags.temple?2:0)) return false; // 神庙聚人:上限+2
  const take = Math.max(8, Math.min(s.pop*.3, 20+s.pop*.08));
  const knownGeos = new Set(aliveSettlements().map(o=>o.geo).filter(Boolean));
  let best=null, bestScore=0;
  // 定向殖民:哪 种地形还没有部落,就主动向那里派出探险队
  const allGeos = ['river','coast','grass','forest','mountain','desert','swamp','tundra'];
  const freeGeos = allGeos.filter(g=>!knownGeos.has(g));
  if (freeGeos.length){
    const targetGeo = freeGeos[(RNG()*freeGeos.length)|0];
    // 全图扫描该地形的地块,筛选可达者(≤50 格),随机选一块
    const biomeTiles = {mountain:[TER.MOUNT,TER.PEAK], desert:[TER.DESERT],
      river:[TER.RIVER], coast:[TER.SEA], grass:[TER.GRASS], forest:[TER.FOREST],
      swamp:[TER.SWAMP], tundra:[TER.TUNDRA]}[targetGeo] || [];
    const spots = [];
    for (let i=0;i<W.T.length;i++){
      if (!biomeTiles.includes(W.T[i])) continue;
      const x=i%WORLD_W, y=(i/WORLD_W)|0;
      let near=1e9;
      for (const o of aliveSettlements()) near=Math.min(near, Math.hypot(o.x-x,o.y-y));
      if (near<=50) spots.push({x,y});
    }
    if (spots.length){
      const p2 = spots[(RNG()*spots.length)|0];
      for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){
        const sx=p2.x+dx, sy=p2.y+dy;
        if (!inW(sx,sy)) continue;
        const t=tAt(sx,sy);
        if (isWaterT(t) || t===TER.PEAK || t===TER.MOUNT) continue;
        if (W.LAVA[sy*WORLD_W+sx]>0) continue;
        let occupied=false;
        for (const o of aliveSettlements()) if (Math.hypot(o.x-sx,o.y-sy)<6){ occupied=true; break; }
        if (!occupied){ bestScore=20; best={x:sx,y:sy}; break; }
      }
    }
  }
  // 常规随机勘探(邻近肥沃处)
  if (!best) for (let k=0;k<80;k++){
    const a = RNG()*Math.PI*2, dist = 7 + RNG()*26;
    const x = (s.x + Math.cos(a)*dist)|0, y = (s.y + Math.sin(a)*dist)|0;
    if (!inW(x,y)) continue;
    const t = tAt(x,y);
    if (isWaterT(t) || t===TER.PEAK || t===TER.MOUNT) continue;
    if (W.LAVA[y*WORLD_W+x]>0) continue;
    let sc=0, water=0, variety=0;
    for (const [dx,dy] of disk(2)){
      const xx=x+dx, yy=y+dy;
      if (!inW(xx,yy)) continue;
      const tt = tAt(xx,yy);
      sc += TERR[tt].fert;
      if (TERR[tt].water) water++;
      else if (tt===TER.SWAMP || tt===TER.HILL || tt===TER.TUNDRA || tt===TER.DESERT) variety++;
    }
    // 生计多样性:渔猎水域与多样作物让湖畔、林地边缘也值得定居
    sc += Math.min(water,4)*.9 + Math.min(variety,4)*.6;
    // 未被占据的地形更吸引迁徙(新地理=新智慧=新机会)
    const g = probeGeo(x,y);
    if (g && !knownGeos.has(g)) sc += 8;
    for (const o of aliveSettlements()) if (Math.hypot(o.x-x,o.y-y)<6) sc=0;
    if (sc > bestScore){ bestScore=sc; best={x,y}; }
  }
  if (best && bestScore > (bestScore===20 ? 0 : 6)){
    s.pop -= take; s.lastMig = G.year;
    const ns = spawnSettlement(best.x, best.y, Math.max(6,take*.8), 0, null, s.col);
    log(`${s.name} 的一支族人远行,建立了新的营地「${ns.name}」。`, 'lg-story');
    // 迁徙队伍的视觉表现
    for (let k=0;k<5;k++){
      G.walkers.push({x:s.tx+rnd(-8,8), y:s.ty+rnd(-8,8), tx:ns.tx+rnd(-8,8), ty:ns.ty+rnd(-8,8),
        home:ns.id, spd:26, kind:'migrate', ph:RNG()*7});
    }
    return true;
  }
  return false;
}
function developFarms(s){
  const r = LEVELS[s.level].r + 1;
  const want = 6 + s.level*5 + (s.geo==='river'?4:0);
  let have = 0;
  for (const [dx,dy] of disk(r)){
    const x=(s.x+dx)|0, y=(s.y+dy)|0;
    if (inW(x,y) && W.FARM[y*WORLD_W+x]===s.id+1) have++;
  }
  if (have >= want) return;
  for (let k=0;k<12 && have<want;k++){
    const a=RNG()*Math.PI*2, d=1+RNG()*(r-1);
    const x=(s.x+Math.cos(a)*d)|0, y=(s.y+Math.sin(a)*d)|0;
    if (!inW(x,y)) continue;
    const i=y*WORLD_W+x, t=W.T[i];
    if ((t===TER.GRASS || t===TER.BASALT || t===TER.SWAMP || t===TER.HILL || t===TER.TUNDRA || t===TER.DESERT) && !W.FARM[i] && W.LAVA[i]<=0 && W.SC[i]<.3){
      W.FARM[i]=s.id+1; W.FS[i]=1; have++;
      if (!G.flags['crop_'+t]){
        G.flags['crop_'+t] = true;
        const c = CROPS[t];
        if (!G.flags.farmStory){ G.flags.farmStory = true;
          log(`他们弯下腰,把第一粒${c.name}种子按进泥土——耕作开始了。`, 'lg-story');
          toast(`🌾 耕作开始 · ${c.name}被驯化了`, 4);
        } else {
          log(`他们驯化了适合${TERR[t].name}的作物:${c.name}。`, 'lg-good');
        }
      }
    }
  }
}
function knowledgeGain(){
  const p = totalPop();
  if (p<1) return 0;
  let k = ERAS[G.era].sci * Math.pow(p, .78);
  if (G.flags.fire) k *= 1.15;      // 烹饪假说:熟食提供更多热量养活大脑
  if (G.flags.theocracy) k *= .75;  // 教会掌权:求知受缚
  if (G.faith > 80) k *= 1.25;      // 众志成城
  return k;
}
function eraCheck(){
  const cur = ERAS[G.era], nxt = ERAS[G.era+1];
  if (!nxt) return;
  const knOK = G.knowledge >= nxt.kn;
  const popOK = totalPop() >= (nxt.pop||0);
  const flagOK = !nxt.flag || G.flags[nxt.flag];
  if (knOK && popOK && flagOK){ eraUp(G.era+1); return; }
  // 引导提示
  if (knOK && !flagOK && !G.hints['needFire'] && G.era===1){
    G.hints['needFire'] = true;
    toast('知识已然足够,但文明仍在等待<span class="hl">火种</span>——试试 ⚡雷击 或 🌋火山,让天火降临部落附近', 7);
    log('祭司们说:我们还需要火,真正的火。', 'lg-story');
  }
  if (knOK && !popOK && !G.hints['pop'+(G.era+1)]){
    G.hints['pop'+(G.era+1)] = true;
    toast(`知识已然足够,但文明需要更庞大的人口(${fmt(nxt.pop)} 人)才能迈入<span class="hl">${nxt.name}</span>`, 6);
  }
}
function eraUp(i){
  G.era = i;
  if (typeof MUS !== 'undefined') MUS.setEra(i);
  chron(`【${ERAS[i].name}】${ERAS[i].desc}`, 'era');
  if (i===3){
    const causes = [];
    if (G.iceT>0 || G.ashT>0) causes.push('气候剧变,野谷歉收,人们被迫试种');
    if (G.clim && G.clim.type==='cold') causes.push('持续寒潮让采集难以为继(8.2千年事件式)');
    if (totalPop() > 300) causes.push('人口压力,野食不足,采集难以为继');
    if (G.stats.harvests > 30 || G.stats.miracles > 0) causes.push('盛宴与馈赠——首领以余粮宴请邻族,换取声望与忠诚');
    if (!causes.length) causes.push('河谷沃土诱使人们停下流浪的脚步');
    const t = '【农业的曙光】' + causes.slice(0,2).join(';') + '——耕种的火种就此点燃。';
    chron(t, 'era');
    log(t, 'lg-story');
  }
  if (i===3 && !G.flags.cloth){
    G.flags.cloth = true;
    const t = '他们搓麻为线,织出第一匹衣料——从此不再只靠兽皮蔽体。';
    log('【民生】'+t, 'lg-story');
    chron(t, 'culture');
  }
  if (i===6 && !G.flags.silk){
    G.flags.silk = true;
    const t = '机杼声日夜不停,细棉与丝绸取代了粗麻——衣冠成了体面。';
    log('【民生】'+t, 'lg-story');
    chron(t, 'culture');
  }
  const E = ERAS[i];
  AU.chime();
  bigToast(`${E.name}`, E.en, i===8);
  log(`【${E.name}】${E.desc}。`, 'lg-era');
  for (const s of aliveSettlements()) FX.ring(s.tx, s.ty, 80, '#d4af37');
  if (i===8){
    log('他们开始建造通往星空之塔……', 'lg-era');
    G.launchT = 9;
  }
  G.hints = {};
}
function damageSettlement(s, frac, cause, sev=2){
  if (!s.alive || frac<=0) return false;
  let resist = Math.max(.12, 1 - G.era*.06);
  if (cause==='flood' && G.adaptations.irrigation) resist *= .2;
  if (cause==='quake' && G.adaptations.seismic) resist *= .3;
  if (cause==='fire' && G.adaptations.firebrigade) resist *= .1;
  if (cause==='cold' && G.flags.fire) resist *= .25;
  if (cause==='cold' && G.adaptations.clothing) resist *= .15;
  const d = s.pop * Math.min(.97, frac * resist);
  s.pop -= d; G.stats.deaths += d; G.lastCause = causeName(cause);(G._dsrc=G._dsrc||{})._other=(G._dsrc._other||0)+1;
  s.damaged = Math.min(1, s.damaged + frac*.55);
  if (s.pop < 1.5){ destroySettlement(s, cause); return false; }
  return true; // 幸存
}
c => ({flood:'洪水', quake:'地震', fire:'烈焰', cold:'严寒', meteor:'天陨',
  volcano:'火山', tornado:'龙卷风', plague:'瘟疫', famine:'饥荒'}[c] || c)
function disasterSurvived(s, cause, sev){
  G.stats.survived++;
  G.faith = Math.min(100, G.faith + 2);
  const nxt = ERAS[G.era+1];
  const gap = nxt && nxt.kn ? Math.max(500, nxt.kn - ERAS[G.era].kn) : 5000;
  G.knowledge += Math.max(20, gap*.02*sev);
  log(`${s.name} 在${causeName(cause)}中幸存——苦难铸就智慧(知识 +${fmt(Math.max(20,gap*.02*sev))})。`, 'lg-good');
  // 适应解锁
  if ((cause==='fire'||cause==='volcano') && !G.flags.fire) grantAdapt('fire', s);
  if (cause==='cold' && G.flags.fire && !G.adaptations.clothing) grantAdapt('clothing', s);
  if (cause==='flood' && G.era>=3 && !G.adaptations.irrigation) grantAdapt('irrigation', s);
  if (cause==='fire' && G.era>=4 && !G.adaptations.firebrigade) grantAdapt('firebrigade', s);
  if (cause==='quake' && G.era>=5 && !G.adaptations.seismic) grantAdapt('seismic', s);
  if (cause==='meteor' && G.era>=4 && !G.adaptations.ironwork) grantAdapt('ironwork', s);
}
function grantAdapt(id, s){
  if (G.adaptations[id]) return;
  G.adaptations[id] = true;
  const A = ADAPT[id];
  if (id==='fire') G.flags.fire = true;
  AU.sparkle();
  bigToast(`🏆 文明适应 · ${A.name.trim()}`, A.fx, false);
  log(`【文明适应】${A.name.trim()} —— ${A.fx}`, 'lg-good');
  chron(`文明适应 · ${A.name.trim()}:${A.fx}`, 'adapt');
  if (id==='ironwork'){
    const nxt = ERAS[G.era+1];
    if (nxt && nxt.kn){ const b = nxt.kn*.05; G.knowledge += b;
      log(`陨铁的秘密被揭开,知识 +${fmt(b)}!`, 'lg-good'); }
  }
  if (s) FX.ring(s.tx, s.ty, 90, '#6fd08c');
  uiRefreshAdapt();
}
// ---- 劳役分配:聚落按时代/季节/地理给子民派活 ----
const JOBS = {
  farm:    {icon:'🌾', name:'农夫', tool:'hoe'},
  hunt:    {icon:'🏹', name:'猎户', tool:'bow'},
  mulberry:{icon:'🐛', name:'蚕娘', tool:'basket'},
  plant:   {icon:'🌱', name:'树人', tool:'sapling'},
  fishfarm:{icon:'🎣', name:'渔人', tool:'rod'},
  build:   {icon:'🔨', name:'工匠', tool:'hammer'},
  gather:  {icon:'🫐', name:'采者', tool:'basket'},
  mine:    {icon:'⛏️', name:'矿工', tool:'pick'},
};
function pickJob(s){
  const S = SEASONS[G.season];
  const w = {};
  // 农夫:农业时代起,春夏秋忙、冬闲
  w.farm    = G.era>=3 ? (S.growth>0 ? 4 : .4) : 0;
  // 猎户:始终有,冬季与狩猎时代更多
  w.hunt    = (G.era>=3 ? 1 : 3) * (S.name==='冬' ? 1.8 : 1);
  // 蚕娘(采桑养蚕):农业时代起,春夏为采桑季
  w.mulberry= G.era>=3 ? (S.name==='春'||S.name==='夏' ? 1.6 : .5) : 0;
  if (s.geo==='forest') w.mulberry *= 1.6;
  // 树人(种树):火焰时代起,春天造林
  w.plant   = (G.era>=2 ? (S.name==='春' ? 1.4 : .3) : .15);
  // 渔人(养鱼):水边聚落才有正经渔养
  w.fishfarm= (s.geo==='river'||s.geo==='coast'||s.geo==='swamp') ? 2 : .3;
  // 采者:附近有浆果丛
  w.gather = 1.2;
  // 矿工:青铜时代起,附近有矿脉
  w.mine = G.era>=4 ? 2 : 0;
  // 工匠(盖房修缮):受损时抢修,人满时扩建
  w.build   = (s.damaged>.05 || s.pop>LEVELS[s.level].cap*.75) ? 2.2 : .4;
  // 加权抽取
  let sum = 0; for (const k in w) sum += w[k];
  let r = RNG()*sum;
  for (const k in w){ r -= w[k]; if (r<=0) return k; }
  return 'hunt';
}
function manageWalkers(){
  const alive = aliveSettlements();
  let total = G.walkers.length;
  for (const s of alive){
    const want = Math.min(22, Math.ceil(Math.pow(s.pop,.55)));
    let have = 0, idle = 0;
    for (const w of G.walkers){
      if (w.home!==s.id || w.kind==='dead') continue;
      have++;
      if (w.kind==='walk') idle++;
    }
    // 生老病死:族人岁月增长,寿终正寝
    for (const w of G.walkers){
      if (w.home!==s.id || w.kind==='dead') continue;
      w.age = (w.age===undefined ? 14+RNG()*16 : w.age); // 以季计
      w.age += 1;
      const lifespan = (52 + (w.spd-12)*3.5 + RNG()*0) * 4; // 52~87 岁(季→年)
      if (w.age > lifespan){
        w.kind='dead'; w.deadT=0; w.cause='age';
        G.stats.deaths += 1;
        FX.burst(w.x, w.y, 5, '#d8d8e8', 70);
        if (RNG()<.15) log('【生死】一位白发族人走完了漫长的一生,孩子们把他葬在部落东边的老树下。', 'lg-dim');
      }
    }
    // 新生子民直接上岗
    if (have < want && total < 520){
      const n = Math.min(want-have, 3);
      for (let k=0;k<n;k++){
        G.walkers.push({ x:s.tx+rnd(-14,14), y:s.ty+rnd(-14,14), tx:s.tx, ty:s.ty,
          home:s.id, spd:12+RNG()*10, kind:pickJob(s), ph:RNG()*7 });
        total++;
      }
    }
    // 闲民重新派活:每年必派,每季再抽查三成(更快响应资源变化)
    for (const w of G.walkers)
      if (w.home===s.id && w.kind!=='dead' && (w.kind==='walk' || RNG()<.3)) w.kind = pickJob(s);
  }
}
function updateWalkers(dt){
  const alive = aliveSettlements();
  for (const w of G.walkers){
    if (w.kind==='dead'){ w.deadT=(w.deadT||0)+dt; continue; }
    const home = G.settlements[w.home];
    if (!home || !home.alive){ w.kind='dead'; w.deadT=(w.deadT||0)+dt; continue; }
    // 农夫:寻找成熟农田,收割入仓
    if (w.kind==='farm'){
      if (w.tile===undefined || W.FS[w.tile]<3 || W.FS[w.tile]>=6 || W.FARM[w.tile]!==home.id+1)
        w.tile = findRipeFarm(home);
      if (w.tile === -1){
        // 无成熟农田:去自己部族的青苗田里备耕除草,没有就去更远的荒地踏勘
        if (w.gtile===undefined || Math.hypot(w.gtx-w.x, w.gty-w.y) < 4){
          let best=-1, bd=1e9;
          const cx2=home.x|0, cy2=home.y|0, rr2=LEVELS[home.level].r+6;
          for (let dy=-rr2;dy<=rr2;dy+=2) for (let dx=-rr2;dx<=rr2;dx+=2){
            const x2=cx2+dx, y2=cy2+dy;
            if (!inW(x2,y2)) continue;
            const i2=y2*WORLD_W+x2;
            if (W.FARM[i2]===home.id+1 && W.FS[i2]>0 && W.FS[i2]<3){
              const d2=dx*dx+dy*dy; if (d2<bd){ bd=d2; best=i2; }
            }
          }
          if (best>=0){ w.gtile=best; w.gtx=(best%WORLD_W)*TILE+7; w.gty=((best/WORLD_W)|0)*TILE+7; }
          else { // 踏勘:朝远离部落的随机远方走(不再围着基地打转)
            const a=RNG()*Math.PI*2, dist=(6+RNG()*9)*TILE;
            w.gtx = home.tx + Math.cos(a)*dist; w.gty = home.ty + Math.sin(a)*dist;
            w.gtile = -1;
          }
        }
        w.tx=w.gtx; w.ty=w.gty;
        const fdx=w.tx-w.x, fdy=w.ty-w.y, fd=Math.hypot(fdx,fdy);
        if (fd>0.1){ w.x+=fdx/fd*w.spd*dt; w.y+=fdy/fd*w.spd*dt; }
        continue;
      }
      w.tile===w.gtile && (w.gtile=undefined);
      w.tx = (w.tile%WORLD_W)*TILE+7; w.ty = ((w.tile/WORLD_W)|0)*TILE+7;
      const mdx=w.tx-w.x, mdy=w.ty-w.y, md=Math.hypot(mdx,mdy);
      if (md < 5){
        W.FS[w.tile] = 0;
        home.store = Math.min(storeCap(home), home.store+14);
        G.stats.harvests++;
        FX.burst(w.x, w.y, 9, '#ffd86b', 55);
        w.tile = undefined;
      } else {
        w.x += mdx/md*w.spd*dt; w.y += mdy/md*w.spd*dt;
      }
      continue;
    }
    // 粮车:运粮进城
    if (w.kind==='cart'){
      const cdx=w.tx-w.x, cdy=w.ty-w.y, cd=Math.hypot(cdx,cdy);
      if (cd < 4){
        const A=G.settlements[w.home], B=G.settlements[w.dest];
        if (A && A.alive && B && B.alive){
          const carry = G.flags.wheel ? 14 : 8; // 轮子:商车载重翻倍
          A.store = Math.max(0, A.store-carry);
          B.store = Math.min(storeCap(B), B.store+carry);
          if (w.trade && RNG() < .25) G.knowledge += (15 + G.era*60) * ((G.settlements[w.home].geo==='river'||G.settlements[w.home].geo==='coast')?1.5:1); // 商旅传播见闻(水路更快更广)
        }
        w.kind='dead'; w.deadT=0;
      } else {
        w.x += cdx/cd*w.spd*dt; w.y += cdy/cd*w.spd*dt;
      }
      continue;
    }
    // 蚕娘:采桑养蚕,丝帛换粮
    if (w.kind==='mulberry'){
      if (w.jobT===undefined){
        const t2 = findTileNear(home, t=>t===TER.FOREST, 6);
        if (t2){ w.tx=t2.x*TILE+7; w.ty=t2.y*TILE+7; w.jobT=0; }
        else { w.kind = w.kind==='mulberry' ? 'farm' : pickJob(home); continue; }
      }
      const mdx=w.tx-w.x, mdy=w.ty-w.y, md=Math.hypot(mdx,mdy);
      if (md < 4){
        w.jobT++;
        if (w.jobT > 10){
          home.store = Math.min(storeCap(home), home.store+9);
          if (!G.flags.silkStory){
            G.flags.silkStory = true;
            const t = '采桑养蚕:蚕娘们以桑叶喂蚕,抽丝织帛,换回满满的粮仓。';
            log('【民生】'+t, 'lg-story'); chron(t, 'culture');
          }
          FX.burst(w.x, w.y, 6, '#b8e07a', 40);
          w.jobT = undefined; w.kind = pickJob(home);
        }
      } else { w.x += mdx/md*w.spd*dt; w.y += mdy/md*w.spd*dt; }
      continue;
    }
    // 树人:春天造林,荒地栽下树苗
    if (w.kind==='plant'){
      if (w.spot===undefined){
        const t2 = findTileNear(home, t=>(t===TER.GRASS||t===TER.HILL), 4);
        if (t2){
          const i = t2.y*WORLD_W+t2.x;
          if (W.TR[i]===0 && W.FARM[i]===0){ w.spot=i; w.tx=t2.x*TILE+7; w.ty=t2.y*TILE+7; }
          else { w.kind=pickJob(home); continue; }
        } else { w.kind=pickJob(home); continue; }
      }
      const pdx=w.tx-w.x, pdy=w.ty-w.y, pd=Math.hypot(pdx,pdy);
      if (pd < 4){
        if (W.TR[w.spot]===0){
          W.TR[w.spot]=1; bakeTile(w.spot%WORLD_W,(w.spot/WORLD_W)|0); miniDirty=true;
          G.stats.planted = (G.stats.planted||0)+1;
          if (G.stats.planted===30){
            const t = '十年树木:他们年年栽下树苗,山川渐渐重新披绿。';
            log('【民生】'+t, 'lg-story'); chron(t, 'culture');
          }
          FX.burst(w.x, w.y, 5, '#7da35a', 36);
        }
        w.spot = undefined; w.kind = pickJob(home);
      } else { w.x += pdx/pd*w.spd*dt; w.y += pdy/pd*w.spd*dt; }
      continue;
    }
    // 采者:寻找浆果丛,采摘入仓(丛会再生)
    if (w.kind==='gather'){
      if (w.spot===undefined || !W.BERRY[w.spot]){
        let best=-1, bd=1e9;
        const cx2=home.x|0, cy2=home.y|0, rr2=LEVELS[home.level].r+3;
        for (let dy=-rr2;dy<=rr2;dy++) for (let dx=-rr2;dx<=rr2;dx++){
          const x2=cx2+dx, y2=cy2+dy;
          if (!inW(x2,y2)) continue;
          const i2=y2*WORLD_W+x2;
          if (W.BERRY[i2]){ const d2=dx*dx+dy*dy; if (d2<bd){ bd=d2; best=i2; } }
        }
        if (best<0){ w.kind=pickJob(home); continue; }
        w.spot=best; w.tx=(best%WORLD_W)*TILE+7; w.ty=((best/WORLD_W)|0)*TILE+7;
      }
      const gdx=w.tx-w.x, gdy=w.ty-w.y, gd=Math.hypot(gdx,gdy);
      if (gd < 3.5){
        W.BERRY[w.spot]=0; bakeTile(w.spot%WORLD_W,(w.spot/WORLD_W)|0);
        home.store = Math.min(storeCap(home), home.store+10);
        w.spot = undefined;
        if (Math.random()<.15) w.kind = pickJob(home);
        FX.burst(w.x, w.y, 5, '#c04a5a', 36);
      } else { w.x += gdx/gd*w.spd*dt; w.y += gdy/gd*w.spd*dt; }
      continue;
    }
    // 矿工:开采矿脉(铜铁金),产出与知识
    if (w.kind==='mine'){
      if (w.spot===undefined || !W.ORE[w.spot]){
        let best=-1, bd=1e9;
        const cx2=home.x|0, cy2=home.y|0, rr2=LEVELS[home.level].r+4;
        for (let dy=-rr2;dy<=rr2;dy++) for (let dx=-rr2;dx<=rr2;dx++){
          const x2=cx2+dx, y2=cy2+dy;
          if (!inW(x2,y2)) continue;
          const i2=y2*WORLD_W+x2;
          if (W.ORE[i2]){ const d2=dx*dx+dy*dy; if (d2<bd){ bd=d2; best=i2; } }
        }
        if (best<0){ w.kind=pickJob(home); continue; }
        w.spot=best; w.tx=(best%WORLD_W)*TILE+7; w.ty=((best/WORLD_W)|0)*TILE+7;
      }
      const mdx2=w.tx-w.x, mdy2=w.ty-w.y, md2=Math.hypot(mdx2,mdy2);
      if (md2 < 3){
        w.workT = (w.workT||0)+dt;
        if (Math.random()<.03) FX.burst(w.x, w.y, 3, '#d8c890', 30);
        if (w.workT > 9){
          w.workT = 0;
          const ot = W.ORE[w.spot];
          home.store = Math.min(storeCap(home), home.store + (ot===3?20:ot===2?14:10));
          G.knowledge += 8 + G.era*30; // 采矿催生冶炼知识
          if (ot===3) G.faith = Math.min(100, G.faith+.05);
          if (!G.flags.mineStory){
            G.flags.mineStory = true;
            const t = '他们凿开山岩,第一次触及大地深处的铜与铁。';
            log('【民生】'+t, 'lg-story'); chron(t, 'culture');
          }
          if (Math.random()<.12) w.kind = pickJob(home);
        }
      } else { w.x += mdx2/md2*w.spd*dt; w.y += mdy2/md2*w.spd*dt; }
      continue;
    }
    // 渔人:驻足水岸,撒网养鱼
    if (w.kind==='fishfarm'){
      if (w.bank===undefined){
        const t2 = findTileNear(home, t=>TERR[t].water, 3);
        if (t2){ w.bank=1; w.tx=t2.x*TILE+5; w.ty=t2.y*TILE+5; }
        else { w.kind = w.kind==='fishfarm' ? 'farm' : pickJob(home); continue; }
      }
      const fdx=w.tx-w.x, fdy=w.ty-w.y, fd=Math.hypot(fdx,fdy);
      if (fd < 3){
        w.workT = (w.workT||0)+dt;
        if (Math.random()<.02) FX.burst(w.x+2, w.y, 3, '#a8d8f0', 26);
        if (w.workT > 7){
          home.store = Math.min(storeCap(home), home.store+7);
          w.workT = 0;
          if (Math.random()<.1) w.kind = pickJob(home);
        }
      } else { w.x += fdx/fd*w.spd*dt; w.y += fdy/fd*w.spd*dt; }
      continue;
    }
    // 工匠:修缮受损的房屋,人满时为新居打地基
    if (w.kind==='build'){
      const need = home.damaged > .05;
      if (!need && home.pop <= LEVELS[home.level].cap*.75){ w.kind=pickJob(home); continue; }
      if (w.site===undefined || Math.hypot(w.tx-w.x,w.ty-w.y)<3 && w.jobT>12){
        const r2 = 6 + home.level*5;
        w.site = 1; w.jobT = 0;
        w.tx = home.tx + rnd(-r2,r2)*.8; w.ty = home.ty + rnd(-r2,r2)*.8;
      }
      const bdx=w.tx-w.x, bdy=w.ty-w.y, bd=Math.hypot(bdx,bdy);
      if (bd < 3){
        w.jobT = (w.jobT||0)+dt;
        if (Math.random()<.02) FX.smoke(w.x, w.y-4, 1, 'rgba(180,160,130,.5)');
        if (need) home.damaged = Math.max(0, home.damaged - .008*dt);
        if (w.jobT > 14){
          if (!need && Math.random()<.5){
            FX.burst(w.tx, w.ty, 8, '#c9a06a', 50);
            home.store = Math.max(0, home.store-4); // 建材
          }
          w.jobT = 0;
          if (Math.random()<.3) w.kind = pickJob(home);
        }
      } else { w.x += bdx/bd*w.spd*dt; w.y += bdy/bd*w.spd*dt; }
      continue;
    }
    // 猎人:追逐兽群/鱼群,得手后满载而归
    if (w.kind==='hunt'){
      const h = w.prey;
      if (!h || h.dead || h.n<1){
        // 巡猎:向远方荒野推进,途中遇上兽群则追猎
        let prey=null, pd=1e9;
        for (const h2 of G.herds){
          const d = Math.hypot(h2.x*TILE-w.x, h2.y*TILE-w.y);
          if (d<pd){ pd=d; prey=h2; }
        }
        if (prey && pd < 90) w.prey = prey;
        else {
          if (Math.hypot(w.tx-w.x, w.ty-w.y) < 5){
            const a = RNG()*Math.PI*2, d2 = 60+RNG()*80;
            w.tx = w.x+Math.cos(a)*d2; w.ty = w.y+Math.sin(a)*d2;
          }
          const sdx=w.tx-w.x, sdy=w.ty-w.y, sd2=Math.hypot(sdx,sdy);
          if (sd2>.1){ w.x+=sdx/sd2*w.spd*dt; w.y+=sdy/sd2*w.spd*dt; }
        }
        continue;
      }
      // 渔猎不下水:目标点向聚落方向偏移,留在岸上
      w.tx = h.x*TILE; w.ty = h.y*TILE;
      if (h.kind==='fish'){ w.tx += (home.tx-w.tx)*.22; w.ty += (home.ty-w.ty)*.22; }
      const hdx=w.tx-w.x, hdy=w.ty-w.y, hd=Math.hypot(hdx,hdy);
      if (hd < 5){
        if (h.kind==='mammoth' && Math.random()<.22){
          // 猛犸反杀
          w.kind='dead'; w.deadT=0;
          FX.burst(w.x, w.y, 9, '#c0392b', 50);
        } else {
          h.n--;
          home.store += h.kind==='mammoth'?40 : h.kind==='boar'?14 : 10;
          G.stats.hunted++;
          FX.burst(w.x, w.y, 7, '#b09a72', 46);
          w.kind='walk';
        }
      } else {
        w.x += hdx/hd*w.spd*dt; w.y += hdy/hd*w.spd*dt;
      }
      continue;
    }
    const dx=w.tx-w.x, dy=w.ty-w.y, d=Math.hypot(dx,dy);
    if (d < 3){
      // 选新目标:聚落附近游荡 / 偶尔远行
      if (RNG() < .12 && alive.length>1 && G.era>=2){
        const o = alive[(RNG()*alive.length)|0];
        if (o!==home && Math.hypot(o.x-home.x,o.y-home.y)<26){
          w.tx=o.tx+rnd(-10,10); w.ty=o.ty+rnd(-10,10); w.back = home.id;
        }
      } else {
        const r = LEVELS[home.level].r*TILE + 8;
        w.tx = home.tx + rnd(-r,r)*.7; w.ty = home.ty + rnd(-r,r)*.7;
      }
    } else {
      const v = w.spd*dt;
      w.x += dx/d*v; w.y += dy/d*v;
    }
  }
  // 清理死者与归零
  if ((G.year&31)===0 || G.walkers.length>560)
    G.walkers = G.walkers.filter(w=> w.kind!=='dead' || w.deadT<8);
}
function seasonalDisaster(){
  const pick = (arr) => arr[(RNG()*arr.length)|0];
  const landSpot = () => {
    for (let k=0;k<80;k++){
      const x=(RNG()*WORLD_W)|0, y=(RNG()*WORLD_H)|0;
      const t=tAt(x,y);
      if (t>=2 && t<=12) return {x,y,t};
    }
    return null;
  };
  const sp = landSpot(); if (!sp) return;
  const names = {0:'春汛',1:'夏旱',2:'秋隳',3:'冬暴'};
  const kind = G.season;
  G.stats.natDisaster = (G.stats.natDisaster||0)+1;
  // 灾祸逼出智慧:挺过天灾的部落,知识跃进(适应与发明的源头)
  for (const s of aliveSettlements()){
    const d = Math.hypot(s.x-sp.x, s.y-sp.y);
    if (d < 14){
      G.knowledge += 60 + G.era*300;
      s.store = Math.max(s.store, 1);
    }
  }
  if (kind===0){
    // 春汛:河湖决堤,低地成沼
    floodPeak({x:sp.x, y:sp.y, R:4});
    for (let dy=-4;dy<=4;dy++) for (let dx=-4;dx<=4;dx++){
      const x2=sp.x+dx, y2=sp.y+dy;
      if (!inW(x2,y2)) continue;
      const i2=y2*WORLD_W+x2;
      if ((W.T[i2]===TER.GRASS||W.T[i2]===TER.FOREST) && W.E[i2]<.45 && RNG()<.3) setTile(x2,y2,TER.SWAMP);
    }
    log('🌊 春汛冲开了河堤,低洼的谷地化作沼泽——灾后,泽畔的人学会了掘鱼为生。', 'lg-bad');
    chron('【天灾·春汛】大河决堤,低地成沼。沼泽部落在泥泞中学会了渔稻。', 'doom');
  } else if (kind===1){
    // 夏旱:赤日炎炎,野火自起
    G.weatherZones.push({type:'sun', x:sp.x, y:sp.y, r:7, t:10});
    if (sp.t===TER.FOREST || sp.t===TER.GRASS) igniteFire(sp.x, sp.y, 1);
    log('☀️ 夏旱连月,赤地千里——一道野火在干裂的林地里自己烧了起来。', 'lg-bad');
    chron('【天灾·夏旱】赤日炎炎,野火自焚。幸存的部落从此懂得开辟防火带。', 'doom');
  } else if (kind===2){
    // 秋隳:早霜杀稼
    G.weatherZones.push({type:'snow', x:sp.x, y:sp.y, r:6, t:8});
    for (let dy=-6;dy<=6;dy++) for (let dx=-6;dx<=6;dx++){
      const x2=sp.x+dx, y2=sp.y+dy;
      if (!inW(x2,y2)) continue;
      const i2=y2*WORLD_W+x2;
      if (W.FARM[i2] && W.FS[i2]>0 && W.FS[i2]<4 && RNG()<.35) W.FS[i2]=0;
    }
    log('🌨 秋霜早至,未熟的庄稼冻死田间——部落将盼望寄托于储粮与祭祀。', 'lg-bad');
    chron('【天灾·秋隳】早霜杀稼,青苗尽萎。仓廪之重,自此刻进文明的骨血。', 'doom');
  } else {
    // 冬暴:白毛风雪,冻毙牛羊
    G.weatherZones.push({type:'snow', x:sp.x, y:sp.y, r:9, t:14});
    AU.whoosh();
    log('❄️ 冬暴席卷旷野,风雪埋没了兽群的小径——猎人围炉不出的季节到了。', 'lg-bad');
    chron('【天灾·冬暴】白毛风雪连月不歇。挺过寒冬的部落,把火塘垒得更深。', 'doom');
  }
}
function tickSim(){
  const S = SEASONS[G.season];
  const newYear = (G.season === 3);
  G.season = (G.season+1)%4;
  if (newYear) G.year++;
  // 天气 / 灾害模拟推进
  tickDisastersSim();
  // 上帝之外,天地自怒:四季各有其灾,迫使人类适应进化
  if (G.phase==='play' && RNG() < .016) seasonalDisaster();
  // 聚落(按季节调制收支与生长)
  for (const s of G.settlements) tickSettlement(s, S);
  // 战争与动物
  tickWars();
  tickFauna(S);
  // 瘟疫沿商路传播(黑死病模式):商队即是病毒的翅膀
  for (const s of G.settlements){
    if (!s.alive || !s.plague) continue;
    for (const r of G.routes){
      const oid = r.a===s.id ? r.b : (r.b===s.id ? r.a : -1);
      if (oid < 0) continue;
      const o = G.settlements[oid];
      if (!o || !o.alive || o.plague) continue;
      if (RNG() < .1*s.plague.sev*(o.traits&&o.traits.hygienic?.4:1)){
        o.plague = {sev:s.plague.sev, t:0};
        log(`疫病随着商队的脚步传到了 ${o.name}!`, 'lg-bad');
      }
    }
  }
  // 农田生长 / 农夫 / 商队
  tickFarmsGrowth(S);
  manageFarmers();
  tickTrade();
  // 丰收里程碑:百姓关注衣食耕作
  const hm = [50, 300, 2000];
  for (const m of hm) if (G.stats.harvests>=m && !(G.flags['hm'+m]>=m)){
    G.flags['hm'+m]=m;
    const t = {50:'新谷入仓,百姓以新米祭天——第一次丰收的庆典在篝火旁举行。',
      300:'仓廪渐实,市集兴起,织麻为衣的姑娘们唱起了丰年的歌。',
      2000:'五谷丰登,六畜兴旺——衣食丰足的岁月里,人口与艺术一同生长。'}[m];
    log('【民生】'+t, 'lg-story');
    chron(t, 'culture');
    G.faith = Math.min(100, G.faith+2);
  }
  // 知识与信仰(每季 1/4 年度值)
  G.knowledge += knowledgeGain()/4;
  const p = totalPop();
  if (p>0) G.faith = Math.min(100, G.faith + .0008*Math.pow(p,.6)/4);
  // 时代演进
  eraCheck();
  // 族人补充
  manageWalkers();
  // 自然恢复(每年开春一次)
  if (newYear) natureHeal();
  // 浆果再生(缓慢)
  if (RNG() < .5){
    for (let k=0;k<6;k++){
      const i=(RNG()*W.T.length)|0;
      if (W.BERRY && !W.BERRY[i] && (W.T[i]===TER.GRASS||W.T[i]===TER.FOREST) && !W.FARM[i] && RNG()<.2) W.BERRY[i]=1;
    }
  }
  // 人性回归中庸
  if (G.nature) G.nature *= .999;
  // 信仰过热的代价:教会掌权,求知受缚(Simmiland 式权衡)
  if (G.faith >= 95){
    G.faithHighT++;
    if (G.faithHighT > 300 && !G.flags.theocracy){
      G.flags.theocracy = true;
      const t = '信仰过热:教会执掌了一切,质疑被视作异端——求知的脚步慢了下来。';
      log('⚖️ '+t, 'lg-bad'); chron(t, 'doom');
    }
  } else {
    if (G.flags.theocracy && G.faith < 80){
      G.flags.theocracy = false;
      const t = '教会归于本分,理性重新抬起头。';
      log('📖 '+t, 'lg-good'); chron(t, 'culture');
    }
    G.faithHighT = Math.max(0, G.faithHighT-2);
  }
  // 废墟风化(约30年湮灭)
  for (const r of G.ruins) r.t++;
  G.ruins = G.ruins.filter(r=>r.t<120);
  // 深度气候波动:8.2千年事件式寒潮 / 全新世暖期(压力与馈赠交替)
  if (newYear){
    if (G.clim){
      G.clim.t--;
      if (G.clim.t <= 0){
        log(G.clim.type==='cold' ? '漫长的寒潮终于退去,大地回暖。' : '湿润的暖期结束了,气候归于平常。', 'lg-sys');
        chron(G.clim.type==='cold' ? '寒潮退去,大地回暖' : '气候 optimum 结束', 'story');
        G.clim = null;
      }
    } else if (RNG() < .004){
      if (RNG() < .6){
        G.clim = {type:'cold', t: Math.round(60+RNG()*120)};
        log('❄️ 一次持续数十年的寒冷期降临大地——像八千二百年前的那场寒潮一样。', 'lg-bad');
        chron('深度寒潮降临(数十年)', 'doom');
      } else {
        G.clim = {type:'warm', t: Math.round(80+RNG()*150)};
        log('🌤 一个温暖湿润的气候 optimum 开始了——水草丰美,繁衍加速。', 'lg-good');
        chron('温暖湿润期开始', 'story');
      }
    }
  }
  // 自然事件:偶尔的自然雷雨与野火,让世界自己呼吸(概率按季折算)
  if (RNG() < .0002 && S.name==='夏'){
    const x=(RNG()*WORLD_W)|0, y=(RNG()*WORLD_H)|0;
    if (tAt(x,y)===TER.FOREST){ igniteFire(x,y,1); log('一道夏日雷火在荒野中燃起。', 'lg-sys'); }
  }
  if (RNG() < .001 && G.weatherZones.length<4){
    const x=(RNG()*WORLD_W)|0, y=(RNG()*WORLD_H)|0;
    G.weatherZones.push({type: RNG()<.6?'rain':'sun', x, y, r:9+RNG()*6, t:26+RNG()*20, natural:true});
  }
  // 文明纪事:一次性文化事件
  if (RNG() < (.003 + G.era*.0009)/4 && aliveSettlements().length){
    const pool = CULTURE.filter(c=>!G.flags['c_'+c.id] && G.era>=c.era[0] && G.era<=c.era[1]);
    if (pool.length) applyCulture(pool[(RNG()*pool.length)|0]);
  }
  // 人口里程碑故事
  const marks = [100,500,2000,8000,30000,100000,400000];
  for (const m of marks) if (p>=m && G.stats.storyPop < m){
    G.stats.storyPop = m;
    log(popStory(m), 'lg-story');
    chron(popStory(m), 'story');
  }
  // 灭绝判定
  checkExtinct();
}
function popStory(m){
  const s = {
    100:'部落篝火相连,人口首次突破一百。孩子们已不记得流浪的日子。',
    500:'五百族人在这片土地上生息。长者开始讲述创世的传说——那是关于你的故事。',
    2000:'两千人。陶器、驯兽与歌谣在聚落间流传,文明的轮廓渐渐清晰。',
    8000:'八千人。城市的雏形在河谷出现,人类第一次在墙上刻下自己的历史。',
    30000:'三万人。烟囱与麦田改变了大地的颜色,没有谁再畏惧黑夜。',
    100000:'十万人。灯火连成了星河,他们的目光开始投向头顶的星空。',
    400000:'四十万人。这颗星球已盛不下他们的梦想——他们在绘制通往群星的航线。',
  }[m];
  return s || '';
}
function checkExtinct(){
  if (G.phase!=='play' || G.overShown) return;
  if (G.year < G.seedYear + 60) return;
  if (totalPop() >= 1) return;
  G.overShown = true;
  setTimeout(()=> showGameOver(), 1600);
}
function startWar(A,B,opts={}){
  const desperate = !!opts.desperate;
  const sent = desperate ? Math.max(6, A.pop*.62) : Math.max(4, A.pop*.12);
  A.pop -= sent;
  const w = { key:++G.warSeq, a:A.id, b:B.id, t:0, desperate,
    dur: Math.max(3, 5+Math.hypot(A.x-B.x,A.y-B.y)*.35), sent, phase:'march' };
  G.wars.push(w);
  G.stats.wars++;
  // 战火切断两国商路
  G.routes = G.routes.filter(r=>{
    const cut = (r.a===A.id&&r.b===B.id)||(r.a===B.id&&r.b===A.id);
    if (cut) log(`⚔️ 战火切断了 ${A.name} 与 ${B.name} 之间的商路。`, 'lg-bad');
    return !cut;
  });
  // 视觉战士
  const n = Math.min(14, 2+(sent/9|0));
  for (let k=0;k<n;k++)
    G.walkers.push({x:A.tx+rnd(-8,8), y:A.ty+rnd(-8,8), tx:B.tx+rnd(-10,10), ty:B.ty+rnd(-10,10),
      home:A.id, spd:17+RNG()*8, kind:'war', warKey:w.key, ph:RNG()*7});
  if (desperate){
    toast(`🔥 倾国之战 · ${A.name} 为生存而战 → ${B.name}`, 4);
    chron(`${A.name} 粮尽,倾国之力扑向 ${B.name}`, 'war');
  } else {
    const scale = G.era>=5 ? '世界大战爆发' : G.era>=4 ? '青铜战车轰鸣' : '战鼓擂响';
    log(`⚔️ ${A.name} 向 ${B.name} 宣战!${Math.round(sent)} 名战士踏上征途。`, 'lg-bad');
    toast(`⚔️ ${scale} · ${A.name} → ${B.name}`, 4);
    chron(`${A.name} 向 ${B.name} 宣战`, 'war');
  }
  MUS.setTension(true);
  setTimeout(()=>MUS.setTension(G.fires.size>25 || G.iceT>0 || G.ashT>0), 8000);
}
function resolveWar(w, A, B){
  endWarWalkers(w);
  const terrainB = (B.level>=2 ? 1.35 : 1) * (G.era>=2 ? 1.12 : 1); // 栅栏与城墙
  const atk = w.sent * (0.8+RNG()*.4) * (1+G.era*.15);
  const def = B.pop * .55 * terrainB * (B.traits&&B.traits.martial?1.15:1) * (B.geo==='mountain'?1.1:1);
  const defLoss = Math.min(B.pop*.85, atk*(0.5+RNG()*.5));
  const atkLoss = Math.min(w.sent, def*(0.4+RNG()*.4));
  B.pop -= defLoss; w.sent -= atkLoss;
  G.stats.deaths += defLoss + atkLoss;(G._dsrc=G._dsrc||{})._other=(G._dsrc._other||0)+1;
  G.faith = Math.max(0, G.faith - 2.5);
  FX.burst(B.tx, B.ty, 34, '#e05c4a', 100);
  FX.burst(B.tx, B.ty, 20, '#ffd86b', 70);
  FX.shake=.55;
  if (B.pop < 3){
    const absorbed = w.sent*.6;
    A.pop += absorbed;
    log(`🔥 城破!${B.name} 的幸存者并入 ${A.name}。`, 'lg-bad');
    bigToast('⚔️ 城破', `${A.name} 吞并了 ${B.name}`);
    destroySettlement(B, 'war');
  } else {
    log(`⚔️ ${A.name} 进攻 ${B.name},双方共损失 ${fmt(defLoss+atkLoss)} 人。`, 'lg-bad');
    chron(`${A.name} 攻 ${B.name} 不克,双方共损 ${fmt(defLoss+atkLoss)} 人`, 'war');
    // 早期战争本质是袭掠:得手即抢粮而走
    if (G.era < 4 && !w.desperate && defLoss > B.pop*.25){
      const loot = B.store*.2;
      A.store += loot; B.store *= .8;
      log(`🔥 ${A.name} 掠走了 ${fmt(loot)} 粮草,满载而归。`, 'lg-bad');
      chron(`${A.name} 袭掠 ${B.name} 的粮仓`, 'war');
    }
    // 战争淬炼军事智慧
    const nxt = ERAS[G.era+1];
    const kn = Math.max(30, (nxt&&nxt.kn? (nxt.kn-ERAS[G.era].kn)*.012 : 500)*.5);
    G.knowledge += kn;
    log(`战争的创伤催生了新的战术与盟约(知识 +${fmt(kn)})。`, 'lg-good');
    // 幸存者变得尚武,结下世仇
    formTrait(B, 'martial');
    const rk = relKey(A,B);
    if (!G.relations[rk]) G.relations[rk] = {grudge:0};
    G.relations[rk].grudge = (G.relations[rk].grudge||0)+1;
    if (G.relations[rk].grudge===1) chron(`${B.name} 记住了这场战争——仇恨的种子埋下了`, 'war');
  }
  if (w.sent > 0) A.pop += w.sent*.8;
  if (w.desperate && A.alive){
    G.faith = Math.max(0, G.faith - 1);
    if (B.pop < 3 || defLoss > B.pop*.5){
      const loot = B.store*.55;
      A.store += loot; B.store *= .45;
      log(`🔥 ${A.name} 夺得了 ${fmt(loot)} 粮草——部落得以延续!`, 'lg-good');
    } else {
      log(`💀 ${A.name} 的孤注一掷失败了……`, 'lg-bad');
    }
  }
  if (A.pop<1.5) destroySettlement(A, 'war');
  if (B.alive && B.pop<1.5) destroySettlement(B, 'war');
}
function endWarWalkers(w){
  for (const wk of G.walkers)
    if (wk.kind==='war' && wk.warKey===w.key) wk.kind='walk';
}
function tickWars(){
  // —— 宣战 ——
  const alive = aliveSettlements();
  if (G.era >= 1 && alive.length >= 2 && G.year >= (G.nextWarY||0)){
    let chance = (.0012 + G.era*.0007) * (G.flags.lang ? .8 : 1) * (G.nature < -20 ? 1.3 : G.nature > 20 ? .85 : 1); // 人性:好战嗜血,和平向善
    for (const s of alive) if (s.famine) chance += .0025;
    if (RNG() < chance){
      const attackers = alive.filter(s=>s.pop>20);
      if (attackers.length){
        // 尚武部落两倍好战
        const pool = [];
        for (const t of attackers){ const w = t.traits&&t.traits.martial?2:1; for (let k=0;k<w;k++) pool.push(t); }
        const A = pool[(RNG()*pool.length)|0];
        let targets = alive.filter(o=>o!==A && !isAlly(A,o) && Math.hypot(o.x-A.x,o.y-A.y)<22);
        // 有世仇的优先复仇
        if (targets.length > 1 && RNG() < .6)
          targets.sort((a,b)=>{
            const ga=(G.relations[relKey(A,a)]||{}).grudge||0, gb=(G.relations[relKey(A,b)]||{}).grudge||0;
            return gb-ga;
          });
        if (targets.length){
          startWar(A, targets[0]);
          G.nextWarY = G.year + 70 + RNG()*140;
        }
      }
    }
  }
  // —— 行军 / 决战 ——
  for (let i=G.wars.length-1;i>=0;i--){
    const w = G.wars[i];
    const A=G.settlements[w.a], B=G.settlements[w.b];
    if (!A.alive || !B.alive){ endWarWalkers(w); G.wars.splice(i,1); continue; }
    w.t++;
    if (w.t < w.dur) continue;
    resolveWar(w, A, B);
    G.wars.splice(i,1);
  }
}
function spawnHerd(){
  for (let tries=0;tries<40;tries++){
    const x=(RNG()*(WORLD_W-8)+4)|0, y=(RNG()*(WORLD_H-8)+4)|0;
    const t = tAt(x,y);
    let kind=null;
    if (t===TER.GRASS) kind = (G.era<3 && RNG()<.22) ? 'mammoth' : 'deer';
    else if (t===TER.FOREST) kind = RNG()<.22 ? 'wolf' : 'boar';
    else if (t===TER.HILL && RNG()<.3) kind='wolf';
    else if (t===TER.TUNDRA) kind = G.era<3 ? 'mammoth' : (RNG()<.5?'deer':null);
    else if (t===TER.RIVER || t===TER.OASIS) kind='fish';
    else if (t===TER.SEA && nearLand(x,y)) kind='fish';
    if (!kind) continue;
    if (G.herds.some(h=>Math.hypot(h.x-x,h.y-y)<5)) continue;
    G.herds.push({x:x+.5, y:y+.5, tx:x+.5, ty:y+.5, kind,
      n:3+(RNG()*7|0), max: kind==='fish'?10:12, ph:RNG()*7});
    return true;
  }
  return false;
}
function nearLand(x,y){
  for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++){
    const xx=x+dx, yy=y+dy;
    if (inW(xx,yy) && !TERR[tAt(xx,yy)].water) return true;
  }
  return false;
}
function spawnFaunaInit(){
  G.herds = [];
  for (let k=0;k<46;k++) spawnHerd();
}
function tickFauna(){
  if (!G.herds.length && G.year<5) spawnFaunaInit();
  // 游荡:仅选择新目标,移动由 updateFauna 逐帧平滑执行
  for (const h of G.herds){
    if (Math.hypot(h.tx-h.x, h.ty-h.y) < .35){
      const a=RNG()*Math.PI*2, dist=1.2+RNG()*2.6;
      const nx=h.x+Math.cos(a)*dist, ny=h.y+Math.sin(a)*dist;
      if (inW(nx,ny)){
        const t=tAt(nx,ny);
        const ok = h.kind==='fish' ? TERR[t].water
          : (!TERR[t].water && t!==TER.PEAK && t!==TER.MOUNT);
        if (ok){ h.tx=nx; h.ty=ny; }
      }
    }
    if (h.n < h.max && RNG()<.02) h.n++;
    if (h.n < 2 && RNG()<.35) h.dead=true;
  }
  G.herds = G.herds.filter(h=>!h.dead);
  while (G.herds.length < (G.era<3?100:76)){ if (!spawnHerd()) break; }
  // 猛犸灭绝(农业时代来临)
  if (G.era>=3 && !G.flags.mammothGone){
    G.flags.mammothGone = true;
    const m = G.herds.filter(h=>h.kind==='mammoth').length;
    G.herds = G.herds.filter(h=>h.kind!=='mammoth');
    if (m) log('最后的猛犸象群消失在北方——耕种的时代来临,人类不再追逐它们。', 'lg-story');
  }
  // 猎人出击(视觉+采集)
  if (G.walkers.length < 540){
    for (const s of aliveSettlements()){
      if (RNG() > .08*SEASONS[G.season].hunt) continue;
      const r = LEVELS[s.level].r + 2;
      let prey=null, pd=1e9;
      for (const h of G.herds){
        const d=Math.hypot(h.x-s.x,h.y-s.y);
        if (d<r && d<pd){ pd=d; prey=h; }
      }
      if (prey){
        const have = G.walkers.filter(w=>w.kind==='hunt' && w.home===s.id).length;
        if (have < 2)
          G.walkers.push({x:s.tx+rnd(-6,6), y:s.ty+rnd(-6,6), tx:prey.x*TILE, ty:prey.y*TILE,
            home:s.id, prey, spd:20+RNG()*6, kind:'hunt', ph:RNG()*7});
      }
    }
  }
}
function updateFauna(dt){
  if (!G || !G.herds) return;
  for (const h of G.herds){
    let dx=h.tx-h.x, dy=h.ty-h.y, d=Math.hypot(dx,dy);
    // 猛兽:追猎 6 格内落单的族人;聚落房屋与围墙是安全区
    if (h.kind==='wolf'){
      let prey=null, pd=36;
      for (const w of G.walkers){
        if (w.kind==='dead'||w.kind==='war'||w.kind==='cart') continue;
        const wd=Math.hypot(w.x-h.x, w.y-h.y);
        if (wd<pd){ pd=wd; prey=w; }
      }
      if (prey){
        let safe=false;
        for (const s of aliveSettlements())
          if ((s.houses||0)>=3 && Math.hypot(prey.x-s.tx, prey.y-s.ty)<3.2){ safe=true; break; }
        if (safe){ prey = null; }
        else {
          // 猎物逃命:朝最近的聚落狂奔
          let hs=null, hd=1e9;
          for (const s of aliveSettlements()){
            const sd=Math.hypot(prey.x-s.tx, prey.y-s.ty);
            if (sd<hd){ hd=sd; hs=s; }
          }
          if (hs) { prey.tx=hs.tx; prey.ty=hs.ty; }
          dx=prey.x-h.x; dy=prey.y-h.y; d=Math.hypot(dx,dy);
          h.tx=h.x+dx; h.ty=h.y+dy;
          if (d < 2.2){
            // 扑杀
            prey.kind='dead'; prey.deadT=0; prey.cause='beast';
            G.stats.deaths += 1;
            s.pop = Math.max(1, s.pop-1); // 猛兽袭人:部落确实少了一个人
            FX.burst(prey.x, prey.y, 8, '#c04040', 50);
            if (RNG()<.3) log('【生死】一名族人被猛兽扑倒……部落为死者立起了石堆。', 'lg-dim');
            h.tx=h.x+(RNG()-.5)*6; h.ty=h.y+(RNG()-.5)*6;
            continue;
          }
        }
      }
    }
    if (d > .05){
      const v = Math.min(d, (h.kind==='fish' ? .28 : h.kind==='wolf' ? 1.1 : .5)*dt);
      h.x += dx/d*v; h.y += dy/d*v;
    }
  }
}
function herdIncome(s){
  let inc=0, fish=0;
  const S = SEASONS[G.season];
  const r = LEVELS[s.level].r + 2;
  for (const h of G.herds){
    const d = Math.hypot(h.x-s.x, h.y-s.y);
    if (d>r) continue;
    let y = HUNT_YIELD[h.kind] * h.n;
    if (h.kind==='fish'){ y *= (G.era>=2 ? 1.2 : .55) * (s.traits&&s.traits.seafaring?1.4:1) * (s.geo==='coast'?1.25:1) * (S.name==='冬'?.5:1); fish += y; }
    else {
      y *= (G.era>=4 ? .3 : G.era>=3 ? .55 : 1) * S.hunt * (G.flags.dog?1.15:1); // 猎犬相伴
      if (h.kind==='boar' && s.geo==='forest') y *= 1.2;
      if (h.kind==='deer' && s.geo==='grass') y *= 1.1;
      if (s.geo==='tundra' && S.name==='冬') y *= 1.25;
      if (h.kind==='fish' && s.geo==='swamp') y *= 1.2;
    }
    inc += y;
    if (!G.flags['m_'+h.kind]){
      G.flags['m_'+h.kind] = true;
      log(`${s.name} 掌握了${HUNT_METHOD[h.kind].name}——${HUNT_METHOD[h.kind].story}。`, 'lg-good');
    }
  }
  s._fishInc = fish;
  return inc;
}
function tickFarmsGrowth(S){
  S = S || SEASONS[G.season];
  for (let i=0;i<W.FARM.length;i++){
    const owner = W.FARM[i];
    if (!owner) continue;
    const s = G.settlements[owner-1];
    if (!s || !s.alive){ W.FARM[i]=0; W.FS[i]=0; continue; }
    const st = W.FS[i];
    // 春耕:开春把所有休耕地翻土下种
    if (S.name==='春' && st===0){
      if (!G.flags.plowStory){ G.flags.plowStory = true;
        const t = '冰雪初融,春耕开始——一年收成,全看这几天。';
        log('【民生】'+t, 'lg-story'); chron(t, 'culture'); }
      if (Math.random() < .75) W.FS[i] = 1;
      continue;
    }
    if (st >= 3){
      // 过熟计时:熟透太久自然落粒归仓(收成减半)
      W.FS[i] = Math.min(15, st+1);
      if (st >= 15){
        s.store = Math.min(storeCap(s), s.store+6);
        G.stats.harvests++;
        W.FS[i] = 0;
      }
      continue;
    }
    // 生长:春夏疯长,秋缓熟,冬停滞
    if (S.growth > 0 && Math.random() < .42*S.growth*Math.min(1.6, zoneMult(i%WORLD_W, (i/WORLD_W)|0)))
      W.FS[i] = st+1;
  }
}
function findRipeFarm(s){
  const r = LEVELS[s.level].r + 1;
  let best=-1, bd=1e9;
  const cx=s.x|0, cy=s.y|0;
  for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++){
    const x=cx+dx, y=cy+dy;
    if (!inW(x,y)) continue;
    const i=y*WORLD_W+x;
    if (W.FARM[i]===s.id+1 && W.FS[i]>=3 && W.FS[i]<6){
      const d=dx*dx+dy*dy;
      if (d<bd){ bd=d; best=i; }
    }
  }
  return best;
}
function manageFarmers(){
  if (G.era < 3) return;
  for (const s of aliveSettlements()){
    const want = Math.min(8, 1 + s.level*2);
    let have = 0;
    for (const w of G.walkers) if (w.kind==='farm' && w.home===s.id) have++;
    if (have >= want || G.walkers.length > 560) continue;
    G.walkers.push({x:s.tx+rnd(-10,10), y:s.ty+rnd(-10,10), tx:s.tx, ty:s.ty,
      home:s.id, spd:11+RNG()*5, kind:'farm', ph:RNG()*7});
  }
}
function tickTrade(){
  if (G.era < 2) return;
  // 建立新商路
  if (G.routes.length < 8 && RNG() < .15){
    const al = aliveSettlements().filter(s=>s.level>=1);
    if (al.length >= 2){
      const A = al[(RNG()*al.length)|0];
      const cand = al.filter(o=>o!==A && Math.hypot(o.x-A.x,o.y-A.y)<30
        && !G.routes.some(r=>(r.a===A.id&&r.b===o.id)||(r.a===o.id&&r.b===A.id)));
      if (cand.length){
        const B = cand[(RNG()*cand.length)|0];
        G.routes.push({a:A.id, b:B.id, t:0});
        chron(`商路通车:${A.name} ↔ ${B.name}`, 'culture');
        log(`🐫 商路通车:${A.name} ↔ ${B.name}——驼铃将带去货物与远方的消息。`, 'lg-good');
      }
    }
  }
  // 商路维护与商队派遣
  for (let i=G.routes.length-1;i>=0;i--){
    const r = G.routes[i];
    const A = G.settlements[r.a], B = G.settlements[r.b];
    if (!A.alive || !B.alive){ G.routes.splice(i,1); continue; }
    if (G.wars.some(w=>(w.a===r.a&&w.b===r.b)||(w.a===r.b&&w.b===r.a))){
      G.routes.splice(i,1);
      log(`⚔️ 战火切断了 ${A.name} 与 ${B.name} 之间的商路。`, 'lg-bad');
      continue;
    }
    r.t = (r.t||0)+1;
    const waterRoute = (A.geo==='river'||A.geo==='coast'||B.geo==='river'||B.geo==='coast');
    if (r.t > ((A.geo==='desert'||B.geo==='desert')?5:waterRoute?6:8) && G.walkers.length < 640){
      r.t = 0;
      const from = A.store >= B.store ? A : B, to = from===A ? B : A;
      G.walkers.push({x:from.tx, y:from.ty, tx:to.tx, ty:to.ty, home:from.id, dest:to.id,
        spd:16, kind:'cart', ph:RNG()*7, trade:true});
    }
  }
}
function survivalDecision(s){
  const r = LEVELS[s.level].r + 3;
  // 1) 全民狩猎/渔猎
  let prey=null, pd=1e9;
  for (const h of G.herds){
    const d = Math.hypot(h.x-s.x, h.y-s.y);
    if (d<r && d<pd){ pd=d; prey=h; }
  }
  if (prey && prey.n>=2){
    const take = Math.min(prey.n-1, 2+(RNG()*3|0));
    prey.n -= take; s.store += take*16;
    log(`${s.name} 粮尽——${prey.kind==='fish'?'倾巢而出,下河捕鱼':'倾巢而出,围猎兽群'},勉强撑过了饥荒。`, 'lg-sys');
    FX.burst(s.tx, s.ty, 14, '#b09a72', 70);
    return;
  }
  // 2) 全族迁徙寻找沃土
  if (s.pop > 12 && RNG() < .65 && tryMigrate(s)) return;
  // 3) 盟友救荒
  const ally = aliveSettlements().find(o=>o!==s && isAlly(o,s) && o.store>storeCap(o)*.4);
  if (ally){
    const aid = ally.store*.3;
    ally.store -= aid; s.store += aid;
    log(`🤝 盟友 ${ally.name} 送来了救命的粮草,${s.name} 的族人得以熬过寒冬。`, 'lg-good');
    chron(`${ally.name} 向盟友 ${s.name} 送去粮草`, 'culture');
    return;
  }
  // 4) 倾国之战:抢夺邻邦粮仓
  const rich = aliveSettlements()
    .filter(o=>o!==s && o.store>storeCap(o)*.35 && Math.hypot(o.x-s.x,o.y-s.y)<24)
    .sort((a,b)=>b.store-a.store)[0];
  if (rich && s.pop >= 10){
    log(`${s.name} 粮尽——倾巢而出,孤注一掷地向 ${rich.name} 发动战争,以夺取过冬的粮草!`, 'lg-bad');
    startWar(s, rich, {desperate:true});
    return;
  }
  // 5) 无路可走,只能等待命运的裁决
  if (RNG() < .3){
    log(`${s.name} 四顾茫然——猎物、沃土、盟友、邻邦的粮仓,都救不了他们了……`, 'lg-bad');
    chron(`${s.name} 在饥荒中挣扎,无人能救`, 'doom');
  }
}
function applyCulture(c){
  G.flags['c_'+c.id] = true;
  chron(c.text, 'culture');
  log('【文明纪事】'+c.text, 'lg-story');
  const nxt = ERAS[G.era+1];
  const gap = nxt&&nxt.kn ? Math.max(1000, nxt.kn-ERAS[G.era].kn) : 5000;
  switch(c.id){
    case 'burial': G.faith = Math.min(100, G.faith+4); break;
    case 'temple':
      G.faith = Math.min(100, G.faith+8);
      G.flags.temple = true;
      log('🏔 神庙聚拢了人群——定居的部落又多了两支的生存空间。', 'lg-good');
      break;
    case 'dog':    G.flags.dog = true; break;
    case 'cattle': G.flags.cattle = true; break;
    case 'plow':   G.flags.plow = true; break;
    case 'wheel':  G.flags.wheel = true; break;
    case 'cattle': G.flags.cattle = true; break;
    case 'art':    G.faith = Math.min(100, G.faith+3); G.knowledge += gap*.01; break;
    case 'lang':   G.knowledge += gap*.02; break;
    case 'totem':  G.faith = Math.min(100, G.faith+6); break;
    case 'write':  G.knowledge += gap*.06; break;
    case 'law':    G.faith = Math.min(100, G.faith+4); G.knowledge += gap*.03; break;
    case 'hero':   G.nextWarY = Math.max(G.nextWarY||0, G.year+220); G.faith = Math.min(100, G.faith+4); break;
    case 'phil':   G.knowledge += gap*.04; break;
    case 'net':    G.knowledge += gap*.1; break;
    case 'wed': {
      const al = aliveSettlements();
      if (al.length >= 2){
        let ba,bb,bd=1e9;
        for (let i=0;i<al.length;i++) for (let j=i+1;j<al.length;j++){
          const d = Math.hypot(al[i].x-al[j].x, al[i].y-al[j].y);
          if (d<bd && !isAlly(al[i],al[j])){ bd=d; ba=al[i]; bb=al[j]; }
        }
        if (ba){
          G.relations[relKey(ba,bb)] = {ally:true, grudge:0};
          chron(`${ba.name} 与 ${bb.name} 结为盟友`, 'culture');
          log(`🤝 ${ba.name} 与 ${bb.name} 结为盟友——饥荒时将互相救助。`, 'lg-good');
        }
      }
      break;
    }
  }
}
let nameUsed = new Set();
