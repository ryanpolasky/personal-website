import assert from "node:assert/strict";
import test from "node:test";
import { createRGeometry } from "../components/scenes/WorkFieldGeometry.ts";
import { createWorkFieldLayout, WORK_FIELD_DRIFT } from "../lib/work-field-layout.ts";
import { workMotion } from "../lib/work-motion.ts";
import { projectSequence, trackPosition, activeTrackIndex } from "../lib/project-track.ts";
import { animateProjectNavigation } from "../lib/project-navigation.ts";

test("Explore transitions preserve modified links and respect motion and data preferences", () => {
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  assert.equal(animateProjectNavigation(click, false, false), true);
  assert.equal(animateProjectNavigation(click, true, false), false);
  assert.equal(animateProjectNavigation(click, false, true), false);
  for (const modifier of ["metaKey", "ctrlKey", "shiftKey", "altKey"]) {
    assert.equal(animateProjectNavigation({ ...click, [modifier]: true }, false, false), false);
  }
  for (const button of [1, 2]) assert.equal(animateProjectNavigation({ ...click, button }, false, false), false);
});

test("each direct project route continues through the registry exactly once", () => {
  const projects = ["marralhinha", "autopsy", "ryme-md", "ryplay"].map((id) => ({ id }));
  for (const project of projects) {
    const sequence = projectSequence(projects, project.id);
    assert.equal(sequence[0].id, project.id);
    assert.equal(new Set(sequence.map((item) => item.id)).size, projects.length);
  }
  assert.deepEqual(projectSequence(projects, "missing"), projects);
});

test("native vertical travel maps to bounded horizontal movement and the next project", () => {
  const offsets = [0, 4000, 7600];
  assert.equal(trackPosition(400, 500, 9000), 0);
  assert.equal(trackPosition(2500, 500, 9000), 2000);
  assert.equal(trackPosition(10000, 500, 9000), 9000);
  assert.equal(trackPosition(500, 500, -1), 0);
  assert.equal(activeTrackIndex(offsets, 0, 1440), 0);
  assert.equal(activeTrackIndex(offsets, 3700, 1440), 1);
  assert.equal(activeTrackIndex(offsets, 7600, 390), 2);
  assert.equal(activeTrackIndex(offsets, 2000, 390), 0);
});

test("arrival reveals the featured project without a click or hold", () => {
  assert.equal(workMotion(800, 800).reveal, 0);
  assert.equal(workMotion(520, 800).reveal, 0);
  assert.equal(workMotion(260, 800).reveal, 0.5);
  assert.equal(workMotion(0, 800).reveal, 1);
  assert.equal(workMotion(-800, 800).reveal, 1);
  assert.equal(workMotion(0, 0).reveal, 1);
  for (let top = 800; top > 0; top -= 10) {
    assert.ok(workMotion(top, 800).reveal <= workMotion(top - 10, 800).reveal);
  }
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
