'use strict';
/* ============================================================
 * AudioSys · 拳击配乐引擎：Web Audio 程序化作曲 + 打击音效
 * 以 AudioContext 时钟为唯一时间源，16 分音符步进调度，
 * 谱面挂在 songTime() 上与音乐天然同步；暂停用 ctx.suspend()。
 * 三种编曲风格：boxing(铜管 stab+四踩) / heavy(boom-bap+808)
 *               / rush(高速强袭+16分镲)。
 * ============================================================ */
const AudioSys = (() => {
  const F = m => 440 * Math.pow(2, (m - 69) / 12);   // MIDI → 频率

  let ctx = null, master, musicGain, sfxGain, noiseBuf;
  let duckGain = null, echoSend = null, echoDelay = null;
  let comp = null;
  let muted = false;
  let songTimer = null, stepIdx = 0, nextStepT = 0, totalSteps = 0;
  let songStartT = 0, playing = false;
  let cur = null;
  let STEP = 60 / 144 / 4;

  /* 自动化测试时钟（?testclock=1）：静默高速跑完整局 */
  const TEST_CLOCK = /[?&#]testclock=1/.test(location.href);
  const TEST_SPEED = 40;
  let testT0 = performance.now() / 1000;
  let pausedAt = null;

  function ensure() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    // 轻压限：密集打击不削波爆音
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004;
    master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.4;
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.6;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    duckGain = ctx.createGain();
    musicGain.connect(duckGain); duckGain.connect(master);
    sfxGain.connect(master);
    echoSend = ctx.createGain(); echoSend.gain.value = 0.2;
    echoDelay = ctx.createDelay(1); echoDelay.delayTime.value = 0.25;
    const fb = ctx.createGain(); fb.gain.value = 0.28;
    const wet = ctx.createGain(); wet.gain.value = 0.7;
    echoSend.connect(echoDelay);
    echoDelay.connect(fb); fb.connect(echoDelay);
    echoDelay.connect(wet); wet.connect(duckGain);
    return ctx;
  }
  function resumeCtx() { ensure(); if (ctx.state === 'suspended') ctx.resume(); }
  const tnow = () => {
    if (!TEST_CLOCK) return ctx.currentTime;
    if (pausedAt !== null) return pausedAt;
    return testT0 + (performance.now() / 1000 - testT0) * TEST_SPEED;
  };

  /* ---------- 基础发声 ---------- */
  function tone({ t, f0, f1, dur, type = 'square', vol = 0.2, dest, attack = 0.004, lp = 0 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    let node = g;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lp;
      node.connect(f); node = f;
    }
    node.connect(dest || musicGain);
    o.start(t); o.stop(t + dur + 0.06);
  }
  function noise({ t, dur, vol = 0.2, hp = 0, lp = 0, dest, attack = 0.001 }) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = s;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g); g.connect(dest || musicGain);
    s.start(t); s.stop(t + dur + 0.06);
  }

  /* ---------- 鼓组 ---------- */
  const kick = (t, v = 1) => {
    tone({ t, f0: 160, f1: 42, dur: 0.2, type: 'sine', vol: 0.62 * v });
    noise({ t, dur: 0.03, vol: 0.12 * v, lp: 900 });       // 打点瞬态
    if (duckGain) {
      duckGain.gain.cancelScheduledValues(t);
      duckGain.gain.setValueAtTime(0.55, t);
      duckGain.gain.linearRampToValueAtTime(1, t + 0.18);
    }
  };
  const kick808 = (t, v = 1) => {
    tone({ t, f0: 130, f1: 36, dur: 0.5, type: 'sine', vol: 0.64 * v });
    noise({ t, dur: 0.02, vol: 0.1 * v, lp: 800 });
  };
  const snare = (t, v = 1) => {
    noise({ t, dur: 0.11, vol: 0.22 * v, hp: 1400 });
    tone({ t, f0: 215, f1: 150, dur: 0.08, type: 'triangle', vol: 0.17 * v });
  };
  const clap = (t, v = 1) => noise({ t, dur: 0.09, vol: 0.16 * v, hp: 1800, lp: 9000 });
  const hat = (t, open = false, v = 1) => noise({ t, dur: open ? 0.13 : 0.035, vol: 0.07 * v, hp: 7000 });

  /* ---------- 旋律乐器 ---------- */
  const bass = (t, f, v = 1, dur = 0.18) => tone({ t, f0: f, dur, type: 'square', vol: 0.15 * v, lp: 620 });
  const sub808 = (t, f, v = 1) => tone({ t, f0: f, dur: 0.55, type: 'sine', vol: 0.3 * v, attack: 0.01 });
  // 铜管味 stab：三层微失谐锯齿 + 低通，拳击配乐的招牌重音
  const stab = (t, fs, v = 1) => {
    for (const f of fs) for (const det of [-11, 0, 11])
      tone({ t, f0: f * Math.pow(2, det / 1200), dur: 0.16, type: 'sawtooth', vol: 0.03 * v, lp: 2600 });
  };
  const lead = (t, f, dur, wave, v = 1) => {
    const main = wave === 'sawtooth' ? 0.08 : 0.1;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(main * v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain); g.connect(echoSend);
    o.start(t); o.stop(t + dur + 0.06);
    tone({ t, f0: f * 2.004, dur: dur * 0.75, type: 'triangle', vol: 0.04 * v });
  };
  const pad = (t, fs, dur) => { for (const f of fs) tone({ t, f0: f, dur, type: 'triangle', vol: 0.04, attack: 0.2 }); };
  // 拳击回合钟：金属钟声（基音+两个非谐波分音+噪声瞬态）
  const bell = (t, v = 1) => {
    [523.25, 1245, 1870].forEach((f, i) =>
      tone({ t, f0: f, f1: f * 0.995, dur: i === 0 ? 1.1 : 0.5, type: 'sine', vol: (i === 0 ? 0.3 : 0.12) * v, attack: 0.002 }));
    noise({ t, dur: 0.02, vol: 0.2 * v, hp: 3000 });
  };
  // 沙哑小号（尘与拳主音）：锯齿+深低通+微降音，模拟蒙住喇叭口的旧铜管
  const brass = (t, f, dur, v = 1) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const flt = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.02, t);              // 起音微降，像人吹出来的
    o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    flt.type = 'lowpass'; flt.frequency.value = 1300; flt.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.11 * v, t + 0.03);
    g.gain.setValueAtTime(0.1 * v, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt); flt.connect(g); g.connect(musicGain); g.connect(echoSend);
    o.start(t); o.stop(t + dur + 0.06);
  };
  // 群众呐喊「嘿！」：带通噪声团
  const chant = (t, v = 1) => {
    noise({ t, dur: 0.16, vol: 0.14 * v, hp: 350, lp: 1900, dest: musicGain, attack: 0.015 });
    tone({ t, f0: 196, f1: 175, dur: 0.14, type: 'sawtooth', vol: 0.045 * v, lp: 900 });
  };
  // 观众口哨
  const whistle = (t) => {
    tone({ t, f0: 2100, f1: 2650, dur: 0.28, type: 'sine', vol: 0.028, dest: musicGain });
  };
  // 乙烯基炒豆声（随机爆点）
  const crackle = (t) => {
    if (Math.random() < 0.55) noise({ t, dur: 0.012, vol: rand2(0.008, 0.028), hp: 2600, dest: musicGain });
  };
  const rand2 = (a, b) => a + Math.random() * (b - a);
  // 场馆人群底噪（持续氛围层）
  let ambSrc = null, ambGain = null;
  function startAmbience() {
    if (TEST_CLOCK || ambSrc) return;
    ambGain = ctx.createGain(); ambGain.gain.value = 0.0;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 750;
    ambSrc = ctx.createBufferSource(); ambSrc.buffer = noiseBuf; ambSrc.loop = true;
    ambSrc.connect(f); f.connect(ambGain); ambGain.connect(master);
    ambGain.gain.setTargetAtTime(0.05, tnow(), 1.2);
    ambSrc.start();
  }
  function stopAmbience() {
    if (!ambSrc) return;
    ambGain.gain.setTargetAtTime(0.0001, tnow(), 0.3);
    const src = ambSrc; setTimeout(() => { try { src.stop(); } catch (e) {} }, 1200);
    ambSrc = null;
  }

  /* ---------- 步进调度 ---------- */
  function scheduleStep(idx, t) {
    if (TEST_CLOCK || !cur) return;
    const bar = idx >> 4, st = idx & 15;
    const sec = Chart.sectionAt(bar);
    const m = cur.music;
    const chord = m.chords[bar % 4];
    const style = m.style;

    /* --- 鼓组 --- */
    if (style === 'heavy') {
      const kicks = sec === 'chorus' ? [0, 6, 8, 10] : [0, 7, 8];
      if (kicks.includes(st)) kick808(t);
      if (st === 4 || st === 12) snare(t, 0.95);
      if (st % 2 === 0) hat(t, false, st % 4 === 2 ? 0.9 : 0.55);
      if (sec === 'chorus' && st % 4 === 2) hat(t, true, 0.7);
    } else if (style === 'dust') {
      // 尘与拳：粗粝 boom-bap——摇摆 kick、脏 snare、炒豆声、群众呐喊
      const sw = (st % 2 === 1) ? STEP * 0.55 : 0;          // 16 分摇摆
      const tt = t + sw;
      const kicks = sec === 'chorus' ? [0, 7, 8, 10] : [0, 7, 8];
      if (kicks.includes(st)) kick808(tt);
      if (st === 4 || st === 12) { noise({ t: tt, dur: 0.13, vol: 0.24, hp: 900, lp: 6500 }); tone({ t: tt, f0: 190, f1: 140, dur: 0.09, type: 'triangle', vol: 0.15 }); }
      if (st % 4 === 2) hat(tt, true, 0.75);
      else if (st % 2 === 0) hat(tt, false, 0.5);
      if (st === 0 || st === 8) sub808(tt, F(chord.r));
      if (st === 11) sub808(tt, F(chord.r) * 1.5, 0.7);
      if (sec === 'chorus' && (st === 0 || st === 8)) stab(t, chord.pad.map(n => n * 2), 0.8);
      if (sec === 'verse' && st === 6) stab(t, [chord.pad[1] * 2], 0.6);
      crackle(t);                                            // 乙烯基炒豆
      if (st === 0 && (sec === 'chorus' || sec === 'verse') && bar % 2 === 0) chant(t + STEP * 2, 1);
      if (st === 10 && bar % 4 === 3) whistle(t);
    } else if (style === 'rush') {
      if (st % 4 === 0) kick(t);
      if (sec === 'chorus' && (st === 10)) kick(t, 0.7);
      if (st === 4 || st === 12) snare(t);
      if (sec === 'chorus' && st === 14) snare(t, 0.45);
      if (sec === 'verse' ? st % 2 === 0 : true) hat(t, st % 4 === 2, st % 4 === 2 ? 0.8 : 0.5);
    } else { // boxing
      if (sec === 'intro') { if (st % 4 === 0) kick(t, 0.75); }
      else {
        if (st % 4 === 0) kick(t);
        if (st === 4 || st === 12) { snare(t); clap(t, 0.8); }
        if (st % 4 === 2) hat(t, true, 0.85);
        else if (st % 2 === 0) hat(t, false, 0.6);
      }
    }

    /* --- 贝斯 --- */
    if (sec !== 'intro') {
      const r = F(chord.r);
      if (style === 'heavy') {
        if (st === 0 || st === 8) sub808(t, r);
        if (st === 11) sub808(t, r * 1.5, 0.7);
      } else if (style === 'rush') {
        if (st % 2 === 0) bass(t, st === 14 ? r * 1.5 : r, 0.9, 0.12);
      } else {
        if (st % 2 === 0) bass(t, st === 14 ? r * 1.5 : r, 0.95);
      }
    }

    /* --- 和声 --- */
    if (st === 0) pad(t, chord.pad, STEP * 15.5);
    if (sec === 'chorus' && (st === 0 || st === 8)) stab(t, chord.pad.map(n => n * 2));
    if (style === 'boxing' && sec === 'verse' && st === 6) stab(t, [chord.pad[1] * 2], 0.7);

    /* --- 回合钟：intro 与两段副歌开拍 --- */
    if (st === 0 && (bar === 0 || bar === 20 || bar === 36)) bell(t);

    /* --- 主旋律 --- */
    const bank = m.lead;
    let seq, li;
    if (sec === 'intro')       { seq = bank.intro;  li = bar; }
    else if (sec === 'verse')  { seq = bank.verse;  li = (bar - 4) % 4; }
    else if (sec === 'chorus') { seq = bank.chorus; li = (bar < 36 ? bar - 20 : bar - 36) % 4; }
    else                       { seq = bank.outro;  li = (bar - 44) % bank.outro.length; }
    const note = seq[li % seq.length][st];
    if (note) {
      if (style === 'dust') brass(t, F(note), sec === 'chorus' ? 0.42 : 0.6);  // 沙哑小号主音
      else lead(t, F(note), sec === 'chorus' ? 0.22 : 0.3, m.wave);
    }
  }

  /* ---------- 歌曲控制 ---------- */
  function startSong(songDef, steps) {
    ensure(); resumeCtx();
    cur = songDef;
    STEP = 60 / songDef.music.bpm / 4;
    if (echoDelay) echoDelay.delayTime.value = STEP * 3;
    totalSteps = steps;
    stepIdx = 0;
    nextStepT = tnow() + 0.5;
    songStartT = nextStepT;
    playing = true;
    musicGain.gain.cancelScheduledValues(tnow());
    musicGain.gain.setTargetAtTime(0.4, tnow(), 0.05);
    startAmbience();                                       // 场馆人群底噪
    if (songTimer) clearInterval(songTimer);
    songTimer = setInterval(() => {
      if (!playing) return;
      while (nextStepT < tnow() + 0.3 && stepIdx < totalSteps) {
        scheduleStep(stepIdx, nextStepT);
        stepIdx++; nextStepT += STEP;
      }
    }, 40);
  }
  const songTime = () => (ctx ? tnow() - songStartT : 0);
  const beatNow = () => songTime() / (STEP * 4);
  function stopSong() {
    playing = false;
    if (songTimer) { clearInterval(songTimer); songTimer = null; }
    if (ctx) musicGain.gain.setTargetAtTime(0.0001, tnow(), 0.15);
    stopAmbience();
  }
  const suspend = () => {
    if (TEST_CLOCK) { pausedAt = tnow(); return; }
    if (ctx && ctx.state === 'running') ctx.suspend();
  };
  const resume = () => {
    if (TEST_CLOCK) {
      if (pausedAt !== null) {
        const nowReal = performance.now() / 1000;
        testT0 = (TEST_SPEED * nowReal - pausedAt) / (TEST_SPEED - 1);
        pausedAt = null;
      }
      return;
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  const setMuted = m => { muted = m; if (ctx) master.gain.value = m ? 0 : 0.9; };
  const bpmOf = songDef => songDef.music.bpm;

  /* ---------- 打击音效（打击感的灵魂） ---------- */
  // 出拳破空声
  const sfxSwing = () => { ensure(); const t = tnow();
    noise({ t, dur: 0.09, vol: 0.09, hp: 2400, lp: 9000, dest: sfxGain, attack: 0.02 }); };
  // 命中：肉感 thud + 重量感低频 + 清脆高频层，按判定分层
  function sfxHit(quality, fever) {
    ensure(); const t = tnow(); const k = quality === 'PERFECT' ? 1 : quality === 'GREAT' ? 0.8 : 0.55;
    noise({ t, dur: 0.05, vol: 0.3 * k, hp: 900, lp: 5200, dest: sfxGain });            // 皮面拍击
    tone({ t, f0: 170, f1: 55, dur: 0.14, type: 'sine', vol: 0.5 * k, dest: sfxGain });  // 重量低频
    if (quality !== 'GOOD') {
      tone({ t: t + 0.005, f0: 1250 + 700 * k, f1: 700, dur: 0.06, type: 'square', vol: 0.09 * k, dest: sfxGain });
    }
    if (quality === 'PERFECT') {
      tone({ t: t + 0.02, f0: 1980, f1: 2600, dur: 0.05, type: 'sine', vol: 0.12, dest: sfxGain });
      if (fever) tone({ t: t + 0.04, f0: 2640, dur: 0.06, type: 'sine', vol: 0.08, dest: sfxGain });
    }
  }
  const sfxCombo = n => { ensure(); const t = tnow();
    tone({ t, f0: 784, dur: 0.06, vol: 0.08, dest: sfxGain });
    tone({ t: t + 0.05, f0: 1046 + Math.min(600, n * 4), dur: 0.09, vol: 0.08, dest: sfxGain }); };
  const sfxGlove = () => { ensure(); const t = tnow();
    tone({ t, f0: 1568, dur: 0.06, type: 'sine', vol: 0.11, dest: sfxGain });
    tone({ t: t + 0.05, f0: 2093, dur: 0.09, type: 'sine', vol: 0.1, dest: sfxGain }); };
  const sfxHurt = () => { ensure(); const t = tnow();
    tone({ t, f0: 200, f1: 62, dur: 0.28, type: 'sawtooth', vol: 0.2, dest: sfxGain });
    noise({ t, dur: 0.12, vol: 0.14, hp: 400, lp: 2400, dest: sfxGain }); };
  function sfxFever() { ensure(); const t = tnow();
    bell(t, 0.7);
    [69, 73, 76, 81].forEach((m, i) => tone({ t: t + 0.08 + i * 0.05, f0: F(m), dur: 0.14, vol: 0.12, dest: sfxGain })); }
  function sfxKO() { ensure(); const t = tnow();
    tone({ t, f0: 240, f1: 40, dur: 0.5, type: 'sine', vol: 0.7, dest: sfxGain });
    noise({ t, dur: 0.3, vol: 0.3, hp: 200, lp: 3000, dest: sfxGain });
    // 人群沸腾
    noise({ t: t + 0.15, dur: 2.2, vol: 0.16, hp: 300, lp: 3800, dest: sfxGain, attack: 0.25 }); }
  function sfxWin() { ensure(); const t = tnow();
    [69, 73, 76, 81, 85].forEach((m, i) => tone({ t: t + i * 0.09, f0: F(m), dur: 0.24, vol: 0.13, dest: sfxGain })); }
  function sfxFail() { ensure(); const t = tnow();
    [64, 60, 55].forEach((m, i) => tone({ t: t + i * 0.16, f0: F(m), dur: 0.34, type: 'triangle', vol: 0.14, dest: sfxGain })); }
  const sfxBell = (n = 3) => { ensure(); const t = tnow();
    for (let i = 0; i < n; i++) bell(t + i * 0.42, 0.9); };
  const sfxUI = () => { ensure(); tone({ t: tnow(), f0: 880, dur: 0.05, type: 'sine', vol: 0.07, dest: sfxGain }); };
  const sfxMiss = () => { ensure(); noise({ t: tnow(), dur: 0.1, vol: 0.08, hp: 500, lp: 1600, dest: sfxGain }); };

  return {
    ensure, resumeCtx, songTime, beatNow,
    startSong, stopSong, suspend, resume, setMuted, bpmOf,
    sfxSwing, sfxHit, sfxCombo, sfxGlove, sfxHurt, sfxFever, sfxKO, sfxWin, sfxFail,
    sfxBell, sfxUI, sfxMiss,
  };
})();
