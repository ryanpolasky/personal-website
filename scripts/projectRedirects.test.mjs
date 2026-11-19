import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRedirects, buildProjectRedirects } from "./build-project-redirects.mjs";
import { PROJECTS } from "../lib/projects.ts";

test("live projects automatically get repointable bare and trailing-slash links", () => {
  assert.deepEqual(projectRedirects([{ id: "internal-id", slug: "new-project", href: "https://example.com/play?mode=1" }]), [
    "/new-project https://example.com/play?mode=1 302",
    "/new-project/ https://example.com/play?mode=1 302",
  ]);
  assert.deepEqual(projectRedirects([]), []);
  assert.deepEqual(projectRedirects([{ id: "private" }, { id: "archive", href: "/gallery" }]), []);
});

test("explicit brand slugs stay stable when names and destinations change", () => {
  const project = { id: "utd-roommates", slug: "meteormate", name: "MeteorMate", href: "https://meteormate.com" };
  assert.deepEqual(projectRedirects([project]), [
    "/meteormate https://meteormate.com 302",
    "/meteormate/ https://meteormate.com 302",
  ]);
  assert.deepEqual(projectRedirects([{ ...project, name: "New Name", href: "https://new.example" }]), [
    "/meteormate https://new.example 302",
    "/meteormate/ https://new.example 302",
  ]);
});

test("missing slugs fall back to IDs for incoming projects such as Wellspring", () => {
  assert.deepEqual(projectRedirects([{ id: "wellspring", href: "https://ws.ryanpolasky.com" }]), [
    "/wellspring https://ws.ryanpolasky.com 302",
    "/wellspring/ https://ws.ryanpolasky.com 302",
  ]);
});

test("invalid slugs, targets, duplicates and reserved routes fail the build", () => {
  const item = { id: "internal-id", slug: "game", href: "https://example.com" };
  assert.throws(() => projectRedirects([item, item]), /clashes/);
  assert.throws(() => projectRedirects([item, { ...item, id: "other-id" }]), /clashes/);
  assert.throws(() => projectRedirects([item, { id: "game", href: item.href }]), /clashes/);
  assert.throws(() => projectRedirects([item], ["game"]), /clashes/);
  assert.doesNotThrow(() => projectRedirects([item], ["internal-id"]));
  for (const slug of ["", "../game", "gallery/child", "bad slug", "_next", null]) {
    assert.throws(() => projectRedirects([{ ...item, slug }]), /Invalid.*slug/);
  }
  assert.throws(() => projectRedirects([{ href: item.href }]), /Invalid.*slug/);
  assert.throws(() => projectRedirects([{ id: "bad id", href: item.href }]), /Invalid.*slug/);
  for (const href of ["javascript:alert(1)", "not a URL", "https://user:pass@example.com", "https://example.com/\n/other"]) {
    assert.throws(() => projectRedirects([{ ...item, href }]));
  }
});

test("build output preserves manual rules and derives every live project from the catalog", async () => {
  const directory = await mkdtemp(join(tmpdir(), "project-redirects-"));
  const output = pathToFileURL(directory + "/");
  try {
    await buildProjectRedirects(output);
    const rules = await readFile(new URL("_redirects", output), "utf8");
    const manual = await readFile(new URL("../public/_redirects", import.meta.url), "utf8");
    assert.ok(rules.startsWith(manual.trimEnd() + "\n"));
    for (const line of projectRedirects(PROJECTS)) assert.ok(rules.split("\n").includes(line));
    const project = PROJECTS.find(({ href }) => href?.startsWith("https://"));
    assert.ok(project);
    await writeFile(new URL(`${project.slug ?? project.id}.html`, output), "existing route");
    await assert.rejects(buildProjectRedirects(output), /clashes/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
