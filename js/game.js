'use strict';
/* ============================================================
 * BoxerDash v3 · 纸片拳王 PAPER FIST
 * 侧视拳台节奏游戏：纸片骨骼拳击手 × 四路出拳谱面。
 * 打击感全家桶：顿帧 / 震屏 / 纸屑飞溅 / 冲击环 / 速度线 /
 * 漫画拟声词 / 沙袋物理摆动 / 人群闪光 / KO 慢镜头。
 * ============================================================ */
const Game = (() => {
  const W = 1280, H = 720;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');

  const AUTO = /[?&#]auto=1/.test(location.href);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const D2R = Math.PI / 180;

  /* ---------- 版本记录（每次更新：改 VERSION + VERSIONS + CHANGELOG.md） ---------- */
  const VERSION = 'v3.6';
  const VERSIONS = [
    { v: 'v3.6', date: '2026-09-19', title: '热血爆发', items: [
      '新增 必杀系统：必杀槽攒满按 F 释放「BULLET FIST!!」——冲刺贴脸六连轰 + 终结上勾轰飞，演出期间无敌',
      '改动 金拳套移除，必杀槽改为纯命中充能；槽满不再自动进入金手套，改为按 F 释放，必杀结束后进入金手套时间',
      '改动 键位定稿 ASGH（A 刺 S 直 G 勾 H 上勾），格挡改到空格，F 专职必杀',
    ]},
    { v: 'v3.5', date: '2026-09-19', title: '攻防回合', items: [
      '新增 格挡系统：对手会更频繁地出重拳，红色「！」预警后按 G 格挡',
      '新增 格挡成功 +150 分并让对手踉跄；失手他会一拳全扣在你身上',
      '改动 键位统一为 ASDF（A 刺 S 直 D 勾 F 上勾），判定圈按身体部位拉开',
      '新增 回合大特效：每打倒一个对手，全屏砸出 ROUND 2 / 3 / 4…',
    ]},
    { v: 'v3.4', date: '2026-09-19', title: '热血拳场', items: [
      '新增 新曲「尘与拳 DUST & FIST」：粗粝 boom-bap + 沙哑小号 + 群众呐喊（地下拳场氛围）',
      '新增 全场馆氛围层：人群底噪、口哨、乙烯基炒豆声',
      '新增 热血场景：三道扫动聚光灯、观众人浪挥手、应援横幅、光柱尘埃、擂台围裙',
      '优化 击退 v2：初速度滑行物理，滑过 100px 会趔趄，高速滑行擦出灰尘',
    ]},
    { v: 'v3.3', date: '2026-09-19', title: '击退', items: [
      '新增 击退效果：打得越重对手被推得越靠右，随后滑步退回原位',
      '新增 被击退时脚下擦出灰尘，K.O. 时被轰飞得更远',
      '优化 伤害数字/拟声词/眩晕星星跟随击退位移',
    ]},
    { v: 'v3.2', date: '2026-09-19', title: '铁拳回应', items: [
      '新增 连击里程碑：每 25 连击对手破防硬直 1 秒，期间伤害翻倍',
      '新增 键位方案切换：方位键 U I / J K ↔ 左右手 F J / D K，大厅可选',
      '新增 游戏内版本记录面板 + CHANGELOG.md',
      '新增 移动端竖屏横屏提示',
      '调整 谱面车道全面语义化，键位与玩法数据解耦',
    ]},
    { v: 'v3.1', date: '2026-09-19', title: '蓝拳对手', items: [
      '沙袋下岗：镜像换色的蓝方纸片拳手登场',
      '对手会压步逼近、还拳挑衅，被击倒后换更硬的下一阵',
      '出拳加前冲上步，拳峰实打实砸在对手身上',
      '肩甲烘焙进躯干，出拳不再散架',
    ]},
    { v: 'v3.0', date: '2026-09-19', title: '纸片拳王', items: [
      '首个完整版本：拼贴主角切件绑定 2D 骨骼',
      '侧视拳台四路出拳玩法（刺/直/勾/上勾）',
      '打击感全家桶：顿帧/震屏/纸屑/冲击星/速度线/拟声词/慢镜头 KO',
      '三首 Web Audio 程序化原创配乐 + 大厅选曲/难度/存档',
    ]},
  ];

  /* ---------- 存档 ---------- */
  const SAVE_KEY = 'boxerdash_v3';
  let save = { best: {}, offset: 0, muted: false, scheme: 'grid' };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

  /* ---------- 全局状态 ---------- */
  const S = {
    scene: 'loading',          // loading/title/lobby/play/pause/results
    t: 0, dt: 0,
    song: null, diff: 'normal', chart: null,
    playing: false, startAt: 0,
    score: 0, combo: 0, maxCombo: 0,
    counts: { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 },
    hp: 100, feverGauge: 0, feverT: 0,
    hitstop: 0, shakeT: 0, shakeMag: 0, flashA: 0, slowmo: 0,
    roundSplash: null, ready: 0, hurtA: 0,
    notes: [], holds: [],
    koT: -1, ended: false, fc: true, endResult: null,
    auto: AUTO,
  };
  const palette = () => S.song.palette;

  /* ---------- 特效池 ---------- */
  const particles = [], words = [], rings = [], dmgNums = [], crowdFlash = [];
  const COMICS = ['BAM!', 'POW!', 'WHAM!', 'SMACK!', 'THUD!', 'BOFF!'];

  function burst(x, y, n, power, accent) {
    for (let i = 0; i < n; i++) {
      const a = rand(-Math.PI * 0.9, Math.PI * 0.45);
      const sp = rand(120, 340) * power;
      particles.push({
        x, y, vx: Math.cos(a) * sp - 90 * power, vy: Math.sin(a) * sp - 60,
        rot: rand(0, 360), vr: rand(-500, 500),
        w: rand(5, 13), h: rand(4, 10),
        life: rand(0.5, 1.0), t: 0,
        color: pick(accent ? ['#f2b632', '#e05548', '#f4ead6', accent] : ['#f4ead6', '#e05548', '#3d6b78', '#f2b632']),
      });
    }
  }
  function impactStar(x, y, scale) { rings.push({ x, y, t: 0, dur: 0.28, star: true, scale }); }
  function ring(x, y) { rings.push({ x, y, t: 0, dur: 0.35, star: false }); }
  function speedlines(x, y) {
    for (let i = 0; i < 7; i++)
      particles.push({ line: true, x: x + rand(10, 60), y: y + rand(-26, 26),
        vx: rand(700, 1300), vy: rand(-30, 30), len: rand(40, 120), life: 0.22, t: 0 });
  }
  function comicWord(x, y, big, text) {
    words.push({ text: text || (big ? 'K.O.!!' : pick(COMICS)), x, y, t: 0, dur: big ? 1.4 : 0.55,
      rot: rand(-14, 14), big: !!big, s: 0 });
  }
  function dmg(x, y, v) { dmgNums.push({ x, y, v, t: 0, dur: 0.7 }); }

  /* ---------- 对手（蓝方拳手） ---------- */
  const foe = {
    x: 790, y: 570, hp: 2600, maxHp: 2600,
    dent: 0, hurtT: 0, stagger: 0, ko: false, respawnT: 0, gen: 1, lastTaunt: 0,
    knock: 0, knockV: 0, knockPrev: 0,
    reset() { Object.assign(this, { hp: 2600, maxHp: 2600, dent: 0, hurtT: 0, stagger: 0,
      ko: false, respawnT: 0, gen: 1, lastTaunt: 0, knock: 0, knockV: 0, knockPrev: 0 }); },
    hit(power) {
      if (this.ko) return;
      if (this.stagger > 0) power *= 2;          // 破防硬直：伤害翻倍
      this.hp = Math.max(0, this.hp - power);
      this.dent = Math.min(1, this.dent + power * 0.0004);
      this.hurtT = 0.18;
      // 击退 v2：命中赋初速度，对手带着速度向后滑行（打得越重滑得越远）
      this.knockV = Math.min(1100, this.knockV + power * 7.5);
      this.knock = Math.min(200, this.knock + 8);
      dmg(this.x + 110 + this.knock, this.y - 320, Math.round(power));
      if (this.stagger <= 0) FoeRig.act('hurt');
      if (this.hp <= 0) {           // 击倒对手，下一回合换更硬的
        this.ko = true; this.respawnT = 1.6; this.stagger = 0;
        this.knockV = Math.min(1400, this.knockV + 650);   // 倒地时被轰飞
        S.roundSplash = { round: this.gen + 1, t: 0 };     // 下一回合大特效
        S.score += 1000 * this.gen;
        comicWord(this.x + 90 + this.knock, this.y - 180, false);
        burst(this.x + 100 + this.knock, this.y - 260, 36, 1.5, palette().accent);
        crowdCheer();
        AudioSys.sfxKO();
        S.slowmo = Math.max(S.slowmo, 0.5);
      }
    },
  };

  /* ---------- 车道（ASDF 单一方案；判定圈按对手身体部位分布） ---------- */
  const LANES = [
    { id: 'jab',   act: 'jab',   hand: 'L', key: 'A', label: 'A', name: '刺拳·打头', mult: 1.0,  y: 205 },
    { id: 'cross', act: 'cross', hand: 'R', key: 'S', label: 'S', name: '直拳·打脸', mult: 1.2,  y: 265 },
    { id: 'hook',  act: 'hook',  hand: 'L', key: 'G', label: 'G', name: '勾拳·打腹', mult: 1.45, y: 330 },
    { id: 'upper', act: 'upper', hand: 'R', key: 'H', label: 'H', name: '上勾·打腰', mult: 1.6,  y: 395 },
  ];
  const PLACE = { x: 250, y: 570, s: 0.36 };
  const FOE_PLACE = { x: 790, y: 570, s: 0.36 };
  const FoeRig = createRig({
    base: 'assets/foe/', flip: true,
    poseBias: { body: 14, rx: 40, ry: 20, head: -6, r: -10, lu: -10 },  // 前倾压向玩家
  });   // 蓝方对手（镜像）
  const FOE_FACE = 585;   // 判定圈所在（对手脸/躯干前缘）
  function computeLanes() {
    // 判定圈按对手身体部位上下拉开：头 205 / 脸 265 / 腹 330 / 腰 395
    LANES.forEach((L, i) => { L.y = L.y = [205, 265, 330, 395][i]; L.x = FOE_FACE; L.railY = L.y; });
  }

  /* ---------- 判定 ---------- */
  const WINDOWS = { PERFECT: 0.058, GREAT: 0.112, GOOD: 0.165 };
  const scoreOf = q => q === 'PERFECT' ? 300 : q === 'GREAT' ? 180 : 80;

  function judgeHit(L) {
    const now = songBeat();
    const spb = S.chart.spb;
    let best = null, bestDt = 1e9;
    for (const n of S.notes) {
      if (n.lane !== L.id || n.done) continue;
      const dt = (n.beat - now) * spb;          // 判定统一用秒
      if (Math.abs(dt) < Math.abs(bestDt)) { best = n; bestDt = dt; }
    }
    if (!best || Math.abs(bestDt) > WINDOWS.GOOD) { whiff(L); return; }
    const q = Math.abs(bestDt) <= WINDOWS.PERFECT ? 'PERFECT'
            : Math.abs(bestDt) <= WINDOWS.GREAT ? 'GREAT' : 'GOOD';
    best.done = true; best.hitAt = S.t;
    landPunch(L, q, best.beat);
  }

  function landPunch(L, q, beat) {
    const perfect = q === 'PERFECT';
    Rig.act(L.act);
    Rig.flash(L.hand);
    AudioSys.sfxSwing();
    // 命中点 = 判定圈（对手身上），特效直接在他身上爆开
    const impactX = L.x + 14, impactY = L.railY;

    AudioSys.sfxHit(q, S.feverT > 0);
    S.counts[q]++;
    S.combo++;
    S.maxCombo = Math.max(S.maxCombo, S.combo);
    const mult = (S.feverT > 0 ? 2 : 1);
    S.score += scoreOf(q) * mult + Math.min(50, S.combo * 2);
    S.feverGauge = clamp(S.feverGauge + (perfect ? 5 : q === 'GREAT' ? 3.4 : 2), 0, 100);
    if (S.combo > 0 && S.combo % 50 === 0) {
      S.hp = clamp(S.hp + 6, 0, 100);
      crowdCheer();
    }
    // 连击里程碑：每 25 连击对手破防硬直 1 秒，伤害翻倍
    if (S.combo > 0 && S.combo % 25 === 0 && !foe.ko && foe.stagger <= 0) {
      foe.stagger = 1.05;
      FoeRig.act('stagger');
      comicWord(FOE_PLACE.x + 120, FOE_PLACE.y - 330, false, '破防!');
      crowdCheer();
    }

    /* ---- 打击感全家桶 ---- */
    S.hitstop = Math.max(S.hitstop, perfect ? 0.075 : q === 'GREAT' ? 0.045 : 0.02);
    S.shakeT = 0.22; S.shakeMag = perfect ? 9 : q === 'GREAT' ? 6 : 3.5;
    S.flashA = Math.max(S.flashA, perfect ? 0.16 : 0.07);
    burst(impactX, impactY, perfect ? 16 : 10, perfect ? 1.15 : 0.8, S.feverT > 0 ? '#f2b632' : null);
    impactStar(impactX, impactY, perfect ? 1.2 : 0.8);
    ring(impactX, impactY);
    speedlines(impactX, impactY);
    if (perfect && Math.random() < 0.65) comicWord(impactX + rand(20, 80), impactY - rand(30, 80), false);
    foe.hit((perfect ? 46 : q === 'GREAT' ? 30 : 18) * L.mult * (S.feverT > 0 ? 1.8 : 1));
  }

  function whiff(L) {
    Rig.act(L.act);
    AudioSys.sfxSwing();
    S.shakeT = 0.1; S.shakeMag = 2;
  }

  function missNote(n) {
    n.done = true; n.missed = true;
    S.counts.MISS++;
    S.combo = 0; S.fc = false;
    const dmgScale = S.diff === 'easy' ? 0.6 : S.diff === 'hard' ? 1.25 : 1;
    S.hp = clamp(S.hp - (n.kind === 'hold' ? 12 : 8) * dmgScale, 0, 100);
    S.feverGauge = clamp(S.feverGauge - 4, 0, 100);
    if (!S.ulti) {
      AudioSys.sfxMiss();
      Rig.act('hurt');
      S.shakeT = 0.18; S.shakeMag = 5;
      if (S.hp <= 0 && !S.ended) knockdown();
    }
  }

  function crowdCheer() {
    for (let i = 0; i < 8; i++)
      crowdFlash.push({ x: rand(60, W - 60), y: rand(430, 600), t: 0, dur: rand(0.2, 0.45) });
  }

  /* ---------- 长按连击 flurry ---------- */
  const holdState = { lane: null, nextTick: 0 };
  function holdStart(L) {
    const now = songBeat();
    let target = null;
    for (const n of S.notes) {
      if (n.lane !== L.id || n.done || n.kind !== 'hold') continue;
      if (Math.abs(n.beat - now) < 0.35) { target = n; break; }
    }
    if (!target) { judgeHit(L); return; }
    target.done = true; target.holding = true;
    holdState.lane = L; holdState.note = target;
    holdState.nextTick = Math.max(now, target.beat);
    holdState.count = 0;
    S.counts.PERFECT++; S.combo++; // 起手即计
  }
  function holdTick() {
    const L = holdState.lane, n = holdState.note;
    if (!L || !n) return;
    const now = songBeat();
    if (!inputDown[L.key]) { // 提前松手 → 断
      n.holding = false;
      S.combo = 0; S.fc = false; S.hp = clamp(S.hp - 6, 0, 100);
      holdState.lane = null;
      AudioSys.sfxMiss();
      return;
    }
      while (holdState.nextTick <= now) {
      holdState.nextTick += 0.5;
      holdState.count++;
      const act = holdState.count % 2 ? 'flL' : 'flR';
      Rig.act(act);
      Rig.flash(holdState.count % 2 ? 'L' : 'R');
      AudioSys.sfxHit('GREAT', false);
      S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
      S.score += (90 + holdState.count * 6) * (S.feverT > 0 ? 2 : 1);
      foe.hit(12 * L.mult * (S.feverT > 0 ? 1.8 : 1));
      burst(L.x + 20, L.railY, 5, 0.6, null);
      S.hitstop = Math.max(S.hitstop, 0.02);
      S.shakeT = 0.12; S.shakeMag = 3;
      holdState.note.ticks = (n.ticks || 0) + 1;
    }
    if (now > n.beat + n.dur) { // 完成长连击
      n.holding = false;
      S.score += 400;
      S.feverGauge = clamp(S.feverGauge + 8, 0, 100);
      comicWord(L.x + 120, L.y - 60, false);
      AudioSys.sfxGlove();
      burst(L.x + 80, L.y, 18, 1.1, '#f2b632');
      holdState.lane = null;
    }
  }

  /* ---------- 输入（ASGH 四拳；F 必杀；空格格挡） ---------- */
  const inputDown = {};
  const KEYMAP = { a: 'A', s: 'S', g: 'G', h: 'H',
    arrowup: 'A', arrowright: 'S', arrowdown: 'G', arrowleft: 'H' };
  function pressLane(key) {
    if (S.scene !== 'play' || S.koT >= 0) return;
    inputDown[key] = true;
    const L = LANES.find(l => l.key === key);
    if (L) { if (S.hitstop > 0) S.hitstop = Math.min(S.hitstop, 0.03); judgeOrHold(L); }
  }
  function judgeOrHold(L) {
    const now = songBeat();
    const hold = S.notes.find(n => !n.done && n.kind === 'hold' && n.lane === L.id
      && Math.abs(n.beat - now) < 0.35);
    if (hold && !holdState.lane) holdStart(L);
    else judgeHit(L);
  }
  function releaseLane(key) { inputDown[key] = false; }

  /* ---------- 格挡系统：对手出重拳时按 G 格挡，失败挨一记重拳 ---------- */
  let foeAtk = null;          // { tele, hit } 预警拍 / 挥拳拍（节拍数）
  let lastAtkBar = -1;
  function tryBlock() {
    if (S.scene !== 'play' || !foeAtk) return;
    const spb = S.chart.spb;
    const dtSec = Math.abs(foeAtk.hit - songBeat()) * spb;
    if (dtSec < 0.42) {
      foeAtk = null;
      window.__foeAtkNow = false; window.__lastBlock = true;
      S.score += 150 * (S.feverT > 0 ? 2 : 1);
      foe.stagger = Math.max(foe.stagger, 0.5);      // 对手被格挡踉跄
      FoeRig.act('hurt');
      burst(505, 285, 12, 1.0, '#f2b632');
      ring(505, 285);
      comicWord(505, 200, false, '格挡!');
      AudioSys.sfxBlock();
      S.hitstop = Math.max(S.hitstop, 0.04);
      S.shakeT = 0.15; S.shakeMag = 5;
    }
    // 时机不对：无效按键（不惩罚，仅空挥）
  }
  function foeSwingLands() {
    foeAtk = null; window.__foeAtkNow = false;
    if (S.ulti) return;                              // 必杀演出期间无敌
    S.combo = 0; S.fc = false;
    S.hp = clamp(S.hp - 14 * (S.diff === 'easy' ? 0.6 : S.diff === 'hard' ? 1.25 : 1), 0, 100);
    Rig.act('hurt');
    AudioSys.sfxHurt();
    S.shakeT = 0.26; S.shakeMag = 9;
    S.hurtA = 0.55;
    comicWord(430, 260, false, '挨打!');
    burst(470, 290, 10, 0.9, '#e05548');
    if (S.hp <= 0 && !S.ended) knockdown();
  }
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (S.scene === 'play' && KEYMAP[k] && !e.repeat) { pressLane(KEYMAP[k]); e.preventDefault(); }
    else if (k === ' ' && S.scene === 'play') { tryBlock(); e.preventDefault(); }
    else if (k === 'f' && S.scene === 'play') { tryUlti(); e.preventDefault(); }
    else if ((k === 'escape' || k === 'p') && (S.scene === 'play' || S.scene === 'pause')) togglePause();
    else if (S.scene === 'title' && k) toLobby();
    else if (k === 'm') { save.muted = !save.muted; AudioSys.setMuted(save.muted); persist(); }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (KEYMAP[k]) releaseLane(KEYMAP[k]);
  });
  // 触屏：左右半屏 × 上下半区（随键位方案映射到对应车道）
  cv.addEventListener('touchstart', e => {
    for (const t of e.changedTouches) {
      const r = cv.getBoundingClientRect();
      const x = (t.clientX - r.left) / r.width * W, y = (t.clientY - r.top) / r.height * H;
      const L = LANES[x > 640 ? (y < 360 ? 1 : 3) : (y < 360 ? 0 : 2)];
      pressLane(L.key);
    }
    e.preventDefault();
  }, { passive: false });
  cv.addEventListener('touchend', () => {
    for (const L of LANES) releaseLane(L.key);
  });

  /* ---------- 必杀：BULLET FIST（槽满按 F，演出期间无敌） ---------- */
  function tryUlti() {
    if (S.scene !== 'play' || S.ulti || S.feverGauge < 100 || foe.ko) return;
    S.ulti = { t: 0, dur: 2.4, fired: {}, finisher: false };
    S.feverGauge = 0;
    foeAtk = null; lastAtkBar = -1;
    S.flashA = 0.32; S.hitstop = 0.12; S.slowmo = Math.max(S.slowmo, 0.45);
    comicWord(FOE_PLACE.x + 140, FOE_PLACE.y - 360, true, 'BULLET FIST!!');
    AudioSys.sfxFever(); AudioSys.sfxBell(1);
    crowdCheer();
  }
  function updateUlti(rawDt) {
    const u = S.ulti; if (!u) return;
    u.t += rawDt;
    const beat = songBeat();
    // 六连轰击时间轴
    const sched = [0.3, 0.55, 0.8, 1.05, 1.3, 1.55];
    sched.forEach((st0, i) => {
      if (!u.fired[i] && u.t >= st0) {
        u.fired[i] = true;
        Rig.act(i % 2 ? 'cross' : 'hook');
        Rig.flash(i % 2 ? 'R' : 'L');
        AudioSys.sfxHit('PERFECT', true);
        foe.hit(70 + i * 18);
        burst(FOE_PLACE.x + foe.knock + 90, FOE_PLACE.y - 300 + i * 28, 12, 1.1, '#f2b632');
        S.hitstop = Math.max(S.hitstop, 0.03);
        S.shakeT = 0.2; S.shakeMag = 8;
      }
    });
    // 终结上勾：大击退 + 慢镜头
    if (!u.finisher && u.t >= 1.95) {
      u.finisher = true;
      Rig.act('upper'); Rig.flash('R');
      foe.hit(200);
      foe.knockV = Math.min(1500, foe.knockV + 1000);
      comicWord(FOE_PLACE.x + foe.knock + 110, FOE_PLACE.y - 330, true);
      S.slowmo = Math.max(S.slowmo, 0.8);
      S.flashA = 0.3;
      AudioSys.sfxKO();
    }
    // 结束：进入金手套时间
    if (u.t >= u.dur) {
      S.ulti = null;
      S.feverT = 9;
      AudioSys.sfxFever();
      crowdCheer();
    }
    // 必杀期间自动清掉身边的音符（拳雨覆盖）
    for (const n of S.notes) {
      if (n.done || n.missed) continue;
      const L = LANES.find(l => l.id === n.lane);
      if (Math.abs(n.beat - beat) < 0.35) {
        n.done = true;
        S.counts.PERFECT++; S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo);
        S.score += 300;
      }
    }
  }
  /* ---------- 节拍时间 ---------- */
  const spb = () => S.chart.spb;
  const songBeat = () => AudioSys.songTime() / spb();

  /* ---------- 场景流转 ---------- */
  const $ = id => document.getElementById(id);
  function show(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.remove('on');
    if (id) $(id).classList.add('on');
  }
  function toTitle() { S.scene = 'title'; show('screen-title'); }
  function toLobby() {
    S.scene = 'lobby'; show('screen-lobby');
    AudioSys.resumeCtx(); AudioSys.sfxUI();
    renderLobby();
  }
  function togglePause() {
    if (S.scene === 'play') {
      S.scene = 'pause'; show('screen-pause'); AudioSys.suspend();
    } else if (S.scene === 'pause') {
      S.scene = 'play'; show(null); AudioSys.resume();
    }
  }
  function startSong(song, diff) {
    S.song = song; S.diff = diff;
    S.chart = Chart.generate(song, diff);
    S.score = 0; S.combo = 0; S.maxCombo = 0;
    S.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    S.hp = 100; S.feverGauge = 0; S.feverT = 0;
    S.koT = -1; S.ended = false; S.fc = true; S.endResult = null;
    S.ready = 1.2; S.roundSplash = { round: 1, t: -1.35 }; S.hurtA = 0;
    particles.length = words.length = rings.length = dmgNums.length = crowdFlash.length = 0;
    foe.reset();
    Rig.reset();
    FoeRig.reset();
    // 生成音符实体（带屏幕坐标）
    const travel = s => s / 60; // 每秒 speed px
    S.notes = S.chart.events.map(e => ({
      beat: e.beat, lane: e.lane, kind: e.kind, dur: e.dur || 0,
      done: false, missed: false, holding: false, x: 0, y: 0, hitAt: 0, ticks: 0,
    }));
    show(null);
    S.scene = 'play';
    S.playing = true;
    const steps = Chart.BARS * 16;
    AudioSys.ensure(); AudioSys.resumeCtx();
    AudioSys.startSong(song, steps);
    computeLanes();
  }

  /* ---------- 结算 ---------- */
  function finishWin() {
    S.ended = true; S.koT = 0;
    S.endResult = 'win';
    S.slowmo = 1.1;
    AudioSys.stopSong();
    AudioSys.sfxKO();
    Rig.act('victory');
    FoeRig.act('down');
    comicWord(FOE_PLACE.x + 90, FOE_PLACE.y - 200, true);
    burst(FOE_PLACE.x + 100, FOE_PLACE.y - 250, 40, 1.6, palette().accent);
    foe.ko = true;
    crowdCheer(); crowdCheer();
    setTimeout(() => showResults(), 2600);
  }
  function knockdown() {
    S.ended = true; S.koT = 0; S.endResult = 'lose';
    AudioSys.stopSong();
    AudioSys.sfxFail();
    Rig.act('down');
    setTimeout(() => showResults(), 2200);
  }
  function showResults() {
    S.scene = 'results';
    const total = S.counts.PERFECT + S.counts.GREAT + S.counts.GOOD + S.counts.MISS;
    const acc = total ? (S.counts.PERFECT * 100 + S.counts.GREAT * 65 + S.counts.GOOD * 30) / total : 0;
    const rank = !S.fc ? (acc >= 95 ? 'S' : acc >= 88 ? 'A' : acc >= 78 ? 'B' : acc >= 65 ? 'C' : 'D')
      : (acc >= 99 ? 'SS' : 'S');
    const key = S.song.id + '_' + S.diff;
    const prev = save.best[key];
    const isNew = !prev || S.score > prev.score;
    if (isNew) save.best[key] = { score: S.score, rank, fc: S.fc };
    persist();
    $('r-title').textContent = S.endResult === 'lose' ? '被击倒…' : (S.fc ? '完美胜利!' : 'K.O. 胜利!');
    $('r-song').textContent = `${S.song.emoji} ${S.song.name} · ${Chart.DIFFS[S.diff].label}`;
    $('r-rank').textContent = rank;
    $('r-score').textContent = S.score.toLocaleString();
    $('r-maxcombo').textContent = S.maxCombo;
    $('r-perfect').textContent = S.counts.PERFECT;
    $('r-great').textContent = S.counts.GREAT;
    $('r-good').textContent = S.counts.GOOD;
    $('r-miss').textContent = S.counts.MISS;
    $('r-acc').textContent = acc.toFixed(1) + '%';
    $('r-fc').style.display = S.fc ? '' : 'none';
    $('r-new').style.display = isNew && S.endResult !== 'lose' ? '' : 'none';
    show('screen-results');
    if (S.endResult !== 'lose') AudioSys.sfxWin();
  }

  /* ---------- 主更新 ---------- */
  let lastT = performance.now();
  function frame() {
    const now = performance.now();   // setTimeout 回调不带时间戳，自取
    try { step(now); } catch (e) { (window.__errors = window.__errors || []).push(String(e && e.stack || e)); }
    setTimeout(frame, 10);   // setTimeout 驱动：隐藏标签页 rAF 会冻结
  }
  function step(now) {
    const rawDt = clamp((now - lastT) / 1000, 0, 0.06);
    lastT = now;
    let dt = rawDt;
    if (S.hitstop > 0) { S.hitstop -= rawDt; dt *= 0.06; }          // 顿帧：世界近乎冻结
    if (S.slowmo > 0) { S.slowmo -= rawDt; dt *= 0.3; }             // KO 慢镜头
    S.t += dt; S.dt = dt;

    if (S.scene === 'play' && !S.ended) {
      updatePlay(dt, rawDt);
    }
    updateFx(dt);
    Rig.update(dt);
    FoeRig.update(dt);
    draw();
  }

  function updatePlay(dt, rawDt) {
    const beat = songBeat();
    Rig.setBeat(((beat % 1) + 1) % 1, S.feverT > 0 ? 1 : 0);
    FoeRig.setBeat(((beat % 1) + 1) % 1, 0);

    // ready 倒计时
    if (S.ready > 0) S.ready -= dt;

    // fever：必杀槽满后按 F 释放（F 键处理在 keydown）
    if (S.feverT > 0) S.feverT -= dt;
    if (S.ulti) updateUlti(rawDt);

    // 自动演奏（演示/测试）
    if (S.auto) {
      for (const n of S.notes) {
        if (n.done || n.kind === 'hold') continue;
        if (Math.abs(n.beat - beat) < 0.06) {
          n.done = true;
          const L = LANES.find(l => l.id === n.lane);
          landPunch(L, 'PERFECT', n.beat);
        }
      }
    }

    // 长按连击 tick；若提前按住按键，到达长按段时自动接入
    if (holdState.lane) {
      holdTick();
    } else {
      for (const L of LANES) {
        if (!inputDown[L.key]) continue;
        const n = S.notes.find(x => !x.done && x.kind === 'hold' && x.lane === L.id
          && beat - x.beat > -0.15 && beat < x.beat + x.dur);
        if (n) { holdStart(L); break; }
      }
    }

    // 音符推进 + 漏判
    const sp = S.chart.speed;
    for (const n of S.notes) {
      const L = LANES.find(l => l.id === n.lane);
      const dtBeat = n.beat - beat;
      n.x = L.x + dtBeat * spb() * sp;
      n.y = L.railY;
      if (n.kind === 'hold') {
        n.x2 = L.x + (n.beat + n.dur - beat) * spb() * sp;
      }
      if (!n.done && !n.missed && n.x < L.x - 130) missNote(n);
      if (n.done && !n.missed && n.kind !== 'hold') {
        // 命中后向左飞散消失
        n.hitAt += dt;
      }
    }

    // 对手：击退滑行物理 / 受击表现 / 破防倒计时 / 挑衅还拳 / K.O. 后换人
    foe.hurtT = Math.max(0, foe.hurtT - dt);
    foe.stagger = Math.max(0, foe.stagger - dt);
    foe.knock += foe.knockV * dt;                              // 带速度向后滑行
    foe.knockV *= Math.exp(-dt * 5);                           // 滑行摩擦
    foe.knock += (0 - foe.knock) * Math.min(1, dt * 0.8);      // 缓慢踱回原位
    foe.knock = clamp(foe.knock, -20, 220);
    if (foe.knock > 100 && foe.knockPrev <= 100 && foe.stagger <= 0 && !foe.ko) {
      FoeRig.act('hurt');                                      // 滑过 100px：趔趄一下
      burst(FOE_PLACE.x + foe.knock + 90, 655, 7, 0.7, null);  // 脚下滑尘
    }
    foe.knockPrev = foe.knock;
    if (foe.knockV > 150 && Math.random() < 0.5) {             // 高速滑行灰尘
      particles.push({ x: FOE_PLACE.x + foe.knock + rand(-60, 60), y: 698,
        vx: rand(-30, 50), vy: rand(-60, -15), rot: 0, vr: 0,
        w: 5, h: 4, life: 0.45, t: 0, color: 'rgba(220,230,225,0.5)' });
    }
    const tauntBar = Math.floor(beat / 4);
    if (foe.lastTaunt !== tauntBar && beat > 8 && !foe.ko && foe.stagger <= 0) {
      foe.lastTaunt = tauntBar;
      // 更凶：随机 1-2 连组合拳 + 时不时侧闪挑衅
      if (Math.random() < 0.45) {
        FoeRig.act(pick(['jab', 'cross']));
        setTimeout(() => FoeRig.act(pick(['hook', 'upper', 'cross'])), 160);
      } else if (Math.random() < 0.5) {
        FoeRig.act('dodge');
      } else {
        FoeRig.act(pick(['jab', 'cross', 'hook']));
      }
    }
    if (foe.respawnT > 0) {
      foe.respawnT -= dt;
      if (foe.respawnT <= 0) {
        foe.gen++;
        foe.maxHp = Math.round(foe.maxHp * 1.2);
        foe.hp = foe.maxHp;
        foe.ko = false; foe.dent = 0;
        FoeRig.reset(); foeAtk = null;
      }
    }

    // 敌方重拳：每 4 拍判定一次，55% 出拳（预警 1 拍，按 G 格挡）
    if (!foeAtk && !S.ulti && beat > 16 && !foe.ko && foe.stagger <= 0 && (beat % 4) < 0.1) {
      const atkBar = Math.floor(beat / 4);
      if (lastAtkBar !== atkBar && Math.random() < 0.55) {
        lastAtkBar = atkBar;
        foeAtk = { tele: beat, hit: beat + 1 };
        window.__foeAtkNow = true; window.__foeAtkSeen = true;
        AudioSys.sfxWarn();
      }
    }
    // 对手挥拳动作（挥到瞬间）
    if (foeAtk && !foeAtk.swung && beat > foeAtk.hit - 0.05) {
      foeAtk.swung = true;
      FoeRig.act(pick(['cross', 'hook']));
      AudioSys.sfxSwing();
    }
    // 挥拳落地：未格挡则结结实实挨一记
    if (foeAtk && beat > foeAtk.hit + 0.4) {
      foeSwingLands();
    }

    // 回合大特效计时
    if (S.roundSplash) S.roundSplash.t += dt;

    // 结束判定
    if (beat > S.chart.totalBeats + 1 && !S.ended) finishWin();

    // 结算失败瞬间等
    S.flashA = Math.max(0, S.flashA - dt * 3);
    if (S.shakeT > 0) S.shakeT -= rawDt;
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!p.line) { p.vy += 760 * dt; p.rot += p.vr * dt; }
      else p.vx *= 0.92;
      if (p.t > p.life) particles.splice(i, 1);
    }
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      w.t += dt;
      w.s = w.t < 0.08 ? w.t / 0.08 : Math.max(1, 1.35 - (w.t - 0.08) * 2.2);
      if (w.t > w.dur) words.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i].t += dt;
      if (rings[i].t > rings[i].dur) rings.splice(i, 1);
    }
    for (let i = dmgNums.length - 1; i >= 0; i--) {
      const d = dmgNums[i];
      d.t += dt; d.y -= 60 * dt;
      if (d.t > d.dur) dmgNums.splice(i, 1);
    }
    for (let i = crowdFlash.length - 1; i >= 0; i--) {
      crowdFlash[i].t += dt;
      if (crowdFlash[i].t > crowdFlash[i].dur) crowdFlash.splice(i, 1);
    }
    S.hurtA = Math.max(0, (S.hurtA || 0) - dt * 1.8);
  }

  /* ============================================================
   * 绘制
   * ============================================================ */
  let grainCanvas = null;
  function makeGrain() {
    grainCanvas = document.createElement('canvas');
    grainCanvas.width = 320; grainCanvas.height = 180;
    const g = grainCanvas.getContext('2d');
    const img = g.createImageData(320, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() * 70 - 35);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 14;
    }
    g.putImageData(img, 0, 0);
  }

  function draw() {
    const pal = S.song ? palette() : null;
    // 背景（大厅外用默认青）
    const wall = pal ? pal.wall : ['#123c46', '#1b5661'];
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, wall[0]); gr.addColorStop(1, wall[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);

    // 震屏
    ctx.save();
    if (S.shakeT > 0) {
      const m = S.shakeMag * (S.shakeT / 0.22);
      ctx.translate(rand(-m, m), rand(-m, m));
    }

    if (S.scene === 'play' || S.scene === 'pause' || (S.scene === 'results' && S.song)) {
      drawStage(pal);
      drawLanes();
      drawFoe();
      drawNotes();
      drawBoxer();
      drawMarkers();
      drawFx();
      ctx.restore();     // 震屏不影响 HUD
      drawHUD();
    } else {
      ctx.restore();
    }

    // 白闪 + 颗粒 + 暗角
    if (S.flashA > 0) {
      ctx.fillStyle = `rgba(255,255,255,${S.flashA})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (S.hurtA > 0) {
      const hg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
      hg.addColorStop(0, 'rgba(180,20,20,0)');
      hg.addColorStop(1, `rgba(190,25,20,${Math.min(0.55, S.hurtA)})`);
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    }
    if (S.ulti) {
      const ug = ctx.createLinearGradient(0, 0, 0, H);
      ug.addColorStop(0, 'rgba(242,182,50,0.22)');
      ug.addColorStop(1, 'rgba(224,85,72,0.10)');
      ctx.fillStyle = ug; ctx.fillRect(0, 0, W, H);
    }
    if (S.feverT > 0) {
      ctx.fillStyle = `rgba(242,182,50,${0.08 + 0.03 * Math.sin(S.t * 10)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (grainCanvas) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let y = 0; y < H; y += 180) for (let x = 0; x < W; x += 320)
        ctx.drawImage(grainCanvas, x, y);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(6,20,24,0.42)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ---------- 拳台场景 ---------- */
  let dustMotes = null;
  function drawStage(pal) {
    const beat = songBeat();
    const bar = Math.max(0, Math.floor(beat / 4));
    const sec = Chart.sectionAt(bar);
    const hot = sec === 'chorus' || sec === 'outro';   // 副歌/终盘：全场沸腾
    const pulse = 0.5 + 0.5 * Math.cos(beat * Math.PI);
    // 地板
    ctx.fillStyle = pal.floor;
    ctx.fillRect(0, 596, W, H - 596);
    ctx.fillStyle = pal.floorLit;
    ctx.fillRect(0, 596, W, 8);
    // 地板透视线
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const x = i * 190 - 80;
      ctx.beginPath(); ctx.moveTo(x, 720); ctx.lineTo(x + 240, 596); ctx.stroke();
    }
    // 擂台围裙（印着赛事名）
    ctx.fillStyle = pal.rope;
    ctx.fillRect(0, 706, W, 14);
    ctx.fillStyle = 'rgba(244,234,214,0.85)';
    ctx.font = '900 10px "Arial Black", system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P A P E R   F I S T · 纸 片 拳 王', W / 2, 713.5);
    // 观众席剪影（随节拍起伏）
    ctx.fillStyle = pal.crowd;
    ctx.beginPath();
    ctx.moveTo(0, 610);
    for (let x = 0; x <= W; x += 26) {
      const h = 586 + Math.sin(x * 0.045 + Math.floor(beat * 2) * 1.7) * 7 * (0.5 + pulse * 0.5);
      ctx.lineTo(x, h);
    }
    ctx.lineTo(W, 610); ctx.closePath(); ctx.fill();
    // 观众手臂：副歌全场人浪挥手，平时每隔几个举一次
    ctx.fillStyle = pal.crowd;
    for (let x = 18; x < W; x += 34) {
      const i = x / 34 | 0;
      const up = hot || i % 3 === 0;
      if (!up) continue;
      const sway = Math.sin(S.t * (hot ? 7 : 3.4) + i * 1.3) * (hot ? 10 : 5);
      const h = 586 + Math.sin(x * 0.045 + Math.floor(beat * 2) * 1.7) * 7;
      ctx.save();
      ctx.translate(x, h + 2);
      ctx.rotate(-1.35 + sway * 0.02);
      ctx.fillRect(-2, -16, 4, 16);          // 手臂
      ctx.beginPath(); ctx.arc(0, -17, 3, 0, 7); ctx.fill();  // 拳头
      ctx.restore();
    }
    // 观众席横幅（纸片标语，微微摆动）
    const banners = [['拳 王', 150], ['FIGHT!', 640], ['K.O.', 1130]];
    banners.forEach(([txt, bx], i) => {
      ctx.save();
      ctx.translate(bx, 528 + Math.sin(S.t * 1.6 + i * 2) * 3);
      ctx.rotate((i % 2 ? 1 : -1) * 0.05 + Math.sin(S.t + i) * 0.02);
      ctx.fillStyle = i === 1 ? 'rgba(224,85,72,0.9)' : 'rgba(244,234,214,0.85)';
      ctx.fillRect(-44, -16, 88, 32);
      ctx.fillStyle = '#12333c';
      ctx.font = '900 15px "Arial Black", system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, 0, 1);
      ctx.restore();
    });
    // 人群相机闪光
    for (const f of crowdFlash) {
      const a = 1 - f.t / f.dur;
      ctx.fillStyle = `rgba(255,250,230,${a * 0.9})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 3 + a * 3, 0, 7); ctx.fill();
    }
    // 围绳（三道，红白蓝）
    const ropes = [[pal.rope, 500], [pal.ropeLight, 534], [pal.rope, 568]];
    for (const [c, y] of ropes) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(0, y);
      // 绳子随节拍微微震颤
      for (let x = 0; x <= W; x += 64)
        ctx.lineTo(x, y + Math.sin(x * 0.02 + beat * 3.1) * 1.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 围绳柱
    for (const x of [36, W - 36]) {
      ctx.fillStyle = pal.rope;
      ctx.fillRect(x - 9, 470, 18, 130);
      ctx.fillStyle = pal.ropeLight;
      ctx.fillRect(x - 9, 470, 18, 14);
    }
    // 顶部扫动聚光灯：副歌扫得更快更亮，尘埃在光柱里飘
    const sweepSpeed = hot ? 1.4 : 0.55, sweepAmp = hot ? 150 : 60;
    for (const lx of [260, 640, 1020]) {
      const sway = Math.sin(S.t * sweepSpeed + lx * 0.01) * sweepAmp;
      const grad = ctx.createLinearGradient(lx, 0, lx + sway, 560);
      grad.addColorStop(0, `rgba(${pal.spot},${hot ? 0.2 : 0.13})`);
      grad.addColorStop(1, `rgba(${pal.spot},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(lx - 26, 0); ctx.lineTo(lx + 26, 0);
      ctx.lineTo(lx + sway + 130, 560); ctx.lineTo(lx + sway - 130, 560);
      ctx.closePath(); ctx.fill();
    }
    // 光柱尘埃（悬浮微粒）
    if (!dustMotes) {
      dustMotes = [];
      for (let i = 0; i < 26; i++)
        dustMotes.push({ x: rand(0, W), y: rand(40, 560), vy: rand(4, 14), ph: rand(0, 7) });
    }
    ctx.fillStyle = `rgba(${pal.spot},0.35)`;
    for (const d of dustMotes) {
      d.y -= d.vy * S.dt; d.x += Math.sin(S.t * 0.6 + d.ph) * 8 * S.dt;
      if (d.y < 30) { d.y = 570; d.x = rand(0, W); }
      const a = 0.08 + 0.07 * Math.sin(S.t * 2 + d.ph);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillRect(d.x, d.y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // 大海报星（背景装饰，节拍脉动）
    ctx.save();
    ctx.translate(920, 210);
    ctx.rotate(beat * 0.02);
    ctx.globalAlpha = 0.1 + pulse * 0.06;
    star(ctx, 0, 0, 5, 90 + pulse * 8, 38, pal.accent);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  function star(c, x, y, n, R, r, color) {
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 ? r : R;
      const a = (i * Math.PI) / n - Math.PI / 2;
      c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    c.closePath(); c.fill();
  }

  /* ---------- 航道与音符 ---------- */
  function drawLanes() {
    const beat = songBeat();
    const pulse = Math.max(0, 1 - ((beat % 1))) ;
    for (const L of LANES) {
      const y = L.railY;
      // 轨道
      ctx.strokeStyle = 'rgba(244,234,214,0.14)';
      ctx.setLineDash([10, 12]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(L.x, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.setLineDash([]);
      // 命中圈：深色底座保证可读 + 节拍呼吸
      const R = 30 + pulse * 5;
      ctx.fillStyle = 'rgba(10,30,36,0.45)';
      ctx.beginPath(); ctx.arc(L.x, y, R + 8, 0, 7); ctx.fill();
      ctx.strokeStyle = L.hand === 'L' ? 'rgba(224,85,72,0.9)' : 'rgba(242,182,50,0.95)';
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(L.x, y, R, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(244,234,214,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(L.x, y, R + 7, 0, 7); ctx.stroke();
      // 键位纸片
      ctx.save();
      ctx.translate(L.x, y + 46);
      ctx.rotate(-0.04);
      ctx.fillStyle = 'rgba(244,234,214,0.92)';
      ctx.fillRect(-16, -14, 32, 26);
      ctx.fillStyle = '#12333c';
      ctx.font = '900 17px "Arial Black", system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(L.label, 0, 1);
      ctx.restore();
    }
  }
  /* 拳击手身上再描一次命中圈，避免被纸片人遮住 */
  function drawMarkers() {
    for (const L of LANES) {
      ctx.strokeStyle = L.hand === 'L' ? 'rgba(224,85,72,0.5)' : 'rgba(242,182,50,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(L.x, L.railY, 33, 0, 7); ctx.stroke();
    }
  }
  function drawNotes() {
    for (const n of S.notes) {
      if (n.done && n.kind !== 'hold') {
        if (n.missed) continue;
        const k = n.hitAt / 0.18;
        if (k > 1) continue;
        const L = LANES.find(l => l.id === n.lane);
        // 命中爆裂残影
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#f4ead6';
        ctx.beginPath(); ctx.arc(L.x, L.railY, 30 + k * 46, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      if (n.missed) continue;
      if (n.x < -60 || n.x > W + 80) continue;
      const L = LANES.find(l => l.id === n.lane);
      const col = L.hand === 'L' ? '#e05548' : '#f2b632';
      if (n.kind === 'hold') {
        // 连击条
        const x0 = Math.max(n.x, L.x), x1 = n.x2;
        ctx.fillStyle = 'rgba(244,234,214,0.55)';
        ctx.fillRect(x0, n.y - 9, Math.max(0, x1 - x0), 18);
        ctx.fillStyle = col;
        ctx.fillRect(x0, n.y - 9, Math.max(0, x1 - x0), 6);
        // 链球头
        ctx.fillStyle = '#f4ead6';
        ctx.beginPath(); ctx.arc(x1, n.y, 14, 0, 7); ctx.fill();
        ctx.fillStyle = '#12333c';
        ctx.font = '900 12px "Arial Black", system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('连', x1, n.y + 1);
      } else {
        // 拳靶纸片
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(Math.sin(n.beat * 2.1) * 0.08);
        ctx.fillStyle = '#f4ead6';
        ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, 7); ctx.fill();
        ctx.fillStyle = '#12333c';
        ctx.font = '900 18px "Arial Black", system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(L.label, 0, 1);
        ctx.restore();
      }
    }
  }

  /* ---------- 对手拳手 ---------- */
  function drawFoe() {
    const fx = FOE_PLACE.x + foe.knock;   // 击退位移：打得越重越靠右
    // 地面阴影（随击退位移）
    ctx.fillStyle = 'rgba(6,20,24,0.3)';
    ctx.beginPath();
    ctx.ellipse(fx + 150, 702, 200, 18, 0, 0, 7);
    ctx.fill();
    // 景深调色：对手整体略暗略灰，和近景主角拉开层次
    const dim = ctx.filter !== undefined;
    if (dim) ctx.filter = 'brightness(0.87) saturate(0.92)';
    FoeRig.draw(ctx, S.t, { x: fx, y: FOE_PLACE.y, s: FOE_PLACE.s });
    ctx.filter = 'none';
    // 被打晕的小星星 + 破防提示
    if (foe.stagger > 0) {
      ctx.fillStyle = '#f2b632';
      ctx.font = '900 26px "Arial Black", system-ui';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#12333c'; ctx.lineWidth = 6;
      ctx.strokeText('破防!', FOE_PLACE.x + 130, 150);
      ctx.fillText('破防!', FOE_PLACE.x + 130, 150);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 10);
      star(ctx, FOE_PLACE.x + 80, 190, 5, 12, 5, '#f4ead6');
      star(ctx, FOE_PLACE.x + 185, 205, 5, 9, 4, '#f4ead6');
      ctx.globalAlpha = 1;
    } else if (foe.dent > 0.25 && !foe.ko) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 8);
      star(ctx, fx + 120, 175 + Math.sin(S.t * 3) * 5, 5, 10, 4, '#f4ead6');
      star(ctx, fx + 210, 160 + Math.cos(S.t * 2.6) * 4, 5, 7, 3, '#f4ead6');
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 出重拳预警：头顶红「！」+ 拳套红光渐强
    if (foeAtk && !S.ulti && !foe.ko) {
      const dtb = foeAtk.hit - songBeat();
      const urgent = clamp(1 - dtb / 1.0, 0, 1);
      const px = FOE_PLACE.x + foe.knock + 60;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(S.t * (6 + urgent * 14));
      ctx.fillStyle = '#e04030';
      ctx.beginPath(); ctx.arc(px, 168, 16 + urgent * 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '900 22px "Arial Black", system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', px, 169);
      ctx.restore();
      // 拳套红光
      ctx.save();
      ctx.globalAlpha = 0.25 + urgent * 0.35;
      ctx.fillStyle = '#e04030';
      ctx.beginPath(); ctx.arc(px - 60, 262, 40 + urgent * 10, 0, 7); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 体力槽（对手）
    if (!foe.ko) {
      const w = 190, cx = FOE_PLACE.x + 100;
      ctx.fillStyle = 'rgba(10,30,36,0.75)';
      ctx.fillRect(cx - w / 2 - 3, 118, w + 6, 20);
      ctx.fillStyle = '#4a9bd8';
      ctx.fillRect(cx - w / 2, 121, w * (foe.hp / foe.maxHp), 14);
      ctx.strokeStyle = 'rgba(244,234,214,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - w / 2 - 3, 118, w + 6, 20);
      ctx.fillStyle = '#f4ead6';
      ctx.font = '900 13px "Arial Black", system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(foe.gen > 1 ? `对手 K.O. 槽 · 第${foe.gen}阵` : '对手 K.O. 槽', cx, 108);
    }
  }

  /* ---------- 拳击手 ---------- */
  function drawBoxer() {
    // 地面阴影
    ctx.fillStyle = 'rgba(6,20,24,0.3)';
    ctx.beginPath();
    ctx.ellipse(PLACE.x + 155, 702, 200, 18, 0, 0, 7);
    ctx.fill();
    Rig.draw(ctx, S.t, PLACE);
    // 脚下灰尘（节拍）
    const beat = songBeat();
    if (((beat % 1) + 1) % 1 < 0.12 && Math.random() < 0.5)
      particles.push({ x: PLACE.x + rand(60, 300), y: 700, vx: rand(-30, 30), vy: rand(-60, -20),
        rot: 0, vr: 0, w: 4, h: 3, life: 0.4, t: 0, color: 'rgba(220,230,225,0.5)' });
  }

  /* ---------- 特效绘制 ---------- */
  function drawFx() {
    // 冲击环 + 星形冲击
    for (const r of rings) {
      const k = r.t / r.dur;
      ctx.globalAlpha = 1 - k;
      if (r.star) {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(k * 1.2);
        star(ctx, 0, 0, 8, (18 + k * 60) * r.scale, (8 + k * 22) * r.scale, '#fff8e8');
        ctx.restore();
      } else {
        ctx.strokeStyle = '#fff8e8';
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, 14 + k * 70, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // 纸屑 / 灰尘 / 速度线
    for (const p of particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, a);
      if (p.line) {
        ctx.strokeStyle = 'rgba(255,250,235,0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.len, p.y); ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * D2R);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // 伤害数字
    for (const d of dmgNums) {
      const a = 1 - d.t / d.dur;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff8e8';
      ctx.font = '900 22px "Arial Black", system-ui';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#12333c'; ctx.lineWidth = 4;
      ctx.strokeText(d.v, d.x, d.y);
      ctx.fillText(d.v, d.x, d.y);
      ctx.globalAlpha = 1;
    }
    // 漫画拟声词
    for (const w of words) {
      const a = clamp(1 - (w.t / w.dur - 0.6) * 2.5, 0, 1);
      ctx.save();
      ctx.translate(w.x, w.y - w.t * 60);
      ctx.rotate(w.rot * D2R);
      ctx.scale(w.s, w.s);
      ctx.globalAlpha = a;
      const size = w.big ? 90 : 44;
      ctx.font = `900 ${size}px "Arial Black", system-ui`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = w.big ? 12 : 7;
      ctx.strokeStyle = '#12333c';
      ctx.strokeText(w.text, 0, 0);
      ctx.fillStyle = w.big ? '#f2b632' : '#f4ead6';
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- HUD ---------- */
  function drawHUD() {
    if (S.scene !== 'play' && S.scene !== 'pause') return;
    const beat = songBeat();
    // 分数
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(10,30,36,0.55)';
    ctx.fillRect(W - 320, 14, 300, 54);
    ctx.strokeStyle = 'rgba(244,234,214,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(W - 320, 14, 300, 54);
    ctx.fillStyle = '#f4ead6';
    ctx.font = '900 34px "Arial Black", system-ui';
    ctx.fillText(S.score.toLocaleString(), W - 34, 20);
    ctx.font = '700 12px system-ui';
    ctx.fillStyle = 'rgba(244,234,214,0.6)';
    ctx.fillText('SCORE', W - 34, 54);
    // 连击
    if (S.combo >= 2) {
      const pop = 1 + 0.22 * Math.max(0, 1 - (S.t - lastHitT) * 6);
      ctx.save();
      ctx.translate(360, 130);
      ctx.rotate(-0.03);
      ctx.scale(pop, pop);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 74px "Arial Black", system-ui';
      ctx.lineWidth = 10; ctx.strokeStyle = '#12333c';
      ctx.strokeText(S.combo, 0, 0);
      ctx.fillStyle = S.feverT > 0 ? '#f2b632' : '#f4ead6';
      ctx.fillText(S.combo, 0, 0);
      ctx.font = '900 16px system-ui';
      ctx.lineWidth = 5;
      ctx.strokeText('HITS', 0, 52);
      ctx.fillText('HITS', 0, 52);
      ctx.restore();
    }
    // 判定文字
    if (lastJudge && S.t - lastJudge.t < 0.5) {
      const k = (S.t - lastJudge.t) / 0.5;
      ctx.globalAlpha = 1 - k;
      ctx.save();
      ctx.translate(360, 235 + k * 14);
      ctx.textAlign = 'center';
      ctx.font = '900 30px "Arial Black", system-ui';
      ctx.lineWidth = 6; ctx.strokeStyle = '#12333c';
      ctx.strokeText(lastJudge.q, 0, 0);
      ctx.fillStyle = lastJudge.q === 'PERFECT' ? '#f2b632' : lastJudge.q === 'GREAT' ? '#8fd8c9' : '#c9b8a0';
      ctx.fillText(lastJudge.q, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 体力条 + 金手套槽（左上，避开拳击手）
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '900 12px system-ui';
    ctx.fillStyle = 'rgba(244,234,214,0.9)';
    const ultiReady = S.feverGauge >= 100 && S.feverT <= 0;
    ctx.fillText(S.feverT > 0 ? '🔥 金手套时间!' : ultiReady ? '必杀就绪! 按 F 释放!' : '必杀槽 (F)', 26, 78);
    ctx.fillStyle = 'rgba(10,30,36,0.7)';
    ctx.fillRect(24, 94, 210, 13);
    ctx.fillStyle = '#f2b632';
    ctx.fillRect(27, 97, 204 * (S.feverT > 0 ? 1 : S.feverGauge / 100), 7);
    ctx.strokeStyle = 'rgba(244,234,214,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(24, 94, 210, 13);
    ctx.fillStyle = 'rgba(244,234,214,0.9)';
    ctx.fillText('体力', 26, 116);
    ctx.fillStyle = 'rgba(10,30,36,0.7)';
    ctx.fillRect(24, 131, 210, 13);
    ctx.fillStyle = S.hp > 40 ? '#8fd8c9' : '#e05548';
    ctx.fillRect(27, 134, 204 * (S.hp / 100), 7);
    ctx.strokeRect(24, 131, 210, 13);
    // 曲名 + 进度
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(10,30,36,0.55)';
    ctx.fillRect(14, 14, 330, 44);
    ctx.fillStyle = '#f4ead6';
    ctx.font = '900 17px system-ui';
    ctx.fillText(`${S.song.emoji} ${S.song.name} · ${Chart.DIFFS[S.diff].label}`, 26, 20);
    ctx.fillStyle = 'rgba(244,234,214,0.35)';
    ctx.fillRect(26, 44, 306, 6);
    ctx.fillStyle = palette().accent;
    ctx.fillRect(26, 44, 306 * clamp(beat / S.chart.totalBeats, 0, 1), 6);
    // 回合大特效：全屏砸出 ROUND N
    if (S.roundSplash && S.roundSplash.t > 0 && S.roundSplash.t < 1.9) {
      const k = S.roundSplash.t;
      const slamIn = clamp(k / 0.22, 0, 1);
      const scale = 2.8 - 1.8 * (1 - Math.pow(1 - slamIn, 4));   // outQuart 砸下
      const fade = clamp(1.55 - k, 0, 1);
      ctx.save();
      // 全屏暗幕 + 冲击线
      ctx.fillStyle = `rgba(10,25,30,${0.5 * fade})`;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(244,234,214,${0.5 * fade})`;
      ctx.lineWidth = 3;
      for (let i2 = 0; i2 < 10; i2++) {
        const yy = 80 + i2 * 62, off = (i2 % 2 ? 1 : -1) * (1 - slamIn) * 300;
        ctx.beginPath(); ctx.moveTo(-off, yy); ctx.lineTo(W + off, yy); ctx.stroke();
      }
      ctx.translate(W / 2, H / 2 - 20);
      ctx.rotate(-0.03 + Math.sin(k * 20) * 0.008 * (1 - slamIn));
      ctx.scale(scale, scale);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 120px "Arial Black", system-ui';
      ctx.lineWidth = 18; ctx.strokeStyle = '#12333c';
      const label = 'ROUND ' + S.roundSplash.round;
      ctx.globalAlpha = fade;
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = '#f2b632';
      ctx.fillText(label, 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 格挡提示：对手出重拳时提示按空格
    if (foeAtk && !S.ulti) {
      const dtb = foeAtk.hit - songBeat();
      const urgent = clamp(1 - dtb / 1.0, 0, 1);
      const a = 0.65 + 0.35 * Math.sin(S.t * (10 + urgent * 12));
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(W / 2, 620);
      ctx.fillStyle = urgent ? 'rgba(190,40,30,0.92)' : 'rgba(10,30,36,0.8)';
      ctx.strokeStyle = 'rgba(244,234,214,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(-110, -22, 220, 44, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f4ead6';
      ctx.font = '900 19px "Arial Black", system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🛡 空格 格挡!', 0, 1);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // READY
    if (S.ready > 0) {
      ctx.save();
      ctx.translate(W / 2, 300);
      ctx.textAlign = 'center';
      ctx.font = '900 64px "Arial Black", system-ui';
      ctx.lineWidth = 12; ctx.strokeStyle = '#12333c';
      const label = S.ready > 0.6 ? 'READY…' : 'FIGHT!';
      ctx.strokeText(label, 0, 0);
      ctx.fillStyle = S.ready > 0.6 ? '#f4ead6' : '#f2b632';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }
  let lastHitT = -9, lastJudge = null;
  const _origLand = landPunch;
  landPunch = function (L, q, beat) {
    lastHitT = S.t; lastJudge = { q, t: S.t };
    _origLand(L, q, beat);
  };

  /* ---------- 大厅 ---------- */
  let lobbySong = 1, lobbyDiff = 'normal';
  function renderLobby() {
    const wrap = $('lobby-songs');
    wrap.innerHTML = '';
    Chart.SONGS.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'song-card' + (i === lobbySong ? ' sel' : '');
      const best = save.best[s.id + '_' + lobbyDiff];
      card.innerHTML = `
        <div class="song-emoji">${s.emoji}</div>
        <div class="song-name">${s.name}<span class="song-en">${s.en}</span></div>
        <div class="song-bpm">${s.music.bpm} BPM · ${s.desc}</div>
        <div class="song-best">${best ? `最佳 ${best.score.toLocaleString()} · ${best.rank}${best.fc ? ' · FC' : ''}` : '暂无记录'}</div>`;
      card.onclick = () => { lobbySong = i; AudioSys.sfxUI(); renderLobby(); };
      card.ondblclick = () => startSong(Chart.SONGS[lobbySong], lobbyDiff);
      wrap.appendChild(card);
    });
    document.querySelectorAll('.diff-btn').forEach(b => {
      b.classList.toggle('sel', b.dataset.d === lobbyDiff);
      b.onclick = () => { lobbyDiff = b.dataset.d; AudioSys.sfxUI(); renderLobby(); };
    });
    $('btn-fight').onclick = () => startSong(Chart.SONGS[lobbySong], lobbyDiff);
    $('btn-back').onclick = toTitle;
    $('mute-chk').textContent = save.muted ? '🔇 已静音 (M)' : '🔊 音效开 (M)';
    $('lobby-ver').textContent = VERSION;
  }

  /* ---------- 版本记录面板 ---------- */
  function renderChangelog() {
    const wrap = $('changelog-list');
    wrap.innerHTML = '';
    VERSIONS.forEach((v, i) => {
      const item = document.createElement('div');
      item.className = 'cl-item' + (i === 0 ? ' newest' : '');
      item.innerHTML = `
        <div class="cl-head"><span class="cl-v">${v.v}</span><span class="cl-title">${v.title}</span><span class="cl-date">${v.date}</span></div>
        <ul>${v.items.map(t => `<li>${t}</li>`).join('')}</ul>`;
      wrap.appendChild(item);
    });
  }

  /* ---------- 标题 ---------- */
  function drawTitleBg() {
    // 标题页背景：淡出的拳台 + 海报
    drawStage(Chart.SONGS[1].palette);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    // DPR 适配
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = Math.min(window.innerWidth / W, window.innerHeight / H);
      cv.style.width = W * r + 'px';
      cv.style.height = H * r + 'px';
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', fit); fit();
    makeGrain();
    AudioSys.setMuted(save.muted);
    document.title = `纸片拳王 PAPER FIST · BoxerDash ${VERSION}`;
    $('ver-label').textContent = VERSION + ' · 更新记录';
    $('btn-version').onclick = () => { renderChangelog(); show('screen-changelog'); AudioSys.sfxUI(); };
    $('btn-changelog-close').onclick = () => show('screen-title');
    $('btn-title-start').onclick = toLobby;
    $('btn-resume').onclick = togglePause;
    $('btn-quit').onclick = () => { AudioSys.resume(); AudioSys.stopSong(); S.scene = 'lobby'; show('screen-lobby'); renderLobby(); };
    $('btn-retry').onclick = () => startSong(S.song, S.diff);
    $('t-block').onclick = () => { if (S.scene === 'play') tryBlock(); };
    $('t-ulti').onclick = () => { if (S.scene === 'play') tryUlti(); };
    $('btn-lobby').onclick = () => { S.scene = 'lobby'; show('screen-lobby'); renderLobby(); };
    Rig.load(() => { computeLanes(); });
    FoeRig.load();
    S.scene = 'title';
    show('screen-title');
    lastT = performance.now();
    frame(lastT);
  }

  /* 调试钩子 */
  window.__boxer = {
    version: VERSION,
    info: () => ({ scene: S.scene, score: S.score, combo: S.combo, counts: S.counts,
      beat: S.scene === 'play' ? songBeat() : 0, hp: S.hp, lanes: LANES.map(l => [l.key, Math.round(l.x), Math.round(l.y)]) }),
    nearest: () => {
      const b = songBeat();
      return S.notes.filter(n => !n.done).map(n => n.beat - b).sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    },
    state: S, rig: Rig, foeRig: FoeRig, foe,
    start: (songId, diff) => startSong(Chart.getSong(songId), diff || 'normal'),
    toLobby,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  return { S, startSong, toLobby, toTitle };
})();
