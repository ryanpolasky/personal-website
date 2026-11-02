import test from "node:test";
import assert from "node:assert/strict";
import { loadProjectModel } from "../lib/projectModel.ts";

const file = "board-0123456789.glb";
const base = "/models/projects/";

test("uses the decoded Brotli response without fetching the raw model", async (t) => {
  const bytes = new Uint8Array(12);
  new DataView(bytes.buffer).setUint32(0, 0x46546c67, true);
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url, base + file + ".br");
    return new Response(bytes);
  });
  const model = {};
  const loader = {
    loadAsync() { assert.fail("unnecessary raw download"); },
    async parseAsync(data, path) {
      assert.deepEqual(new Uint8Array(data), bytes);
      assert.equal(path, base);
      return model;
    },
  };
  assert.equal(await loadProjectModel(loader, file), model);
});

for (const failure of ["network", "404", "missing encoding", "HTML fallback", "parse failure"]) {
  test(`falls back to the raw model after ${failure}`, async (t) => {
    const bytes = new Uint8Array(12);
    if (failure === "parse failure") new DataView(bytes.buffer).setUint32(0, 0x46546c67, true);
    t.mock.method(globalThis, "fetch", async () => {
      if (failure === "network") throw new TypeError("offline");
      return new Response(failure === "HTML fallback" ? "<!doctype html>" : bytes, { status: failure === "404" ? 404 : 200 });
    });
    const model = {};
    const loader = {
      async loadAsync(url) { assert.equal(url, base + file); return model; },
      async parseAsync() { assert.equal(failure, "parse failure"); throw new Error("invalid model"); },
    };
    assert.equal(await loadProjectModel(loader, file), model);
  });
}

test("development uses authoring assets without requesting a compressed version", async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("unexpected compressed download"));
  const loader = { async loadAsync(url) { return url; }, parseAsync() { assert.fail(); } };
  assert.equal(await loadProjectModel(loader, file, false), "/assets/project-objects/" + file);
});

test("propagates raw fallback errors so the scene can recover", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 404 }));
  const loader = { async loadAsync() { throw new Error("raw unavailable"); }, parseAsync() { assert.fail(); } };
  await assert.rejects(loadProjectModel(loader, file), /raw unavailable/);
});
