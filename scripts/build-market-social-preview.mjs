import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const root = process.cwd();
const outputDirectory = path.resolve(root, "public/social");
const width = 1200, height = 630;

// Use the same deterministic development examples and complete native front
// renderer as the Market. No player inventory, sale price or proof payload is
// read or embedded in this promotional image. Compile outside .test-build so
// rebuilding the preview never interferes with application/test builds.
async function loadNativeCards() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wildz-market-social-"));
  const entry = "src/features/market/market-fixture-cards.ts";
  const renderer = "src/features/play/card-export.ts";
  try {
    const program = ts.createProgram([path.resolve(root, entry), path.resolve(root, renderer)], {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, esModuleInterop: true,
      skipLibCheck: true, rootDir: root, outDir: directory,
      paths: { "@/*": [path.join(root, "src/*")] }
    });
    const result = program.emit();
    if (result.emitSkipped) throw new Error("Native card renderer could not be compiled");
    await writeFile(path.join(directory, "package.json"), '{"type":"module"}\n');
    await symlink(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
    async function patchDirectory(current) {
      for (const file of await readdir(current, { withFileTypes: true })) {
        if (file.name === "node_modules") continue;
        const absolute = path.join(current, file.name);
        if (file.isDirectory()) { await patchDirectory(absolute); continue; }
        if (!file.name.endsWith(".js")) continue;
        const source = await readFile(absolute, "utf8");
        const patched = source.replace(/((?:from\s+|import\s*\(\s*)["'])((?:\.{1,2}\/|@\/)[^"']+)(["'])/g,
          (match, prefix, specifier, suffix) => {
            if (specifier.startsWith("@/")) {
              const relative = path.relative(path.dirname(absolute), path.join(directory, "src", specifier.slice(2))).split(path.sep).join("/");
              specifier = relative.startsWith(".") ? relative : `./${relative}`;
            }
            return path.extname(specifier) ? `${prefix}${specifier}${suffix}` : `${prefix}${specifier}.js${suffix}`;
          });
        await writeFile(absolute, patched);
      }
    }
    await patchDirectory(directory);
    const [{ marketFixtureCards }, { renderWildsCardSvg }] = await Promise.all([
      import(pathToFileURL(path.join(directory, entry.replace(/\.ts$/, ".js")))),
      import(pathToFileURL(path.join(directory, renderer.replace(/\.ts$/, ".js"))))
    ]);
    return marketFixtureCards.map(card => renderWildsCardSvg(card));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const cards = await loadNativeCards();
const wordmark = await sharp(path.resolve(root, "public/brand/wildz-wordmark.svg"))
  .resize({ width: 232 }).png().toBuffer();
const backdrop = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#03120f" stop-opacity=".87"/>
      <stop offset=".40" stop-color="#03120f" stop-opacity=".73"/>
      <stop offset=".76" stop-color="#03120f" stop-opacity=".12"/>
      <stop offset="1" stop-color="#03120f" stop-opacity=".28"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#03120f" stop-opacity="0"/>
      <stop offset="1" stop-color="#03120f" stop-opacity=".88"/>
    </linearGradient>
    <radialGradient id="glow"><stop stop-color="#97f8ba" stop-opacity=".24"/><stop offset="1" stop-color="#97f8ba" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#shade)"/>
  <rect y="420" width="1200" height="210" fill="url(#floor)"/>
  <ellipse cx="860" cy="398" rx="370" ry="260" fill="url(#glow)"/>
  <rect x="20" y="20" width="1160" height="590" rx="25" fill="none" stroke="#e8d58a" stroke-opacity=".38"/>
</svg>`);
const typography = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="legend" x1="60" y1="0" x2="480" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#c5ff84"/><stop offset=".7" stop-color="#70e4a3"/><stop offset="1" stop-color="#42c991"/></linearGradient>
  </defs>
  <g font-family="Arial, Helvetica, sans-serif">
    <text x="313" y="98" fill="#e8d58a" fill-opacity=".65" font-size="29" font-weight="300">/</text>
    <text x="337" y="96" fill="#f7f4e8" font-size="27" font-weight="600">Market</text>
    <text x="61" y="185" fill="#e8d58a" font-size="13" font-weight="700" letter-spacing="3">A WORLD OF DISCOVERY</text>
    <text x="58" y="268" fill="#f7f4e8" font-size="70" font-weight="800" letter-spacing="-2.7">Find your</text>
    <text x="58" y="344" fill="url(#legend)" font-size="70" font-weight="800" letter-spacing="-2.7">legend.</text>
    <text x="61" y="396" fill="#f7f4e8" fill-opacity=".86" font-size="23">Creatures and resources.</text>
    <text x="61" y="430" fill="#f7f4e8" fill-opacity=".86" font-size="23">Yours to explore.</text>
    <path d="M61 506h43" stroke="#e8d58a" stroke-width="2"/>
    <text x="61" y="551" fill="#f7f4e8" font-size="22" font-weight="700" letter-spacing=".4">wildz.quest/market</text>
    <path d="M296 544h20m-7-7 7 7-7 7" stroke="#b8ff6a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`);

// Keep card artwork and its names legible, while the staggered scale creates
// a collection reveal without implying any card is currently for sale.
const placements = [
  { index: 0, width: 225, angle: -9, left: 522, top: 212 },
  { index: 2, width: 213, angle: 9, left: 937, top: 236 },
  { index: 1, width: 285, angle: 3, left: 718, top: 136 }
];
const layers = [{ input: backdrop, left: 0, top: 0 }];
for (const placement of placements) {
  const sprite = await sharp(Buffer.from(cards[placement.index])).resize({ width: placement.width * 2 })
    .rotate(placement.angle, { background: "#00000000" })
    .resize({ width: Math.ceil(placement.width * (Math.cos(placement.angle * Math.PI / 180) + 1.4 * Math.abs(Math.sin(placement.angle * Math.PI / 180)))) })
    .png().toBuffer();
  const shadow = await sharp(sprite).linear(0, 0)
    .extend({ top: 30, bottom: 30, left: 30, right: 30, background: "#00000000" })
    .blur(12).png().toBuffer();
  layers.push({ input: shadow, left: placement.left - 30, top: placement.top - 14 });
  layers.push({ input: sprite, left: placement.left, top: placement.top });
}
layers.push({ input: typography, left: 0, top: 0 }, { input: wordmark, left: 59, top: 59 });

await mkdir(outputDirectory, { recursive: true });
const composed = await sharp(path.resolve(root, "public/images/market/forest-header.webp"))
  .resize(width, height, { fit: "cover" }).composite(layers).png().toBuffer();
const preview = sharp(composed).removeAlpha();
const outputs = [
  { filename: "wildz-market-open-graph.png", pipeline: preview.clone().png({ compressionLevel: 9 }) },
  { filename: "wildz-market-open-graph.jpg", pipeline: preview.clone().jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true }) }
];
for (const output of outputs) {
  const destination = path.join(outputDirectory, output.filename);
  await output.pipeline.toFile(destination);
  const metadata = await sharp(destination).metadata();
  if (metadata.width !== width || metadata.height !== height) throw new Error("Market preview dimensions are invalid");
  console.log(`${path.relative(root, destination)} — ${width}×${height}, ${(await stat(destination)).size} bytes`);
}
