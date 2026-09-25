// ============ 造物主 · GOD VIEW — 配置表 ============
"use strict";

// ---- 世界与模拟 ----
const TILE = 14;                 // 每格像素
const WORLD_W = 360, WORLD_H = 220;
const WORLD_PW = WORLD_W * TILE, WORLD_PH = WORLD_H * TILE;
const SIM_TPS = 2;               // 模拟 tick / 秒 (1 tick = 1 年;1× 下 1 年 = 0.5 秒,生长清晰可见)
const MAX_SETTLEMENTS = 14;      // 聚落上限:每种地形约 1~2 个部落,竞争生存而非铺满地图

// ---- 四季(1 tick = 1 季,4 tick = 1 年):百姓靠天吃饭 ----
const SEASONS = [
  {name:'春', icon:'🌸', income:1.10, growth:1.45, hunt:1.0,  eat:1.0,  tint:'rgba(255,228,150,.05)'},
  {name:'夏', icon:'☀️', income:1.00, growth:1.30, hunt:.9,  eat:.95,  tint:'rgba(130,225,130,.04)'},
  {name:'秋', icon:'🍂', income:1.30, growth:.65,  hunt:1.1,  eat:1.0,  tint:'rgba(255,150,60,.08)'},
  {name:'冬', icon:'❄️', income:.55,  growth:0,    hunt:1.4,  eat:1.15, tint:'rgba(165,195,235,.11)'},
];      // 聚落上限:每种地形约 1~2 个部落,竞争生存而非铺满地图               // 模拟 tick / 秒 (1 tick = 1 年;1× 下 1 年 = 0.5 秒,生长清晰可见)
const POWER_MAX = 100;

// ---- 地形 ----
const TER = { DEEP:0, SEA:1, BEACH:2, GRASS:3, FOREST:4, HILL:5, MOUNT:6, PEAK:7, DESERT:8, TUNDRA:9, SWAMP:10, BASALT:11, RUBBLE:12, RIVER:13, OASIS:14 };
const TERR = [
  {name:'深海',   col:'#0a2c4a', col2:'#0d3860', water:true,  fert:0},
  {name:'浅海',   col:'#155d8a', col2:'#1d7bb0', water:true,  fert:0.08},
  {name:'沙滩',   col:'#d9c38a', col2:'#c8b076', fert:0.3},
  {name:'草原',   col:'#699f4a', col2:'#78af55', fert:1.0},
  {name:'森林',   col:'#4c7c3c', col2:'#40692f', fert:0.72, trees:true},
  {name:'丘陵',   col:'#8a915f', col2:'#79825a', fert:0.45},
  {name:'山地',   col:'#8d8d93', col2:'#7a7a82', fert:0.08},
  {name:'雪峰',   col:'#cfd8e3', col2:'#bac7d6', fert:0.02},
  {name:'荒漠',   col:'#c9b078', col2:'#b9a065', fert:0.12},
  {name:'苔原',   col:'#9aa886', col2:'#8a997a', fert:0.28},
  {name:'沼泽',   col:'#5c7050', col2:'#4e6144', fert:0.55, trees:true},
  {name:'火山沃土',col:'#4a4348', col2:'#3e383d', fert:1.35},
  {name:'焦土',   col:'#6e6259', col2:'#5d534c', fert:0.18},
  {name:'河流',   col:'#2a6ea8', col2:'#3a7fb8', water:true, fert:0},
  {name:'绿洲',   col:'#3aa87a', col2:'#2f8f68', water:true, fert:1.3},
];

