/**
 * Capybara runner — physics/spawn/collision aligned with legacy original.html;
 * drawing simplified (shapes). Neuro modulates world speed; events recorded for reports.
 */

import { gameAudio } from './gameAudio';

export type GameEventType = 'jump' | 'hit' | 'snack' | 'yuzu' | 'death';

/** Slim neuro snapshot for gameplay + reporting (avoid importing neuroManager here). */
export interface NeuroGameInput {
  calm: number;
  arousal: number;
  bpm: number | null;
  baselineBpm: number | null;
  baselineDelta: number | null;
  hrvRmssd: number | null;
  alphaPower: number | null;
  betaPower: number | null;
  thetaPower: number | null;
  gammaPower: number | null;
  signalQuality: number;
  bpmQuality: number;
  source: 'eeg' | 'rppg' | 'mock' | 'none';
  calmnessState: string | null;
  alphaBump: boolean;
}

export interface GameEvent {
  tSec: number;
  type: GameEventType;
  meta?: Record<string, unknown>;
  /** Monotonic id for stable React keys in reports (omitted in older stored runs) */
  seq?: number;
}

export interface SpeedSample {
  tSec: number;
  speed: number;
  neuroScale: number;
}

export interface GameOverPayload {
  dist: number;
  snacks: number;
  best: number;
  maxCombo: number;
  durationSec: number;
  events: GameEvent[];
  speedSamples: SpeedSample[];
  spicy: boolean;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number) {
  return () => {
    let a = seed >>> 0;
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function now(): number {
  return performance.now();
}

const STORE_KEY = 'copypara_best';

function loadBest(): number {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v ? JSON.parse(v) : 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(n));
  } catch {
    /* ignore */
  }
}

type Obstacle = { type: 'log' | 'rock'; x: number; y: number; w: number; h: number; wob: number };
type Item = { type: 'leaf' | 'yuzu'; x: number; y: number; r: number; spin: number; bob: number };

const WARMUP_SEC = 32;

const cfgBase = {
  gravity: 2200,
  jumpV: 860,
  holdBoost: 1700,
  speed0: 275,
  speedMax: 655,
  accel: 5.2,
  spawnMin: 0.95,
  spawnMax: 1.38,
  snackChance: 0.75,
  yuzuChance: 0.12,
  lives: 3,
  playerPad: 6,
};

const cfgSpicy = {
  gravity: 2350,
  jumpV: 880,
  holdBoost: 1850,
  speed0: 315,
  speedMax: 760,
  accel: 7.0,
  spawnMin: 0.74,
  spawnMax: 1.14,
  snackChance: 0.75,
  yuzuChance: 0.14,
  lives: 3,
  playerPad: 6,
};

const NEURO_SIG_OK = 0.28;
const NEURO_BPM_OK = 0.32;

export interface RunnerOptions {
  canvas: HTMLCanvasElement;
  soundEnabled: boolean;
  spicy: boolean;
  neuroInfluence: number;
  reducedMotion: boolean;
  /** Session time in seconds (must match SessionRecorder sample `t` after restarts). */
  getSessionT: () => number;
  getNeuro: () => NeuroGameInput;
  onGameOver: (payload: GameOverPayload) => void;
  onHud?: () => void;
  /** Called once per simulation step while running (for session recording). */
  onFrame?: (dt: number) => void;
}

