import type { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export async function loadProjectModel(
  loader: Pick<GLTFLoader, "loadAsync" | "parseAsync">,
  file: string,
  compressed = true,
) {
  if (!compressed) return loader.loadAsync(`/assets/project-objects/${file}`);
  const base = "/models/projects/";
  try {
    const response = await fetch(`${base}${file}.br`);
    if (!response.ok) throw new Error("Compressed model unavailable");
    const data = await response.arrayBuffer();
    if (data.byteLength < 12 || new DataView(data).getUint32(0, true) !== 0x46546c67)
      throw new Error("Model response was not decoded");
    return await loader.parseAsync(data, base);
  } catch {
    return loader.loadAsync(base + file);
  }
}
