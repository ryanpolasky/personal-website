import test from "node:test";
import assert from "node:assert/strict";
import { observeProjectLanding, PROJECT_SCROLL_IDLE } from "../lib/projectLanding.ts";

function setup(t) {
  const browser = new EventTarget();
  const page = new EventTarget();
  const timers = new Map();
  const calls = { land: 0, browse: 0, move: 0, leave: 0, snap: [] };
  let now = 0;
  let nextTimer = 0;
  Object.assign(browser, {
    innerHeight: 800,
    scrollY: 0,
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
    onLand: () => { calls.land++; },
    onBrowse: () => { calls.browse++; },
    onMove: () => { calls.move++; },
    onLeaveAbove: () => { calls.leave++; },
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

test("touch landing waits for release, native snapping, and momentum to stop", (t) => {
  const s = setup(t);
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
  assert.equal(s.calls.land, 1);
  assert.deepEqual(s.calls.snap, []);
  s.scroll(1550);
  s.wait(PROJECT_SCROLL_IDLE - 1);
  s.scroll(1600);
  s.wait();
  assert.equal(s.calls.land, 2);
  s.scroll(1740);
  s.wait();
  assert.deepEqual(s.calls.snap, []);
});

test("arrival never drives scrolling or fights native snapping, including repeat visits", (t) => {
  const s = setup(t);
  for (let visit = 0; visit < 2; visit++) {
    for (const y of [1250, 1720, 1950, 2500, 2700, 2250, 1600, 1330, 800]) {
      s.scroll(y);
      s.wait();
    }
  }
  assert.ok(s.calls.land > 0);
  assert.ok(s.calls.browse > 0);
  assert.ok(s.calls.leave > 0);
  assert.deepEqual(s.calls.snap, []);
});

test("upward exit reverses immediately without snapping back; re-entry can land", (t) => {
  const s = setup(t);
  s.scroll(1600);
  s.wait();
  s.scroll(1330);
  assert.equal(s.calls.leave, 1);
  s.wait();
  assert.deepEqual(s.calls.snap, []);
  s.scroll(1600);
  s.wait();
  assert.equal(s.calls.land, 2);
  assert.deepEqual(s.calls.snap, []);
});

for (const coarse of [false, true]) {
  test(`a fast pass into the visible tail exposes content without an entrance (${coarse ? "touch" : "desktop"})`, (t) => {
    const s = setup(t);
    if (coarse) s.event("touchstart");
    for (const y of [1500, 1800, 2000, 2250]) {
      s.scroll(y);
      s.wait(PROJECT_SCROLL_IDLE - 1);
      assert.equal(s.calls.land, 0);
      assert.equal(s.calls.browse, 0);
    }
    if (coarse) s.event("touchend", { touches: [] });
    s.wait();
    assert.equal(s.calls.land, 0);
    assert.equal(s.calls.browse, 1);
    assert.deepEqual(s.calls.snap, []);
    s.scroll(2700);
    s.wait();
    assert.equal(s.calls.browse, 1);
  });
}

test("a new touch pauses arrival until every finger is released without cancelling native scroll", (t) => {
  const s = setup(t);
  s.scroll(1450);
  s.wait();
  s.scroll(1500);
  s.event("touchstart");
  s.event("touchend", { touches: [{}] });
  s.wait(1000);
  assert.equal(s.calls.land, 1);
  s.event("touchcancel", { touches: [] });
  s.wait();
  assert.deepEqual(s.calls.snap, []);
  assert.equal(s.calls.land, 2);
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
