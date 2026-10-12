import QRCode from "qrcode";
import {creatureForm} from "./creature-catalog";
import {renderWildsCollectibleArt} from "./wilds-collectible-art";
import {currentCreatureHistoryProjection} from "./living-card-proof";
import {isLivingCardAsset} from "./living-card-types";
import {projectLivingCardStory} from "./living-card-dossier";
import {portableCardStatusLabel,type PortableCardAsset} from "./portable-card";
import {standaloneCardUrl} from "./card-url";
import {WILDZ_PRODUCT} from "../../lib/wildz/product";

/** The shared deterministic artwork of the complete card. No identity session,
 * publication, network lookup, artifact opening or private export is involved. */
function xml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function statRow(label: string, value: number, x: number, color: string) {
  return `<g transform="translate(${x} 0)"><rect width="116" height="70" rx="18" fill="#071c26" fill-opacity=".88" stroke="${xml(color)}" stroke-opacity=".55"/><text x="58" y="26" text-anchor="middle" fill="#8da9b3" font-family="system-ui,sans-serif" font-size="15" font-weight="700" letter-spacing="1.5">${label}</text><text x="58" y="55" text-anchor="middle" fill="#ffffff" font-family="system-ui,sans-serif" font-size="27" font-weight="850">${value}</text></g>`;
}

function svgTextTspans(text: string, options: { x: number; lineHeight: number; maxChars: number; maxLines: number }) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  while (words.length && lines.length < options.maxLines) {
    const word = words.shift()!;
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= options.maxChars || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line && lines.length < options.maxLines) lines.push(line);
  if (words.length && lines.length) {
    const last = lines.length - 1;
    lines[last] = `${lines[last]!.slice(0, Math.max(1, options.maxChars - 1)).trimEnd()}…`;
  }
  return lines.map((value, index) => `<tspan x="${options.x}" dy="${index === 0 ? 0 : options.lineHeight}">${xml(value)}</tspan>`).join("");
}

function premiumQrSvg(value: string, x: number, y: number, accent: string) {
  const size = 66;
  const qr = QRCode.create(value, { errorCorrectionLevel: "L" });
  const modules = qr.modules.size;
  const quiet = 4;
  const cell = size / (modules + quiet * 2);
  const path: string[] = [];
  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (qr.modules.get(row, col)) path.push(`M${(x + (col + quiet) * cell).toFixed(3)} ${(y + (row + quiet) * cell).toFixed(3)}h${cell.toFixed(3)}v${cell.toFixed(3)}h-${cell.toFixed(3)}z`);
    }
  }
  return `<g id="card-qr" aria-label="QR link to standalone card page" data-premium-qr="true" data-module-grid="crisp-vector" data-qr-size="${size}"><rect x="${x - 3}" y="${y - 3}" width="${size + 6}" height="${size + 6}" rx="9" fill="#031018" stroke="${xml(accent)}" stroke-opacity=".58"/><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="5" fill="#fff"/><path d="${path.join("")}" fill="#07141c" shape-rendering="crispEdges"/><circle cx="${x + size - 3}" cy="${y + 3}" r="2" fill="${xml(accent)}"/></g>`;
}

