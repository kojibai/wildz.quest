import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const source = path.resolve(root, process.argv[2] || "public/social/wildz-living-creatures-key-art.png");
const outputDirectory = path.resolve(root, "public/social");
const wordmark = await sharp(path.resolve(root, "public/brand/wildz-wordmark.svg"))
  .resize({ width: 300 })
  .png()
  .toBuffer();

await mkdir(outputDirectory, { recursive: true });

const overlay = Buffer.from(`
  <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#04100d" stop-opacity=".96"/>
        <stop offset=".42" stop-color="#04100d" stop-opacity=".72"/>
        <stop offset=".68" stop-color="#04100d" stop-opacity=".08"/>
        <stop offset="1" stop-color="#04100d" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="headline" x1="72" y1="0" x2="610" y2="0" gradientUnits="userSpaceOnUse">
        <stop stop-color="#B8FF6A"/>
        <stop offset=".48" stop-color="#5EE59B"/>
        <stop offset="1" stop-color="#23B77C"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity=".46"/>
      </filter>
    </defs>
    <rect width="1200" height="630" fill="url(#shade)"/>
    <rect x="20" y="20" width="1160" height="590" rx="30" fill="none" stroke="#E8D58A" stroke-opacity=".55" stroke-width="2"/>
    <g font-family="Arial, Helvetica, sans-serif" filter="url(#shadow)">
      <text x="72" y="212" fill="#F7F4E8" font-size="56" font-weight="800" letter-spacing="-2">Catch living creatures</text>
      <text x="72" y="274" fill="url(#headline)" font-size="56" font-weight="800" letter-spacing="-2">shaped by the moment.</text>
      <text x="74" y="326" fill="#F3D277" font-size="22" font-weight="700" letter-spacing="3">EXPLORE  ·  BOND  ·  EVOLVE  ·  TALK</text>
    </g>
    <g transform="translate(72 492)">
      <rect width="350" height="66" rx="33" fill="#091713" fill-opacity=".9" stroke="#E8D58A" stroke-width="2"/>
      <circle cx="34" cy="33" r="14" fill="#5EE59B" fill-opacity=".18" stroke="#5EE59B"/>
      <path d="M27 33h14M34 26v14" stroke="#B8FF6A" stroke-width="3" stroke-linecap="round"/>
      <text x="62" y="41" fill="#F7F4E8" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" letter-spacing="1.5">PLAY AT WILDZ.QUEST</text>
    </g>
  </svg>
`);

const openGraph = sharp(source)
  .resize(1200, 630, { fit: "cover", position: "centre" })
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: wordmark, left: 72, top: 62 }
  ]);

await Promise.all([
  openGraph.clone().png({ compressionLevel: 9 }).toFile(path.join(outputDirectory, "wildz-open-graph.png")),
  openGraph.clone().jpeg({ quality: 91, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(path.join(outputDirectory, "wildz-open-graph.jpg")),
  sharp(source)
    .resize(1280, 720, { fit: "cover", position: "centre" })
    .webp({ quality: 88, effort: 6 })
    .toFile(path.join(outputDirectory, "wildz-living-creatures-discover.webp"))
]);

console.log("Built Wildz social previews in public/social");
