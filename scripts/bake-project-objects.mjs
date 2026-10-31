import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { weld, reorder, quantize } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const root = fileURLToPath(new URL("../", import.meta.url));
const ids = ["marralhinha", "autopsy", "utd-roommates", "rycord", "nimby", "apple-triage", "apple-nlsql", "readme-ryvamper"];
const directory = await mkdtemp(path.join(tmpdir(), "project-bake-"));
const html = `<!doctype html><script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/":"/three/"}}</script><script type="module">
import { buildProjectObject } from '/sources.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
window.bakeProjects = async () => {
  for (const id of ${JSON.stringify(ids)}) {
    const model = await buildProjectObject(id);
    const data = await new GLTFExporter().parseAsync(model, { binary: true });
    const response = await fetch('/export/' + id, { method: 'POST', body: data });
    if (!response.ok) throw new Error(await response.text());
  }
  return true;
};
</script>`;
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    if (pathname === "/") {
      response.setHeader("Content-Type", "text/html");
      response.end(html);
      return;
    }
    if (request.method === "POST" && ids.includes(pathname.slice(8)) && pathname.startsWith("/export/")) {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      await writeFile(path.join(directory, pathname.slice(8) + ".glb"), Buffer.concat(chunks));
      response.end("ok");
      return;
    }
    const modules = { "/sources.js": "scripts/projectObjectSources.ts", "/lib/projectObjectGeometry.js": "lib/projectObjectGeometry.ts" };
    if (modules[pathname]) {
      response.setHeader("Content-Type", "text/javascript");
      response.end(ts.transpileModule(await readFile(path.join(root, modules[pathname]), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
      return;
    }
    const relative = pathname.startsWith("/three/") ? "node_modules/three/" + pathname.slice(7) : "public" + pathname;
    const file = path.resolve(root, relative);
    if (!file.startsWith(root)) throw new Error("Invalid asset path");
    if (file.endsWith(".js")) response.setHeader("Content-Type", "text/javascript");
    response.end(await readFile(file));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const cdp = process.env.CDP_URL || "http://localhost:9222";
let tab;
let socket;
try {
  tab = await (await fetch(`${cdp}/json/new?${encodeURIComponent(`http://127.0.0.1:${port}`)}`, { method: "PUT" })).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer);
      pending.delete(message.id);
      if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message)));
      else resolve(message.result);
    }
  });
  const evaluate = (expression) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("Bake timed out")); }, 180000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  await evaluate("new Promise((resolve, reject) => { const start = Date.now(); const timer = setInterval(() => { if (window.bakeProjects) { clearInterval(timer); resolve(true); } else if (Date.now() - start > 20000) { clearInterval(timer); reject(new Error('Model authoring modules failed to load')); } }, 50); })");
  await evaluate("window.bakeProjects()");
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const manifest = {};
  for (const id of ids) {
    const document = await io.read(path.join(directory, id + ".glb"));
    await document.transform(weld(), reorder({ encoder: MeshoptEncoder, target: "size" }), quantize({ pattern: /^(NORMAL|TEXCOORD|COLOR)(_\d+)?$/ }));
    document.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
    const data = await io.writeBinary(document);
    const hash = createHash("sha256").update(data).digest("hex").slice(0, 10);
    const file = `${id}-${hash}.glb`;
    await writeFile(path.join(root, "public/assets/project-objects", file), data);
    manifest[id] = { file, bytes: data.byteLength };
    console.log(`${id}: ${(data.byteLength / 1024).toFixed(0)} KiB`);
  }
  await writeFile(path.join(root, "lib/projectObjects.json"), JSON.stringify(manifest, null, 2) + "\n");
} finally {
  socket?.close();
  if (tab) await fetch(`${cdp}/json/close/${tab.id}`).catch(() => {});
  server.closeAllConnections();
  server.close();
  await rm(directory, { recursive: true, force: true });
}
