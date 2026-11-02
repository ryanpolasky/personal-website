import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { PROJECT_HOLD, PROJECT_ARRIVAL_END } from "../lib/projectMotion.ts";

const require = createRequire(import.meta.url);
const sources = await Promise.all(["Nav", "ProjectsDesktop"].map(async (name) => [name,
  ts.transpileModule(await readFile(new URL(`../components/${name}.tsx`, import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
]));

function component(name, mocks, globals) {
  let cursor = 0;
  const hooks = [], effects = [];
  const react = {
    useState(initial) {
      const hook = hooks[cursor++] ??= { value: initial };
      return [hook.value, (value) => { hook.value = typeof value === "function" ? value(hook.value) : value; }];
    },
    useRef(initial) { return hooks[cursor++] ??= { current: initial }; },
    useCallback(callback, deps) {
      const index = cursor++, old = hooks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) hooks[index] = { callback, deps };
      return hooks[index].callback;
    },
    useEffect(callback, deps) {
      const index = cursor++, old = hooks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) {
        const hook = hooks[index] = { deps };
        effects.push(() => { old?.cleanup?.(); hook.cleanup = callback(); });
      }
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(Object.fromEntries(sources)[name], {
    module, exports: module.exports,
    require: (id) => id === "react" ? react : id in mocks ? mocks[id] : require(id),
    CustomEvent, ...globals,
  });
  return {
    render() { cursor = 0; return module.exports[name](); },
    flush() { while (effects.length) effects.shift()(); },
    cleanup() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}

function nodes(root) {
  if (Array.isArray(root)) return root.flatMap(nodes);
  if (!root || typeof root !== "object") return [];
  return [root, ...nodes(root.props?.children)];
}
const curtain = (tree) => nodes(tree).find((node) => node.props?.className?.includes("z-[200]"));
const click = (extra = {}) => ({
  button: 0, prevented: false,
  nativeEvent: { stopImmediatePropagation() {} },
  preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra,
});

function nav(t, { lenis = null, reduced = false } = {}) {
  const browser = new EventTarget(), timers = new Map(), events = [], scrolls = [], hashes = [];
  let timerId = 0;
  const element = { clientHeight: 940, getBoundingClientRect: () => ({ top: 2000, bottom: 2940 }), scrollIntoView: (options) => scrolls.push(options) };
  Object.assign(browser, {
    scrollY: 0, innerHeight: 800,
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    matchMedia: () => ({ matches: reduced }),
    getComputedStyle: () => ({ backgroundColor: "rgb(80, 210, 150)", color: "rgb(20, 50, 40)" }),
  });
  for (const name of ["projects:prepare", "projects:enter", "projects:cancel", "nav:teleport"]) {
    browser.addEventListener(name, () => events.push(name));
  }
  const context = { lenis };
  const c = component("Nav", {
    "next/navigation": { usePathname: () => "/" },
    "next/link": { default: () => null },
    "@/lib/site": { RESUME_PDF_HREF: "/resume.pdf" },
    "@/lib/scroll": { resolveSectionScrollTarget: () => ({ element, offset: -12 }) },
    "@/lib/projectMotion": { PROJECT_HOLD },
    "@/components/UtdWebringButtons": { UtdWebringButtons: () => null },
    "@/components/SmoothScrollProvider": { useLenis: () => context.lenis },
  }, {
    window: browser, document: { getElementById: () => element, body: element },
    history: { replaceState: (...args) => hashes.push(args) },
    requestAnimationFrame: (callback) => callback(), cancelAnimationFrame() {},
  });
  const render = () => { const tree = c.render(); c.flush(); return tree; };
  t.after(c.cleanup);
  return {
    render, browser, context, element, events, scrolls, hashes, timers,
    transition(tree) { const node = curtain(tree); node.props.onTransitionEnd({ target: node, currentTarget: node, propertyName: "transform" }); },
    wait() { for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); } },
    select(tree, id, mobile = false, event = click()) {
      nodes(tree).filter((node) => node.type === "a" && node.props.href === `#${id}`)[mobile ? 1 : 0].props.onClick(event);
      return event;
    },
  };
}

for (const native of [true, false]) for (const mobile of [false, true]) {
  test(`Projects curtain hands off without lifting or a second hold (${native ? "native" : "Lenis"}, ${mobile ? "mobile" : "desktop"})`, (t) => {
    const scrolls = [];
    const s = nav(t, { lenis: native ? null : { scrollTo: (...args) => scrolls.push(args) } });
    let tree = s.render();
    if (mobile) {
      nodes(tree).find((node) => node.type === "button" && node.props["aria-label"] === "open menu").props.onClick();
      tree = s.render();
    }
    s.select(tree, "projects", mobile);
    tree = s.render();
    assert.equal(s.scrolls.length + scrolls.length, 0);
    assert.equal(curtain(tree).props.style.transform, "translate3d(0, 0%, 0)");
    assert.equal(curtain(tree).props.style.backgroundColor, "rgb(80, 210, 150)");
    assert.equal(nodes(curtain(tree)).filter((node) => node.type === "span").map((node) => node.props.children).join(""), "PROJECTS");
    assert.equal(nodes(tree).find((node) => node.props?.["aria-expanded"] !== undefined).props["aria-expanded"], false);
    s.transition(tree);
    tree = s.render();
    assert.deepEqual(s.events.slice(-2), ["projects:prepare", "nav:teleport"]);
    assert.equal([...s.timers.values()][0].delay, PROJECT_HOLD * 1000);
    assert.equal(s.hashes.at(-1)[2], "#projects");
    if (native) assert.equal(s.scrolls[0].behavior, "instant");
    else { assert.equal(scrolls[0][0], s.element); assert.equal(scrolls[0][1].offset, -12); assert.equal(scrolls[0][1].immediate, true); }
    s.wait();
    tree = s.render();
    assert.equal(curtain(tree).props.style.transform, "translate3d(0, 100%, 0)");
    assert.equal(curtain(tree).props.style.transition, "none");
    assert.equal(s.events.at(-1), "projects:enter");
    assert.equal(curtain(s.render()).props.style.transition, "none");
  });
}

test("CTA requests, repeat entry, changed Lenis context, and cancellation use the same handoff", (t) => {
  const s = nav(t), scrolls = [];
  s.render();
  s.browser.dispatchEvent(new CustomEvent("nav:wash", { detail: { id: "projects" } }));
  let tree = s.render();
  s.context.lenis = { scrollTo: (...args) => scrolls.push(args) };
  tree = s.render();
  s.transition(tree);
  s.render(); s.wait(); s.render();
  tree = s.render();
  s.select(tree, "projects"); tree = s.render(); s.transition(tree); tree = s.render();
  assert.equal(scrolls.length, 2);
  s.select(tree, "contact"); tree = s.render();
  assert.equal(s.timers.size, 0);
  assert.equal(s.events.at(-1), "projects:cancel");
  assert.ok(!curtain(tree).props.className.includes("project-nav-curtain"));
});

for (const id of ["about", "experience", "contact", "projects"]) {
  test(`the standard ${id} curtain still lifts (${id === "projects" ? "reduced motion" : "unchanged destination"})`, (t) => {
    const s = nav(t, { reduced: id === "projects" });
    s.select(s.render(), id);
    let tree = s.render();
    assert.ok(!curtain(tree).props.className.includes("project-nav-curtain"));
    s.transition(tree); s.render(); s.wait(); tree = s.render();
    assert.equal(curtain(tree).props.style.transform, "translate3d(0, -100%, 0)");
    assert.ok(!s.events.includes("projects:prepare"));
  });
}

test("modifier and middle clicks stay native", (t) => {
  const s = nav(t), tree = s.render();
  for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
    assert.equal(s.select(tree, "projects", false, click(modifier)).prevented, false);
  }
  assert.equal(s.events.length, 0);
  assert.equal(s.hashes.length, 0);
});

test("arrival stays pinned under the curtain, starts at the burst, and still reverses on scroll", (t) => {
  const browser = new EventTarget(), ticks = new Set(), archive = { inert: false };
  let handlers, arrival, cleanup;
  const timeline = { to() { return this; }, fromTo() { return this; }, time() { return this; }, invalidate() { return this; } };
  const section = {
    dataset: {}, querySelector: (selector) => selector === ".project-desktop-archive" ? archive : { children: [] },
    querySelectorAll: () => [],
  };
  class Observer { observe() {} disconnect() {} }
  const c = component("ProjectsDesktop", {
    "next/dynamic": { default: () => null }, "next/image": { default: () => null }, "./projects-desktop.css": {},
    "@/lib/projects": { getEnabledProjects: () => [{ id: "marralhinha", name: "Marralhinha", role: "Creator", stack: [] }] },
    "@/lib/projectMotion": { PROJECT_HOLD, PROJECT_REVEAL: PROJECT_HOLD + 0.27, PROJECT_ARRIVAL_END },
    "@/lib/projectLanding": { observeProjectLanding: (_section, callbacks) => { handlers = callbacks; return () => {}; } },
    gsap: { default: {
      matchMedia: () => ({ add: (_query, callback) => { cleanup = callback(); }, revert: () => cleanup() }),
      timeline: () => timeline,
      ticker: { add: (callback) => ticks.add(callback), remove: (callback) => ticks.delete(callback) },
      utils: { clamp: (min, max, value) => Math.max(min, Math.min(max, value)) },
    } },
  }, { window: Object.assign(browser, { IntersectionObserver: Observer }), IntersectionObserver: Observer, ResizeObserver: Observer, document: { fonts: { ready: Promise.resolve() } } });
  const tree = c.render();
  tree.props.ref.current = section;
  arrival = nodes(tree).find((node) => node.props?.arrival)?.props.arrival.current;
  c.flush();
  t.after(c.cleanup);
  const event = (name) => browser.dispatchEvent(new CustomEvent(`projects:${name}`));
  const tick = () => { for (const callback of [...ticks]) callback(0, 100); };
  handlers.onLand(); tick();
  assert.ok(arrival.time > 0);
  event("prepare");
  for (const callback of Object.values(handlers)) callback();
  tick();
  assert.equal(arrival.time, 0);
  assert.equal(ticks.size, 0);
  assert.equal(archive.inert, true);
  event("enter");
  assert.equal(arrival.time, PROJECT_HOLD);
  tick();
  assert.ok(arrival.time > PROJECT_HOLD);
  assert.equal(section.dataset.boot, "burst");
  handlers.onLeaveAbove(); tick();
  assert.equal(section.dataset.motion, "reversing");
  event("prepare"); event("cancel"); handlers.onLand(); tick();
  assert.equal(arrival.time, 0.1);
  c.cleanup();
  event("prepare");
  assert.equal(arrival.time, PROJECT_ARRIVAL_END);
});
