import { journeyFrame, rideTimeline, smoother, duration, type Context, type Stage } from "./journey.ts";

type Point = [number, number, number];
export type CameraPose = { position: Point; yaw: number; pitch: number; roll: number; fov: number };
// Exact at both ends, so stage handoffs are bit-identical.
const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const pointMix = (a: Point, b: Point, t: number): Point => a.map((value, index) => mix(value, b[index], t)) as Point;
function bezier(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const s = 1 - t;
  return a.map((value, index) => s ** 3 * value + 3 * s * s * t * b[index] + 3 * s * t * t * c[index] + t ** 3 * d[index]) as Point;
}
/** yaw 0 looks down -z (at the doors from the hallway); -π looks down +z (out of the car). */
function aimAt(position: Point, target: Point) {
  const dx = target[0] - position[0], dy = target[1] - position[1], dz = target[2] - position[2];
  let yaw = Math.atan2(dx, -dz);
  if (yaw > 0) yaw -= Math.PI * 2;
  return { yaw, pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** Where the camera stands in the hallway, framing the doors beside the copy. */
export function hallPose(aspect: number): CameraPose {
  const portrait = aspect <= 1;
  const position: Point = portrait ? [0.3, 1.7, 8.6] : [1.25, 1.72, 6.9];
  const yaw = Math.atan2((portrait ? 0.35 : -Math.min(1.6, 0.85 * aspect)) - position[0], position[2]);
  return { position, yaw, pitch: portrait ? 0.07 : 0.004, roll: 0, fov: portrait ? 58 : 47 };
}
/** Close, square-on framing of the floor panel so every button is comfortably tappable. */
export function panelPose(aspect: number): CameraPose {
  const portrait = aspect <= 1;
  const squat = portrait && aspect > 0.6;
  // Portrait screens stand far enough back that all thirteen buttons fit between the copy and SURPRISE ME.
  const position: Point = portrait ? [-1.6, 1.4, squat ? -1.82 : -2.02] : [-0.86, 1.5, -1.62];
  const target: Point = portrait ? [-1.65, 1.31, -0.24] : [-1.27, 1.36, -0.24];
  return { position, ...aimAt(position, target), roll: 0, fov: portrait ? 56 : 50 };
}
/** Standing in the middle of the car, facing the doors and the lintel indicator. */
export function centerPose(aspect: number): CameraPose {
  const portrait = aspect <= 1;
  return { position: [0, 1.62, portrait ? -3.05 : -2.75], yaw: -Math.PI, pitch: portrait ? 0.035 : 0.02, roll: 0, fov: portrait ? 74 : 58 };
}
/** A few steps out of the car into the destination. */
export function outsidePose(aspect: number): CameraPose {
  const portrait = aspect <= 1;
  return { position: [0, 1.65, 3.1], yaw: -Math.PI, pitch: 0.025, roll: 0, fov: portrait ? 66 : 54 };
}

function blend(a: CameraPose, b: CameraPose, t: number, position?: Point): CameraPose {
  return { position: position ?? pointMix(a.position, b.position, t), yaw: mix(a.yaw, b.yaw, t), pitch: mix(a.pitch, b.pitch, t), roll: 0, fov: mix(a.fov, b.fov, t) };
}

/** World-space camera choreography, separated so doorway clearance is testable. */
export function cameraPose(stage: Stage, time: number, aspect: number, ctx: Context): CameraPose {
  const { reduced } = ctx;
  const hall = hallPose(aspect), panel = panelPose(aspect), center = centerPose(aspect), outside = outsidePose(aspect);
  switch (stage) {
    case "arrival":
    case "open":
      return hall;
    case "calling": {
      // A small, involuntary step toward the doors as they open.
      const lean = reduced ? 0 : smoother(1.9, 3.9, time) * 0.35;
      return { ...hall, position: [hall.position[0] - lean * 0.15, hall.position[1], hall.position[2] - lean] };
    }
    case "entering": {
      const end = duration("entering", ctx);
      if (reduced) return time < end * 0.5 ? callingEnd(hall, reduced) : panel;
      const start = callingEnd(hall, reduced);
      const move = smoother(0.5, 4.5, time);
      const position = bezier(start.position, [0.18, 1.66, 4.2], [0.05, 1.62, -1.75], panel.position, move);
      const align = smoother(0.3, 2.4, time);
      const turn = smoother(2.9, 4.8, time);
      return {
        position,
        yaw: mix(mix(start.yaw, 0, align), panel.yaw, turn),
        pitch: mix(mix(start.pitch, 0, align), panel.pitch, turn),
        roll: 0,
        fov: mix(start.fov, panel.fov, smoother(0.5, 4.8, time)),
      };
    }
    case "cabin":
      return panel;
    case "destination":
      return outside;
    case "returning": {
      if (reduced) return time < duration("returning", ctx) * 0.5 ? outside : panel;
      const t = smoother(0, duration("returning", ctx), time);
      const position = bezier(outside.position, [0, 1.64, 1.1], [-0.35, 1.6, -1.35], panel.position, t);
      const turn = smoother(0.35, 1, t);
      return blend(outside, panel, turn, position);
    }
    case "ride": {
      const r = rideTimeline(ctx.from, ctx.to, reduced);
      const frame = journeyFrame("ride", time, ctx);
      if (reduced) return frame.exit >= 0.5 ? outside : time < r.closeStart ? panel : center;
      const settle = smoother(0.15, 1.9, time);
      let pose = blend(panel, center, settle);
      if (frame.exit > 0) {
        const position = bezier(center.position, [0, 1.63, -1.1], [0, 1.65, 1.2], outside.position, frame.exit);
        pose = blend(center, outside, frame.exit, position);
      }
      // Departure sags the body slightly, arrival lifts it; the cab hums while moving.
      pose.position[1] += -frame.accel * 0.028 + Math.sin(time * 37) * 0.0022 * frame.speed + Math.sin(time * 23.3) * 0.0012 * frame.speed;
      pose.position[0] += Math.sin(time * 17.1) * 0.0012 * frame.speed;
      // `|| 0` folds -0 into 0 so the ride hands the destination an identical pose.
      pose.roll = Math.sin(time * 2.3) * 0.0011 * frame.speed || 0;
      pose.pitch += Math.sin(time * 1.6) * 0.0016 * frame.speed - frame.accel * 0.002;
      return pose;
    }
  }
}
function callingEnd(hall: CameraPose, reduced: boolean): CameraPose {
  const lean = reduced ? 0 : 0.35;
  return { ...hall, position: [hall.position[0] - lean * 0.15, hall.position[1], hall.position[2] - lean] };
}
