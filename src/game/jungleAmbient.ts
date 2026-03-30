/**
 * Slim neuro-reactive ambient bed: drone + filtered noise. No external samples.
 */

export interface AmbientNeuroMix {
  calm: number;
  arousal: number;
  bpm: number | null;
  bpmQuality: number;
  hrvRmssd: number | null;
  alphaPower: number | null;
  betaPower: number | null;
  signalQuality: number;
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export class JungleAmbient {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private pad: OscillatorNode | null = null;
  private padGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    try {
      const Ctx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ac = new Ctx();
      const ac = this.ac;
      this.master = ac.createGain();
      this.master.gain.value = 0.12;

      this.droneGain = ac.createGain();
      this.droneGain.gain.value = 0.5;
      this.drone = ac.createOscillator();
      this.drone.type = 'sine';
      this.drone.frequency.value = 55;
      this.drone.connect(this.droneGain);

      this.filter = ac.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 420;
      this.filter.Q.value = 0.7;

      this.padGain = ac.createGain();
      this.padGain.gain.value = 0.08;
      this.pad = ac.createOscillator();
      this.pad.type = 'triangle';
      this.pad.frequency.value = 110;
      this.pad.connect(this.padGain);
      this.padGain.connect(this.filter);

      this.droneGain.connect(this.filter);
      this.filter.connect(this.master);

      const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      this.noiseGain = ac.createGain();
      this.noiseGain.gain.value = 0.02;
      const n = ac.createBufferSource();
      n.buffer = buf;
      n.loop = true;
      n.connect(this.noiseGain);
      this.noiseGain.connect(this.master);
      this.noise = n;

      this.master.connect(ac.destination);
      this.drone.start();
      this.pad.start();
      n.start();
      this.running = true;
    } catch {
      this.destroy();
    }
  }

  update(mix: AmbientNeuroMix): void {
    if (!this.running || !this.ac || !this.drone || !this.pad || !this.filter || !this.master || !this.droneGain)
      return;
    const conf = clamp(mix.signalQuality, 0, 1);
    const gate = conf < 0.22 ? 0.35 : 0.65 + conf * 0.35;
    const t = this.ac.currentTime;

    const calm = clamp(mix.calm, 0, 1);
    const arousal = clamp(mix.arousal, 0, 1);
    const bpmQ = clamp(mix.bpmQuality, 0, 1);

    const targetDrone = 48 + calm * 22 + arousal * 14;
    this.drone.frequency.exponentialRampToValueAtTime(Math.max(40, targetDrone), t + 0.25);

    const detune = (arousal - calm) * 18 * gate * (0.4 + bpmQ * 0.6);
    this.pad.detune.setValueAtTime(detune, t);

    const cutoff = 280 + calm * 380 + arousal * 220;
    this.filter.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff), t + 0.2);

    let hrvN = 0.5;
    if (mix.hrvRmssd != null && mix.hrvRmssd > 0) {
      hrvN = clamp((mix.hrvRmssd - 15) / 90, 0, 1);
    }
    const steadiness = 1 - hrvN * 0.35 * gate;
    this.master.gain.setTargetAtTime(0.07 + arousal * 0.06 + calm * 0.03, t, 0.15);
    this.droneGain.gain.setTargetAtTime(0.35 + steadiness * 0.25, t, 0.2);

    if (mix.alphaPower != null && mix.betaPower != null) {
      const ab = mix.alphaPower / (mix.betaPower + 1e-6);
      const tilt = clamp((ab - 1) * 0.02, -0.06, 0.06);
      this.pad.frequency.setTargetAtTime(110 + tilt * 55, t, 0.2);
    }
  }

  setMuted(m: boolean): void {
    if (this.master && this.ac) {
      this.master.gain.setTargetAtTime(m ? 0.0001 : 0.1, this.ac.currentTime, 0.08);
    }
  }

  pause(): void {
    if (this.ac?.state === 'running') this.ac.suspend().catch(() => {});
  }

  resume(): void {
    if (this.ac?.state === 'suspended') this.ac.resume().catch(() => {});
  }

  destroy(): void {
    try {
      this.noise?.stop();
      this.drone?.stop();
      this.pad?.stop();
    } catch {
      /* ignore */
    }
    this.noise = null;
    this.drone = null;
    this.pad = null;
    this.ac?.close().catch(() => {});
    this.ac = null;
    this.master = null;
    this.droneGain = null;
    this.padGain = null;
    this.filter = null;
    this.noiseGain = null;
    this.running = false;
  }
}
