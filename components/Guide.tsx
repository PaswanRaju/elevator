"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
type Mood = "wave" | "point" | "hop" | "shake" | "tilt" | "calm";
type Line = { text: string; mood: Mood; emote?: string; hold: number; next?: Cue };
type Cue = "hello" | "elevator" | "again" | "entering" | "cabin" | "closing" | "moving" | "arrived" | "reveal" | "destination";

// Scene lines fire once per real scene change; `hold` is how long the bubble stays, in seconds.
const LINES: Record<Cue, Line | null> = {
  hello: { text: "Hey! Welcome to my world 👋 Ready for a little adventure?", mood: "wave", hold: 5, next: "elevator" },
  elevator: { text: "See that elevator? Let’s find out where it goes.", mood: "point", emote: "✨", hold: 6 },
  again: { text: "Back for another ride? I like you already.", mood: "hop", emote: "😄", hold: 5 },
  entering: { text: "In we go. Mind the gap!", mood: "hop", hold: 3 },
  cabin: { text: "Thirteen buttons, zero wrong answers. Pick your chaos.", mood: "point", emote: "👉", hold: 8 },
  closing: null,
  moving: { text: "Whoa, we’re moving! Hold on…", mood: "shake", emote: "😮", hold: 6 },
  arrived: { text: "Ding! You’ve arrived. This is the secret part.", mood: "hop", emote: "🔔", hold: 4 },
  reveal: { text: "Welcome to the Forbidden Floor 🎉 That’s me in the gold frame, by the way.", mood: "hop", emote: "💛", hold: 7 },
  destination: { text: "Ding! New world unlocked. Try another floor when you’re ready.", mood: "hop", emote: "✨", hold: 6 },
};
const TAPS: Record<"lobby" | "cabin" | "ride" | "destination", string[]> = {
  lobby: ["Tip: turn the sound on. The elevator hums.", "No rush. The doors will wait for you.", "I promise it’s worth the ride."],
  cabin: ["Yes, there’s only one button. Very exclusive.", "Go on, 13 won’t bite."],
  ride: ["Thirteen is my lucky number.", "Almost there… ears popping yet?"],
  destination: ["Not many people make it up here. Thanks for riding with me.", "Want to go again? The way back is right there.", "Stay a while. Every floor has a secret."],
};

function cueFor(stage: string, status: string): Cue {
  if (stage === "arrival") return "hello";
  if (stage === "entering") return "entering";
  if (stage === "cabin") return "cabin";
  if (stage === "reveal") return "reveal";
  if (stage === "destination") return "destination";
  return status === "Doors closing" ? "closing" : status === "You have arrived" ? "arrived" : "moving";
}
const STORAGE = "elevator-guide-hidden";

/** A small companion that reacts to the journey's actual scene changes. Mounted client-side only. */
const FLOOR_LINES: Record<number, string> = {
  1: "Rain, neon, and absolutely no umbrella. Classic.",
  2: "The jellyfish are glowing. I’m pretending that’s normal.",
  3: "Please keep your snacks secured in zero gravity.",
  4: "The fireflies said you have excellent taste.",
  5: "I left my initials on the high-score table. Maybe.",
  6: "A little quiet never hurt anybody. Except maybe the koi.",
  7: "That book has been waiting longer than either of us.",
  8: "I call dibs on the warmest chair.",
  9: "Gravity called. We sent it to voicemail.",
  10: "Ah. You found the floor I was trying to hide.",
  11: "The sunset is showing off again.",
  12: "The skyline looks tiny from here. Adorable.",
  13: "Reality is buffering. Give it a second.",
};

export default function Guide({ stage, status, paused, floor = 13 }: { stage: string; status: string; paused: boolean; floor?: number }) {
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(STORAGE) !== "1"; } catch { return true; } });
  const [line, setLine] = useState<Line | null>(null);
  const [beat, setBeat] = useState(0);
  const [cue, setCue] = useState<Cue | null>(null);
  const [laps, setLaps] = useState(0);
  const [taps, setTaps] = useState(0);
  const [mood, setMood] = useState<Mood>("calm");
  const current = cueFor(stage, status);

  function say(next: Line | null) {
    setLine(next); setBeat((value) => value + 1);
    if (next) setMood(next.mood);
  }
  // Adjust during render when the scene changes, rather than in an effect.
  if (current !== cue) {
    setCue(current);
    const finished = cue === "reveal" && current === "hello";
    if (finished) setLaps(laps + 1);
    const scripted = current === "hello" && (laps > 0 || finished) ? LINES.again : stage === "destination" ? { text: FLOOR_LINES[floor] ?? LINES.destination!.text, mood: "hop" as Mood, emote: "✨", hold: 6 } : LINES[current];
    if (open) say(scripted);
    setMood(current === "moving" ? "shake" : scripted?.mood ?? "calm");
  }

  // Bubbles retire on their own; a paused journey holds the current line.
  useEffect(() => {
    if (!line || paused) return;
    const timer = setTimeout(() => {
      const next = line.next && open ? LINES[line.next] : null;
      setLine(next); setBeat((value) => value + 1);
      setMood(next ? next.mood : cue === "moving" ? "shake" : "calm");
    }, line.hold * 1000);
    return () => clearTimeout(timer);
  }, [line, beat, paused, open, cue]);

  function tap() {
    const group: keyof typeof TAPS = stage === "arrival" || stage === "entering" ? "lobby" : stage === "reveal" || stage === "destination" ? "destination" : stage === "cabin" ? "cabin" : "ride";
    const options = TAPS[group];
    say({ text: options[taps % options.length], mood: stage === "ride" ? "shake" : "tilt", hold: 5 });
    setTaps(taps + 1);
  }
  function toggle(value: boolean) {
    setOpen(value);
    try { sessionStorage.setItem(STORAGE, value ? "0" : "1"); } catch {}
    if (value) say(LINES[current] && current !== "hello" ? LINES[current] : { text: "I’m back. Tap me any time.", mood: "wave", hold: 4 });
    else setLine(null);
  }

  if (!open) return (
    <aside className="guide is-hidden" aria-label="Guide">
      <button className="guide-reopen" onClick={() => toggle(true)} aria-label="Show your guide">
        <span className="guide-thumb"><Image src="/avatar.jpg" alt="" width={64} height={64} sizes="80px" /></span>GUIDE
      </button>
    </aside>
  );
  return (
    <aside className={`guide mood-${mood}`} aria-label="Guide">
      {line && <div className="guide-bubble" key={beat} role="status" aria-live="polite">
        <span className="guide-name">RKP · YOUR GUIDE</span>
        <p>{line.text}</p>
      </div>}
      <div className="guide-figure">
        <button className="guide-avatar" onClick={tap} aria-label="Talk to your guide">
          <span className="guide-body" key={`${beat}-${mood}`}>
            <span className="guide-float"><Image src="/avatar.jpg" alt="" width={128} height={128} sizes="160px" /></span>
          </span>
          {mood === "wave" && line && <span className="guide-wave" aria-hidden="true">👋</span>}
          {line?.emote && <span className="guide-emote" key={beat} aria-hidden="true">{line.emote}</span>}
        </button>
        <button className="guide-close" onClick={() => toggle(false)} aria-label="Hide your guide"><span><X size={10} strokeWidth={2} /></span></button>
      </div>
    </aside>
  );
}