// ---- 作物(按地形) ----
const CROPS = {
  [TER.GRASS]:  {name:'麦',     col:'#cfa63f', dark:'rgba(90,60,10,.25)'},
  [TER.SWAMP]:  {name:'稻',     col:'#8fae5f', dark:'rgba(30,60,25,.3)'},
  [TER.HILL]:   {name:'粟',     col:'#c98f4a', dark:'rgba(80,50,10,.25)'},
  [TER.TUNDRA]: {name:'青稞',   col:'#a8bd7f', dark:'rgba(40,60,40,.28)'},
  [TER.DESERT]: {name:'椰枣',   col:'#c9b06a', dark:'rgba(90,70,20,.25)'},
  [TER.BASALT]: {name:'火山豆', col:'#b8926a', dark:'rgba(60,30,20,.28)'},
};
// ---- 狩猎方式(按猎物/地形) ----
const HUNT_YIELD = {deer:.24, boar:.30, mammoth:.55, fish:.15, wolf:.18};
const HUNT_METHOD = {
  deer:    {name:'草原追猎', story:'草原追猎——他们学会驱赶兽群,长矛齐出'},
  boar:    {name:'林间围猎', story:'林间围猎——陷阱与号角声包围了猎物'},
  mammoth: {name:'苔原协作围猎', story:'苔原协作围猎——整支部落合力对付巨兽'},
  fish:    {name:'水畔渔猎', story:'水畔渔猎——他们叉鱼、织网,向河流湖泊讨生活'},
  wolf:    {name:'御狼卫戍', story:'御狼卫戍——猎人们围歼了袭人的狼群,从此聚落有了守夜人'},
};

// ---- 武器谱系:战争剧情随时代演进 ----
const WEAPON_NAMES = [
  '木棒与掷石',        // 0 蒙昧
  '磨制石斧与木矛',    // 1 石器
  '火攻与骨弓',        // 2 火焰
  '戈矛与石弹',        // 3 农业
  '青铜剑与战车',      // 4 青铜
  '火绳枪与野战炮',    // 5 工业
  '来复枪与铁甲舰',    // 6 电气
  '坦克与机枪',        // 7 信息
  '制导武器与无人机',  // 8 太空
];
const WEAPON_STORIES = {
  2: '他们把火把掷向敌人的茅屋,骨弓在夜里发出尖啸',
  4: '青铜剑在作坊里锻成——战车碾过田野,战争第一次有了甲胄的铿锵',
  5: '火绳枪的白烟遮蔽了原野——工业化的战争,绞肉机开始了',
  7: '钢铁的洪流碾过战线,战争成了工厂产量的较量',
};

// ---- 时代 ----
// kn: 进入下一时代所需知识 | pop: 所需人口 | flag: 需要的契机 | sci/gather: 每年系数
// lv: 该时代聚落最高等级 | dot: 族人服饰色
// 阈值按「14 聚落封顶」的人口阶梯重新标定:每时代约 500~900 年
const ERAS = [
  {name:'蒙昧时代', en:'DAWN OF HOMINIDS', kn:300,      pop:0,     sci:.045, gather:.62, lv:0, dot:'#b98a5e',
   desc:'古猿走出丛林,第一次仰望星空'},
  {name:'石器时代', en:'STONE AGE',        kn:700,     pop:60,    sci:.10,  gather:1.0,  lv:1, dot:'#9c7b52',
   desc:'打制石器,围猎走兽,篝火边传递语言'},
  {name:'火焰时代', en:'AGE OF FIRE',      kn:8000,    pop:120,   flag:'fire', sci:.12, gather:1.5, lv:1, dot:'#c27b3a',
   desc:'他们保存了天火——黑暗与严寒再也无法轻易杀死他们'},
  {name:'农业时代', en:'AGE OF AGRICULTURE',kn:45000,  pop:500,   sci:.3,   gather:2.6, lv:2, dot:'#c9a53f',
   desc:'驯化谷物与牛羊,从流浪者变为耕耘者'},
  {name:'青铜时代', en:'BRONZE AGE',       kn:500000,  pop:3000,  sci:.8,   gather:4.2, lv:3, dot:'#c98f4a',
   desc:'城邦、文字与律法,文明开始书写自己'},
  {name:'工业时代', en:'INDUSTRIAL AGE',   kn:5000000, pop:20000, sci:2.2,  gather:7,   lv:3, dot:'#8f8f9a',
   desc:'蒸汽与钢铁,机器的轰鸣撼动大地'},
  {name:'电气时代', en:'ELECTRIC AGE',     kn:14000000,pop:80000, sci:6,    gather:12,  lv:4, dot:'#5f9ec9',
   desc:'他们点亮了黑夜,电流奔流如神血'},
  {name:'信息时代', en:'INFORMATION AGE',  kn:260000000,pop:400000,sci:16,  gather:20,  lv:4, dot:'#7fd4c9',
   desc:'网络连接每一颗头脑,知识爆炸增长'},
  {name:'太空时代', en:'SPACE AGE',        kn:1200000000, pop:0,  sci:40,   gather:32,  lv:4, dot:'#efe6d8',
   desc:'挣脱摇篮,迈向群星'},
];
// 聚落等级: 名称 / 人口上限 / 采集半径
// (营地 25~50 人符合游团研究;城镇数百人符合 Çatalhöyük 修订估计;都会对应工业后大城市)
const LEVELS = [
  {name:'营地', cap:40,    r:2},
  {name:'村庄', cap:220,   r:3},
  {name:'城镇', cap:800,   r:4},
  {name:'城市', cap:3800,  r:5},
  {name:'都会', cap:30000, r:6},
];

