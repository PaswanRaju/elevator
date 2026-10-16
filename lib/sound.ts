import type { Frame, Stage } from "./journey";

/**
 * Synthesized locally, nothing is downloaded. Constructed only from an explicit
 * sound-control gesture, so iOS and in-app browsers allow the AudioContext.
 * The bed follows the car's real speed; chimes fire on the journey's own cues.
 */
export class JourneySound {
  private context: AudioContext;
  private master: GainNode;
  private bed: GainNode;
  private motor: OscillatorNode;
  private filter: BiquadFilterNode;
  private sources: AudioScheduledSourceNode[] = [];
  private lastDoors = 0;
  private wasArrived = false;
  private doorsMoving = false;
  enabled = false;

  constructor() {
    const Constructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new Constructor();
    const ctx = this.context;
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    this.bed = ctx.createGain(); this.bed.gain.value = 0.02; this.bed.connect(this.master);
    this.filter = ctx.createBiquadFilter(); this.filter.type = "lowpass"; this.filter.frequency.value = 180;
    this.filter.connect(this.bed);
    // Brown noise: air in the shaft.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const samples = buffer.getChannelData(0); let last = 0;
    for (let i = 0; i < samples.length; i++) { last = (last + Math.random() * 0.04 - 0.02) / 1.02; samples[i] = last * 3; }
    const noise = ctx.createBufferSource(); noise.buffer = buffer; noise.loop = true; noise.connect(this.filter); noise.start(); this.sources.push(noise);
    this.motor = ctx.createOscillator(); this.motor.type = "sine"; this.motor.frequency.value = 48; this.motor.connect(this.bed); this.motor.start(); this.sources.push(this.motor);
  }

  async enable() {
    await this.context.resume();
    this.enabled = true;
    this.master.gain.setTargetAtTime(0.22, this.context.currentTime, 0.12);
  }
  mute() {
    this.enabled = false;
    this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.03);
  }

  /** Called every frame with the journey state; cheap when nothing changes. */
  update(stage: Stage, frame: Frame) {
    if (!this.enabled) return;
    const now = this.context.currentTime;
    this.bed.gain.setTargetAtTime(0.03 + frame.speed * 0.16, now, 0.25);
    this.motor.frequency.setTargetAtTime(44 + frame.speed * 18, now, 0.3);
    this.filter.frequency.setTargetAtTime(stage === "destination" ? 700 : 130 + frame.speed * 220, now, 0.5);
    if (frame.arrived && !this.wasArrived) { this.chime(660, 0.9, 0.16); this.chime(880, 1.1, 0.1, 0.16); }
    this.wasArrived = frame.arrived;
    // A soft pneumatic whoosh whenever the leaves start moving.
    const moving = Math.abs(frame.doors - this.lastDoors) > 0.0005;
    const wasMoving = this.doorsMoving;
    this.doorsMoving = moving;
    if (moving && !wasMoving) this.whoosh(frame.doors > this.lastDoors);
    this.lastDoors = frame.doors;
  }
  /** Short click for button presses. */
  click() {
    if (!this.enabled) return;
    this.chime(1800, 0.06, 0.05);
  }

  private chime(frequency: number, length: number, volume: number, delay = 0) {
    const ctx = this.context, start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(start); oscillator.stop(start + length);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  private whoosh(opening: boolean) {
    const ctx = this.context, start = ctx.currentTime;
    const source = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.6, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    source.buffer = buffer;
    const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.Q.value = 0.8;
    band.frequency.setValueAtTime(opening ? 300 : 600, start);
    band.frequency.linearRampToValueAtTime(opening ? 700 : 260, start + 1.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.05, start + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);
    source.connect(band); band.connect(gain); gain.connect(this.master);
    source.start(start); source.stop(start + 1.6);
    source.onended = () => { source.disconnect(); band.disconnect(); gain.disconnect(); };
  }

  suspend() { void this.context.suspend().catch(() => {}); }
  resume() { if (this.enabled) void this.context.resume().catch(() => {}); }
  dispose() {
    this.sources.forEach((source) => { try { source.stop(); } catch {} source.disconnect(); });
    void this.context.close().catch(() => {});
  }
}
