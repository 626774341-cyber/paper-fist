'use strict';
/* ============================================================
 * Rig · 纸片拳王骨骼动画系统（工厂版，支持红蓝双拳手）
 * 把拼贴画切成的 7 个纸片部件（body/head/armLu/gloveL/armR/shoeL/shoeR）
 * 绑成层级骨骼：root→body→(head, armLu→gloveL, armR, shoeL, shoeR)。
 * 待机是节拍驱动的程序动画（弹跳/摇摆/点脚），出拳是一次性关键帧
 * 动作（windup→strike→recover），impact 帧即拳头命中帧。
 * flip:true 用于镜像对手——部件已在生成时翻转，这里只需把所有
 * 角度/横向位移取反，运动学即自动镜像。
 * ============================================================ */
function createRig(opts) {
  const BASE = opts.base;
  const FLIP = !!opts.flip;
  const BIAS = opts.poseBias || null;   // 常驻姿态偏置（对手前倾逼近用）
  const D2R = Math.PI / 180;

  let meta = null, imgs = {}, shadows = {}, ready = false, onloadCb = null;

  /* ---------- 关节（随 pieces.json 镜像） ---------- */
  const J = {
    root: [430, 1060], neck: [636, 196],
    shoulderL: [186, 285], elbowL: [186, 492], fistL: [172, 815],
    shoulderR: [772, 268], fistR: [990, 205],
    ankleL: [482, 1072], ankleR: [982, 952],
  };

  /* ---------- 缓动 ---------- */
  const EASE = {
    linear: t => t,
    in: t => t * t,
    out: t => 1 - (1 - t) * (1 - t),
    inOut: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outQuart: t => 1 - Math.pow(1 - t, 4),
    outBack: t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  };
  function trackval(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1, e] = keys[i + 1];
      if (t <= t1) {
        const k = (t - t0) / Math.max(1e-6, t1 - t0);
        return v0 + (v1 - v0) * (EASE[e] || EASE.linear)(k);
      }
    }
    return keys[keys.length - 1][1];
  }

  /* ---------- 动作库 ---------- */
  const ACTS = {
    jab: { dur: .26, impact: .07, hand: 'L', tracks: {
      lu: [[0,0],[.05,-8,'in'],[.07,-88,'outQuart'],[.13,-84,'linear'],[.26,0,'inOut']],
      gl:[[0,0],[.07,-6,'outQuart'],[.26,0,'inOut']],
      luext:[[0,0],[.07,170,'outQuart'],[.26,0,'inOut']],
      rx:[[0,0],[.07,130,'outQuart'],[.26,0,'inOut']],
      body:[[0,0],[.07,-3,'outQuart'],[.26,0,'inOut']],
    }},
    cross: { dur: .30, impact: .075, hand: 'R', tracks: {
      r:[[0,0],[.05,10,'in'],[.075,-30,'outQuart'],[.14,-26,'linear'],[.30,0,'inOut']],
      rext:[[0,0],[.075,128,'outQuart'],[.30,0,'inOut']],
      rx:[[0,0],[.075,140,'outQuart'],[.30,0,'inOut']],
      body:[[0,0],[.075,4,'outQuart'],[.30,0,'inOut']],
    }},
    hook: { dur: .32, impact: .08, hand: 'L', tracks: {
      lu:[[0,0],[.06,12,'in'],[.08,-62,'outQuart'],[.15,-57,'linear'],[.32,0,'inOut']],
      gl:[[0,0],[.08,-26,'outQuart'],[.32,0,'inOut']],
      luext:[[0,0],[.08,200,'outQuart'],[.32,0,'inOut']],
      rx:[[0,0],[.08,170,'outQuart'],[.32,0,'inOut']],
      body:[[0,0],[.08,-7,'outQuart'],[.32,0,'inOut']],
      ry:[[0,0],[.08,-6,'outQuart'],[.32,0,'inOut']],
    }},
    upper: { dur: .34, impact: .09, hand: 'R', tracks: {
      r:[[0,0],[.05,-12,'in'],[.09,28,'outQuart'],[.16,24,'linear'],[.34,0,'inOut']],
      rext:[[0,0],[.09,92,'outQuart'],[.34,0,'inOut']],
      rx:[[0,0],[.09,100,'outQuart'],[.34,0,'inOut']],
      ry:[[0,0],[.05,8,'in'],[.09,-6,'outQuart'],[.34,0,'inOut']],
      body:[[0,0],[.09,6,'outQuart'],[.34,0,'inOut']],
      head:[[0,0],[.09,-5,'outQuart'],[.34,0,'inOut']],
    }},
    dodge: { dur: .52, impact: -1, tracks: {
      rx:[[0,0],[.2,-30,'outQuart'],[.52,0,'inOut']],
      rot:[[0,0],[.2,-5,'outQuart'],[.52,0,'inOut']],
      head:[[0,0],[.2,9,'outQuart'],[.52,0,'inOut']],
      ry:[[0,0],[.2,6,'outQuart'],[.52,0,'inOut']],
    }},
    hurt: { dur: .42, impact: -1, tracks: {
      rot:[[0,0],[.06,-6,'outQuart'],[.42,0,'inOut']],
      head:[[0,0],[.06,11,'outQuart'],[.42,0,'inOut']],
      rx:[[0,0],[.06,-20,'outQuart'],[.42,0,'inOut']],
      lu:[[0,0],[.06,16,'outQuart'],[.42,0,'inOut']],
    }},
    victory: { dur: 2.4, impact: -1, tracks: {
      lu:[[0,0],[.3,-168,'outBack'],[2.4,-160,'linear']],
      gl:[[0,0],[.3,-16,'outBack'],[2.4,-8,'linear']],
      r:[[0,0],[.3,-96,'outBack'],[2.4,-88,'linear']],
      rext:[[0,0],[.3,-20,'outBack'],[2.4,-14,'linear']],
      ry:[[0,0],[.28,-52,'outQuart'],[.62,0,'inOut'],[1.1,-34,'outQuart'],[1.5,0,'inOut'],[2.05,-26,'outQuart'],[2.4,0,'inOut']],
      rot:[[0,0],[.3,-3,'outBack'],[1.2,3,'inOut'],[2.4,0,'inOut']],
      head:[[0,0],[.3,-8,'outBack'],[2.4,-4,'linear']],
    }},
    down: { dur: 1.4, impact: -1, tracks: {
      rot:[[0,0],[1.1,86,'in']],
      ry:[[0,0],[1.1,120,'in']],
      rx:[[0,0],[1.1,-56,'in']],
      lu:[[0,0],[1.1,-38,'inOut']],
      r:[[0,0],[1.1,-14,'inOut']],
      head:[[0,0],[1.1,-16,'inOut']],
      sL:[[0,0],[1.1,14,'inOut']], sR:[[0,0],[1.1,-20,'inOut']],
    }},
    flL: { dur: .15, impact: .05, hand: 'L', tracks: {
      lu:[[0,0],[.05,-88,'outQuart'],[.15,-8,'out']],
      rx:[[0,0],[.05,10,'outQuart'],[.15,0,'out']],
    }},
    flR: { dur: .15, impact: .05, hand: 'R', tracks: {
      r:[[0,0],[.05,-36,'outQuart'],[.15,0,'out']],
      rext:[[0,0],[.05,70,'outQuart'],[.15,0,'out']],
      rx:[[0,0],[.05,14,'outQuart'],[.15,0,'out']],
    }},
  };

  /* ---------- 运行时状态 ---------- */
  const st = {
    act: null, actT: 0,
    beatPhase: 0, fever: 0,
    downed: false, victory: false,
    flashL: 0, flashR: 0, popL: 0, popR: 0,
  };

  function idlePose(t) {
    const bp = st.beatPhase;
    return {
      rx: 7 * Math.sin(t * .9),
      ry: -13 * Math.abs(Math.sin(Math.PI * bp)) * (1 + st.fever * .6),
      rot: 1.4 * Math.sin(t * .6 + 2),
      body: Math.sin(t * .8 + 1),
      head: 2.4 * Math.sin(t * 1.1),
      lu: 2.5 * Math.sin(t * .7),
      gl: 3 * Math.sin(t * .7 + .5),
      luext: 0,
      r: 1.6 * Math.sin(t * .8 + 2),
      rext: 0,
      sL: -8 * Math.max(0, Math.sin(Math.PI * bp)),
      sR: -8 * Math.max(0, Math.sin(Math.PI * (bp + .5))),
    };
  }

  function act(name) {
    if (st.downed && name !== 'down') return;
    const a = ACTS[name];
    if (!a) return;
    if (st.act && ACTS[st.act].dur - st.actT > .08 && name !== 'victory' && name !== 'down') return;
    st.act = name; st.actT = 0;
  }
  function update(dt) {
    st.actT += dt;
    st.flashL = Math.max(0, st.flashL - dt);
    st.flashR = Math.max(0, st.flashR - dt);
    st.popL = Math.max(0, st.popL - dt);
    st.popR = Math.max(0, st.popR - dt);
    if (st.act) {
      const d = ACTS[st.act].dur;
      if (st.actT >= d) {
        if (st.act === 'down') st.downed = true;
        if (st.act === 'victory') st.victory = true;
        st.act = null;
      }
    }
  }

  /* 合成当前姿态：待机程序动画 + 动作叠加 + 镜像取反 */
  function pose(t) {
    const p = idlePose(t);
    if (st.victory) { p.lu=-160; p.gl=-8; p.r=-88; p.rext=-14; p.head=-4; }
    if (st.downed)  { p.rot=86; p.ry=120; p.rx=-56; p.lu=-38; p.r=-14; p.head=-16; p.sL=14; p.sR=-20; }
    if (st.act) {
      const a = ACTS[st.act], tt = Math.min(st.actT, a.dur);
      for (const k in a.tracks) p[k] = trackval(a.tracks[k], tt);
    }
    if (BIAS) for (const k in BIAS) p[k] = (p[k] || 0) + BIAS[k];
    if (FLIP) {
      for (const k of ['rot','body','head','lu','gl','r','sL','sR']) p[k] = -p[k];
      p.rx = -p.rx; p.luext = -p.luext; p.rext = -p.rext;
    }
    return p;
  }

  /* 点变换：源图坐标 → 画布坐标 */
  function xf(px, py, P, place) {
    const s = place.s;
    let x = px - J.root[0], y = py - J.root[1];
    let a = P.rot * D2R, c = Math.cos(a), sn = Math.sin(a);
    let X = x * c - y * sn + P.rx, Y = x * sn + y * c + P.ry;
    a = P.body * D2R; c = Math.cos(a); sn = Math.sin(a);
    x = X * c - Y * sn; y = X * sn + Y * c;
    return [place.x + x * s, place.y + y * s];
  }
  function limbFist(f, shoulder, upperDeg, ext, lowerDeg) {
    let x = f[0] - shoulder[0], y = f[1] - shoulder[1];
    let a = upperDeg * D2R, c = Math.cos(a), sn = Math.sin(a);
    const x1 = x * c - y * sn + ext * c, y1 = x * sn + y * c + ext * sn;
    return [x1, y1];
  }
  function fistPos(P, place, hand) {
    const sgn = FLIP ? -1 : 1;
    const f = hand === 'L' ? J.fistL : J.fistR;
    const sh = hand === 'L' ? J.shoulderL : J.shoulderR;
    let x1, y1, a, c, sn;
    if (hand === 'L') {
      x1 = f[0] - sh[0]; y1 = f[1] - sh[1];
      a = P.lu * D2R; c = Math.cos(a); sn = Math.sin(a);
      const rx1 = x1 * c - y1 * sn + P.luext * c, ry1 = x1 * sn + y1 * c + P.luext * sn;
      const a2 = (P.lu + P.gl) * D2R, c2 = Math.cos(a2), sn2 = Math.sin(a2);
      // 前臂从肘算：肘相对肩的旋转偏移
      const ex = J.elbowL[0] - sh[0], ey = J.elbowL[1] - sh[1];
      const exr = ex * c - ey * sn + P.luext * c, eyr = ex * sn + ey * c + P.luext * sn;
      const fx = f[0] - J.elbowL[0], fy = f[1] - J.elbowL[1];
      x1 = exr + fx * c2 - fy * sn2 + P.luext * c2 - P.luext * c;
      y1 = eyr + fx * sn2 + fy * c2 + P.luext * sn2 - P.luext * sn;
    } else {
      x1 = f[0] - sh[0]; y1 = f[1] - sh[1];
      a = P.r * D2R; c = Math.cos(a); sn = Math.sin(a);
      x1 = x1 * c - y1 * sn + P.rext * c; y1 = x1 * sn + y1 * c + P.rext * sn;
    }
    let aa = P.rot * D2R, cc = Math.cos(aa), ss = Math.sin(aa);
    const sho = [sh[0] - J.root[0], sh[1] - J.root[1]];
    let shx = sho[0] * cc - sho[1] * ss + P.rx * sgn, shy = sho[0] * ss + sho[1] * cc + P.ry;
    aa = P.body * D2R; cc = Math.cos(aa); ss = Math.sin(aa);
    const shx2 = shx * cc - shy * ss, shy2 = shx * ss + shy * cc;
    return [place.x + (shx2 + x1 * sgn) * place.s, place.y + (shy2 + y1) * place.s];
  }
  function impactPoint(name, place) {
    const a = ACTS[name]; if (!a) return null;
    const saved = { act: st.act, actT: st.actT };
    st.act = name; st.actT = a.impact;
    const pt = fistPos(pose(0), place, a.hand);
    st.act = saved.act; st.actT = saved.actT;
    return pt;
  }

  /* ---------- 绘制 ---------- */
  let ctx = null;
  function rotAbout(c2d, jx, jy, deg) {
    if (!deg) return;
    c2d.translate(jx, jy); c2d.rotate(deg * D2R); c2d.translate(-jx, -jy);
  }
  function drawImg(part, shadowOff, alpha) {
    const im = imgs[part.name]; if (!im) return;
    const sh = shadows[part.name];
    ctx.globalAlpha = (alpha ?? 1);
    if (sh && shadowOff) {
      ctx.globalAlpha = 0.26 * (alpha ?? 1);
      ctx.drawImage(sh, 0, 0, part.w, part.h,
        part.x + shadowOff[0], part.y + shadowOff[1], part.w, part.h);
      ctx.globalAlpha = (alpha ?? 1);
    }
    ctx.drawImage(im, part.x, part.y, part.w, part.h);
    ctx.globalAlpha = 1;
  }
  function draw(c2d, t, place) {
    if (!ready || !meta) return;
    ctx = c2d;
    const P = pose(t);
    const S = place.s;
    const parts = {}; meta.pieces.forEach(p => parts[p.name] = p);
    ctx.save();
    ctx.translate(place.x, place.y);
    ctx.scale(S, S);
    ctx.translate(P.rx, P.ry);
    ctx.rotate(P.rot * D2R);
    ctx.translate(-J.root[0], -J.root[1]);
    const SH = place.shadow === false ? null : [FLIP ? -7 : 7, 13];

    ctx.save(); rotAbout(ctx, J.ankleL[0], J.ankleL[1], P.sL);
    drawImg(parts.shoeL, SH, .96); ctx.restore();
    ctx.save(); rotAbout(ctx, J.ankleR[0], J.ankleR[1], P.sR);
    drawImg(parts.shoeR, SH, .96); ctx.restore();

    ctx.save();
    rotAbout(ctx, J.root[0], J.root[1], P.body);
    drawImg(parts.body, SH);
    ctx.restore();

    ctx.save();
    rotAbout(ctx, J.shoulderL[0], J.shoulderL[1], P.lu);
    ctx.translate(P.luext, 0);
    drawImg(parts.armLu, SH);
    ctx.save();
    rotAbout(ctx, J.elbowL[0], J.elbowL[1], P.gl);
    const popL = st.popL > 0 ? 1 + .14 * Math.sin(Math.PI * (1 - st.popL / .16)) : 1;
    if (popL !== 1) {
      ctx.translate(J.fistL[0], J.fistL[1]); ctx.scale(popL, popL); ctx.translate(-J.fistL[0], -J.fistL[1]);
    }
    if (st.flashL > 0 && ctx.filter !== undefined) ctx.filter = 'brightness(1.9) saturate(.55)';
    drawImg(parts.gloveL, SH);
    ctx.filter = 'none';
    ctx.restore();
    ctx.restore();

    ctx.save();
    rotAbout(ctx, J.shoulderR[0], J.shoulderR[1], P.r);
    ctx.translate(P.rext, 0);
    const popR = st.popR > 0 ? 1 + .14 * Math.sin(Math.PI * (1 - st.popR / .16)) : 1;
    if (popR !== 1) {
      ctx.translate(J.fistR[0], J.fistR[1]); ctx.scale(popR, popR); ctx.translate(-J.fistR[0], -J.fistR[1]);
    }
    if (st.flashR > 0 && ctx.filter !== undefined) ctx.filter = 'brightness(1.9) saturate(.55)';
    drawImg(parts.armR, SH);
    ctx.filter = 'none';
    ctx.restore();

    ctx.save();
    rotAbout(ctx, J.neck[0], J.neck[1], P.head);
    drawImg(parts.head, SH);
    ctx.restore();

    ctx.restore();
  }

  function load(cb) {
    onloadCb = cb;
    fetch(BASE + 'pieces.json').then(r => r.json()).then(m => {
      meta = m;
      meta.pieces.push({ name: 'body', x: 0, y: 0, w: meta.src.w, h: meta.src.h });
      if (FLIP) for (const k in J) J[k] = meta.joints[k] || J[k];
      let n = 0;
      const done = () => { if (++n === meta.pieces.length) buildShadows(); };
      meta.pieces.forEach(p => {
        const im = new Image();
        im.onload = done; im.src = BASE + p.name + '.png';
        imgs[p.name] = im;
      });
    });
  }
  function buildShadows() {
    let n = 0;
    meta.pieces.forEach(p => {
      const off = document.createElement('canvas');
      off.width = p.w + 20; off.height = p.h + 20;
      const oc = off.getContext('2d');
      oc.drawImage(imgs[p.name], 0, 0);
      oc.globalCompositeOperation = 'source-in';
      oc.fillStyle = 'rgba(16,42,48,1)';
      oc.fillRect(0, 0, off.width, off.height);
      shadows[p.name] = off;
      if (++n === meta.pieces.length) { ready = true; onloadCb && onloadCb(); }
    });
  }

  return {
    load, ready: () => ready, update, act, pose, draw,
    fistPos, impactPoint,
    flash: h => { if (h === 'L') { st.flashL = .1; st.popL = .16; } else { st.flashR = .1; st.popR = .16; } },
    setBeat: (bp, fever) => { st.beatPhase = bp; st.fever = fever; },
    reset: () => { st.act = null; st.downed = false; st.victory = false; st.flashL = st.flashR = st.popL = st.popR = 0; },
    J,
  };
}
const Rig = createRig({ base: 'assets/parts/' });