export function renderWildsCardSvg(asset: PortableCardAsset, options: { origin?: string } = {}) {
  const form = creatureForm(asset.manifest.formId);
  if (!form) throw new Error("wilds_card_form_unknown");
  const stats = asset.manifest.stats;
  const palette = asset.manifest.variant.traits.palette;
  const heartboundArt = renderWildsCollectibleArt(asset,{width:640,height:405});
  const foilOpacity = form.foil === "standard" ? 0.08 : form.foil === "shimmer" ? 0.2 : 0.32;
  const statRows = [
    statRow("HEALTH", stats.health, 0, palette.primary),
    statRow("POWER", stats.power, 126, palette.accent),
    statRow("GUARD", stats.guard, 252, palette.primary),
    statRow("SPEED", stats.speed, 378, palette.accent),
    statRow("BOND", stats.bond, 504, palette.primary)
  ].join("");
  const abilityOne = form.abilities[0];
  const abilityTwo = form.abilities[1];
  const story = projectLivingCardStory(asset).excerpt;
  const level = isLivingCardAsset(asset) ? currentCreatureHistoryProjection(asset).level : 1;
  const cardPath = standaloneCardUrl(asset.id, options.origin ?? WILDZ_PRODUCT.origin);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050" role="img" aria-labelledby="title description">
  <title id="title">${xml(asset.manifest.name)} Wilds card</title><desc id="description">Level ${level}, Stage ${asset.manifest.stage} ${xml(asset.manifest.rarity)} portable Receiz card. ${xml(story)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#06151e"/><stop offset=".5" stop-color="#103345"/><stop offset="1" stop-color="#07141c"/></linearGradient>
    <linearGradient id="foil" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#ff5ead"/><stop offset=".22" stop-color="#ffd75e"/><stop offset=".45" stop-color="#70ffcc"/><stop offset=".7" stop-color="#71a9ff"/><stop offset="1" stop-color="#c772ff"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="18"/></filter>
    <clipPath id="art"><rect x="55" y="164" width="640" height="405" rx="35"/></clipPath>
  </defs>
  <rect x="12" y="12" width="726" height="1026" rx="50" fill="url(#bg)" stroke="${xml(palette.accent)}" stroke-width="18"/>
  <rect x="35" y="35" width="680" height="980" rx="34" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/>
  <path d="M55 132h640" stroke="${xml(palette.primary)}" stroke-width="4"/>
  <text x="58" y="94" fill="#fff" font-family="system-ui,sans-serif" font-size="${Math.max(20,Math.min(42,Math.floor(540/(Math.max(1,asset.manifest.name.length)*.6))))}" font-weight="900">${xml(asset.manifest.name)}</text>
  <text x="692" y="75" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="18" font-weight="800">STAGE ${asset.manifest.stage}</text>
  <text x="692" y="102" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="18" font-weight="800">LV. ${level}</text>
  <text x="692" y="124" text-anchor="end" fill="#b9d1da" font-family="system-ui,sans-serif" font-size="14" font-weight="700">${xml(asset.manifest.cardNumber)}</text>
  <g clip-path="url(#art)"><rect x="55" y="164" width="640" height="405" fill="#0d2632"/><circle cx="358" cy="330" r="230" fill="${xml(palette.glow)}" opacity=".2" filter="url(#glow)"/><g transform="translate(55 164)">${heartboundArt}</g><rect x="55" y="164" width="640" height="405" fill="url(#foil)" opacity="${foilOpacity}"/></g>
  <rect x="55" y="164" width="640" height="405" rx="35" fill="none" stroke="${xml(palette.accent)}" stroke-width="5"/>
  <text x="70" y="604" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="17" font-weight="850" letter-spacing="2">${xml(asset.manifest.rarity.toUpperCase())} · ${xml(asset.manifest.foil.toUpperCase())}</text>
  <text x="680" y="604" text-anchor="end" fill="#b9d1da" font-family="system-ui,sans-serif" font-size="17" font-weight="700">${xml(form.species)}</text>
  <g transform="translate(65 630)">${statRows}</g>
  <g data-card-lower="saved-story-split" transform="translate(65 727)">
    <g data-card-powers="left-half" data-column-width="300">
      <g><rect width="300" height="88" rx="22" fill="#0a202b" stroke="${xml(palette.primary)}" stroke-opacity=".52"/><text x="18" y="28" fill="#fff" font-family="system-ui,sans-serif" font-size="18" font-weight="850">${xml(abilityOne.name)}</text><text x="280" y="28" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="18" font-weight="900">${abilityOne.power}</text><text x="18" y="53" fill="#a9c2cb" font-family="system-ui,sans-serif" font-size="12">${svgTextTspans(abilityOne.text, { x: 18, lineHeight: 16, maxChars: 38, maxLines: 2 })}</text></g>
      <g transform="translate(0 102)"><rect width="300" height="88" rx="22" fill="#0a202b" stroke="${xml(palette.accent)}" stroke-opacity=".52"/><text x="18" y="28" fill="#fff" font-family="system-ui,sans-serif" font-size="18" font-weight="850">${xml(abilityTwo.name)}</text><text x="280" y="28" text-anchor="end" fill="${xml(palette.primary)}" font-family="system-ui,sans-serif" font-size="18" font-weight="900">${abilityTwo.power}</text><text x="18" y="53" fill="#a9c2cb" font-family="system-ui,sans-serif" font-size="12">${svgTextTspans(abilityTwo.text, { x: 18, lineHeight: 16, maxChars: 38, maxLines: 2 })}</text></g>
    </g>
    <g data-card-story="right-half" data-column-width="300" transform="translate(320 0)"><rect width="300" height="190" rx="22" fill="#0a202b" stroke="${xml(palette.accent)}" stroke-opacity=".52"/><circle cx="266" cy="28" r="16" fill="${xml(palette.primary)}" opacity=".16"/><path d="M256 28h20M266 18v20" stroke="${xml(palette.accent)}" stroke-width="2" stroke-linecap="round" opacity=".72"/><text x="20" y="31" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="13" font-weight="900" letter-spacing="1.6">LIVING STORY</text><text x="20" y="60" fill="#c7dbe2" font-family="system-ui,sans-serif" font-size="13">${svgTextTspans(story, { x: 20, lineHeight: 19, maxChars: 34, maxLines: 6 })}</text></g>
  </g>
  <text x="65" y="960" fill="#7896a1" font-family="ui-monospace,monospace" font-size="12">${xml(asset.proof.digest)}</text>${premiumQrSvg(cardPath, 621, 927, palette.accent)}
  <text x="65" y="990" fill="#fff" font-family="system-ui,sans-serif" font-size="15" font-weight="750">RECEIZ WILDS · PORTABLE PROOF CARD</text><text x="600" y="990" text-anchor="end" fill="${xml(palette.accent)}" font-family="system-ui,sans-serif" font-size="15" font-weight="850">${xml(portableCardStatusLabel(asset.status).toUpperCase())}</text>
</svg>`;
}
