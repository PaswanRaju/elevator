"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { Stage } from "@/lib/journey";

type Mood = "wave" | "point" | "hop" | "shake" | "tilt" | "calm";
type Line = { text: string; mood: Mood; emote?: string; hold: number; next?: Line };

const ELEVATOR: Line = { text: "See that call button by the doors? Give it a press.", mood: "point", emote: "✨", hold: 6 };
const LINES: Partial<Record<Stage, Line>> = {
  arrival: { text: "Hey! Welcome to my world 👋 Ready for a little adventure?", mood: "wave", hold: 5, next: ELEVATOR },
  calling: { text: "Ooh, it’s coming down. Hear that hum?", mood: "tilt", hold: 4 },
  entering: { text: "In we go. Mind the gap!", mood: "hop", hold: 3 },
  cabin: { text: "Thirteen buttons, zero wrong answers. Pick your chaos.", mood: "point", emote: "👉", hold: 7 },
  ride: { text: "Whoa, we’re moving! Hold on…", mood: "shake", emote: "😮", hold: 4 },
  returning: { text: "Back inside. Where to next?", mood: "hop", hold: 3 },
};
const AGAIN: Line = { text: "Back for another ride? I like you already.", mood: "hop", emote: "😄", hold: 5 };

/** A different reaction for every world. */
const FLOOR_LINES: Record<number, string> = {
  1: "Rain, neon, and absolutely no umbrella. Classic.",
  2: "The jellyfish are glowing. I’m pretending that’s normal.",
  3: "Please keep your snacks secured in zero gravity.",
  4: "The fireflies said you have excellent taste.",
  5: "I left my initials on the high-score table. Maybe.",
  6: "A little quiet never hurt anybody. Except maybe the koi.",
  7: "That book has been waiting longer than either of us.",
  8: "I call dibs on the warmest chair in that cabin.",
  9: "Gravity called. We sent it to voicemail.",
  10: "Ah. You found the floor I was trying to hide. Yes, that’s me. 💛",
  11: "The sunset is showing off again.",
  12: "The skyline looks tiny from here. Adorable.",
  13: "Reality is buffering. Give it a second.",
};
const TAPS: Record<"lobby" | "cabin" | "ride" | "destination", string[]> = {
  lobby: ["Tip: turn the sound on. The elevator hums.", "No rush. The doors will wait for you.", "I promise it’s worth the ride."],
  cabin: ["Can’t decide? SURPRISE ME is very brave.", "Go on, 13 won’t bite.", "Every number is a different world. Every single one."],
  ride: ["Thirteen is my lucky number.", "Almost there… ears popping yet?"],
  destination: ["Try the button on the left. Something happens.", "Want to go again? The way back is right there.", "Stay a while. Every floor has a secret."],
};
const STORAGE = "elevator-guide-hidden";

/** Client-only (loaded without SSR). A small companion that reacts to the journey's real scene changes and to each floor. */
export default function Guide({ stage, floor, paused, visits, busy }: { stage: Stage; floor: number; paused: boolean; visits: number; busy: boolean }) {
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(STORAGE) !== "1"; } catch { return true; } });
  const [line, setLine] = useState<Line | null>(null);
  const [beat, setBeat] = useState(0);
  const [cue, setCue] = useState<string | null>(null);
  const [taps, setTaps] = useState(0);
  const [mood, setMood] = useState<Mood>("calm");
  const [source, setSource] = useState<"scene" | "tap">("scene");

  function say(next: Line | null, from: "scene" | "tap" = "scene") {
    setLine(next); setBeat((value) => value + 1); setSource(from);
    if (next) setMood(next.mood);
  }
  // React to a scene change during render, rather than in an effect.
  const current = stage === "destination" ? `destination-${floor}-${visits}` : stage === "open" ? "entering" : stage;
  if (current !== cue) {
    setCue(current);
    const scripted = stage === "destination" ? { text: FLOOR_LINES[floor], mood: floor === 10 ? "wave" as Mood : "hop" as Mood, emote: floor === 10 ? "💛" : "✨", hold: 7 }
      : stage === "arrival" && visits > 0 ? AGAIN : LINES[stage === "open" ? "entering" : stage] ?? null;
    if (open && scripted) say(scripted);
    setMood(stage === "ride" ? "shake" : scripted?.mood ?? "calm");
  }

  // Bubbles retire on their own; a paused journey holds the current line.
  useEffect(() => {
    if (!line || paused) return;
    const timer = setTimeout(() => {
      const next = line.next && open ? line.next : null;
      setLine(next); setBeat((value) => value + 1);
      setMood(next ? next.mood : stage === "ride" ? "shake" : "calm");
    }, line.hold * 1000);
    return () => clearTimeout(timer);
  }, [line, beat, paused, open, stage]);

  function tap() {
    const group: keyof typeof TAPS = stage === "arrival" || stage === "calling" || stage === "open" || stage === "entering" ? "lobby" : stage === "destination" ? "destination" : stage === "cabin" ? "cabin" : "ride";
    const options = TAPS[group];
    say({ text: options[taps % options.length], mood: stage === "ride" ? "shake" : "tilt", hold: 5 }, "tap");
    setTaps(taps + 1);
  }
  function toggle(value: boolean) {
    setOpen(value);
    try { sessionStorage.setItem(STORAGE, value ? "0" : "1"); } catch {}
    if (value) say({ text: "I’m back. Tap me any time.", mood: "wave", hold: 4 }, "tap");
    else setLine(null);
  }

  if (!open) return (
    <aside className="guide is-hidden" data-stage={stage} aria-label="Guide">
      <button className="guide-reopen" onClick={() => toggle(true)} aria-label="Show your guide">
        <span className="guide-thumb"><Image src="/avatar.jpg" alt="" width={64} height={64} sizes="64px" /></span>GUIDE
      </button>
    </aside>
  );
  return (
    <aside className={`guide mood-${mood}`} data-stage={stage} data-floor={floor} data-source={source} data-busy={busy} aria-label="Guide">
      {line && <div className="guide-bubble" key={beat} role="status" aria-live="polite">
        <span className="guide-name">RKP · YOUR GUIDE</span>
        <p>{line.text}</p>
      </div>}
      <div className="guide-figure">
        <button className="guide-avatar" onClick={tap} aria-label="Talk to your guide">
          <span className="guide-body" key={`${beat}-${mood}`}>
            <span className="guide-float"><Image src="/avatar.jpg" alt="" width={128} height={128} sizes="128px" /></span>
          </span>
          {mood === "wave" && line && <span className="guide-wave" aria-hidden="true">👋</span>}
          {line?.emote && <span className="guide-emote" key={beat} aria-hidden="true">{line.emote}</span>}
        </button>
        <button className="guide-close" onClick={() => toggle(false)} aria-label="Hide your guide"><span><X size={10} strokeWidth={2} /></span></button>
      </div>
    </aside>
  );
}
