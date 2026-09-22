import { embedWildsMapInPng } from "./wilds-map-image";
import { wildsExplorationBounds, wildsExplorationContainsWorld, type WildsExplorationAtlas } from "./wilds-exploration-atlas";
import { WILDS_REGION_SIZE } from "./multiplayer-core";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import { WILDS_NAMED_REGIONS } from "./wilds-world-geography";

const pause = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** A north-up, complete discovery chart, independent of the live camera and other players. */
export async function renderWildsMapImage(atlas: WildsExplorationAtlas): Promise<Blob> {
  const bounds = wildsExplorationBounds(atlas);
  const canvas = document.createElement("canvas");
  canvas.width = 1280; canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create a map image.");
  const background = ctx.createLinearGradient(0, 0, 1280, 1280);
  background.addColorStop(0, "#102d32"); background.addColorStop(1, "#06181e");
  ctx.fillStyle = background; ctx.fillRect(0, 0, 1280, 1280);
  ctx.strokeStyle = "#a9bd9360"; ctx.lineWidth = 1; ctx.strokeRect(28.5, 28.5, 1223, 1223);
  ctx.strokeStyle = "#a9bd9324"; ctx.strokeRect(36.5, 36.5, 1207, 1207);
  ctx.fillStyle = "#c9d8b0"; ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText("W I L D Z   /   F I E L D   A T L A S", 76, 93);
  ctx.fillStyle = "#eff3df"; ctx.font = '52px Georgia, serif'; ctx.fillText("A world discovered", 72, 166);
  ctx.fillStyle = "#92b9ad"; ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(`${bounds.count.toLocaleString("en-US")} regions charted · Every discovery, held in one map`, 76, 205);

  const area = { x: 76, y: 274, width: 1128, height: 790 };
  ctx.save(); ctx.beginPath(); ctx.rect(area.x, area.y, area.width, area.height); ctx.clip();
  ctx.strokeStyle = "#b7d5c00c";
  for (let x = area.x; x <= area.x + area.width; x += 47) { ctx.beginPath(); ctx.moveTo(x, area.y); ctx.lineTo(x, area.y + area.height); ctx.stroke(); }
  for (let y = area.y; y <= area.y + area.height; y += 47) { ctx.beginPath(); ctx.moveTo(area.x, y); ctx.lineTo(area.x + area.width, y); ctx.stroke(); }
  const spanX = bounds.maxX - bounds.minX + 1, spanZ = bounds.maxZ - bounds.minZ + 1;
  const scale = Math.min((area.width - 80) / spanX, (area.height - 80) / spanZ);
  const left = area.x + (area.width - spanX * scale) / 2;
  const top = area.y + (area.height - spanZ * scale) / 2;
  const width = Math.max(1, Math.ceil(spanX * scale / 2));
  const height = Math.max(1, Math.ceil(spanZ * scale / 2));
  const raster = document.createElement("canvas"); raster.width = width; raster.height = height;
  const rasterCtx = raster.getContext("2d")!;
  const pixels = rasterCtx.createImageData(width, height);
  const worldX = new Float64Array(width * height), worldZ = new Float64Array(width * height);
  const mask = new Uint8Array(width * height);
  // Rasterize only known intervals. A distant island always receives at least one pixel.
  for (let rowIndex = 0; rowIndex < atlas.rows.length; rowIndex++) {
    const row = atlas.rows[rowIndex]!;
    const y0 = Math.floor((row.z - bounds.minZ) / spanZ * height);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil((row.z + 1 - bounds.minZ) / spanZ * height)));
    for (const range of row.ranges) {
      const x0 = Math.floor((range.minX - bounds.minX) / spanX * width);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil((range.maxX + 1 - bounds.minX) / spanX * width)));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const index = y * width + x;
        mask[index] = 1;
        worldX[index] = Math.max(range.minX + .001, Math.min(range.maxX + .999, bounds.minX + (x + .5) / width * spanX)) * WILDS_REGION_SIZE;
        worldZ[index] = Math.max(row.z + .001, Math.min(row.z + .999, bounds.minZ + (y + .5) / height * spanZ)) * WILDS_REGION_SIZE;
      }
    }
    if (rowIndex % 128 === 0) await pause();
  }
  const elevations = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!mask[index]) continue;
      const elevation = wildsTerrainElevation(worldX[index]!, worldZ[index]!);
      elevations[index] = elevation;
      const above = y > 0 && mask[index - width] ? elevations[index - width]! : elevation;
      const west = x > 0 && mask[index - 1] ? elevations[index - 1]! : elevation;
      const shade = Math.max(.65, Math.min(1.3, 1 + (above - elevation + west - elevation) * .12));
      const palette = elevation < -2 ? [23, 77, 96] : elevation < -1.06 ? [48, 126, 139] : elevation < -.25 ? [190, 180, 127] : elevation > 15 ? [166, 174, 150] : elevation > 7 ? [108, 137, 105] : [70, 123, 88];
      const contour = elevation > -.25 && Math.abs(elevation / 2 - Math.round(elevation / 2)) < .04 ? .84 : 1;
      for (let channel = 0; channel < 3; channel++) pixels.data[index * 4 + channel] = palette[channel]! * shade * contour;
      pixels.data[index * 4 + 3] = 255;
    }
    if (y % 8 === 0) await pause();
  }
  rasterCtx.putImageData(pixels, 0, 0);
  ctx.shadowColor = "#71c5a138"; ctx.shadowBlur = 20;
  ctx.drawImage(raster, left, top, spanX * scale, spanZ * scale);
  ctx.shadowBlur = 0;
  // Label authored regions only when there is enough room to distinguish them.
  if (scale >= 18) for (const region of WILDS_NAMED_REGIONS) {
    if (!wildsExplorationContainsWorld(atlas, region.position)) continue;
    const x = left + (region.position.x / WILDS_REGION_SIZE - bounds.minX) * scale;
    const y = top + (region.position.z / WILDS_REGION_SIZE - bounds.minZ) * scale;
    ctx.textAlign = "center"; ctx.font = 'italic 16px Georgia, serif';
    ctx.lineWidth = 4; ctx.strokeStyle = "#0b2229b8"; ctx.strokeText(region.name, x, y);
    ctx.fillStyle = "#f0eed1"; ctx.fillText(region.name, x, y);
  }
  ctx.restore(); ctx.textAlign = "left";
  // Quiet compass and coordinate frame make the image useful as a real chart.
  ctx.save(); ctx.translate(1158, 160); ctx.strokeStyle = "#cfcea5"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(0, 25); ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.stroke();
  ctx.fillStyle = "#e8e3bc"; ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(-5, -4); ctx.lineTo(5, -4); ctx.fill();
  ctx.textAlign = "center"; ctx.font = '12px system-ui, sans-serif'; ctx.fillText("N", 0, -37); ctx.restore();
  ctx.strokeStyle = "#bfd0ab40"; ctx.beginPath(); ctx.moveTo(76, 1112); ctx.lineTo(1204, 1112); ctx.stroke();
  ctx.fillStyle = "#d2dcc3"; ctx.font = '15px system-ui, sans-serif'; ctx.fillText("DISCOVERED TERRITORY", 76, 1150);
  ctx.fillStyle = "#83a89e"; ctx.font = '13px ui-monospace, monospace';
  ctx.fillText(`X ${bounds.minX * WILDS_REGION_SIZE} … ${(bounds.maxX + 1) * WILDS_REGION_SIZE}   /   Z ${bounds.minZ * WILDS_REGION_SIZE} … ${(bounds.maxZ + 1) * WILDS_REGION_SIZE}`, 76, 1180);
  ctx.textAlign = "right"; ctx.font = '14px system-ui, sans-serif'; ctx.fillText("wildz.quest", 1204, 1150);
  ctx.font = '12px system-ui, sans-serif'; ctx.fillText("Import the original PNG to add this territory to your atlas.", 1204, 1210);
  const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not save the map image.")), "image/png"));
  const bytes = embedWildsMapInPng(new Uint8Array(await image.arrayBuffer()), atlas);
  return new Blob([bytes.slice().buffer], { type: "image/png" });
}
