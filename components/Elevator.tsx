"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowUpRight, Pause, Play, Shuffle, Volume2, VolumeX, Zap } from "lucide-react";
import { JourneySound } from "@/lib/sound";
import { FLOORS, floorByNumber } from "@/lib/floors";
import { duration, floorLabel, journeyFrame, LOBBY, rideTimeline, type Context, type Frame, type Stage } from "@/lib/journey";
import type { Anchor, ElevatorWorld } from "@/lib/world";

// The guide reads session storage on first render, so it is never server-rendered.
const Guide = dynamic(() => import("@/components/Guide"), { ssr: false });

type Renderer = "loading" | "webgl" | "fallback";
type Clock = { stage: Stage; ctx: Context; elapsed: number };

const NEXT: Partial<Record<Stage, Stage>> = { calling: "open", entering: "cabin", ride: "destination", returning: "cabin" };
const HIT_MIN = 44;

export default function Elevator() {
  const [stage, setStage] = useState<Stage>("arrival");
  const [floor, setFloor] = useState(0);
  const [renderer, setRenderer] = useState<Renderer>("loading");
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(false);
  const [soundError, setSoundError] = useState(false);
  const [count, setCount] = useState(0);
  const [visits, setVisits] = useState(0);
  const [origin, setOrigin] = useState(0);

  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<ElevatorWorld | null>(null);
  const audio = useRef<JourneySound | null>(null);
  const clock = useRef<Clock>({ stage: "arrival", ctx: { from: LOBBY, to: LOBBY, reduced: false }, elapsed: 0 });
  const pausedRef = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });
  const hover = useRef<number | null>(null);
  const pulseAt = useRef<number | null>(null);
  const countRef = useRef(0);
  const callHit = useRef<HTMLButtonElement>(null);
  const floorHits = useRef<(HTMLButtonElement | null)[]>([]);
  const indicator = useRef<HTMLSpanElement>(null);
  const arrow = useRef<HTMLSpanElement>(null);
  const panelLit = useRef<number | null>(null);

  const go = useCallback((next: Stage, ctx?: Partial<Context>) => {
    const c = clock.current;
    c.stage = next; c.elapsed = 0;
    if (ctx) c.ctx = { ...c.ctx, ...ctx };
    setStage(next);
    setFloor(c.ctx.to);
    setOrigin(c.ctx.from);
    if (next === "destination") { pulseAt.current = null; countRef.current = 0; setCount(0); setVisits((v) => v + 1); }
  }, []);

  // Boot the 3D engine; any failure (no WebGL, old GPU, compile error) drops to the 2D view.
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    clock.current.ctx.reduced = reduced;
    let cancelled = false;
    const fallback = () => { if (!cancelled) setRenderer("fallback"); };
    const timer = setTimeout(fallback, 15000);
    (async () => {
      try {
        const probe = document.createElement("canvas");
        if (!probe.getContext("webgl2") && !probe.getContext("webgl")) throw new Error("WebGL unavailable");
        const { createWorld } = await import("@/lib/world");
        if (cancelled || !host.current) return;
        const created = await createWorld(host.current, () => { world.current = null; setRenderer("fallback"); });
        if (cancelled) { created.dispose(); return; }
        clearTimeout(timer);
        world.current = created;
        setRenderer("webgl");
      } catch { clearTimeout(timer); fallback(); }
    })();
    return () => { cancelled = true; clearTimeout(timer); world.current?.dispose(); world.current = null; audio.current?.dispose(); };
  }, []);

  // The single animation loop: advances the journey clock and hands one frame to engine, DOM and sound.
  useEffect(() => {
    let raf = 0, last = performance.now();
    let shownLabel = "", shownDirection = 9;
    const place = (el: HTMLElement | null, a: Anchor, scale = 2.4) => {
      if (!el) return;
      if (a.x < -100) { el.style.visibility = "hidden"; return; }
      const size = Math.max(HIT_MIN, a.r * scale);
      el.style.visibility = "visible";
      el.style.width = el.style.height = `${size}px`;
      el.style.transform = `translate(${a.x - size / 2}px, ${a.y - size / 2}px)`;
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const c = clock.current;
      const dt = pausedRef.current || document.hidden ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      let t = c.elapsed + dt;
      const engine = world.current;
      // Hold the car with its doors shut until the destination world has been built.
      if (c.stage === "ride" && engine && !engine.isReady(c.ctx.to)) t = Math.min(t, rideTimeline(c.ctx.from, c.ctx.to, c.ctx.reduced).closeEnd);
      c.elapsed = t;
      const span = duration(c.stage, c.ctx);
      if (span > 0 && t >= span) {
        const next = NEXT[c.stage]!;
        go(next, c.stage === "ride" ? { from: c.ctx.to } : undefined);
        return;
      }
      if (c.stage === "open" && t > (c.ctx.reduced ? 0.2 : 0.6)) { go("entering"); return; }
      const frame: Frame = journeyFrame(c.stage, t, c.ctx);
      const pulse = pulseAt.current === null ? Infinity : (now - pulseAt.current) / 1000;
      const el = root.current;
      if (el) el.style.setProperty("--doors", frame.doors.toFixed(4));

      const label = floorLabel(frame.floor);
      if (label !== shownLabel && indicator.current) { indicator.current.textContent = label; shownLabel = label; }
      if (frame.direction !== shownDirection && arrow.current) { arrow.current.dataset.direction = String(frame.direction); shownDirection = frame.direction; }
      if (frame.lit !== panelLit.current) {
        panelLit.current = frame.lit;
        document.querySelectorAll<HTMLElement>("[data-floor-button]").forEach((b) => b.toggleAttribute("data-lit", Number(b.dataset.floorButton) === frame.lit));
      }

      if (engine) {
        const anchors = engine.update({ stage: c.stage, time: t, total: now / 1000, frame, ctx: c.ctx, pointer: pointer.current, hover: hover.current, pulse, count: countRef.current });
        place(callHit.current, c.stage === "arrival" ? anchors.call : { x: -999, y: -999, r: 0 }, 5);
        // If the physical buttons would be too small to tap comfortably, the HTML panel takes over.
        const spacing = anchors.buttons.length > 1 ? Math.hypot(anchors.buttons[0].x - anchors.buttons[1].x, anchors.buttons[0].y - anchors.buttons[1].y) : 0;
        const physical = c.stage === "cabin" && spacing >= 40;
        if (el) el.dataset.panel = physical ? "3d" : "html";
        anchors.buttons.forEach((a, i) => place(floorHits.current[i], physical ? a : { x: -999, y: -999, r: 0 }, Math.min(2.6, spacing / Math.max(1, a.r))));
      }
      audio.current?.update(c.stage, frame);
    };
    raf = requestAnimationFrame(loop);
    const move = (event: PointerEvent) => { pointer.current = { x: (event.clientX / innerWidth) * 2 - 1, y: (event.clientY / innerHeight) * 2 - 1 }; };
    const visibility = () => { if (document.hidden) audio.current?.suspend(); else audio.current?.resume(); };
    addEventListener("pointermove", move, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(raf); removeEventListener("pointermove", move); document.removeEventListener("visibilitychange", visibility); };
  }, [go]);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  // Fetch the destination code while the visitor reads the panel.
  useEffect(() => {
    if (stage === "cabin" && renderer === "webgl") void import("@/lib/worlds").then(({ prefetchWorlds }) => prefetchWorlds());
  }, [stage, renderer]);

  const click = () => audio.current?.click();
  function call() {
    if (clock.current.stage !== "arrival" || renderer === "loading") return;
    click(); go("calling", { from: LOBBY, to: LOBBY });
  }
  function choose(number: number) {
    if (clock.current.stage !== "cabin") return;
    click();
    void world.current?.prepare(number).catch(() => setRenderer("fallback"));
    go("ride", { from: clock.current.ctx.from, to: number });
  }
  function surprise() {
    const here = clock.current.ctx.from;
    const options = FLOORS.filter((item) => item.number !== here);
    const entropy = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(entropy); else entropy[0] = Math.floor(Math.random() * 1e9);
    choose(options[entropy[0] % options.length].number);
  }
  function back() {
    if (clock.current.stage !== "destination") return;
    const here = clock.current.ctx.to;
    go("returning", { from: here, to: here });
  }
  function lobby() {
    const s = clock.current.stage;
    if (s === "ride" || s === "calling" || s === "entering" || s === "returning") return;
    go("arrival", { from: LOBBY, to: LOBBY });
  }
  function interact() {
    pulseAt.current = performance.now();
    countRef.current += 1;
    setCount(countRef.current);
  }
  async function toggleSound() {
    try {
      if (!audio.current) audio.current = new JourneySound();
      if (audio.current.enabled) { audio.current.mute(); setSound(false); return; }
      await audio.current.enable(); setSound(true); setSoundError(false);
    } catch { setSoundError(true); }
  }

  const destination = floorByNumber(floor || 1);
  const isReveal = stage === "destination" && floor === 10;
  const busy = stage === "calling" || stage === "open" || stage === "entering" || stage === "ride" || stage === "returning";
  const status = stage === "arrival" ? "A quiet hallway. Call the elevator."
    : stage === "calling" ? "The elevator is on its way down."
    : stage === "open" || stage === "entering" ? "Stepping inside."
    : stage === "cabin" ? "Inside the elevator. Choose a floor from 1 to 13."
    : stage === "ride" ? `Travelling to floor ${floor}.`
    : stage === "destination" ? `Floor ${floor}: ${destination.name}.`
    : "Returning to the elevator.";

  return (
    <main ref={root} className="experience" data-stage={stage} data-renderer={renderer} data-ready={renderer !== "loading"} data-floor={floor} data-panel="html">
      <div ref={host} className="world" aria-hidden="true" />
      {renderer === "fallback" && <FallbackScene stage={stage} floor={floor} />}
      <div className="cinema-shade" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />
      {renderer === "loading" && <div className="loading-veil" role="status"><span className="brand-mark" aria-hidden="true"><i /><i /></span><p>THE ELEVATOR</p><small>Polishing the brass…</small></div>}

      <header className="topbar">
        <button className="wordmark" onClick={lobby} aria-label="The Elevator — back to the lobby"><span className="brand-mark" aria-hidden="true"><i /><i /></span>THE ELEVATOR<span className="brand-edition">THIRTEEN FLOORS · THIRTEEN WORLDS</span></button>
        <div className="top-controls">
          <button className="icon-button pause-button" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Resume" : "Pause"} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
          <button className="sound-button" onClick={toggleSound} aria-label={sound ? "Mute sound" : "Turn sound on"} aria-pressed={sound}>{sound ? <Volume2 size={15} /> : <VolumeX size={15} />}<span>SOUND {sound ? "ON" : "OFF"}</span></button>
        </div>
      </header>

      {/* Lift indicator: what the car's own display shows, mirrored for small screens. */}
      <div className="hud" data-visible={stage !== "arrival" && stage !== "destination"} aria-hidden="true">
        <span ref={arrow} className="hud-arrow" data-direction="0" /><span ref={indicator} className="hud-floor">G</span>
      </div>

      <section className="scene-copy arrival-copy" data-visible={stage === "arrival"} aria-hidden={stage !== "arrival"}>
        <p className="eyebrow"><span /> SOMEWHERE, AFTER HOURS</p>
        <h1>Some doors lead<br /><em>somewhere else.</em></h1>
        <p className="intro">Thirteen floors. Thirteen hidden worlds. One elevator.</p>
        <button className="enter-button" onClick={call} disabled={renderer === "loading" || stage !== "arrival"}>
          <span className="call-orb" aria-hidden="true"><ArrowUpRight size={18} strokeWidth={1.4} /></span>
          <span>Call the elevator<small>OR PRESS THE ▲ BESIDE THE DOORS</small></span>
        </button>
      </section>
      <button ref={callHit} className="hit hit-call" onClick={call} aria-label="Call button beside the elevator doors" tabIndex={stage === "arrival" ? 0 : -1} onPointerEnter={() => { hover.current = 0; }} onPointerLeave={() => { hover.current = null; }} />

      <section className="scene-copy cabin-copy" data-visible={stage === "cabin"} aria-hidden={stage !== "cabin"}>
        <p className="eyebrow"><span /> THE PANEL</p>
        <h2>Pick a random floor.</h2>
        <p>Every number hides a different world.</p>
      </section>
      <div className="cabin-actions" data-visible={stage === "cabin"}>
        <button className="surprise-button" onClick={surprise} tabIndex={stage === "cabin" ? 0 : -1}><Shuffle size={14} />SURPRISE ME</button>
      </div>
      <nav className="floor-hits" aria-label="Elevator floor buttons" data-visible={stage === "cabin"}>
        {FLOORS.map((item, i) => (
          <button key={item.number} ref={(el) => { floorHits.current[i] = el; }} className="hit floor-control" data-floor-button={item.number} onClick={() => choose(item.number)} aria-label={`Floor ${item.number}`} tabIndex={stage === "cabin" ? 0 : -1}
            onPointerEnter={() => { hover.current = item.number; }} onPointerLeave={() => { hover.current = null; }} onFocus={() => { hover.current = item.number; }} onBlur={() => { hover.current = null; }} />
        ))}
      </nav>
      <div className="html-panel" data-visible={stage === "cabin" || stage === "ride"} aria-hidden={stage !== "cabin"}>
        <div className="html-panel-plate">
          <div className="html-panel-display"><span>{stage === "ride" ? String(floor).padStart(2, "0") : "--"}</span></div>
          <div className="html-panel-grid">
            {[...FLOORS].reverse().map((item) => (
              <button key={item.number} className="panel-button" data-floor-button={item.number} onClick={() => choose(item.number)} disabled={stage !== "cabin"} tabIndex={stage === "cabin" ? 0 : -1} aria-label={`Floor ${item.number}`}><span>{item.number}</span></button>
            ))}
          </div>
        </div>
      </div>

      <div className="ride-copy" data-visible={stage === "ride"} aria-hidden="true">
        <p className="eyebrow">{origin === floor ? "SAME FLOOR, NEW EYES" : "THE ELEVATOR IS MOVING"}</p>
        <p className="ride-target">Floor {String(floor).padStart(2, "0")}</p>
      </div>

      {stage === "destination" && (
        <section className={`scene-copy destination-copy${isReveal ? " reveal-copy" : ""}`} data-visible key={`${floor}-${visits}`}>
          <p className="eyebrow"><span /> FLOOR {String(floor).padStart(2, "0")} · {destination.subtitle.toUpperCase()}</p>
          {isReveal ? <h1>You Were Not Meant{" "}<br /><em>to Find This.</em></h1> : <h1>{destination.name}</h1>}
          <p>{isReveal ? "But somehow, you knew where to look." : destination.reaction}</p>
          <div className="destination-actions">
            <button className="interact-button" onClick={interact}><Zap size={14} />{destination.interaction}{count > 0 && <b>×{count}</b>}</button>
            <button className="return-button" onClick={back}><ArrowLeft size={14} />Back to the elevator</button>
          </div>
        </section>
      )}
      {isReveal && (
        <figure className={`portrait${count > 0 ? " is-close" : ""}`} key={`portrait-${visits}`}>
          <div className="portrait-frame">
            <Image src="/raju.png" alt="Portrait of Raju" width={1254} height={1254} sizes="(max-aspect-ratio: 4/5) 62vw, 30vw" priority />
            <span className="portrait-sheen" aria-hidden="true" />
          </div>
          <figcaption>RAJU KUMAR PASWAN</figcaption>
        </figure>
      )}

      <Guide stage={stage} floor={floor} paused={paused} visits={visits} busy={busy} />
      {soundError && <p className="audio-notice" role="status">Sound is unavailable in this browser.</p>}
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
    </main>
  );
}

/** The 2D compatibility view: same journey, drawn with CSS when WebGL is unavailable or lost. */
function FallbackScene({ stage, floor }: { stage: Stage; floor: number }) {
  const outside = stage === "destination" || stage === "returning" || (stage === "cabin" && floor > 0);
  const palette = floorByNumber(floor || 1).palette;
  return (
    <div className={`fallback-world${outside ? ` fallback-${palette}` : ""}`} data-inside={stage !== "arrival" && stage !== "calling"} aria-hidden="true">
      <div className="fallback-hall"><div className="fallback-wall wall-left" /><div className="fallback-wall wall-right" /><div className="fallback-floor" /></div>
      <div className="fallback-destination" />
      <div className="fallback-doorway"><div className="fallback-leaf leaf-left" /><div className="fallback-leaf leaf-right" /></div>
    </div>
  );
}
