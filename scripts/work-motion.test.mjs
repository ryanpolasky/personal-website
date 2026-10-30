import assert from "node:assert/strict";
import test from "node:test";
import { createRGeometry } from "../components/scenes/WorkFieldGeometry.ts";
import { createWorkFieldLayout, WORK_FIELD_DRIFT } from "../lib/work-field-layout.ts";
import { HOLD_DURATION, REVEAL_DURATION, workMotion } from "../lib/work-motion.ts";

test("uncommitted motion never reveals a project", () => {
  for (const heldFor of [0, HOLD_DURATION / 2, HOLD_DURATION]) {
    assert.equal(workMotion(heldFor, null).reveal, 0);
  }
  assert.equal(workMotion(HOLD_DURATION / 2, null).charge, 0.5);
  assert.equal(workMotion(0, REVEAL_DURATION).reveal, 1);
});

test("mesh bounding spheres remain separate during idle, charge, and burst", () => {
  const geometry = createRGeometry();
  const radius = geometry.boundingSphere.radius;
  geometry.dispose();
  for (const aspect of [320 / 700, 390 / 844, 768 / 1024, 1024 / 768, 1440 / 1000, 1920 / 1080, 3440 / 1440, 3840 / 1080]) {
    const items = createWorkFieldLayout(aspect, radius);
    assert.ok(items.length >= 10);
    for (let time = 0; time <= 100; time += 5) {
      for (const charge of [0, 0.5, 1]) {
        for (const reveal of [0, 0.025, 0.05, 0.1, 0.25, 0.5, 1]) {
          const bounds = items.map((item, index) => {
            const outward = reveal * 32 / Math.hypot(item.x, item.y, item.z);
            const gather = 1 - charge * 0.12;
            return {
              x: item.x * (gather + outward) + Math.sin(time * 0.3 + index) * WORK_FIELD_DRIFT,
              y: item.y * (gather + outward) + Math.cos(time * 0.25 + index * 1.9) * WORK_FIELD_DRIFT,
              z: item.z * (gather + outward),
              radius: radius * item.scale * gather * (1 - reveal * 0.85),
            };
          });
          for (let i = 0; i < bounds.length; i++) {
            for (let j = i + 1; j < bounds.length; j++) {
              const a = bounds[i], b = bounds[j];
              const clearance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) - a.radius - b.radius;
              assert.ok(clearance > 0, `intersection at aspect ${aspect}, time ${time}, charge ${charge}, reveal ${reveal}`);
            }
          }
        }
      }
    }
  }
});

test("ultrawide layouts grow the objects and cover the camera width", () => {
  const standard = createWorkFieldLayout(1440 / 1000, 1.407);
  const wide = createWorkFieldLayout(3440 / 1440, 1.407);
  const mean = (items) => items.reduce((sum, item) => sum + item.scale, 0) / items.length;
  assert.ok(mean(wide) > mean(standard) * 1.2);
  const edges = wide.flatMap((item) => [(item.x - 1.407 * item.scale) * 13 / (13 - item.z), (item.x + 1.407 * item.scale) * 13 / (13 - item.z)]);
  const width = 26 * Math.tan(38 * Math.PI / 360) * 3440 / 1440;
  assert.ok((Math.max(...edges) - Math.min(...edges)) / width > 0.9);
});
