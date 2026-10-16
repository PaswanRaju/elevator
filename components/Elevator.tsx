"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Pause, Play, Volume2, VolumeX, Zap } from "lucide-react";
import Guide from "@/components/Guide";
import { ElevatorSound } from "@/lib/sound";
import { FLOORS, floorByNumber } from "@/lib/floors";

type Stage = "arrival" | "cabin" | "ride" | "destination";

function SceneArt({ floor, active, interactionCount, onInteract }: { floor: number; active: boolean; interactionCount: number; onInteract: () => void }) {
  const destination = floorByNumber(floor);
  return (
    <div className={`destination-scene scene-${destination.palette}${active ? " is-active" : ""}`}>
      <div className="scene-stars" aria-hidden="true" />
      <div className="scene-silhouette" aria-hidden="true" />
      <div className="scene-depth scene-depth-one" aria-hidden="true" />
      <div className="scene-depth scene-depth-two" aria-hidden="true" />
      <div className="scene-particles" aria-hidden="true" />
      {floor === 1 && <><div className="tokyo-sign">東京<br /><small>OPEN 24H</small></div><div className="tokyo-train" /></>}
      {floor === 2 && <><div className="ocean-window"><span className="jelly jelly-one" /><span className="jelly jelly-two" /><span className="jelly jelly-three" /></div><div className="ocean-console" /></>}
      {floor === 3 && <><div className="planet" /><div className="orbit-ring" /><div className="space-station" /></>}
      {floor === 4 && <><div className="forest-moon" /><div className="tree tree-one" /><div className="tree tree-two" /><div className="tree tree-three" /></>}
      {floor === 5 && <><div className="arcade-cabinet"><span>★ CATCH</span><b>{active ? `SCORE ${interactionCount * 100}` : "INSERT COIN"}</b></div><div className="arcade-floor" /></>}
      {floor === 6 && <><div className="torii" /><div className="garden-lantern" /><div className="petals" /></>}
      {floor === 7 && <><div className="library-shelf shelf-one" /><div className="library-shelf shelf-two" /><div className="open-book">THE<br />UNKNOWN</div></>}
      {floor === 8 && <><div className="aurora" /><div className="mountains" /><div className="cabin" /></>}
      {floor === 9 && <><div className="dream-island island-one" /><div className="dream-island island-two" /><div className="dream-cloud cloud-one" /><div className="dream-cloud cloud-two" /></>}
      {floor === 10 && <><div className="forbidden-door" /><div className="forbidden-light" /></>}
      {floor === 11 && <><div className="sun" /><div className="ocean-horizon" /><div className="wave wave-one" /><div className="wave wave-two" /></>}
      {floor === 12 && <><div className="skyline" /><div className="rooftop-rail" /><div className="skyline-beacon" /></>}
      {floor === 13 && <><div className="code-rain">0101<br />&gt;_ 7F<br />1010</div><div className="digital-grid" /><div className="glitch-frame" /></>}
      <div className="scene-vignette" aria-hidden="true" />
      <button className="scene-interaction" onClick={onInteract}><Zap size={13} />{destination.interaction}</button>
    </div>
  );
}

