/**
 * Web Audio one-shots — no external assets (ported from original.html).
 */

let ac: AudioContext | null = null;
let enabled = true;

function ensure(): void {
  if (ac) return;
  try {
    ac = new (
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
  } catch {
    ac = null;
  }
}

function beep(type: OscillatorType, f0: number, f1: number, dur: number, gain: number): void {
  if (!enabled) return;
  ensure();
  if (!ac) return;
  const t0 = ac.currentTime + 0.0005;

  const o = ac.createOscillator();
  const g = ac.createGain();

  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  o.connect(g);
  g.connect(ac.destination);

  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const gameAudio = {
  setEnabled(v: boolean): void {
    enabled = !!v;
  },
  getEnabled(): boolean {
    return enabled;
  },
  resume(): void {
    if (ac?.state === 'suspended') ac.resume().catch(() => {});
  },
  jump(): void {
    beep('square', 280, 520, 0.1, 0.12);
  },
  snack(): void {
    beep('sine', 560, 880, 0.08, 0.1);
  },
  yuzu(): void {
    beep('triangle', 300, 1200, 0.16, 0.12);
  },
  hit(): void {
    beep('sawtooth', 180, 70, 0.18, 0.12);
  },
  start(): void {
    beep('sine', 220, 440, 0.12, 0.1);
  },
  pause(): void {
    beep('sine', 360, 220, 0.1, 0.08);
  },
};
