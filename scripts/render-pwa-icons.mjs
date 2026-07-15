import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = resolve(root, "public/brand/wildz-mark.svg");
const output = resolve(root, "public/icons");
await mkdir(output, { recursive: true });

for (const [name, size, maskable] of [
  ["icon-180.png", 180, false], ["icon-192.png", 192, false], ["icon-512.png", 512, false],
  ["icon-maskable-192.png", 192, true], ["icon-maskable-512.png", 512, true]
]) {
  const inset = maskable ? Math.round(size * .12) : 0;
  await sharp(source).resize(size - inset * 2, size - inset * 2).extend({ top: inset, bottom: inset, left: inset, right: inset, background: "#09110d" }).png().toFile(resolve(output, name));
}
