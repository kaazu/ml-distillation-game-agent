// ===== ゲーム本体（決定的シミュレーション） =====
const TILE = 16, VIEW_H = 240, GROUND = 2;
const ACTIONS = ['right_run', 'right_run_jump'];
const DECIDE = 4; // 何フレームごとに判断するか

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// コース：列ごとの地面の高さ(タイル数, 0=穴) + 敵の初期位置
function makeCourse(seed) {
  const r = rng(seed * 7919 + 13);
  const h = [], enemies = [];
  for (let i = 0; i < 14; i++) h.push(GROUND);
  while (h.length < 190) {
    const k = r();
    if (k < 0.22) { // 穴
      const w = 2 + Math.floor(r() * 2);
      for (let i = 0; i < w; i++) h.push(0);
      for (let i = 0; i < 3; i++) h.push(GROUND);
    } else if (k < 0.45) { // 土管
      const ph = GROUND + 1 + Math.floor(r() * 3);
      h.push(ph, ph);
      for (let i = 0; i < 3; i++) h.push(GROUND);
    } else if (k < 0.72) { // 敵
      const n = 1 + Math.floor(r() * 2);
      const w = 5 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) enemies.push((h.length + 2 + i * 2) * TILE);
      for (let i = 0; i < w; i++) h.push(GROUND);
    } else if (k < 0.82) { // 段差
      const ph = GROUND + 1 + Math.floor(r() * 2);
      const w = 3 + Math.floor(r() * 3);
      for (let i = 0; i < w; i++) h.push(ph);
      for (let i = 0; i < 2; i++) h.push(GROUND);
    } else {
      for (let i = 0; i < 3; i++) h.push(GROUND);
    }
  }
  for (let s = 1; s <= 4; s++) h.push(GROUND + s, GROUND + s); // 階段
  for (let i = 0; i < 16; i++) h.push(GROUND);
  const goalX = (h.length - 8) * TILE;
  return { h, enemies, goalX, seed };
}

function groundTop(c, col) {
  if (col < 0) return VIEW_H - GROUND * TILE - 999;
  const v = col < c.h.length ? c.h[col] : GROUND;
  return v === 0 ? 1e9 : VIEW_H - v * TILE;
}

function newState(course, wait) {
  const s = {
    t: 0, dead: false, clear: false,
    p: { x: 40, y: VIEW_H - GROUND * TILE - 16, w: 12, h: 16, vx: 0, vy: 0, ground: true, jumpHeld: false, canJump: true },
    e: course.enemies.map(x => ({ x, y: VIEW_H - GROUND * TILE - 14, w: 14, h: 14, vx: -0.5, vy: 0, alive: true })),
  };
  for (let i = 0; i < wait; i++) stepEnemies(course, s); // 開始待機（敵だけ動く）
  s.t = 0;
  return s;
}

function clone(s) {
  return { t: s.t, dead: s.dead, clear: s.clear, p: { ...s.p }, e: s.e.map(e => ({ ...e })) };
}

function blockedAt(c, x, w, bottom) {
  const col = Math.floor((x + w - 0.01) / TILE);
  return groundTop(c, col) < bottom - 0.5;
}

function moveBody(c, b) {
  // 横
  const nx = b.x + b.vx;
  if (b.vx > 0 && blockedAt(c, nx, b.w, b.y + b.h)) {
    b.x = Math.floor((nx + b.w) / TILE) * TILE - b.w; b.hitWall = true;
  } else if (b.vx < 0 && groundTop(c, Math.floor(nx / TILE)) < b.y + b.h - 0.5) {
    b.hitWall = true;
  } else { b.x = nx; b.hitWall = false; }
  // 縦
  const prevBottom = b.y + b.h;
  b.y += b.vy;
  const c0 = Math.floor(b.x / TILE), c1 = Math.floor((b.x + b.w - 0.01) / TILE);
  let top = 1e9;
  for (let k = c0; k <= c1; k++) top = Math.min(top, groundTop(c, k));
  if (b.vy >= 0 && b.y + b.h >= top && prevBottom <= top + 6) {
    b.y = top - b.h; b.vy = 0; b.ground = true;
  } else b.ground = false;
}

function stepEnemies(c, s) {
  for (const e of s.e) {
    if (!e.alive) continue;
    e.vy = Math.min(e.vy + 0.5, 6);
    moveBody(c, e);
    if (e.hitWall) e.vx = -e.vx;
    if (e.y > VIEW_H + 20) e.alive = false;
  }
}

