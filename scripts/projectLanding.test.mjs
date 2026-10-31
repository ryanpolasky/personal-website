import test from "node:test";
import assert from "node:assert/strict";
import { observeProjectLanding, PROJECT_SCROLL_IDLE } from "../lib/projectLanding.ts";

function setup(t, coarse = false) {
  const browser = new EventTarget();
  const page = new EventTarget();
  const timers = new Map();
  const calls = { land: 0, browse: 0, move: 0, leave: 0, snap: [] };
  let now = 0;
  let nextTimer = 0;
  let entered = false;
  Object.assign(browser, {
    innerHeight: 800,
    scrollY: 0,
    matchMedia: () => ({ matches: coarse }),
    setTimeout: (callback, delay) => {
      timers.set(++nextTimer, { callback, at: now + delay });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
    scrollTo: (options) => calls.snap.push(options),
  });
  page.visibilityState = "visible";
  const originals = new Map();
  for (const [name, value] of [["window", browser], ["document", page]]) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true });
  }
  const stop = observeProjectLanding({
    getBoundingClientRect: () => ({ top: 1600 - browser.scrollY, bottom: 2600 - browser.scrollY }),
  }, {
    onLand: () => { calls.land++; entered = true; },
    onBrowse: () => { calls.browse++; entered = true; },
    onMove: () => { calls.move++; },
    onLeaveAbove: () => { calls.leave++; entered = false; },
    canSnap: () => !entered,
  });
  t.after(() => {
    stop();
    for (const [name, original] of originals) {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    }
  });
  return {
    browser, page, calls, stop,
    event: (name, properties = {}) => browser.dispatchEvent(Object.assign(new Event(name), properties)),
    scroll: (y) => {
      browser.scrollY = y;
      browser.dispatchEvent(new Event("scroll"));
    },
    wait: (ms = PROJECT_SCROLL_IDLE) => {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(id);
          timer.callback();
        }
      }
    },
  };
}

test("desktop waits for the last rendered scroll, not just wheel release", (t) => {
  const s = setup(t);
  s.scroll(1500);
  for (const y of [1530, 1560, 1590, 1600]) {
    s.wait(PROJECT_SCROLL_IDLE - 1);
    assert.equal(s.calls.land, 0);
    s.scroll(y);
  }
  s.wait();
  assert.equal(s.calls.land, 1);
  assert.deepEqual(s.calls.snap, []);
  s.event("wheel");
  assert.ok(s.calls.move > 0);
  s.wait(PROJECT_SCROLL_IDLE - 1);
  assert.equal(s.calls.land, 1);
  s.wait(1);
  assert.equal(s.calls.land, 2);
});

test("passing through or stopping before Projects does not play the entrance", (t) => {
  const s = setup(t);
  s.scroll(1200);
  s.wait();
  assert.equal(s.calls.land, 0);
  for (const y of [1500, 1800, 2200, 2700]) {
    s.scroll(y);
    s.wait(PROJECT_SCROLL_IDLE - 1);
  }
  s.wait();
  assert.equal(s.calls.land, 0);
});

test("touch landing waits for release and momentum, snaps, then starts at rest", (t) => {
  const s = setup(t, true);
  s.event("touchstart");
  s.scroll(1450);
  s.wait(1000);
  assert.equal(s.calls.land, 0);
  assert.deepEqual(s.calls.snap, []);
  s.event("touchend", { touches: [] });
  s.wait(PROJECT_SCROLL_IDLE - 1);
  s.scroll(1480);
  s.wait(PROJECT_SCROLL_IDLE - 1);
  assert.deepEqual(s.calls.snap, []);
  s.wait(1);
  assert.deepEqual(s.calls.snap, [{ top: 1600, behavior: "smooth" }]);
  assert.equal(s.calls.land, 0);
  s.wait();
  assert.equal(s.calls.land, 0);
  s.scroll(1550);
  s.wait(PROJECT_SCROLL_IDLE - 1);
  s.scroll(1600);
  s.wait();
  assert.equal(s.calls.land, 1);
  s.scroll(1740);
  s.wait();
  assert.equal(s.calls.snap.length, 1);
});

test("small touch overshoots land at the section start too", (t) => {
  const s = setup(t, true);
  s.scroll(1720);
  s.wait();
  assert.deepEqual(s.calls.snap, [{ top: 1600, behavior: "smooth" }]);
  assert.equal(s.calls.land, 0);
});

test("touch proximity does not pull back a scroll outside its range", (t) => {
  const s = setup(t, true);
  s.scroll(1290);
  s.wait();
  assert.deepEqual(s.calls.snap, []);
  s.scroll(1950);
  s.wait();
  assert.deepEqual(s.calls.snap, []);
  assert.equal(s.calls.land, 1);
});

test("upward exit reverses immediately without snapping back; re-entry can land", (t) => {
  const s = setup(t, true);
  s.scroll(1600);
  s.wait();
  s.scroll(1330);
  assert.equal(s.calls.leave, 1);
  s.wait();
  assert.deepEqual(s.calls.snap, []);
  s.scroll(1410);
  s.wait();
  assert.deepEqual(s.calls.snap, [{ top: 1600, behavior: "smooth" }]);
});

for (const coarse of [false, true]) {
  test(`a fast pass into the visible tail exposes content without an entrance (${coarse ? "touch" : "desktop"})`, (t) => {
    const s = setup(t, coarse);
    for (const y of [1500, 1800, 2000, 2250]) {
      s.scroll(y);
      s.wait(PROJECT_SCROLL_IDLE - 1);
      assert.equal(s.calls.land, 0);
      assert.equal(s.calls.browse, 0);
    }
    s.wait(1);
    assert.equal(s.calls.land, 0);
    assert.equal(s.calls.browse, 1);
    assert.deepEqual(s.calls.snap, []);
    s.scroll(2700);
    s.wait();
    assert.equal(s.calls.browse, 1);
  });
}

test("a new touch interrupts a native snap, including multi-touch release", (t) => {
  const s = setup(t, true);
  s.scroll(1450);
  s.wait();
  s.scroll(1500);
  s.event("touchstart");
  assert.deepEqual(s.calls.snap.at(-1), { top: 1500, behavior: "instant" });
  s.event("touchend", { touches: [{}] });
  s.wait(1000);
  assert.equal(s.calls.land, 0);
  s.event("touchcancel", { touches: [] });
  s.wait();
  assert.equal(s.calls.snap.length, 2);
  assert.equal(s.calls.land, 1);
});

test("hidden tabs and disposed observers cannot start an entrance", (t) => {
  const s = setup(t);
  s.scroll(1600);
  s.page.visibilityState = "hidden";
  s.page.dispatchEvent(new Event("visibilitychange"));
  s.wait();
  assert.equal(s.calls.land, 0);
  s.page.visibilityState = "visible";
  s.page.dispatchEvent(new Event("visibilitychange"));
  s.wait();
  assert.equal(s.calls.land, 1);
  s.scroll(1700);
  s.stop();
  s.wait();
  s.scroll(1600);
  s.wait();
  assert.equal(s.calls.land, 1);
});
