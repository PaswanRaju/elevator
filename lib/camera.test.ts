import assert from "node:assert/strict";
import test from "node:test";
import { cameraPose } from "./camera.ts";
import { journeyFrame } from "./journey.ts";

for (const aspect of [320 / 568, 390 / 844, 768 / 1024, 1024 / 768, 1440 / 900, 844 / 390]) {
  test(`camera clears the physical doors on entry and exit at aspect ${aspect.toFixed(2)}`, () => {
    for (const stage of ["entering", "ride"] as const) {
      let previous = cameraPose(stage, 0, aspect);
      for (let tick = 1; tick <= (stage === "entering" ? 560 : 1240); tick++) {
        const time = tick / 100;
        const pose = cameraPose(stage, time, aspect);
        const [x, y, z] = pose.position;
        assert.ok(y > 1.5 && y < 2, "camera stays at human eye height");
        assert.ok(Math.hypot(...pose.position.map((value, i) => value - previous.position[i])) < 0.15, "no positional jump");
        if (Math.abs(z) < 0.3) {
          const opening = journeyFrame(stage, time).doors * 1.32;
          assert.ok(Math.abs(x) + 0.2 < opening, "camera plus clearance fits through the open leaves");
        }
        if (stage === "entering" && pose.yaw > 0.3) assert.ok(z < -2, "turn starts inside the cabin");
        previous = pose;
      }
    }
  });
}

test("camera position and lens match at scene boundaries", () => {
  for (const aspect of [0.46, 1, 1.78, 2.16]) {
    assert.deepEqual(cameraPose("entering", 0, aspect), cameraPose("arrival", 0, aspect));
    assert.deepEqual(cameraPose("entering", 5.6, aspect), cameraPose("cabin", 0, aspect));
    assert.deepEqual(cameraPose("ride", 12.4, aspect), cameraPose("reveal", 0, aspect));
  }
});

test("reduced-motion ride has no vibration or turn animation", () => {
  const stationary = cameraPose("ride", 2, 0.46, true);
  assert.deepEqual(stationary, cameraPose("ride", 6, 0.46, true));
  assert.equal(stationary.roll, 0);
  assert.deepEqual(cameraPose("entering", 5.6, 0.46, true), cameraPose("cabin", 0, 0.46, true));
});