// ---- 神力 ----
const POWERS = [
  // 天气(区域持续)
  {id:'sun',     icon:'☀️', name:'阳光', cost:8,  cd:3,  group:'weather', dur:30,
   desc:'让阳光洒满大地:范围内土地肥力 <b>+50%</b>,持续 30 秒。'},
  {id:'rain',    icon:'🌧️', name:'甘霖', cost:10, cd:4,  group:'weather', dur:30,
   desc:'降下细雨:范围内肥力 +40%,<b>浇灭野火</b>,持续 30 秒。'},
  {id:'snow',    icon:'❄️', name:'严寒', cost:12, cd:8,  group:'weather', dur:26,
   desc:'酷寒笼罩:作物减产,尚未掌握火种的部落将有人冻毙。<span class="req">幸存者将学会缝制衣物</span>'},
  {id:'iceage',  icon:'🧊', name:'冰河世纪', cost:45, cd:60, group:'weather', dur:55, global:true,
   desc:'降下持续 55 秒的<span class="req">大冰期</span>:全球作物锐减,北方苔原扩张,每个聚落都将面对生存的试炼。'},
  {id:'wind',    icon:'🌬️', name:'长风', cost:6,  cd:10, group:'weather', dur:20, global:true,
   desc:'全图起风 20 秒:吹送草木种子(森林扩散),但也会<b>助长火势</b>。'},
  // 天灾
  {id:'lightning',icon:'⚡', name:'雷击', cost:6,  cd:2,  group:'disaster',
   desc:'引落天雷。点燃森林;若落在部落附近——<span class="req">他们可能在余烬中发现火种(解锁火焰时代)</span>'},
  {id:'wildfire', icon:'🔥', name:'野火', cost:14, cd:8,  group:'disaster',
   desc:'在草木丰茂之地引燃燎原大火,随风蔓延。<span class="req">城市幸存火灾 → 解锁消防</span>'},
  {id:'quake',    icon:'💥', name:'地震', cost:18, cd:12, group:'disaster',
   desc:'大地震颤,摧毁范围内的建筑与生灵。<span class="req">工业时代幸存 → 解锁抗震建筑</span>'},
  {id:'tornado',  icon:'🌀', name:'龙卷', cost:16, cd:14, group:'disaster',
   desc:'生成一柄游走的毁灭之矛,横扫沿途 20 秒。'},
  {id:'flood',    icon:'🌊', name:'洪水', cost:20, cd:16, group:'disaster',
   desc:'大水淹没低地,冲毁农田。<span class="req">农业时代幸存 → 解锁水利</span>,泥沙让土地更肥沃'},
  {id:'volcano',  icon:'🌋', name:'火山', cost:26, cd:25, group:'disaster',
   desc:'大地隆起火山:熔岩、火山灰遮天——而灰烬之下,是最肥沃的土壤。<span class="req">也可为部落带来火种</span>'},
  {id:'plague',   icon:'🦠', name:'瘟疫', cost:15, cd:22, group:'disaster',
   desc:'在聚落散播疫病,沿商路蔓延,直至终息或被神愈治愈。<span class="req">青铜时代幸存 → 解锁医学</span>'},
  {id:'meteor',   icon:'☄️', name:'陨星', cost:40, cd:45, group:'disaster',
   desc:'召唤陨石:毁灭半径内的一切。<span class="req">青铜时代后幸存 → 解锁陨铁冶炼</span>'},
  // 神恩
  {id:'heal',     icon:'✨', name:'神愈', cost:18, cd:14, group:'bless',
   desc:'圣光降临:治愈瘟疫与创伤,人口小幅回升,信仰提升。'},
  {id:'harvest',  icon:'🌾', name:'丰收', cost:12, cd:10, group:'bless', dur:45,
   desc:'金色祝福:范围内即时填满粮仓,肥力翻倍 45 秒。'},
  {id:'tree',   icon:'🌳', name:'造树', cost:5,  cd:2,  group:'bless', dur:0,
   desc:'在目标地块种下树木——森林渐成,木材与果实随之而来。'},
  {id:'berry',  icon:'🫐', name:'浆果丛', cost:6, cd:3, group:'bless', dur:0,
   desc:'种下浆果丛——采集者的四季口粮。'},
  {id:'ore',    icon:'⛏️', name:'现矿', cost:10, cd:5,  group:'bless', dur:0,
   desc:'群山中显现矿脉(铜/铁/金)。'},
  {id:'insight',  icon:'💡', name:'神启', cost:25, cd:30, group:'bless',
   desc:'向最大的聚落降下灵感:知识 + 剩余需求的 8%。'},
];