// action: 0=右へ走る, 1=右へ走りながらジャンプ(ボタン保持)
function step(c, s, action) {
  if (s.dead || s.clear) return;
  const p = s.p, jump = action === 1;
  p.vx = Math.min(p.vx + 0.12, 2.4);
  if (jump && p.ground && p.canJump) { p.vy = -7; p.ground = false; p.canJump = false; }
  if (!jump) p.canJump = true;
  const g = 0.45; // 固定高さジャンプ
  p.vy = Math.min(p.vy + g, 7);
  moveBody(c, p);
  stepEnemies(c, s);
  for (const e of s.e) {
    if (!e.alive) continue;
    if (p.x < e.x + e.w && p.x + p.w > e.x && p.y < e.y + e.h && p.y + p.h > e.y) {
      if (p.vy > 0 && p.y + p.h - e.y < 12) { e.alive = false; p.vy = -4; }
      else { s.dead = true; s.cause = 'enemy'; }
    }
  }
  if (p.y > VIEW_H + 10) { s.dead = true; s.cause = 'pit'; }
  if (p.x >= c.goalX) s.clear = true;
  s.t++;
  if (s.t > 60 * 90) { s.dead = true; s.cause = 'timeout'; }
}

// ===== ハーネス：状態 → 特徴量ベクトル =====
const LOOK = 10;
const FEATURE_NAMES = ['vy', 'vx', 'on_ground', 'can_jump', 'x_in_tile']
  .concat(Array.from({ length: LOOK }, (_, i) => `terrain_${i}`))
  .concat(['e1_dx', 'e1_dy', 'e1_vx', 'e2_dx', 'e2_dy', 'e2_vx']);

function features(c, s) {
  const p = s.p, bottom = p.y + p.h;
  const col = Math.floor((p.x + p.w) / TILE);
  const f = [p.vy, p.vx, p.ground ? 1 : 0, p.canJump ? 1 : 0, (p.x + p.w) % TILE];
  for (let i = 0; i < LOOK; i++) {
    const gt = groundTop(c, col + i);
    f.push(gt > 1e8 ? -9 : Math.max(-8, Math.min(8, (bottom - gt) / TILE))); // 足元より何タイル高いか（穴=-9）
  }
  const ahead = s.e.filter(e => e.alive && e.x + e.w > p.x - 8 && e.x < p.x + 200)
    .sort((a, b) => a.x - b.x).slice(0, 2);
  for (let i = 0; i < 2; i++) {
    const e = ahead[i];
    if (e) f.push(e.x - p.x, e.y - p.y, e.vx); else f.push(999, 0, 0);
  }
  return f;
}

// ===== 教師：重い先読みプランナー（LLMの代役） =====
let SEG = 8, DEPTH = +(typeof process!=="undefined"&&process.env.DEPTH||8);
function rollout(c, s0, seq) {
  const s = clone(s0);
  for (let d = 0; d < seq.length; d++) {
    const n = d === 0 ? DECIDE : SEG;
    for (let k = 0; k < n; k++) {
      step(c, s, seq[d]);
      if (s.dead) return -1e6 + s.t;
      if (s.clear) return 1e6 - s.t;
    }
  }
  // 着地していない状態で終わる手は少し減点（空中で視野切れ）
  return s.p.x + (s.p.ground ? 0 : -2);
}
function teacher(c, s, mode = TEACHER_MODE) {
  // 各「最初の手」について、続きの手順 2^(DEPTH-1) 通りを全部試す
  const best = [-Infinity, -Infinity], alive = [0, 0];
  const n = 1 << DEPTH;
  for (let m = 0; m < n; m++) {
    const seq = [];
    for (let d = 0; d < DEPTH; d++) seq.push((m >> d) & 1);
    const v = rollout(c, s, seq);
    if (v > best[seq[0]]) best[seq[0]] = v;
    if (v > -5e5) alive[seq[0]]++;
  }
  const ok0 = best[0] > -5e5, ok1 = best[1] > -5e5;
  if (ok0 !== ok1) return ok1 ? 1 : 0;
  if (!ok0) return best[1] > best[0] ? 1 : 0;
  if (s.p.hitWall && best[1] > best[0] + 1) return 1; // 壁で進めない
  if (mode === 'margin') return alive[1] > alive[0] * RATIO ? 1 : 0; // 余裕度で比較
  return best[1] > best[0] + 1 ? 1 : 0; // 同点なら「走るだけ」
}
let TEACHER_MODE = 'best', RATIO = 1.3;
function setTeacher(m, r, d) { TEACHER_MODE = m; if (r) RATIO = r; if (d) DEPTH = d; }