export function createRunner(opts: RunnerOptions) {
  const ctx0 = opts.canvas.getContext('2d', { alpha: false });
  if (!ctx0) throw new Error('2d context');
  const ctx: CanvasRenderingContext2D = ctx0;

  const sessionT = () => opts.getSessionT();

  let spicy = opts.spicy;
  let soundOn = opts.soundEnabled;
  gameAudio.setEnabled(soundOn);
  let neuroInfl = opts.neuroInfluence;
  const reducedMotion = opts.reducedMotion;

  const rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

  let W = 800;
  let H = 450;
  let dpr = 1;

  let state: 'running' | 'paused' | 'gameover' = 'running';
  let tLast = now();
  let tGame = 0;

  let worldSpeed = cfgBase.speed0;
  let distPx = 0;
  let best = loadBest();
  let snacks = 0;
  let lives = cfgBase.lives;
  let invuln = 0;
  let wantJump = false;
  let pressActive = false;
  let pressStartedAt = 0;
  const maxHold = 0.22;

  const player = {
    x: 0,
    y: 0,
    vy: 0,
    onGround: true,
    runT: 0,
    zen: 0,
    combo: 0,
    comboT: 0,
  };

  const obstacles: Obstacle[] = [];
  const items: Item[] = [];

  const events: GameEvent[] = [];
  const speedSamples: SpeedSample[] = [];
  let speedSampleAcc = 0;
  let maxCombo = 0;
  let eventSeq = 0;

  let nextObstacleIn = 0.9;
  let nextSnackIn = 0.9;

  let raf = 0;

  function cfg() {
    return spicy ? cfgSpicy : cfgBase;
  }

  function groundY() {
    return Math.floor(H * 0.78);
  }

  function logEvent(type: GameEventType, meta?: Record<string, unknown>) {
    eventSeq += 1;
    events.push({ tSec: sessionT(), type, meta, seq: eventSeq });
  }

  function neuroUsable(n: NeuroGameInput): boolean {
    return n.source !== 'none' && n.signalQuality >= NEURO_SIG_OK;
  }

  function neuroSpeedScale(n: NeuroGameInput): number {
    const inf = neuroInfl * (reducedMotion ? 0.35 : 1);
    const { calm, arousal } = n;
    let raw = 1 + inf * (0.22 * arousal - 0.1 * calm);
    if (neuroUsable(n) && n.bpm != null && n.baselineDelta != null && n.bpmQuality >= NEURO_BPM_OK) {
      raw += inf * 0.045 * clamp(n.baselineDelta / 18, -1, 1);
    }
    if (neuroUsable(n) && n.alphaBump) {
      raw -= inf * 0.04;
    }
    return clamp(raw, 0.82, 1.22);
  }

  function obstacleSpacingBias(n: NeuroGameInput): number {
    const inf = neuroInfl * (reducedMotion ? 0.35 : 1);
    const { calm } = n;
    let bias = 1 - inf * 0.12 * calm;
    if (neuroUsable(n) && n.hrvRmssd != null && n.hrvRmssd > 0) {
      const h = clamp((n.hrvRmssd - 18) / 72, 0, 1);
      bias *= 1 + inf * 0.07 * h;
    }
    if (neuroUsable(n) && n.alphaPower != null && n.betaPower != null && n.alphaPower + n.betaPower > 1e-6) {
      const ratio = n.alphaPower / (n.betaPower + 1e-6);
      const zen = clamp((ratio - 0.8) / 2.2, -0.35, 0.35);
      bias *= 1 + inf * 0.05 * zen;
    }
    return bias;
  }

  /** 0 = early warmup, 1 = full difficulty curve. */
  function warmupEase(tGameSec: number): number {
    const u = clamp(tGameSec / WARMUP_SEC, 0, 1);
    return u * u;
  }

  function setCanvasSize() {
    const rect = opts.canvas.getBoundingClientRect();
    W = Math.max(320, Math.floor(rect.width));
    H = Math.max(320, Math.floor(rect.height));
    dpr = Math.max(1, Math.min(2.5, window.devicePixelRatio || 1));
    opts.canvas.width = Math.floor(W * dpr);
    opts.canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    player.x = Math.floor(W * 0.18);
    player.y = groundY();
  }

  function scheduleNextObstacle(minAdd: number) {
    const c = cfg();
    const u = c.spawnMin + (c.spawnMax - c.spawnMin) * rng();
    nextObstacleIn = (minAdd || 0) + u;
  }

  function scheduleNextSnack(minAdd: number) {
    nextSnackIn = (minAdd || 0) + 0.65 + rng() * 0.95;
  }

  function spawnObstacle() {
    const gY = groundY();
    const type = rng() < 0.82 ? 'log' : 'rock';
    const size = lerp(0.85, 1.12, rng());
    let w = 76 * size;
    let h = 34 * size;
    if (type === 'rock') {
      w = 54 * size;
      h = 42 * size;
    }
    obstacles.push({ type, x: W + 40, y: gY - h, w, h, wob: rng() * Math.PI * 2 });
  }

  function spawnSnack() {
    const c = cfg();
    if (rng() > c.snackChance) return;
    const gY = groundY();
    const isYuzu = rng() < c.yuzuChance;
    items.push({
      type: isYuzu ? 'yuzu' : 'leaf',
      x: W + 40,
      y: gY - (70 + rng() * 80),
      r: isYuzu ? 15 : 14,
      spin: rng() * Math.PI * 2,
      bob: rng() * Math.PI * 2,
    });
  }

  function resetRun() {
    const c = cfg();
    state = 'running';
    tGame = 0;
    worldSpeed = c.speed0;
    distPx = 0;
    snacks = 0;
    lives = c.lives;
    invuln = 0;
    player.y = groundY();
    player.vy = 0;
    player.onGround = true;
    player.runT = 0;
    player.zen = 0;
    player.combo = 0;
    player.comboT = 0;
    obstacles.length = 0;
    items.length = 0;
    events.length = 0;
    speedSamples.length = 0;
    speedSampleAcc = 0;
    maxCombo = 0;
    eventSeq = 0;
    scheduleNextObstacle(0.55);
    scheduleNextSnack(0.9);
    nextObstacleIn = 0.55;
    nextSnackIn = 0.9;
  }

  function playerBox() {
    const pad = cfg().playerPad;
    const w = 70;
    const h = 44;
    const x = player.x - w * 0.45 + pad;
    const y = player.y - h + pad;
    return { x, y, w: w - pad * 2, h: h - pad * 2 };
  }

  function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function endRun() {
    state = 'gameover';
    const dist = Math.floor(distPx / 12);
    if (dist > best) {
      best = dist;
      saveBest(best);
    }
    logEvent('death', { dist, snacks, lives: 0, maxCombo });
    opts.onGameOver({
      dist,
      snacks,
      best,
      maxCombo,
      durationSec: tGame,
      events: [...events],
      speedSamples: [...speedSamples],
      spicy,
    });
  }

  function step(dt: number) {
    if (state !== 'running') return;
    const c = cfg();
    const neuro = opts.getNeuro();
    const nScale = neuroSpeedScale(neuro);
    const spawnBias = obstacleSpacingBias(neuro);

    tGame += dt;
    const warm = warmupEase(tGame);
    const speedCap = lerp(c.speed0 * 0.88, c.speedMax, warm);
    const accelScale = lerp(0.62, 1, warm);
    const obstacleDecayScale = lerp(0.78, 1, warm);

    const zenFactor = player.zen > 0 ? 0.7 : 1;
    worldSpeed = Math.min(speedCap, worldSpeed + c.accel * accelScale * dt * 60);
    const effSpeed = worldSpeed * zenFactor * nScale;
    distPx += effSpeed * dt;

    speedSampleAcc += dt;
    if (speedSampleAcc >= 0.45) {
      speedSampleAcc = 0;
      speedSamples.push({ tSec: sessionT(), speed: effSpeed, neuroScale: nScale });
    }

    if (player.comboT > 0) {
      player.comboT -= dt;
      if (player.comboT <= 0) player.combo = 0;
    }
    if (invuln > 0) invuln -= dt;

    nextObstacleIn -= dt * (0.75 + (effSpeed / Math.max(c.speedMax, 1)) * 0.65) * spawnBias * obstacleDecayScale;
    if (nextObstacleIn <= 0) {
      spawnObstacle();
      scheduleNextObstacle(0);
    }

    nextSnackIn -= dt * (0.9 + (effSpeed / c.speedMax) * 0.35);
    if (nextSnackIn <= 0) {
      spawnSnack();
      scheduleNextSnack(0);
    }

    player.runT += dt * (0.9 + effSpeed / 520);
    player.vy += c.gravity * dt;
    player.y += player.vy * dt;

    const gY = groundY();
    if (player.y >= gY) {
      player.y = gY;
      player.vy = 0;
      player.onGround = true;
    } else {
      player.onGround = false;
    }

    if (wantJump) {
      wantJump = false;
      if (player.onGround) {
        player.vy = -c.jumpV;
        player.onGround = false;
        logEvent('jump', { effSpeed, nScale, combo: player.combo });
        if (soundOn) gameAudio.jump();
      }
    }

    const tSec = tGame;
    let hold = false;
    if (!player.onGround && player.vy < 0) {
      hold = pressActive && tSec - pressStartedAt <= maxHold;
    }
    if (hold) player.vy -= c.holdBoost * dt;

    if (player.zen > 0) player.zen -= dt;

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= effSpeed * dt;
      o.wob += dt * 3;
      if (o.x + o.w < -60) obstacles.splice(i, 1);
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.x -= effSpeed * dt;
      it.spin += dt * 3.4;
      it.bob += dt * 2;
      if (it.x + 40 < -60) items.splice(i, 1);
    }

    const pb = playerBox();
    if (invuln <= 0) {
      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (aabb(pb.x, pb.y, pb.w, pb.h, o.x + 10, o.y + 8, o.w - 20, o.h - 12)) {
          lives -= 1;
          invuln = 1.1;
          logEvent('hit', { livesRemaining: lives, effSpeed, nScale, combo: player.combo });
          if (soundOn) gameAudio.hit();
          if (lives <= 0) endRun();
          break;
        }
      }
    }

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      const iy = it.y + Math.sin(it.bob) * 6;
      const cx = clamp(it.x, pb.x, pb.x + pb.w);
      const cy = clamp(iy, pb.y, pb.y + pb.h);
      const dx = it.x - cx;
      const dy = iy - cy;
      if (dx * dx + dy * dy <= it.r * it.r) {
        items.splice(i, 1);
        if (it.type === 'leaf') {
          snacks += 1;
          player.combo += 1;
          player.comboT = 2;
          maxCombo = Math.max(maxCombo, player.combo);
          logEvent('snack', { combo: player.combo, effSpeed, nScale });
          if (soundOn) gameAudio.snack();
        } else {
          snacks += 3;
          player.zen = 2.4;
          invuln = Math.max(invuln, 0.7);
          logEvent('yuzu', { snacks, effSpeed, nScale, combo: player.combo });
          if (soundOn) gameAudio.yuzu();
        }
      }
    }

    opts.onFrame?.(dt);
  }

  function drawBackground() {
    const d = distPx / 1200;
    const warm = Math.sin(d * 0.22) * 8;
    const sky = ctx.createLinearGradient(0, 0, W * 0.3, H);
    sky.addColorStop(0, `hsl(${(168 + warm) | 0}, 42%, 11%)`);
    sky.addColorStop(0.45, `hsl(${(152 + warm) | 0}, 38%, 8%)`);
    sky.addColorStop(1, `hsl(${(200 + warm * 0.5) | 0}, 35%, 6%)`);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(20, 90, 70, 0.28)';
    ctx.fillRect(0, H * 0.32, W, H * 0.48);
    const glow = ctx.createRadialGradient(W * 0.75, H * 0.12, 0, W * 0.75, H * 0.12, W * 0.5);
    glow.addColorStop(0, 'rgba(251, 146, 60, 0.12)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function drawGround() {
    const gY = groundY();
    ctx.fillStyle = 'rgba(10,28,30,0.95)';
    ctx.fillRect(0, gY, W, H - gY);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, gY);
    ctx.lineTo(W, gY);
    ctx.stroke();
    const scroll = -(distPx * 0.95) % 40;
    ctx.strokeStyle = 'rgba(50,140,90,0.25)';
    for (let x = scroll - 40; x < W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, gY + 8);
      ctx.lineTo(x + 12, gY + 2);
      ctx.stroke();
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.type === 'log') {
        ctx.fillStyle = 'rgba(140,95,55,0.95)';
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        const y = o.y - 4;
        const h = o.h + 10;
        const r = 10;
        const x = o.x;
        const w = o.w;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(120,135,140,0.92)';
        ctx.beginPath();
        ctx.moveTo(o.x + o.w * 0.1, o.y + o.h * 0.76);
        ctx.quadraticCurveTo(o.x + o.w * 0.18, o.y + o.h * 0.1, o.x + o.w * 0.55, o.y + o.h * 0.14);
        ctx.quadraticCurveTo(o.x + o.w * 0.98, o.y + o.h * 0.28, o.x + o.w * 0.84, o.y + o.h * 0.86);
        ctx.quadraticCurveTo(o.x + o.w * 0.56, o.y + o.h * 1.05, o.x + o.w * 0.1, o.y + o.h * 0.76);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawItems() {
    for (const it of items) {
      const y = it.y + Math.sin(it.bob) * 6;
      ctx.save();
      ctx.translate(it.x, y);
      ctx.rotate(it.spin * 0.7);
      if (it.type === 'leaf') {
        ctx.fillStyle = 'rgba(80,200,120,0.9)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 10, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,200,80,0.95)';
        ctx.beginPath();
        ctx.arc(0, 0, it.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawPlayer() {
    const bob = player.onGround ? Math.sin(player.runT * 10) * 2.2 : -6;
    ctx.save();
    ctx.translate(player.x, player.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 10, player.onGround ? 31 : 25, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,110,75,0.98)';
    ctx.strokeStyle = 'rgba(0,0,0,0.26)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -28, 48, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(42, -44, 22, 18, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.arc(40, -46, 2.5, 0, Math.PI * 2);
    ctx.arc(52, -46, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (player.zen > 0 && !reducedMotion) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      const grd = ctx.createRadialGradient(player.x, player.y - 36, 10, player.x, player.y - 36, 80);
      grd.addColorStop(0, 'rgba(255,212,121,0.5)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(player.x, player.y - 36, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function render() {
    drawBackground();
    drawItems();
    drawObstacles();
    drawGround();
    drawPlayer();
  }

  function tick() {
    const t = now();
    const dt = Math.min(0.033, Math.max(0, (t - tLast) / 1000));
    tLast = t;
    if (state === 'running') step(dt);
    render();
    opts.onHud?.();
    raf = requestAnimationFrame(tick);
  }

  setCanvasSize();
  resetRun();

  return {
    destroy() {
      cancelAnimationFrame(raf);
    },
    startLoop() {
      tLast = now();
      raf = requestAnimationFrame(tick);
    },
    resize() {
      setCanvasSize();
    },
    setPaused(p: boolean) {
      state = p ? 'paused' : 'running';
    },
    getPaused: () => state === 'paused',
    restart() {
      resetRun();
      state = 'running';
      tLast = now();
      if (soundOn) gameAudio.start();
    },
    requestJump() {
      if (state === 'gameover') {
        resetRun();
        state = 'running';
        if (soundOn) gameAudio.start();
        return;
      }
      if (state === 'paused') {
        state = 'running';
        return;
      }
      wantJump = true;
    },
    tapPress(tSec: number) {
      pressActive = true;
      pressStartedAt = tSec;
    },
    tapRelease() {
      pressActive = false;
    },
    setSpicy(v: boolean) {
      spicy = v;
    },
    setSoundEnabled(v: boolean) {
      soundOn = v;
      gameAudio.setEnabled(v);
    },
    setNeuroInfluence(v: number) {
      neuroInfl = clamp(v, 0, 1);
    },
    getSnapshot() {
      return {
        state,
        dist: Math.floor(distPx / 12),
        distPx,
        snacks,
        lives,
        best,
        combo: player.combo,
        tGame,
        soundOn,
        spicy,
      };
    },
    getSoundEnabled: () => soundOn,
  };
}

export type RunnerHandle = ReturnType<typeof createRunner>;
