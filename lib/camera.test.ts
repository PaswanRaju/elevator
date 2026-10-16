import assert from "node:assert/strict";
import test from "node:test";
import { cameraPose } from "./camera.ts";
import { duration, journeyFrame, type Context, type Stage } from "./journey.ts";

const aspects = [320 / 568, 390 / 844, 768 / 1024, 1024 / 768, 1440 / 900, 844 / 390];
const DOOR_TRAVEL = 1.32;
const ctx = (from: number, to: number, reduced = false): Context => ({ from, to, reduced });

for (const aspect of aspects) {
  test(`camera stays at eye height, moves continuously and clears the doors at aspect ${aspect.toFixed(2)}`, () => {
    for (const [stage, c] of [["entering", ctx(0, 0)], ["ride", ctx(0, 13)], ["ride", ctx(9, 2)], ["returning", ctx(4, 4)]] as [Stage, Context][]) {
      const end = duration(stage, c);
      let previous = cameraPose(stage, 0, aspect, c);
      for (let time = 0.01; time <= end; time += 0.01) {
        const pose = cameraPose(stage, time, aspect, c);
        const [x, y, z] = pose.position;
        assert.ok(y > 1.3 && y < 1.9, `eye height at ${stage} ${time}`);
        assert.ok(Math.hypot(...pose.position.map((value, i) => value - previous.position[i])) < 0.1, `no positional jump in ${stage} at ${time}`);
        assert.ok(Math.abs(pose.yaw - previous.yaw) < 0.08, `no snap turn in ${stage} at ${time}`);
        if (Math.abs(z) < 0.3) {
          const opening = (stage === "ride" ? journeyFrame("ride", time, c).doors : 1) * DOOR_TRAVEL;
          assert.ok(Math.abs(x) + 0.2 < opening, `camera fits through the leaves in ${stage} at ${time}`);
        }
        if (z < 0) assert.ok(Math.abs(x) < 1.9 && z > -4.1, "camera stays inside the car");
        previous = pose;
      }
    }
  });
}

test("camera pose and lens match at every stage boundary", () => {
  for (const aspect of [0.46, 0.75, 1, 1.78, 2.16]) {
    const lobby = ctx(0, 0), trip = ctx(0, 7), back = ctx(7, 7);
    assert.deepEqual(cameraPose("calling", 0, aspect, lobby), cameraPose("arrival", 0, aspect, lobby));
    assert.deepEqual(cameraPose("entering", 0, aspect, lobby), cameraPose("calling", duration("calling", lobby), aspect, lobby));
    assert.deepEqual(cameraPose("entering", duration("entering", lobby), aspect, lobby), cameraPose("cabin", 0, aspect, lobby));
    assert.deepEqual(cameraPose("ride", 0, aspect, trip), cameraPose("cabin", 0, aspect, trip));
    assert.deepEqual(cameraPose("ride", duration("ride", trip), aspect, trip), cameraPose("destination", 0, aspect, trip));
    assert.deepEqual(cameraPose("returning", 0, aspect, back), cameraPose("destination", 0, aspect, back));
    assert.deepEqual(cameraPose("returning", duration("returning", back), aspect, back), cameraPose("cabin", 0, aspect, back));
  }
});

test("reduced motion uses stationary viewpoints with no vibration", () => {
  const c = ctx(0, 13, true);
  const poses = new Set<string>();
  for (let time = 0; time <= duration("ride", c); time += 0.05) {
    const pose = cameraPose("ride", time, 0.46, c);
    assert.equal(pose.roll, 0);
    poses.add(JSON.stringify(pose));
  }
  assert.ok(poses.size <= 3, "only cuts between fixed viewpoints");
});