// ---- 文明适应(多难兴邦) ----
const ADAPT = {
  fire:      {icon:'🔥', name:'掌控天火', req:'部落从雷击/野火/火山中幸存', fx:'解锁火焰时代 · 严寒伤害-75% · 食物利用+20%'},
  clothing:  {icon:'🧥', name:'缝制衣物', req:'掌握火后幸存严寒/冰河',     fx:'严寒伤害再-85%'},
  irrigation:{icon:'🏗️', name:'水利治世', req:'农业时代幸存洪水',          fx:'洪水伤害-80% · 农田产量+25%'},
  medicine:  {icon:'💉', name:'医学      ',req:'青铜时代幸存瘟疫',          fx:'瘟疫伤害-85%'},
  firebrigade:{icon:'🚒',name:'消防队',   req:'青铜时代聚落幸存火灾',       fx:'火灾伤害-90%'},
  seismic:   {icon:'🏗', name:'抗震建筑', req:'工业时代幸存地震',           fx:'地震伤害-70%'},
  ironwork:  {icon:'⚔️', name:'陨铁冶炼', req:'青铜时代后幸存陨星',         fx:'采集+30% · 知识大增'},
};

// ---- 聚落命名 ----
const NAME_PRE = ['曙','河','石','风','星','谷','林','金','沙','雪','火','原','月','泉','岩','海','翠','苍','白','赤','鹿','鹰','麦','盐','铜','铁','云','春','枫','盐'];
const NAME_SUF = ['部','落','村','庄','镇','城','邑','都','川','岭','原','泽'];
const TRIBE_FIRST = '伊甸';

// ---- 数字格式化 ----
function fmt(n){
  n = Math.floor(n);
  if (n >= 1e8) return (n/1e8).toFixed(2).replace(/\.?0+$/,'') + '亿';
  if (n >= 1e4) return (n/1e4).toFixed(1).replace(/\.0$/,'') + '万';
  return String(n);
}
function fmtY(y){ return '纪元 ' + y.toLocaleString('en-US') + ' 年'; }

// ---- 部落特质(经历塑造性格,性格影响决策) ----
const TRAITS = {
  martial:   {icon:'⚔️', name:'尚武', fx:'更好战,守城+15%'},
  tenacious: {icon:'🪨', name:'坚韧', fx:'饥荒损耗-40%'},
  pious:     {icon:'🙏', name:'虔诚', fx:'幸存与神迹带来更多信仰'},
  hygienic:  {icon:'🧼', name:'洁净', fx:'瘟疫传播-60%'},
  seafaring: {icon:'🛶', name:'善渔', fx:'渔获+40%'},
  rooted:    {icon:'🌳', name:'恋土', fx:'不愿迁徙,田产+10%'},
};

