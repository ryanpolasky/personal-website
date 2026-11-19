import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PROJECTS } from "../lib/projects.ts";

export function projectRedirects(projects, reserved = []) {
  const occupied = new Set(reserved);
  const rules = [];
  for (const { id, slug = id, href } of projects) {
    if (!href || href.startsWith("/")) continue;
    if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`Invalid project redirect slug: ${slug}`);
    }
    const target = new URL(href);
    if (!/^https?:$/.test(target.protocol) || /\s/.test(href) || target.username || target.password) {
      throw new Error(`Invalid project redirect target: ${id}`);
    }
    if (occupied.has(slug)) throw new Error(`Project redirect clashes with an existing route: /${slug}`);
    occupied.add(slug);
    rules.push(`/${slug} ${href} 302`, `/${slug}/ ${href} 302`);
  }
  return rules;
}

export async function buildProjectRedirects(output = new URL("../out/", import.meta.url)) {
  const manual = await readFile(new URL("../public/_redirects", import.meta.url), "utf8");
  const entries = await readdir(output);
  const reserved = entries.flatMap((name) => [name, name.replace(/\.html$/, "")]);
  for (const line of manual.split("\n")) {
    if (line.trim().startsWith("/")) reserved.push(line.trim().split(/[\s/]/)[1]);
  }
  const rules = projectRedirects(PROJECTS, reserved);
  await writeFile(new URL("_redirects", output), `${manual.trimEnd()}\n\n# Generated from lib/projects.ts; edit project hrefs there.\n${rules.join("\n")}\n`);
  console.log(`Project redirects: ${rules.length / 2} projects, ${rules.length} HTTP 302 rules → out/_redirects`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildProjectRedirects();
}
