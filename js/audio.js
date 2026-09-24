// ============ 极简音效合成器 ============
"use strict";
const AU = {
  ctx:null, muted:false, master:null,
  init(){
    if (this.ctx) return;
    try{
      this.ctx = new (window.AudioContext||window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = .22;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = .8;
      this.musicBus.connect(this.master);
    }catch(e){}
  },
  env(g, t0, a, d, peak=1){
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0+a);
    g.gain.exponentialRampToValueAtTime(.0001, t0+a+d);
  },
  tone(freq, dur, type='sine', vol=.5, slide=0){
    if (!this.ctx || this.muted) return;
    const t0=this.ctx.currentTime, o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide), t0+dur);
    this.env(g,t0,.01,dur,vol);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0+dur+.05);
  },
  noise(dur, vol=.5, f0=800, f1=200){
    if (!this.ctx || this.muted) return;
    const t0=this.ctx.currentTime, n=this.ctx.sampleRate*dur|0;
    const buf=this.ctx.createBuffer(1,n,this.ctx.sampleRate), d=buf.getChannelData(0);
    for (let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const flt=this.ctx.createBiquadFilter(); flt.type='lowpass';
    flt.frequency.setValueAtTime(f0,t0); flt.frequency.exponentialRampToValueAtTime(f1,t0+dur);
    const g=this.ctx.createGain(); this.env(g,t0,.005,dur,vol);
    src.connect(flt); flt.connect(g); g.connect(this.master); src.start(t0);
  },
  click(){ this.tone(660,.06,'triangle',.25); },
  chime(){ // 时代跃迁
    [523,659,784,1047].forEach((f,i)=> setTimeout(()=>this.tone(f,.7,'sine',.35), i*110));
  },
  sparkle(){ [880,1175,1568].forEach((f,i)=> setTimeout(()=>this.tone(f,.3,'sine',.2), i*70)); },
  thunder(){ this.noise(1.1,.9,1400,120); this.tone(70,.9,'sine',.5,-40); },
  boom(big){ this.noise(big?1.6:.9, big?1:.7, 900,60); this.tone(55,big?1.4:.8,'sine',.7,-30); },
  whoosh(){ this.noise(1.2,.4,300,1600); },
  quake(){ this.noise(2.2,.8,300,40); this.tone(38,1.8,'sine',.6,-14); },
  plague(){ this.tone(220,1.2,'sawtooth',.12,-80); this.tone(233,1.2,'sawtooth',.12,-80); },
  rocket(){ this.noise(3.5,.8,500,2000); },
};

// ============ 生成式背景音乐:按时代分组风格 ============
"use strict";
const MUS = {
  timer:null, group:-1, tension:false, nextBar:0, barI:0,
  // 每组:根音/和弦(半音)/五声调式/垫底波形/节拍/旋律概率/低通亮度
  MOODS: [
    {root:110.0,  chords:[[0,7,12],[3,10,15],[-2,5,10],[3,10,14]],       scale:[0,3,5,7,10],     wave:'sine',    bpm:30, melP:.35, bright:750,  mel:'sine'},     // 蒙昧·骨笛与风
    {root:110.0,  chords:[[0,7,12],[5,12,17],[7,14,19],[5,12,16]],       scale:[0,2,5,7,9],      wave:'triangle',bpm:36, melP:.5,  bright:1100, mel:'triangle'}, // 篝火·民谣
    {root:98.0,   chords:[[0,7,12],[8,15,20],[3,10,15],[-4,3,8]],        scale:[0,2,3,7,8],      wave:'sawtooth',bpm:42, melP:.4,  bright:1400, mel:'sine'},     // 文明·弦咏
    {root:123.47, chords:[[0,7,12],[4,11,16],[5,12,17],[-3,4,9]],        scale:[0,2,4,7,9],      wave:'square',  bpm:48, melP:.65, bright:2000, mel:'square'},   // 钢铁·电子
    {root:87.31,  chords:[[0,7,12,19],[5,12,17,22],[-2,5,10,17],[2,9,14,21]], scale:[0,2,4,6,9,11], wave:'sine', bpm:28, melP:.5, bright:2600, mel:'sine'},     // 群星·空灵
  ],
  start(){
    if (this.timer || !AU.ctx) return;
    this.nextBar = 0; this.barI = 0;
    this.timer = setInterval(()=>this.tick(), 300);
  },
  setEra(e){
    const g = e>=8 ? 4 : Math.min(3, (e/2)|0);
    if (g !== this.group){ this.group = g; this.nextBar = 0; }
  },
  setTension(t){ this.tension = t; },
  pad(freq, t0, dur, wave, vol, bright){
    const c=AU.ctx; if(!c) return;
    const o=c.createOscillator(), o2=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.type=wave; o2.type=wave;
    o.frequency.value=freq; o2.frequency.value=freq*1.004;
    f.type='lowpass'; f.frequency.value=bright;
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(vol, t0+dur*.3);
    g.gain.linearRampToValueAtTime(.0001, t0+dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(AU.musicBus||AU.master);
    o.start(t0); o2.start(t0); o.stop(t0+dur+.1); o2.stop(t0+dur+.1);
  },
  pluck(freq, t0, wave, vol){
    const c=AU.ctx; if(!c) return;
    const o=c.createOscillator(), g=c.createGain(), f=c.createBiquadFilter();
    o.type=wave; o.frequency.value=freq;
    f.type='lowpass'; f.frequency.value=3000;
    g.gain.setValueAtTime(0,t0);
    g.gain.linearRampToValueAtTime(vol, t0+.02);
    g.gain.exponentialRampToValueAtTime(.0001, t0+1.4);
    o.connect(f); f.connect(g); g.connect(AU.musicBus||AU.master);
    o.start(t0); o.stop(t0+1.5);
  },
  drum(t0, vol=.15){
    const c=AU.ctx; if(!c) return;
    const o=c.createOscillator(), g=c.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(90,t0);
    o.frequency.exponentialRampToValueAtTime(38,t0+.25);
    g.gain.setValueAtTime(vol,t0);
    g.gain.exponentialRampToValueAtTime(.0001,t0+.32);
    o.connect(g); g.connect(AU.musicBus||AU.master);
    o.start(t0); o.stop(t0+.4);
  },
  tick(){
    if (!AU.ctx || AU.muted) return;
    const t = AU.ctx.currentTime;
    if (this.nextBar < t) this.nextBar = t + .06;
    while (this.nextBar < t + 1.4){
      this.scheduleBar(this.nextBar);
      const m = this.MOODS[Math.max(0,this.group)];
      this.nextBar += 60/m.bpm*2;
    }
  },
  scheduleBar(t0){
    const m = this.MOODS[Math.max(0,this.group)];
    this.barI++;
    const ch = m.chords[this.barI % m.chords.length];
    const beat = 60/m.bpm;
    for (const st of ch)
      this.pad(m.root*Math.pow(2,st/12), t0, beat*2.3, m.wave, .045, m.bright);
    this.pad(m.root/2*Math.pow(2,ch[0]/12), t0, beat*2.3, 'sine', .08, 400);
    if (Math.random() < m.melP){
      const st = m.scale[(Math.random()*m.scale.length)|0] + 12*(2+(Math.random()*2|0));
      this.pluck(m.root*Math.pow(2,st/12), t0 + (Math.random()<.5?0:beat), m.mel, .06);
    }
    if (this.tension){
      this.pad(55, t0, beat*2.3, 'sawtooth', .05, 300);
      this.drum(t0); this.drum(t0+beat);
    }
  },
};
