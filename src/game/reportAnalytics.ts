import type { GameEventType, GameOverPayload } from '@/game/runner';
import type { SessionReport, SessionSample } from '@/neuro/SessionRecorder';

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Linear interpolate sample series at time t (sec). */
function interpAt(samples: SessionSample[], t: number, key: keyof SessionSample): number | null {
  if (samples.length === 0) return null;
  let i = 0;
  while (i < samples.length && samples[i].t < t) i++;
  if (i === 0) {
    const v = samples[0][key];
    return typeof v === 'number' ? v : null;
  }
  if (i >= samples.length) {
    const v = samples[samples.length - 1][key];
    return typeof v === 'number' ? v : null;
  }
  const a = samples[i - 1];
  const b = samples[i];
  const va = a[key];
  const vb = b[key];
  if (typeof va !== 'number' || typeof vb !== 'number')
    return typeof vb === 'number' ? vb : typeof va === 'number' ? va : null;
  const u = (t - a.t) / Math.max(b.t - a.t, 1e-6);
  return va + (vb - va) * clamp(u, 0, 1);
}

function samplesInWindow(samples: SessionSample[], center: number, halfWidth: number): SessionSample[] {
  const lo = center - halfWidth;
  const hi = center + halfWidth;
  return samples.filter((s) => s.t >= lo && s.t <= hi);
}

export interface PhaseStats {
  phaseIndex: 0 | 1 | 2;
  label: string;
  tStart: number;
  tEnd: number;
  meanCalm: number;
  medianCalm: number;
  meanArousal: number;
  meanHrv: number | null;
  meanBpm: number | null;
  jumpCount: number;
  snackCount: number;
  hitCount: number;
  deathCount: number;
}

export interface EventTypeWindowAgg {
  type: GameEventType;
  count: number;
  meanCalm2s: number | null;
  meanArousal2s: number | null;
  meanHrv2s: number | null;
  deltaCalmVsBaseline: number | null;
}

export interface NotableMoment {
  tSec: number;
  kind: string;
  detail: string;
}

export interface ReportAnalytics {
  durationSec: number;
  baseline: { meanCalm: number; meanArousal: number; meanHrv: number | null; meanBpm: number | null };
  phases: PhaseStats[];
  byEventType: EventTypeWindowAgg[];
  preHitArousal2s: number | null;
  snackCalmDelta: number | null;
  yuzuHrvDelta: number | null;
  jumpThenHitWithin1s: number;
  panicStretches: number;
  speedNeuro: {
    fastestT: number | null;
    fastestSpeed: number | null;
    calmestAtSpeedT: number | null;
    calmestAtSpeed: number | null;
  };
  coverage: {
    bpmPct: number;
    hrvPct: number;
    eegBandPct: number;
    lowConfidence: boolean;
  };
  blurbs: string[];
  notableMoments: NotableMoment[];
}

const EVENT_TYPES: GameEventType[] = ['jump', 'hit', 'snack', 'yuzu', 'death'];

