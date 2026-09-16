export const MAX_GAIN = 0.2;

export function clampGain(gain: number): number {
  return Number.isFinite(gain) ? Math.min(MAX_GAIN, Math.max(0, gain)) : 0;
}

/** One sine oscillator. Start it from a click: browsers block audio that starts on its own. */
export class Tone {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  start(frequency: number, gain: number): void {
    if (typeof AudioContext === 'undefined') return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    if (!this.osc || !this.gain) {
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.osc = this.ctx.createOscillator();
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
    }
    const now = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(frequency, now, 0.02);
    this.gain.gain.setTargetAtTime(clampGain(gain), now, 0.03);
  }

  stop(): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, now, 0.03);
    this.osc.stop(now + 0.2);
    this.osc = null;
    this.gain = null;
  }
}
