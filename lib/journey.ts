/**
 * The journey timeline. Pure functions, so camera, doors, display and sound all
 * read the same physically coherent state and the sequencing is unit-testable.
 *
 * arrival ─call→ calling ─(timed)→ open ─step in→ entering ─(timed)→ cabin
 * cabin ─floor→ ride ─(timed)→ destination ─return→ returning ─(timed)→ cabin
 */
export type Stage = "arrival" | "calling" | "open" | "entering" | "cabin" | "ride" | "destination" | "returning";
export type Context = { from: number; to: number; reduced: boolean };

export const LOBBY = 0;
export const TOP_FLOOR = 13;

export function smooth(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** Quintic ease: zero velocity and acceleration at both ends, like a real drive profile. */
export function smoother(a: number, b: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Seconds the car spends moving between two floors. */
export function travelTime(from: number, to: number, reduced = false) {
  const floors = Math.abs(to - from);
  if (reduced) return floors ? 1.2 : 0.4;
  return floors ? 1.7 + floors * 0.24 : 0.6;
}

/** Key moments of a ride, in seconds from the button press. */
export function rideTimeline(from: number, to: number, reduced = false) {
  if (reduced) {
    const depart = 1.1, arrive = depart + travelTime(from, to, true);
    return { closeStart: 0.2, closeEnd: 1, depart, arrive, openStart: arrive + 0.3, openEnd: arrive + 1.3, exitStart: arrive + 1.3, exitEnd: arrive + 1.7, total: arrive + 1.8 };
  }
  const depart = 2.8, arrive = depart + travelTime(from, to);
  return { closeStart: 0.9, closeEnd: 2.6, depart, arrive, openStart: arrive + 0.75, openEnd: arrive + 2.75, exitStart: arrive + 1.45, exitEnd: arrive + 4.45, total: arrive + 4.6 };
}

export function duration(stage: Stage, { from, to, reduced }: Context) {
  if (stage === "calling") return reduced ? 1.6 : 3.9;
  if (stage === "entering") return reduced ? 1.2 : 4.8;
  if (stage === "returning") return reduced ? 0.9 : 3;
  if (stage === "ride") return rideTimeline(from, to, reduced).total;
  return 0; // Waiting stages last until the visitor acts.
}

export type Frame = {
  /** 0 = closed, 1 = fully open. */
  doors: number;
  /** Floor shown on the indicators (0 = lobby, shown as G). */
  floor: number;
  direction: -1 | 0 | 1;
  /** Car speed as a fraction of cruise speed, for vibration, sound and passing lights. */
  speed: number;
  /** Vertical acceleration, signed: brief sag on departure, lift on arrival. */
  accel: number;
  /** Which world is outside the doors: 0 is the lobby hallway. */
  world: number;
  callLit: boolean;
  /** Selected floor button glows from press until the car arrives. */
  lit: number | null;
  /** Fraction of the way the camera has stepped out of the car. */
  exit: number;
  /** True for the instant around arrival when the chime should sound. */
  arrived: boolean;
};

export function journeyFrame(stage: Stage, t: number, ctx: Context): Frame {
  const { from, to, reduced } = ctx;
  const base: Frame = { doors: 0, floor: from, direction: 0, speed: 0, accel: 0, world: from, callLit: false, lit: null, exit: 0, arrived: false };
  switch (stage) {
    case "arrival":
      return { ...base, floor: LOBBY, world: LOBBY };
    case "calling": {
      // The car descends to the lobby, chimes, then the doors part.
      const count = reduced ? 0 : 3 - Math.floor(smoother(0.15, 1.5, t) * 3);
      return { ...base, floor: count, world: LOBBY, callLit: t < (reduced ? 0.6 : 1.9), doors: smoother(reduced ? 0.6 : 1.9, reduced ? 1.6 : 3.9, t), arrived: !reduced && t >= 1.6 && t < 1.75 };
    }
    case "open":
    case "entering":
      return { ...base, floor: LOBBY, world: LOBBY, doors: 1 };
    case "cabin":
      return { ...base, doors: 1 };
    case "destination":
      return { ...base, doors: 1, exit: 1 };
    case "returning":
      return { ...base, doors: 1, exit: 1 - smoother(0, duration("returning", ctx), t) };
    case "ride": {
      const r = rideTimeline(from, to, reduced);
      const progress = smoother(r.depart, r.arrive, t);
      const span = r.arrive - r.depart;
      // Derivatives of the quintic profile, normalised so cruise speed is 1.
      const u = Math.max(0, Math.min(1, (t - r.depart) / span));
      const speed = from === to ? 0 : (30 * u * u * (1 - u) * (1 - u)) / 1.875;
      const accel = from === to ? 0 : (60 * u * (1 - u) * (1 - 2 * u)) / 5.77;
      const position = from + (to - from) * progress;
      return {
        doors: t < r.openStart ? 1 - smoother(r.closeStart, r.closeEnd, t) : smoother(r.openStart, r.openEnd, t),
        floor: Math.round(position),
        direction: t >= r.depart && t < r.arrive ? (to > from ? 1 : to < from ? -1 : 0) : 0,
        speed: reduced ? 0 : speed,
        accel: reduced ? 0 : accel,
        // The outside world only changes while the doors are fully shut.
        world: t >= r.closeEnd ? to : from,
        callLit: false,
        lit: t < r.arrive + 0.4 ? to : null,
        exit: smoother(r.exitStart, r.exitEnd, t),
        arrived: t >= r.arrive && t < r.arrive + 0.15,
      };
    }
  }
}

export function floorLabel(floor: number) {
  return floor <= LOBBY ? "G" : String(floor).padStart(2, "0");
}
