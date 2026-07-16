import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const audioRoot = resolve(projectRoot, "public/audio/wildz");
const catalogPath = resolve(audioRoot, "catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const allowed = new Set(["CC0-1.0", "Public-Domain", "Receiz-Owned"]);
const ids = new Set();
const declaredFiles = new Set([catalogPath]);

for (const asset of catalog) {
  if (ids.has(asset.id)) throw new Error(`Duplicate audio id: ${asset.id}`);
  ids.add(asset.id);
  if (!allowed.has(asset.license)) throw new Error(`Blocked license: ${asset.id}`);
  if (asset.license !== "Receiz-Owned" && asset.licenseUrl !== "https://creativecommons.org/publicdomain/zero/1.0/") throw new Error(`Blocked license deed: ${asset.id}`);
  if (typeof asset.path !== "string" || !asset.path.startsWith("/audio/wildz/") || asset.path.includes("..")) throw new Error(`Invalid local path: ${asset.id}`);
  const file = resolve(projectRoot, `public${asset.path}`);
  if (!file.startsWith(`${audioRoot}${sep}`)) throw new Error(`Audio path escaped root: ${asset.id}`);
  const bytes = await readFile(file);
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== asset.sha256) throw new Error(`Digest mismatch: ${asset.id}`);
  declaredFiles.add(file);
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

for (const file of await walk(audioRoot)) {
  if (!declaredFiles.has(file)) throw new Error(`Uncatalogued audio file: ${file.slice(projectRoot.length + 1)}`);
}

console.log(`Wildz audio catalog verified: ${catalog.length} commercial-safe assets`);
