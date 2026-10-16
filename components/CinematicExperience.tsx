'use client';
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUp, ArrowUpRight, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { duration, sampleJourney, transition, type JourneyFrame, type Phase } from '@/lib/journey';
import { JourneySound } from '@/lib/sound';

function subscribeMotion(callback:()=>void){const query=window.matchMedia('(prefers-reduced-motion: reduce)');query.addEventListener('change',callback);return()=>query.removeEventListener('change',callback)}
const motionSnapshot=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const serverMotionSnapshot=()=>false;
const descriptions:Record<Phase,string>={arrival:'A door to somewhere else.',entering:'The doors open. Step inside.',boarding:'Select Floor 13 to begin your ascent.',riding:'Ascending to Floor 13.',revealing:'The doors open onto a city above the clouds.',reveal:'You were never meant to stay below. Replay whenever you like.'};
export default function CinematicExperience(){
  const [phase,dispatch]=useReducer(transition,'arrival');
  const [progress,setProgress]=useState(0),[mode,setMode]=useState<'loading'|'webgl'|'fallback'>('loading');
  const [sound,setSound]=useState(false),[audioMessage,setAudioMessage]=useState(''),[replays,setReplays]=useState(0);
  const reduced=useSyncExternalStore(subscribeMotion,motionSnapshot,serverMotionSnapshot);
  const canvas=useRef<HTMLCanvasElement>(null),floorButton=useRef<HTMLButtonElement>(null),replayButton=useRef<HTMLButtonElement>(null);
  const frame=useRef<JourneyFrame>({phase:'arrival',progress:0,reduced:false});
  const audio=useRef<JourneySound|null>(null);
  useEffect(()=>{
    let active=true;let scene:{dispose:()=>void}|undefined;
    import('@/lib/cinematic-renderer').then(({createCinematic})=>{
      if(!active||!canvas.current||!floorButton.current)return;
      try{scene=createCinematic({canvas:canvas.current,floorControl:floorButton.current,getFrame:()=>frame.current,onContextLost:()=>{if(active)setMode('fallback')}});setMode('webgl')}
      catch{setMode('fallback')}
    }).catch(()=>{if(active)setMode('fallback')});
    return()=>{active=false;scene?.dispose()};
  },[]);
  useEffect(()=>{
    frame.current={phase,progress:0,reduced};
    const length=duration(phase,reduced);
    audio.current?.phase(phase);
    if(phase==='boarding')floorButton.current?.focus({preventScroll:true});
    if(phase==='reveal')replayButton.current?.focus({preventScroll:true});
    if(!length)return;
    let request=0,last=0,elapsed=0,lastPaint=0;
    function tick(time:number){
      if(document.hidden){last=0;request=requestAnimationFrame(tick);return;}
      if(last)elapsed+=Math.min(100,time-last);last=time;
      const value=Math.min(1,elapsed/length);frame.current={phase,progress:value,reduced};
      if(time-lastPaint>90){setProgress(value);lastPaint=time;}
      if(value>=1){setProgress(0);dispatch('COMPLETE');return;}
      request=requestAnimationFrame(tick);
    }
    request=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(request);
  },[phase,reduced]);
  useEffect(()=>{
    function visibility(){if(document.hidden)audio.current?.suspend();else audio.current?.resume()}
    document.addEventListener('visibilitychange',visibility);
    return()=>{document.removeEventListener('visibilitychange',visibility);audio.current?.dispose()};
  },[]);
  async function toggleSound(){
    setAudioMessage('');
    if(sound){audio.current?.mute();setSound(false);return;}
    try{audio.current??=new JourneySound();await audio.current.enable();audio.current.phase(phase);setSound(true)}catch{setAudioMessage('Sound could not start. You can still enjoy the journey.');setSound(false)}
  }
  const sample=sampleJourney({phase,progress,reduced});
  const chapter=phase==='arrival'||phase==='entering'?1:phase==='boarding'||phase==='riding'?2:3;
  const ready=mode!=='loading';
  return <main className="cinematic" data-phase={phase} data-renderer={mode} data-ready={ready} data-reduced={reduced}>
    <div className="world" aria-hidden="true">
      {mode!=='webgl'&&<div className={`fallback-world ${sample.city?'fallback-city':''}`}>
        <div className="fallback-sky"/><div className="fallback-moon"/>
        <div className="fallback-skyline">{Array.from({length:22},(_,i)=><i key={i} style={{height:`${18+(i*37)%73}%`,width:`${3+i%3}%`}}/>)}</div>
        <div className="fallback-hall"><div className="fallback-ceiling"/><div className="fallback-wall wall-left"/><div className="fallback-wall wall-right"/><div className="fallback-doorway"><div style={{transform:`translateX(${-sample.doors*100}%)`}}/><div style={{transform:`translateX(${sample.doors*100}%)`}}/></div><div className="fallback-floor"/></div>
      </div>}
      <canvas ref={canvas} className="scene-canvas"/>
      <div className="cinema-grade"/><div className="cinema-vignette"/>
      <div className="motion-curtain" style={{opacity:sample.fade}}/>
      {replays>0&&<div className="replay-curtain" key={replays}/>}
    </div>
    <header className="masthead"><div className="brand">THE ELEVATOR<span>A SHORT ESCAPE FROM THE ORDINARY</span></div><button className="sound-toggle" onClick={toggleSound} aria-pressed={sound} aria-label={sound?'Turn sound off':'Turn sound on'}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}<span>SOUND {sound?'ON':'OFF'}</span></button></header>
    <section className="arrival-copy scene-copy" data-visible={phase==='arrival'} aria-hidden={phase!=='arrival'} inert={phase!=='arrival'}>
      <div className="overline"><span/> SOMEWHERE, AFTER HOURS</div>
      <h1>Some doors<br/><em>change everything.</em></h1>
      <p>Leave the world behind.<br/>Just for a moment.</p>
    </section>
    <div className="arrival-action" data-visible={phase==='arrival'} inert={phase!=='arrival'} aria-hidden={phase!=='arrival'}>
      <button className="enter-button" disabled={!ready} onClick={()=>dispatch('ENTER')}><span className="enter-icon"><ArrowUpRight size={22}/></span><span>{ready?'ENTER THE ELEVATOR':'SETTING THE SCENE'}<small>{ready?'AN 18-SECOND JOURNEY':'YOUR ESCAPE IS ALMOST READY'}</small></span></button>
    </div>
    <button ref={floorButton} className="floor-selector" data-visible={phase==='boarding'} disabled={phase!=='boarding'} aria-label="Select Floor 13" onClick={()=>dispatch('SELECT_13')}><span>13</span><span className="selector-halo"/></button>
    <div className="boarding-copy" data-visible={phase==='boarding'} aria-hidden={phase!=='boarding'}><span className="overline">ONE DESTINATION.</span><p>Press <strong>13</strong>.<br/><span>See what’s waiting above.</span></p></div>
    <div className="ride-copy" data-visible={phase==='riding'} aria-hidden={phase!=='riding'}><span className="overline">LEAVING THE ORDINARY</span><div><ArrowUp size={18}/><span>{String(sample.floor).padStart(2,'0')}</span></div></div>
    <section className="reveal-copy scene-copy" data-visible={phase==='reveal'} aria-hidden={phase!=='reveal'} inert={phase!=='reveal'}>
      <div className="overline"><span/> FLOOR 13 / A DIFFERENT PERSPECTIVE</div><h2>You were never<br/>meant to<br/><em>stay below.</em></h2><p>The world is bigger than the one you know.</p>
      <button ref={replayButton} className="replay-button" onClick={()=>{setReplays(n=>n+1);setProgress(0);dispatch('REPLAY')}}><RotateCcw size={15}/> TAKE THE RIDE AGAIN <span>↗</span></button>
    </section>
    <footer className="film-footer"><span className="film-location">EST. NOWHERE <i/> OPEN AFTER DARK</span><div className="chapters" aria-label={`Scene ${chapter} of 3`}><span data-active={chapter===1}>01 <b>ARRIVAL</b></span><i/><span data-active={chapter===2}>02 <b>THE RIDE</b></span><i/><span data-active={chapter===3}>03 <b>BEYOND</b></span></div><span className="signature">AN EXPERIENCE BY <b>RKP</b></span></footer>
    <p className="sr-only" role="status">{descriptions[phase]}</p>
    {audioMessage&&<p className="audio-message" role="status">{audioMessage}</p>}
  </main>;
}
