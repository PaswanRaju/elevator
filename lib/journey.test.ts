import { test } from "node:test";
import assert from "node:assert/strict";
import { duration, journeyFrame, rideTimeline, travelTime, type Context } from "./journey.ts";

const ctx = (from: number, to: number, reduced = false): Context => ({ from, to, reduced });

test("calling the car lights the button, chimes, then opens the doors", () => {
  const c = ctx(0, 0);
  assert.equal(journeyFrame("arrival", 0, c).doors, 0);
  assert.equal(journeyFrame("calling", 0.1, c).callLit, true);
  assert.equal(journeyFrame("calling", 1.2, c).doors, 0, "doors stay shut until the car has arrived");
  assert.ok([0.5, 1.2, 1.65].some((t) => journeyFrame("calling", t, c).floor > 0), "indicator counts down to the lobby");
  assert.equal(journeyFrame("calling", duration("calling", c), c).doors, 1);
  assert.equal(journeyFrame("calling", duration("calling", c), c).floor, 0);
});

test("the outside world only changes while the doors are fully closed", () => {
  for (const [from, to] of [[0, 13], [7, 2], [4, 4], [13, 1]]) {
    const c = ctx(from, to);
    const total = duration("ride", c);
    for (let t = 0; t <= total; t += 0.01) {
      const frame = journeyFrame("ride", t, c);
      if (frame.world !== from) assert.ok(frame.world === to);
      const previous = journeyFrame("ride", Math.max(0, t - 0.01), c);
      if (previous.world !== frame.world) assert.equal(frame.doors, 0, `world swapped with doors at ${frame.doors}`);
    }
  }
});

test("the indicator moves monotonically one floor at a time and lands on the destination", () => {
  for (const [from, to] of [[0, 13], [12, 3], [5, 6]]) {
    const c = ctx(from, to);
    let last = from;
    for (let t = 0; t <= duration("ride", c); t += 0.005) {
      const { floor } = journeyFrame("ride", t, c);
      assert.ok(Math.abs(floor - last) <= 1, "no skipped floors");
      assert.ok(to > from ? floor >= last : floor <= last, "never reverses");
      last = floor;
    }
    assert.equal(last, to);
  }
});

test("the car is stationary with doors open or closing, and accelerates smoothly", () => {
  const c = ctx(0, 13);
  const r = rideTimeline(0, 13);
  for (let t = 0; t <= r.total; t += 0.01) {
    const frame = journeyFrame("ride", t, c);
    if (frame.speed > 0.001) assert.equal(frame.doors, 0, "never moves with doors open");
    assert.ok(frame.speed <= 1.0001 && frame.speed >= 0);
  }
  assert.ok(Math.abs(journeyFrame("ride", (r.depart + r.arrive) / 2, c).speed - 1) < 0.01, "reaches cruise speed mid-journey");
  assert.equal(journeyFrame("ride", r.depart, c).speed, 0);
  assert.equal(journeyFrame("ride", r.arrive, c).speed, 0);
  assert.ok(journeyFrame("ride", r.depart + 0.3, c).accel > 0 && journeyFrame("ride", r.arrive - 0.3, c).accel < 0);
});

test("longer trips take longer, and the camera only steps out once the doors are open", () => {
  assert.ok(travelTime(0, 13) > travelTime(0, 2));
  const r = rideTimeline(0, 9);
  for (let t = 0; t <= r.total; t += 0.01) {
    const frame = journeyFrame("ride", t, ctx(0, 9));
    if (frame.exit > 0.05) assert.ok(frame.doors > 0.6, "camera clears the opening leaves");
  }
  assert.equal(journeyFrame("ride", r.total, ctx(0, 9)).exit, 1);
  assert.equal(journeyFrame("ride", r.total, ctx(0, 9)).doors, 1);
});

test("reduced motion shortens every timed stage and removes vibration", () => {
  for (const stage of ["calling", "entering", "ride", "returning"] as const) {
    assert.ok(duration(stage, ctx(0, 13, true)) < duration(stage, ctx(0, 13)));
  }
  const c = ctx(0, 13, true);
  for (let t = 0; t <= duration("ride", c); t += 0.02) {
    const frame = journeyFrame("ride", t, c);
    assert.equal(frame.speed, 0); assert.equal(frame.accel, 0);
  }
  assert.equal(journeyFrame("ride", duration("ride", c), c).floor, 13);
});

test("waiting stages have no timer", () => {
  for (const stage of ["arrival", "open", "cabin", "destination"] as const) assert.equal(duration(stage, ctx(0, 5)), 0);
});