export default function Elevator() {
  const [stage, setStage] = useState<Stage>("arrival");
  const [selected, setSelected] = useState(13);
  const [interacted, setInteracted] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [guideRefresh, setGuideRefresh] = useState(0);
  const soundscape = useRef<ElevatorSound | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surpriseIndex = useRef(0);
  const floor = useMemo(() => floorByNumber(selected), [selected]);

  useEffect(() => {
    soundscape.current = new ElevatorSound();
    return () => { if (timeout.current) clearTimeout(timeout.current); soundscape.current?.dispose(); };
  }, []);

  function enter() {
    if (stage === "arrival") setStage("cabin");
  }
  function choose(number: number) {
    if (stage !== "cabin") return;
    setSelected(number); setInteracted(false); setInteractionCount(0); setStage("ride"); setGuideRefresh((value) => value + 1);
    timeout.current = setTimeout(() => setStage("destination"), 2400);
  }
  function surprise() {
    const options = FLOORS.filter((item) => item.number !== selected);
    const entropy = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(entropy);
    else entropy[0] = surpriseIndex.current + 7;
    surpriseIndex.current = entropy[0] % options.length;
    choose(options[surpriseIndex.current].number);
  }
  function returnToElevator() {
    if (timeout.current) clearTimeout(timeout.current);
    setStage("cabin"); setInteracted(false); setInteractionCount(0); setGuideRefresh((value) => value + 1);
  }
  async function toggleSound() {
    const audio = soundscape.current;
    if (!audio) return;
    if (audio.enabled) { audio.mute(); setSound(false); return; }
    try { await audio.enable(); setSound(true); setSoundError(false); } catch { setSoundError(true); }
  }
  const status = stage === "arrival" ? "The arrival" : stage === "cabin" ? "Choose a floor" : stage === "ride" ? `Ascending to Floor ${selected}` : `Floor ${selected} · ${floor.name}`;
  const isReveal = stage === "destination" && selected === 10;

  return (
    <main className={`experience stage-${stage} destination-${floor.palette}${paused ? " is-paused" : ""}`} data-stage={stage} data-floor={selected}>
      <div className="cinema-background" aria-hidden="true"><div className="background-glow" /></div>
      {stage === "destination" && <SceneArt floor={selected} active={interacted} interactionCount={interactionCount} onInteract={() => { setInteracted(true); setInteractionCount((value) => value + 1); }} />}
      <div className="cinema-shade" aria-hidden="true" /><div className="film-grain" aria-hidden="true" />
      <header className="topbar">
        <button className="wordmark" onClick={() => setStage("arrival")} aria-label="The Elevator, return to the arrival"><span className="brand-mark" aria-hidden="true"><i /><i /></span>THE ELEVATOR<span className="brand-edition">THIRTEEN WORLDS · ONE RIDE</span></button>
        <div className="top-controls">
          <button className="icon-button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Resume experience" : "Pause experience"}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
          <button className="sound-button" onClick={toggleSound} aria-label={sound ? "Mute sound" : "Enable sound"} aria-pressed={sound}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}<span>SOUND {sound ? "ON" : "OFF"}</span></button>
        </div>
      </header>

      {stage === "arrival" && <section className="arrival-copy scene-copy">
        <p className="eyebrow"><span /> SOMEWHERE, AFTER HOURS</p>
        <h1>Some doors lead<br /><em>somewhere else.</em></h1>
        <p className="intro">Thirteen destinations. No map. No wrong turn.</p>
        <button className="enter-button" onClick={enter}><span>Step inside</span><ArrowUpRight size={19} strokeWidth={1.3} /></button>
        <p className="invitation-note">PICK ANY RANDOM FLOOR · EVERY NUMBER HIDES A DIFFERENT WORLD</p>
      </section>}

      {stage === "cabin" && <section className="cabin-interface">
        <div className="cabin-copy scene-copy"><p className="eyebrow">01 / THE PANEL</p><h2>Pick any <em>random floor.</em></h2><p>Every number hides a different world.</p></div>
        <div className="control-panel">
          <div className="panel-header"><span>DESTINATION SELECT</span><strong>{String(selected).padStart(2, "0")}</strong></div>
          <div className="floor-grid" aria-label="Choose a floor">{FLOORS.map((item) => <button key={item.number} className={item.number === selected ? "selected" : ""} aria-label={`Press Floor ${item.number}`} aria-pressed={item.number === selected} onClick={() => choose(item.number)}>{item.number}</button>)}</div>
          <button className="surprise-button" onClick={surprise}><Zap size={13} />SURPRISE ME</button>
          <p className="panel-note">Pick any random floor. Every number hides a different world.</p>
        </div>
      </section>}

      {stage === "ride" && <div className="ride-overlay"><div className="elevator-doors"><i /><i /></div><div className="ride-copy"><p className="eyebrow">THE ELEVATOR IS MOVING</p><span className="floor-readout">{String(selected).padStart(2, "0")}</span><p>{floor.name}</p></div><div className="ride-light" /></div>}

      {stage === "destination" && <section className={`destination-copy scene-copy${isReveal ? " forbidden-copy" : ""}`}>
        <p className="eyebrow"><span /> FLOOR {String(selected).padStart(2, "0")} / {floor.subtitle.toUpperCase()}</p>
        <h1>{isReveal ? <>You Were Not Meant<br /><em>to Find This.</em></> : <>{floor.name}<br /><em>is waiting.</em></>}</h1>
        <p>{isReveal ? "But somehow, you knew where to look." : floor.reaction}</p>
        {isReveal && <figure className="portrait-fallback"><Image src="/raju.png" alt="Portrait of Raju in a gold frame" width={1254} height={1254} sizes="(max-aspect-ratio: 1/1) 58vw, 30vw" /></figure>}
        <button className="return-button" onClick={returnToElevator}><ArrowLeft size={14} />Return to the elevator</button>
      </section>}

      {stage !== "arrival" && stage !== "cabin" && <button className="destination-back" onClick={returnToElevator} aria-label="Return to the elevator"><ArrowLeft size={15} /> PANEL</button>}
      {stage !== "arrival" && <Guide key={`${stage}-${selected}-${guideRefresh}`} stage={stage} status={status} paused={paused} floor={selected} />}
      {soundError && <p className="audio-notice" role="status">Sound is unavailable in this browser.</p>}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      <footer className="footer"><div className="location"><span className="live-dot" />{stage === "destination" ? floor.name.toUpperCase() : "NO ADDRESS. NO EXPLANATION."}</div><div className="floor-progress"><span className={stage === "arrival" ? "active" : ""}>ARRIVAL</span><i /><span className={stage === "cabin" ? "active" : ""}>PANEL</span><i /><span className={stage === "destination" ? "active" : ""}>DESTINATION</span></div><div className="duration">A SHORT ESCAPE<span>{selected}/13 WORLDS OPEN</span></div></footer>
    </main>
  );
}