// ===== GBDT（LightGBM風：ヒストグラム + 葉優先成長） =====
function trainGBDT(X, y, opt = {}) {
  const o = Object.assign({ trees: 120, lr: 0.1, leaves: 15, minChild: 5, lambda: 1, bins: 32, weight: null }, opt);
  const n = X.length, F = X[0].length;
  const w = o.weight || new Array(n).fill(1);
  // 分位点で閾値を作る
  const edges = [];
  for (let f = 0; f < F; f++) {
    const vals = [...new Set(X.map(r => r[f]))].sort((a, b) => a - b);
    let th;
    if (vals.length <= o.bins) th = vals.slice(0, -1).map((v, i) => (v + vals[i + 1]) / 2);
    else { th = []; for (let b = 1; b < o.bins; b++) { const i = Math.floor(b * vals.length / o.bins); th.push((vals[i - 1] + vals[i]) / 2); } th = [...new Set(th)]; }
    edges.push(th);
  }
  const bin = X.map(r => r.map((v, f) => { const t = edges[f]; let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (v > t[m]) lo = m + 1; else hi = m; } return lo; }));
  const pos = y.reduce((a, v, i) => a + v * w[i], 0), tot = w.reduce((a, v) => a + v, 0);
  const base = Math.log((pos + 1) / (tot - pos + 1));
  const F_ = new Float64Array(n).fill(base);
  const trees = [], gain = new Array(F).fill(0);
  const score = (G, H) => G * G / (H + o.lambda);
  for (let t = 0; t < o.trees; t++) {
    const g = new Float64Array(n), h = new Float64Array(n);
    for (let i = 0; i < n; i++) { const p = 1 / (1 + Math.exp(-F_[i])); g[i] = (p - y[i]) * w[i]; h[i] = Math.max(p * (1 - p), 1e-6) * w[i]; }
    const nodes = [{ idx: [...Array(n).keys()] }];
    const findSplit = node => {
      let G = 0, H = 0; for (const i of node.idx) { G += g[i]; H += h[i]; }
      node.G = G; node.H = H; node.best = null;
      if (node.idx.length < 2 * o.minChild) return;
      for (let f = 0; f < F; f++) {
        const nb = edges[f].length + 1; if (nb < 2) continue;
        const hg = new Float64Array(nb), hh = new Float64Array(nb), hc = new Int32Array(nb);
        for (const i of node.idx) { const b = bin[i][f]; hg[b] += g[i]; hh[b] += h[i]; hc[b]++; }
        let gl = 0, hl = 0, cl = 0;
        for (let b = 0; b < nb - 1; b++) {
          gl += hg[b]; hl += hh[b]; cl += hc[b];
          if (cl < o.minChild || node.idx.length - cl < o.minChild) continue;
          const gn = score(gl, hl) + score(G - gl, H - hl) - score(G, H);
          if (gn > 1e-9 && (!node.best || gn > node.best.gain)) node.best = { f, b, gain: gn, th: edges[f][b] };
        }
      }
    };
    findSplit(nodes[0]);
    let leaves = [nodes[0]];
    while (leaves.length < o.leaves) {
      let bi = -1; leaves.forEach((l, i) => { if (l.best && (bi < 0 || l.best.gain > leaves[bi].best.gain)) bi = i; });
      if (bi < 0) break;
      const nd = leaves[bi], { f, b } = nd.best;
      gain[f] += nd.best.gain;
      const L = { idx: nd.idx.filter(i => bin[i][f] <= b) }, R = { idx: nd.idx.filter(i => bin[i][f] > b) };
      nd.f = f; nd.th = nd.best.th; nd.l = nodes.push(L) - 1; nd.r = nodes.push(R) - 1;
      findSplit(L); findSplit(R);
      leaves.splice(bi, 1, L, R);
    }
    for (const l of leaves) { l.v = -o.lr * l.G / (l.H + o.lambda); for (const i of l.idx) F_[i] += l.v; }
    // 推論用に平坦な配列へ： [feature, threshold, left, right] / 葉は feature=-1, value
    const flat = nodes.map(nd => nd.f !== undefined ? [nd.f, nd.th, nd.l, nd.r] : [-1, nd.v || 0, 0, 0]);
    trees.push(flat);
    if (o.onTree) o.onTree(t);
  }
  return { base, trees, gain, names: FEATURE_NAMES };
}
function predictProb(m, x) {
  let s = m.base;
  for (const t of m.trees) { let k = 0; while (t[k][0] >= 0) k = x[t[k][0]] <= t[k][1] ? t[k][2] : t[k][3]; s += t[k][1]; }
  return 1 / (1 + Math.exp(-s));
}

// ===== 1エピソード実行 =====
// policy(state) -> action。latencyフレーム後に反映（リアルタイム方式）
function runEpisode(c, wait, policy, { latency = 0, record = null, maxFrames = 60 * 90 } = {}) {
  const s = newState(c, wait);
  let action = 0; const pending = [];
  while (!s.dead && !s.clear && s.t < maxFrames) {
    if (s.t % DECIDE === 0) {
      const a = policy(s);
      if (record) record.push({ x: features(c, s), y: a, px: s.p.x });
      pending.push({ at: s.t + latency, a });
    }
    while (pending.length && pending[0].at <= s.t) action = pending.shift().a;
    step(c, s, action);
  }
  return { clear: s.clear, x: s.p.x, cause: s.cause || (s.clear ? null : 'stuck'), frames: s.t };
}

if (typeof module !== 'undefined') module.exports = { setTeacher, TILE, VIEW_H, ACTIONS, DECIDE, FEATURE_NAMES, makeCourse, newState, clone, step, features, teacher, trainGBDT, predictProb, runEpisode, groundTop };