export function computeReportAnalytics(report: SessionReport, game: GameOverPayload): ReportAnalytics {
  const samples = report.samples;
  const dur = game.durationSec || (samples.length ? samples[samples.length - 1].t : 0) || 1;

  const calmVals = samples.map((s) => s.calm);
  const arousalVals = samples.map((s) => s.arousal);
  const hrvVals = samples.map((s) => s.hrv).filter((h): h is number => h != null && Number.isFinite(h));
  const bpmVals = samples.map((s) => s.bpm).filter((b): b is number => b != null && Number.isFinite(b));
  const baseline = {
    meanCalm: mean(calmVals) || 0,
    meanArousal: mean(arousalVals) || 0,
    meanHrv: hrvVals.length ? mean(hrvVals) : null,
    meanBpm: bpmVals.length ? mean(bpmVals) : null,
  };

  const third = dur / 3;
  const phases: PhaseStats[] = [0, 1, 2].map((i) => {
    const tStart = i * third;
    const tEnd = i === 2 ? dur : (i + 1) * third;
    const slice = samples.filter((s) => s.t >= tStart && s.t < tEnd);
    const evs = game.events.filter((e) => e.tSec >= tStart && e.tSec < tEnd);
    const hrvS = slice.map((s) => s.hrv).filter((h): h is number => h != null);
    const bpmS = slice.map((s) => s.bpm).filter((b): b is number => b != null);
    return {
      phaseIndex: i as 0 | 1 | 2,
      label: i === 0 ? 'Opening' : i === 1 ? 'Mid canopy' : 'Late run',
      tStart,
      tEnd,
      meanCalm: mean(slice.map((s) => s.calm)),
      medianCalm: median(slice.map((s) => s.calm)),
      meanArousal: mean(slice.map((s) => s.arousal)),
      meanHrv: hrvS.length ? mean(hrvS) : null,
      meanBpm: bpmS.length ? mean(bpmS) : null,
      jumpCount: evs.filter((e) => e.type === 'jump').length,
      snackCount: evs.filter((e) => e.type === 'snack').length,
      hitCount: evs.filter((e) => e.type === 'hit').length,
      deathCount: evs.filter((e) => e.type === 'death').length,
    };
  });

  const byEventType: EventTypeWindowAgg[] = EVENT_TYPES.map((type) => {
    const evs = game.events.filter((e) => e.type === type);
    const calmW: number[] = [];
    const arousalW: number[] = [];
    const hrvW: number[] = [];
    for (const e of evs) {
      const w = samplesInWindow(samples, e.tSec, 2);
      for (const s of w) {
        calmW.push(s.calm);
        arousalW.push(s.arousal);
        if (s.hrv != null) hrvW.push(s.hrv);
      }
    }
    const mc = calmW.length ? mean(calmW) : null;
    const ma = arousalW.length ? mean(arousalW) : null;
    const mh = hrvW.length ? mean(hrvW) : null;
    return {
      type,
      count: evs.length,
      meanCalm2s: mc,
      meanArousal2s: ma,
      meanHrv2s: mh,
      deltaCalmVsBaseline: mc != null ? mc - baseline.meanCalm : null,
    };
  });

  const preHitArousals: number[] = [];
  for (const e of game.events) {
    if (e.type !== 'hit') continue;
    const w = samplesInWindow(samples, e.tSec, 2).filter((s) => s.t <= e.tSec);
    for (const s of w) preHitArousals.push(s.arousal);
  }
  const preHitArousal2s = preHitArousals.length ? mean(preHitArousals) : null;

  const snackCalms: number[] = [];
  for (const e of game.events) {
    if (e.type !== 'snack') continue;
    const w = samplesInWindow(samples, e.tSec, 1.5);
    for (const s of w) snackCalms.push(s.calm);
  }
  const snackCalmMean = snackCalms.length ? mean(snackCalms) : null;
  const snackCalmDelta = snackCalmMean != null ? snackCalmMean - baseline.meanCalm : null;

  const yuzuHrvs: number[] = [];
  for (const e of game.events) {
    if (e.type !== 'yuzu') continue;
    const w = samplesInWindow(samples, e.tSec, 1.5);
    for (const s of w) {
      if (s.hrv != null) yuzuHrvs.push(s.hrv);
    }
  }
  const yuzuHrvMean = yuzuHrvs.length ? mean(yuzuHrvs) : null;
  const yuzuHrvDelta = yuzuHrvMean != null && baseline.meanHrv != null ? yuzuHrvMean - baseline.meanHrv : null;

  let jumpThenHitWithin1s = 0;
  const jumps = game.events.filter((e) => e.type === 'jump');
  for (const j of jumps) {
    const soon = game.events.some((e) => e.type === 'hit' && e.tSec > j.tSec && e.tSec <= j.tSec + 1);
    if (soon) jumpThenHitWithin1s++;
  }

  let panicStretches = 0;
  let inPanic = false;
  for (const s of samples) {
    const hi = s.arousal > 0.72;
    if (hi && !inPanic) {
      panicStretches++;
      inPanic = true;
    } else if (!hi) inPanic = false;
  }

  let fastestT: number | null = null;
  let fastestSpeed: number | null = null;
  let calmestAtSpeedT: number | null = null;
  let calmestAtSpeed: number | null = null;
  for (const sp of game.speedSamples) {
    if (fastestSpeed === null || sp.speed > fastestSpeed) {
      fastestSpeed = sp.speed;
      fastestT = sp.tSec;
    }
  }
  for (const sp of game.speedSamples) {
    const c = interpAt(samples, sp.tSec, 'calm');
    if (c != null && (calmestAtSpeed === null || c > calmestAtSpeed)) {
      calmestAtSpeed = c;
      calmestAtSpeedT = sp.tSec;
    }
  }

  const n = samples.length || 1;
  const bpmPct = (samples.filter((s) => s.bpm != null).length / n) * 100;
  const hrvPct = (samples.filter((s) => s.hrv != null).length / n) * 100;
  const eegBandPct = (samples.filter((s) => s.alpha + s.beta + s.theta > 1e-4).length / n) * 100;
  const sigQ = samples.filter((s) => s.signalQuality != null).map((s) => s.signalQuality as number);
  const lowConfidence = sigQ.length > 0 ? mean(sigQ) < 0.35 : bpmPct < 15 && eegBandPct < 10;

  const blurbs: string[] = [];
  if (snackCalmDelta != null && snackCalmDelta > 0.04) {
    blurbs.push('Leaf snacks tended to line up with calmer moments than your run average.');
  }
  if (preHitArousal2s != null && preHitArousal2s > baseline.meanArousal + 0.06) {
    blurbs.push('Arousal was often elevated in the moments leading up to bumps.');
  }
  if (yuzuHrvDelta != null && yuzuHrvDelta > 3) {
    blurbs.push('Yuzu pickups coincided with higher HRV windows — a nice recovery signal.');
  }
  if (phases[2] && phases[0] && phases[2].meanCalm > phases[0].meanCalm + 0.05) {
    blurbs.push('You looked calmer in the late run than at the opening — steady settling.');
  }
  if (blurbs.length === 0) {
    blurbs.push('Keep connecting sensors for richer BPM, HRV, and band tie-ins on your next dash.');
  }

  const notableMoments: NotableMoment[] = [];
  for (const e of game.events) {
    if (e.type === 'death') {
      const ar = interpAt(samples, e.tSec, 'arousal');
      notableMoments.push({
        tSec: e.tSec,
        kind: 'Game over',
        detail: ar != null ? `arousal ~${(ar * 100).toFixed(0)}% at finish` : 'end of run',
      });
    }
    if (e.type === 'yuzu') {
      const ar = interpAt(samples, e.tSec, 'arousal');
      if (ar != null && ar > baseline.meanArousal + 0.12) {
        notableMoments.push({
          tSec: e.tSec,
          kind: 'Yuzu under stress',
          detail: `arousal ${(ar * 100).toFixed(0)}% vs run avg ${(baseline.meanArousal * 100).toFixed(0)}%`,
        });
      }
    }
  }
  for (let i = 1; i < samples.length; i++) {
    const d = samples[i].arousal - samples[i - 1].arousal;
    if (d > 0.2) {
      notableMoments.push({
        tSec: samples[i].t,
        kind: 'Arousal spike',
        detail: `+${(d * 100).toFixed(0)}% in ~1s`,
      });
    }
  }
  notableMoments.sort((a, b) => b.tSec - a.tSec);
  const notableTrimmed = notableMoments.slice(0, 8);

  return {
    durationSec: dur,
    baseline,
    phases,
    byEventType,
    preHitArousal2s,
    snackCalmDelta,
    yuzuHrvDelta,
    jumpThenHitWithin1s,
    panicStretches,
    speedNeuro: { fastestT, fastestSpeed, calmestAtSpeedT, calmestAtSpeed },
    coverage: { bpmPct, hrvPct, eegBandPct, lowConfidence },
    blurbs,
    notableMoments: notableTrimmed,
  };
}
