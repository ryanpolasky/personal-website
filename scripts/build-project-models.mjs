import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { brotliCompress, constants } from "node:zlib";
import { promisify } from "node:util";

const compress = promisify(brotliCompress);
const manifest = JSON.parse(await readFile(new URL("../lib/projectObjects.json", import.meta.url)));
const destination = new URL("../out/models/projects/", import.meta.url);
await mkdir(destination, { recursive: true });
for (const { file } of Object.values(manifest)) {
  const source = new URL("../out/assets/project-objects/" + file, import.meta.url);
  const data = await readFile(source);
  const encoded = await compress(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
  await copyFile(source, new URL(file, destination));
  await writeFile(new URL(file + ".br", destination), encoded);
  console.log(`${file}: ${data.length} → ${encoded.length} bytes`);
}