// ---- 文明纪事(一次性文化事件,取材真实演化里程碑) ----
// era:[最小,最大] 可触发时代区间
const CULTURE = [
  {id:'temple', era:[0,2], text:'他们在山顶竖起成排巨石——为神,而非为收成。四方的猎人被召集来此劳作、集会、盛宴,定居的种子就此埋下。'},
  {id:'burial', era:[0,1], text:'他们开始埋葬逝去的族人,并在坟前放上鲜花——爱与哀思诞生了。'},
  {id:'art',    era:[1,2], text:'第一批岩画留在了洞穴深处:野牛、篝火与狩猎的舞步。'},
  {id:'lang',   era:[1,3], text:'语言成熟了——长者能用故事讲述百年前的星空。'},
  {id:'dog',     era:[0,1], text:'他们驯化了狼的后裔——狗。猎人们从此有了最忠诚的伙伴。'},
  {id:'cattle',  era:[3,4], text:'牛被驯化,套上犁铧——田野从此有了畜力。'},
  {id:'hearth',  era:[1,2], text:'篝火成了夜晚的中心——分食烤肉,低语故事,语言在火光中生长。'},
  {id:'totem',  era:[2,4], text:'图腾立起,散落的氏族有了共同的名字与禁忌。'},
  {id:'wed',    era:[2,5], text:'两个部落互换谷种与歌谣,结为姻亲之盟。'},
  {id:'write',  era:[4,6], text:'文字诞生了!祭司把丰年与灾年刻进泥板。'},
  {id:'plow',    era:[3,4], text:'犁铧翻开泥土——一个人能耕种从前三倍的土地。'},
  {id:'wheel',   era:[4,5], text:'轮子转起来了。陶轮、车轮,万物开始流动。'},
  {id:'law',    era:[4,6], text:'第一部成文律法颁布——以牙还牙,以眼还眼。'},
  {id:'hero',   era:[5,7], text:'一位传奇英雄平息了边境的世代仇杀,刀剑入库二十年。'},
  {id:'phil',   era:[6,8], text:'哲人们在广场辩论世界的本原——理性觉醒了。'},
  {id:'net',    era:[7,8], text:'所有头脑连入同一张网,知识的洪流再也拦不住。'},
];

// ---- 地理智慧(不同地形孕育不同生活方式) ----
const GEO = {
  river:   {icon:'🌊', name:'大河文明', story:'他们掘开河渠引水灌田,在两岸沃土上建起了最早的水利文明', fx:'农田+1,水车转动'},
  coast:   {icon:'⛵', name:'滨海渔盐', story:'他们向大海讨生活,渔船与盐田点缀着海岸', fx:'渔获+25%,扬帆出海'},
  grass:   {icon:'🐎', name:'草原游牧', story:'他们驯服了马——牧群与骑手开始奔驰在草原上', fx:'迁徙更勤,逐水草而居'},
  forest:  {icon:'🪵', name:'山林猎户', story:'他们伐木造屋、设陷阱于林间,山林成了粮仓与家园', fx:'围猎+20%'},
  mountain:{icon:'⛰️', name:'山地梯田', story:'他们在山坡垒出层层梯田,凿石为墙以御外敌', fx:'守城+10%'},
  swamp:   {icon:'🌾', name:'泽国稻作', story:'他们在泥沼中垒田引水,种下耐水的稻,以网捕鱼', fx:'稻作+渔产'},
  tundra:  {icon:'🦌', name:'苔原游猎', story:'他们跟随兽群迁徙,以兽皮御寒,以驯鹿为生', fx:'冬猎+25%,抗寒'},
  desert:  {icon:'🏜️', name:'荒漠凿井', story:'沙漠边缘的部落凿井取水,驼队在绿洲之间穿行', fx:'商队更频繁'},
};

// ---- 部落颜色(迁徙继承母部落颜色,战争吞并后疆域同色扩张) ----
const TRIBE_COLORS = [
  '#e0564a','#e08a3c','#e0c94a','#8fd04a','#4ac97a','#4ac9c9','#4a9ae0','#8a7ae0',
  '#b05ae0','#e05ab0','#e07a9a','#a0784a','#c9d04a','#5ac9b0','#e05a5a','#9ab04a',
];
