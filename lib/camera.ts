import { smooth, type Stage } from "./journey.ts";

type Point = [number, number, number];
export type CameraPose = { position: Point; yaw: number; pitch: number; roll: number; fov: number };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const pointMix = (a: Point, b: Point, t: number): Point => a.map((value, index) => mix(value, b[index], t)) as Point;

/** Acceleration is zero at both ends, so the dolly and the turn settle gently. */
function ease(start: number, end: number, time: number) {
  const t = Math.max(0, Math.min(1, (time - start) / (end - start)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function bezier(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const s = 1 - t;
  return a.map((value, index) => s ** 3 * value + 3 * s * s * t * b[index] + 3 * s * t * t * c[index] + t ** 3 * d[index]) as Point;
}

/** World-space camera choreography, separated so doorway clearance is testable. */
export function cameraPose(stage: Stage, time: number, aspect: number, reduced = false): CameraPose {
  const portrait = aspect <= 1;
  const start: Point = portrait ? [0.24, 1.7, 8.4] : [1.25, 1.72, 6.9];
  const cabin: Point = [portrait ? -0.8 : 0.12, 1.65, -3.55];
  const terrace: Point = [portrait ? 0 : 0.35, 1.85, 8.2];
  const startYaw = Math.atan2((portrait ? 0 : -Math.min(1.6, 0.85 * aspect)) - start[0], start[2]);
  const startPitch = portrait ? 0.06 : 0.004;
  const cabinFov = portrait ? 72 : 62;
  const result: CameraPose = { position: start, yaw: startYaw, pitch: startPitch, roll: 0, fov: portrait ? 57 : 47 };
  if (stage === "arrival") return result;
  if (stage === "entering") {
    const move = reduced ? Number(time >= 4) : ease(0.95, 4.35, time);
    result.position = bezier(start, [0.2, 1.67, 4.4], [0, 1.65, -1.4], cabin, move);
    const turn = reduced ? Number(time >= 4) : ease(4.05, 5.6, time);
    const align = reduced ? move : ease(0.75, 2.7, time);
    result.yaw = mix(startYaw, 0, align) + Math.PI * turn;
    result.pitch = mix(startPitch, 0, move);
    result.fov = mix(result.fov, cabinFov, move);
    return result;
  }
  result.position = cabin;
  result.yaw = Math.PI;
  result.pitch = 0;
  result.fov = cabinFov;
  if (stage === "cabin") return result;
  const exit = stage === "reveal" ? 1 : reduced ? Number(time >= 11.5) : ease(9.1, 12.4, time);
  result.position = pointMix(cabin, terrace, exit);
  result.pitch = mix(0, 0.065, exit);
  result.fov = mix(cabinFov, portrait ? 61 : 56, exit);
  if (stage === "ride" && !reduced) {
    const accelerating = Math.sin(smooth(1.6, 3.3, time) * Math.PI);
    const stopping = Math.sin(smooth(6.5, 7.7, time) * Math.PI);
    const moving = smooth(1.6, 2.5, time) * (1 - smooth(6.8, 7.7, time));
    result.position[1] += -accelerating * 0.045 + stopping * 0.028 + Math.sin(time * 31) * 0.0025 * moving;
    // `|| 0` folds -0 into 0 so the ride hands the reveal an identical pose.
    result.roll = Math.sin(time * 2.3) * 0.0009 * moving || 0;
    result.pitch += Math.sin(time * 1.4) * 0.0015 * moving;
  }
  return result;
}
