import type { Phase } from './journey';
/** Synthesized locally. Constructed only from an explicit sound-control gesture. */
export class JourneySound {
  private context: AudioContext;
  private master: GainNode;
  private bed: GainNode;
  private filter: BiquadFilterNode;
  private sources: AudioScheduledSourceNode[] = [];
  private enabled = false;
  constructor() {
    const Constructor = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    this.context=new Constructor();
    const ctx=this.context;
    this.master=ctx.createGain(); this.master.gain.value=0; this.master.connect(ctx.destination);
    this.bed=ctx.createGain(); this.bed.gain.value=.02; this.bed.connect(this.master);
    this.filter=ctx.createBiquadFilter(); this.filter.type='lowpass'; this.filter.frequency.value=180;
    this.filter.connect(this.bed);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);
    const samples=buffer.getChannelData(0); let last=0;
    for(let i=0;i<samples.length;i++){last=(last+Math.random()*.04-.02)/1.02;samples[i]=last*3;}
    const noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;noise.connect(this.filter);noise.start();this.sources.push(noise);
    const motor=ctx.createOscillator();motor.type='sine';motor.frequency.value=48;motor.connect(this.bed);motor.start();this.sources.push(motor);
  }
  async enable(){await this.context.resume();this.enabled=true;this.master.gain.setTargetAtTime(.18,this.context.currentTime,.12);}
  mute(){this.enabled=false;this.master.gain.setTargetAtTime(0,this.context.currentTime,.03);}
  phase(phase:Phase){
    if(!this.enabled)return;
    const now=this.context.currentTime;
    this.bed.gain.setTargetAtTime(phase==='riding'?.17:phase==='reveal'?.04:.025,now,.6);
    this.filter.frequency.setTargetAtTime(phase==='revealing'||phase==='reveal'?850:phase==='riding'?260:130,now,.7);
    if(phase==='entering'||phase==='riding')this.chime(110,.8,.14);
    if(phase==='boarding'||phase==='revealing'){this.chime(660,.8,.16);this.chime(880,1,.09,.13);}
  }
  private chime(frequency:number,length:number,volume:number,delay=0){
    const ctx=this.context, start=ctx.currentTime+delay;
    const oscillator=ctx.createOscillator(),gain=ctx.createGain();
    oscillator.frequency.value=frequency; gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.025);gain.gain.exponentialRampToValueAtTime(.0001,start+length);
    oscillator.connect(gain);gain.connect(this.master);oscillator.start(start);oscillator.stop(start+length);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()};
  }
  suspend(){void this.context.suspend().catch(()=>{});}
  resume(){if(this.enabled)void this.context.resume().catch(()=>{});}
  dispose(){this.sources.forEach(source=>{source.stop();source.disconnect()});void this.context.close().catch(()=>{});}
}
