'use strict';
/* ============================================================
 * Chart · 曲目与谱面生成器（纸片拳王）
 * 四路出拳：F=后手刺拳(高)  J=前手直拳(高)
 *          D=后手勾拳(低)  K=前手上勾(低)
 * 拳理即谱面：1-2 连击（刺拳接直拳）、交叉互搏、终结上勾。
 * 长按 = 连击 flurry（按住不放，拳头自动连打）。
 * ============================================================ */
const Chart = (() => {
  const BARS = 48;
  const _ = null;

  /* ---------- 旋律/和声素材（16 步/小节） ---------- */
  const MUSIC = {
    // 拳台之夜：Am-G-F-E 安达卢西亚下行，铜管味 stab，回合钟开场
    fightnight: {
      wave: 'sawtooth', style: 'boxing',
      bpm: 144,
      chords: [
        { r: 45, pad: [57, 64, 69] },   // Am
        { r: 43, pad: [55, 62, 67] },   // G
        { r: 41, pad: [53, 60, 65] },   // F
        { r: 40, pad: [52, 59, 64] },   // E
      ],
      lead: {
        intro:  [[69,_,_,_, _,_,67,_, 65,_,_,_, 64,_,65,_]],
        verse: [
          [69,_,_,69, _,_,67,_, 65,_,64,_, 65,_,67,_],
          [67,_,_,67, _,_,65,_, 64,_,62,_, 64,_,65,_],
          [65,_,_,65, _,64,_,_, 62,_,_,_, 60,_,62,_],
          [64,_,64,_, 65,_,67,_, 68,_,_,_, 71,_,68,_],
        ],
        chorus: [
          [69,_,69,_, 72,_,69,_, 67,_,65,_, 67,_,_,_],
          [67,_,67,_, 71,_,67,_, 65,_,64,_, 65,_,_,_],
          [65,_,65,_, 69,_,72,_, 74,_,72,_, 69,_,_,_],
          [76,_,74,_, 71,_,68,_, 64,_,65,_, 64,_,_,_],
        ],
        outro:  [[69,_,_,_, 65,_,_,_, 64,_,_,_, 64,_,_,_]],
      },
    },
    // 钢铁脚步：重型 boom-bap，低音厚，小调阴郁
    steppin: {
      wave: 'square', style: 'heavy',
      bpm: 128,
      chords: [
        { r: 40, pad: [55, 62, 67] },   // Em
        { r: 40, pad: [55, 62, 67] },
        { r: 43, pad: [55, 62, 67] },   // G
        { r: 38, pad: [53, 60, 65] },   // D
      ],
      lead: {
        intro:  [[64,_,_,_, _,_,_,_, 62,_,_,_, _,_,_,_]],
        verse: [
          [64,_,_,_, _,_,62,_, 64,_,_,_, _,_,_,_],
          [64,_,_,_, _,_,67,_, 64,_,62,_, _,_,_,_],
          [67,_,_,_, _,_,64,_, 62,_,_,_, 64,_,_,_],
          [64,_,62,_, 64,_,_,_, _,_,_,_, _,_,62,_],
        ],
        chorus: [
          [76,_,_,74, _,_,71,_, 74,_,_,71, _,69,_,_],
          [76,_,_,79, _,76,_,74, _,71,_,_, _,69,_,_],
          [74,_,_,71, _,_,69,_, 71,_,74,_, 71,_,69,_],
          [76,_,74,_, 76,_,79,_, 76,_,74,_, 71,_,_,_],
        ],
        outro:  [[64,_,_,_, _,_,_,_, 62,_,_,_, _,_,_,_]],
      },
    },
    // 尘与拳：地下拳场热血风——粗粝 boom-bap + 沙哑铜管 + 群众呐喊（致敬 MEGALOBOX 氛围）
    dustfist: {
      wave: 'sawtooth', style: 'dust',
      bpm: 96,
      chords: [
        { r: 38, pad: [50, 62, 65] },   // Dm
        { r: 36, pad: [48, 60, 65] },   // C
        { r: 41, pad: [53, 60, 65] },   // F
        { r: 38, pad: [50, 62, 68] },   // Dm7
      ],
      lead: {                            // 沙哑小号式长句，切分呐喊
        intro:  [[62,_,_,_, _,_,65,_, _,_,_,_, _,_,_,_]],
        verse: [
          [62,_,_,_, 65,_,_,_, 62,_,60,_, _,_,_,_],
          [62,_,_,_, 65,_,67,_, 65,_,62,_, _,_,_,_],
          [60,_,_,_, 62,_,65,_, 62,_,_,_, _,_,_,_],
          [62,_,65,_, 67,_,_,_, 70,_,67,_, 65,_,_,_],
        ],
        chorus: [
          [70,_,_,_, 67,_,65,_, 62,_,_,65, _,_,_,_],
          [67,_,_,_, 65,_,62,_, 60,_,_,62, _,_,_,_],
          [65,_,62,_, 60,_,58,_, 60,_,_,_, _,_,_,_],
          [62,_,65,_, 67,_,70,_, 72,_,_,_, _,_,_,_],
        ],
        outro:  [[62,_,_,_, _,_,_,_, 60,_,_,_, _,_,_,_]],
      },
    },
    // 最后一战：高速强袭，E 小调，高压连打
    finalround: {
      wave: 'sawtooth', style: 'rush',
      bpm: 160,
      chords: [
        { r: 40, pad: [52, 59, 64] },   // Em
        { r: 45, pad: [55, 59, 62] },   // Am
        { r: 43, pad: [55, 62, 66] },   // G
        { r: 40, pad: [52, 59, 64] },
      ],
      lead: {
        intro:  [[76,_,76,_, _,_,74,_, 76,_,_,_, _,_,_,_]],
        verse: [
          [76,_,76,_, 79,_,76,_, 74,_,76,_, _,_,_,_],
          [76,_,76,_, 79,_,81,_, 79,_,76,_, 74,_,_,_],
          [74,_,74,_, 77,_,74,_, 71,_,74,_, _,_,_,_],
          [76,_,79,_, 76,_,74,_, 71,_,74,_, 76,_,_,_],
        ],
        chorus: [
          [83,_,81,_, 79,_,81,_, 83,_,_,79, _,76,_,_],
          [83,_,86,_, 83,_,81,_, 79,_,76,_, 79,_,_,_],
          [81,_,79,_, 76,_,79,_, 81,_,_,84, _,81,_,_],
          [83,81,79,_, 76,_,74,_, 76,_,79,_, 83,_,_,_],
        ],
        outro:  [[76,_,_,_, 74,_,_,_, 71,_,_,_, 64,_,_,_]],
      },
    },
  };

  /* ---------- 曲目定义 ---------- */
  const SONGS = [
    {
      id: 'dustfist', name: '尘与拳', en: 'DUST & FIST',
      emoji: '🔥', desc: '地下拳场热血风 · 粗粝 boom-bap + 群众呐喊',
      music: MUSIC.dustfist,
      speeds: { easy: 500, normal: 585, hard: 665 },
      palette: {
        wall: ['#2b2016', '#4a331f'], floor: '#3c2c1c', floorLit: '#54402a',
        rope: '#d95843', ropeLight: '#e8c98f', accent: '#e8a33d',
        crowd: '#170f09', spot: '255,196,120',
      },
    },
    {
      id: 'steppin', name: '钢铁脚步', en: 'Steppin\u2019 Steel',
      emoji: '🥊', desc: '重型慢摇 · 拳台热身，入门首选',
      music: MUSIC.steppin,
      speeds: { easy: 520, normal: 600, hard: 680 },
      palette: {
        wall: ['#0e3a42', '#155059'], floor: '#123c44', floorLit: '#1a4e57',
        rope: '#d94f43', ropeLight: '#f0e6d2', accent: '#f2b632',
        crowd: '#081e24', spot: '240,230,200',
      },
    },
    {
      id: 'fightnight', name: '拳台之夜', en: 'Fight Night',
      emoji: '🏆', desc: '安达卢西亚下行 · 回合钟开场，标准手感',
      music: MUSIC.fightnight,
      speeds: { easy: 540, normal: 625, hard: 710 },
      palette: {
        wall: ['#123c46', '#1b5661'], floor: '#14454f', floorLit: '#1d5a66',
        rope: '#e05548', ropeLight: '#f4ead6', accent: '#f2b632',
        crowd: '#0a252c', spot: '244,234,206',
      },
    },
    {
      id: 'finalround', name: '最后一战', en: 'Final Round',
      emoji: '🔥', desc: '高速强袭 · 为冠军准备的地狱强度',
      music: MUSIC.finalround,
      speeds: { easy: 570, normal: 655, hard: 745 },
      palette: {
        wall: ['#3c1420', '#571c2c'], floor: '#451725', floorLit: '#5e2135',
        rope: '#e8b64c', ropeLight: '#f4ead6', accent: '#ff5f4d',
        crowd: '#200a10', spot: '255,214,170',
      },
    },
  ];
  const getSong = id => SONGS.find(s => s.id === id) || SONGS[1];

  /* ---------- 段落 ---------- */
  const SECTIONS = [];
  for (let b = 0; b < BARS; b++)
    SECTIONS.push(b < 4 ? 'intro' : b < 20 ? 'verse' : b < 28 ? 'chorus'
               : b < 36 ? 'verse' : b < 44 ? 'chorus' : 'outro');
  const sectionAt = bar => SECTIONS[Math.max(0, Math.min(BARS - 1, bar))];
  const roundAt = bar => (bar < 20 ? 1 : bar < 44 ? 2 : 3);

  /* ---------- 模式库 ----------
     事件 = [拍位, 车道 'J'/'K'/'U'/'I', 类型 'n'普通/'h'连击flurry, 连击持续拍] */
  const POOLS = {
    easy: {
      verse: [
        [[0,'jab','n'],[2,'cross','n']],
        [[0,'cross','n'],[2,'jab','n']],
        [[0,'jab','n'],[2,'hook','n']],
        [[0,'cross','n'],[2,'upper','n']],
        [[0,'jab','n'],[1,'jab','n'],[2,'cross','n']],
        [[1,'cross','n'],[3,'upper','n']],
      ],
      chorus: [
        [[0,'jab','n'],[1,'cross','n'],[2,'jab','n'],[3,'cross','n']],
        [[0,'hook','n'],[1,'hook','n'],[2,'upper','n'],[3,'upper','n']],
        [[0,'jab','n'],[1,'cross','n'],[2,'upper','n']],
        [[0,'jab','h',2],[2,'cross','n'],[3,'upper','n']],
        [[0,'cross','n'],[2,'hook','n'],[3,'upper','n']],
      ],
    },
    normal: {
      verse: [
        [[0,'jab','n'],[1,'cross','n'],[2,'jab','n'],[3,'cross','n']],
        [[0,'cross','n'],[1,'upper','n'],[2,'jab','n'],[3,'hook','n']],
        [[0,'jab','n'],[0.5,'cross','n'],[2,'jab','n'],[2.5,'cross','n']],
        [[0,'hook','n'],[1,'upper','n'],[2,'hook','n'],[3,'upper','n']],
        [[0,'jab','h',2.5]],
        [[0,'jab','n'],[1,'jab','n'],[2,'cross','n'],[3,'upper','n']],
        [[0,'cross','n'],[1,'jab','n'],[2,'upper','n'],[3,'cross','n']],
        [[1,'jab','n'],[2,'cross','n'],[3,'hook','n']],
      ],
      chorus: [
        [[0,'jab','n'],[1,'cross','n'],[1.5,'jab','n'],[2,'cross','n'],[3,'upper','n']],
        [[0,'hook','n'],[0.5,'upper','n'],[2,'jab','n'],[2.5,'cross','n'],[3,'upper','n']],
        [[0,'jab','n'],[1,'cross','n'],[2,'upper','h',1.5]],
        [[0,'upper','n'],[1,'upper','n'],[2,'jab','n'],[2.5,'cross','n'],[3,'hook','n']],
        [[0,'jab','h',1.5],[2,'cross','n'],[3,'upper','n']],
        [[0,'cross','n'],[1,'upper','n'],[2,'jab','n'],[3,'cross','n'],[3.5,'upper','n']],
      ],
    },
    hard: {
      verse: [
        [[0,'jab','n'],[0.5,'cross','n'],[1,'jab','n'],[2,'hook','n'],[2.5,'upper','n'],[3,'hook','n']],
        [[0,'cross','n'],[1,'upper','n'],[1.5,'cross','n'],[2,'jab','n'],[3,'cross','n'],[3.5,'upper','n']],
        [[0,'jab','h',3.5]],
        [[0,'upper','h',3.5]],
        [[0,'jab','n'],[0,'cross','n'],[1.5,'hook','n'],[2,'upper','n'],[2.5,'hook','n'],[3.5,'cross','n']],
        [[0,'hook','n'],[1,'jab','n'],[2,'upper','n'],[3,'cross','n'],[3.5,'jab','n']],
      ],
      chorus: [
        [[0,'jab','n'],[0.5,'cross','n'],[1,'jab','n'],[1.5,'cross','n'],[2,'hook','n'],[2.5,'upper','n'],[3,'hook','n'],[3.5,'upper','n']],
        [[0,'jab','h',1.5],[2,'cross','h',1.5]],
        [[0,'upper','n'],[0.5,'hook','n'],[1,'upper','n'],[2,'jab','n'],[2.5,'cross','n'],[3,'jab','n'],[3.5,'cross','n']],
        [[0,'cross','n'],[1,'jab','n'],[1.5,'cross','n'],[2,'upper','n'],[3,'hook','n'],[3.5,'upper','n']],
        [[0,'jab','n'],[1,'upper','h',2],[3,'cross','n'],[3.5,'jab','n']],
        [[0,'hook','n'],[0.5,'jab','n'],[1,'upper','n'],[2,'cross','n'],[2.5,'jab','n'],[3,'upper','n'],[3.5,'cross','n']],
      ],
    },
  };
  const OUTRO = [
    [[0,'jab','n'],[2,'cross','n']],
    [[0,'cross','n'],[2,'upper','n']],
    [[1,'jab','n'],[3,'upper','n']],
  ];

  const DIFFS = {
    easy:   { label: '热身', gloveChance: 0.42 },
    normal: { label: '挑战', gloveChance: 0.52 },
    hard:   { label: '冠军', gloveChance: 0.60 },
  };

  /* 金拳套（奖励拾取，按对应车道键吃掉） */
  function generate(song, diffKey) {
    const d = DIFFS[diffKey] || DIFFS.normal;
    const bpm = song.music.bpm;
    const beat = 60 / bpm;
    const speed = song.speeds[diffKey] || song.speeds.normal;
    const events = [];

    for (let bar = 0; bar < BARS; bar++) {
      const sec = sectionAt(bar);
      if (sec === 'intro') continue;
      const pool = sec === 'outro' ? OUTRO
                 : sec === 'chorus' ? POOLS[diffKey].chorus : POOLS[diffKey].verse;
      const pat = pool[Math.floor(Math.random() * pool.length)];
      for (const ev of pat) {
        const beatPos = bar * 4 + ev[0];
        if (ev[2] === 'h')
          events.push({ beat: beatPos, lane: ev[1], kind: 'hold', dur: Math.max(1.5, ev[3]) });
        else
          events.push({ beat: beatPos, lane: ev[1], kind: 'normal' });
      }
    }
    events.sort((a, b) => a.beat - b.beat || a.lane.localeCompare(b.lane));
    const clean = [];
    for (const e of events) {
      const prev = clean[clean.length - 1];
      if (prev && Math.abs(prev.beat - e.beat) < 0.01 && prev.lane === e.lane) continue;
      clean.push(e);
    }

    const gloves = [];
    for (let bar = 4; bar < BARS; bar++) {
      for (const off of [1.5, 2.5, 3.5]) {
        if (Math.random() > d.gloveChance) continue;
        const beat = bar * 4 + off;
        const lane = ['jab', 'cross', 'hook', 'upper'][Math.floor(Math.random() * 4)];
        const conflict = clean.some(e =>
          Math.abs(e.beat - beat) < 0.3 ||
          (e.kind === 'hold' && e.lane === lane && beat > e.beat - 0.3 && beat < e.beat + e.dur + 0.3));
        if (!conflict) gloves.push({ beat, lane });
      }
    }

    let lastTime = 0;
    for (const e of clean) lastTime = Math.max(lastTime, e.beat * beat);

    return {
      events: clean, gloves, totalBeats: BARS * 4, lastTime,
      speed, spb: beat, bars: BARS,
    };
  }

  return { generate, SONGS, getSong, DIFFS, BARS, sectionAt, roundAt };
})();
