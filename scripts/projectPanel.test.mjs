import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("project-info reveal releases its clip so hover and focus outlines can paint outside the content box", async () => {
  const css = await readFile(new URL("../components/projects-desktop.css", import.meta.url), "utf8");
  const reveal = css.slice(css.indexOf("@keyframes project-desktop-window-switch"));
  assert.match(reveal, /^@keyframes[^}]+from\s*\{[^}]*clip-path:\s*inset\(85% 0 0\)/);
  assert.match(reveal, /to\s*\{[^}]*clip-path:\s*none;/);
  assert.match(css, /\.project-desktop-actions a:hover,\s*\.project-desktop-actions a:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--pd-ink\);\s*outline-offset:\s*2px;/);
});
