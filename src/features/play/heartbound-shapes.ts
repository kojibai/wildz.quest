import type { HeartboundIdentityV2 } from "./living-card-types";
import type { HeartboundPose } from "./heartbound-renderer";

export type HeartboundPalette = { primary: string; secondary: string; accent: string; glow: string; ink?: string };

const variantNumber = (value: string) => Number.parseInt(value.match(/(\d+)$/)?.[1] ?? "1", 10);

export function renderHeadShape(identity: HeartboundIdentityV2, palette: HeartboundPalette) {
  const face = identity.faceGeometry;
  const wide = 1 + (face.cheek - 1) * 0.45;
  const tall = 1 + (face.forehead - 1) * 0.38;
  const paths = {
    round: "M154 105Q170 10 280 6Q390 10 406 105Q423 171 383 219Q344 266 280 268Q216 266 177 219Q137 171 154 105Z",
    tapered: "M166 91Q191 9 280 4Q369 9 394 91Q419 163 373 222L280 274L187 222Q141 163 166 91Z",
    broad: "M137 104Q145 18 249 5H311Q415 18 423 104Q434 180 390 227Q346 266 280 266Q214 266 170 227Q126 180 137 104Z",
    heart: "M151 106Q155 25 228 9Q273 0 280 42Q287 0 332 9Q405 25 409 106Q418 179 375 224Q334 263 280 281Q226 263 185 224Q142 179 151 106Z",
    long: "M177 62Q210 4 280 4Q350 4 383 62Q414 126 386 209Q361 273 280 286Q199 273 174 209Q146 126 177 62Z",
    crested: "M155 108Q161 31 224 14L280 0L336 14Q399 31 405 108Q417 177 380 223Q340 267 280 270Q220 267 180 223Q143 177 155 108Z"
  } as const;
  return `<g data-head-shape="${face.head}" transform="translate(${(280 * (1 - wide)).toFixed(2)} ${(135 * (1 - tall)).toFixed(2)}) scale(${wide.toFixed(3)} ${tall.toFixed(3)})"><path d="${paths[face.head]}" fill="${palette.primary}" stroke="${palette.accent}" stroke-width="6"/><path d="M188 208Q280 ${244 + Math.round(face.jaw * 8)} 372 208" fill="${palette.secondary}" opacity=".16"/></g>`;
}

function pupilMarkup(shape: HeartboundIdentityV2["faceGeometry"]["pupil"], x: number, y: number, color: string) {
  if (shape === "star") return `<path d="M${x} ${y - 11}l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" fill="${color}"/>`;
  if (shape === "crescent") return `<path d="M${x + 7} ${y - 10}a12 12 0 1 0 0 20 10 10 0 1 1 0-20Z" fill="${color}"/>`;
  if (shape === "slit") return `<ellipse cx="${x}" cy="${y}" rx="4" ry="13" fill="${color}"/>`;
  return `<ellipse cx="${x}" cy="${y}" rx="${shape === "oval" ? 7 : 10}" ry="${shape === "oval" ? 12 : 10}" fill="${color}"/>`;
}

export function renderEyes(identity: HeartboundIdentityV2, palette: HeartboundPalette) {
  const face = identity.faceGeometry;
  const y = 142 * face.eyeHeight;
  const left = 280 - 57 * face.eyeSpacing;
  const right = 280 + 57 * face.eyeSpacing;
  const rx = 26 * face.eyeSize;
  const ry = 34 * face.eyeSize;
  const ink = palette.ink ?? "#102831";
  const highlights = face.highlight === "double"
    ? `<circle cx="${left + 7}" cy="${y - 10}" r="8" fill="#fff"/><circle cx="${left - 6}" cy="${y + 5}" r="4" fill="#fff"/><circle cx="${right + 7}" cy="${y - 10}" r="8" fill="#fff"/><circle cx="${right - 6}" cy="${y + 5}" r="4" fill="#fff"/>`
    : `<circle cx="${left + 7}" cy="${y - 10}" r="9" fill="#fff"/><circle cx="${right + 7}" cy="${y - 10}" r="9" fill="#fff"/>`;
  return `<g data-eye-style="${face.signature}" transform="rotate(${face.eyeTilt} 280 ${y})"><ellipse cx="${left}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}"/><ellipse cx="${right}" cy="${y}" rx="${rx}" ry="${ry}" fill="${ink}"/>${pupilMarkup(face.pupil, left, y + 2, palette.glow)}${pupilMarkup(face.pupil, right, y + 2, palette.glow)}${highlights}<path d="M${left - 25} ${y - 45}q25 ${face.brow === "heroic" ? -12 : -5} 50 0M${right - 25} ${y - 45}q25 ${face.brow === "mischievous" ? 11 : -5} 50 0" fill="none" stroke="${palette.accent}" stroke-width="7" stroke-linecap="round"/></g>`;
}

export function renderMouth(identity: HeartboundIdentityV2, palette: HeartboundPalette) {
  const muzzle = identity.faceGeometry.muzzle;
  const width = 28 + muzzle * 13;
  const expression = identity.behavior.posture === "playful" ? 10 : identity.behavior.posture === "heroic" ? 3 : 7;
  return `<g data-mouth-style="${identity.behavior.posture}"><path d="m280 174 13 10-13 12-13-12Z" fill="${palette.accent}"/><path d="M${280 - width} 207Q280 ${220 + expression} ${280 + width} 207" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/><path d="M280 196v8" stroke="${palette.accent}" stroke-width="4"/></g>`;
}

export function renderTorso(identity: HeartboundIdentityV2, palette: HeartboundPalette, pose: HeartboundPose) {
  const body = identity.body;
  const lift = pose === "celebrate" ? -10 : pose === "damage" ? 7 : 0;
  const width = 86 * body.shoulder;
  const lower = 64 * body.hip;
  const height = 206 * body.torso;
  const top = 188;
  const bottom = Math.min(420, top + height);
  const path = identity.family.locomotion === "serpentine"
    ? `M210 184Q280 145 350 184Q415 228 365 301Q330 346 389 414Q304 438 246 387Q186 334 209 279Q231 231 210 184Z`
    : identity.family.locomotion === "quadruped"
      ? `M${280 - width} 196Q280 151 ${280 + width} 196L405 286Q390 352 323 368H208Q151 347 158 287Z`
      : `M${280 - width} ${top}Q280 148 ${280 + width} ${top}Q${390 + lower / 4} 253 ${344 + lower / 3} ${bottom}H${216 - lower / 3}Q${170 - lower / 4} 253 ${280 - width} ${top}Z`;
  return `<g data-body-build="${body.build}" transform="translate(0 ${lift})"><path d="${path}" fill="${palette.primary}" stroke="${palette.accent}" stroke-width="5"/><path d="M220 227Q280 199 340 227Q326 314 280 350Q234 314 220 227Z" fill="${palette.secondary}" opacity=".2"/></g>`;
}

export function renderLimbs(identity: HeartboundIdentityV2, palette: HeartboundPalette, pose: HeartboundPose) {
  const stride = pose === "run" ? 22 : pose === "walk" ? 11 : 0;
  const limb = identity.body.limb;
  const paw = identity.body.paw;
  if (identity.family.locomotion === "serpentine") return { leftHind: "", rightHind: "", leftFore: `<path d="M210 244q-65 12-88 67l-29 26q-10 14 7 24 21 11 35-8l21-31 77-32Z" fill="${palette.primary}"/>`, rightFore: `<path d="M350 244q65 12 88 67l29 26q10 14-7 24-21 11-35-8l-21-31-77-32Z" fill="${palette.primary}"/>` };
  const hind = (side: -1 | 1) => `<path d="M${280 + side * 54} 294q${side * 35} 38 ${side * 42} 90l${side * 20} 16q10 14-9 19h-${Math.round(50 * paw)}q-17-4-8-19l15-23-${side * stride} -74Z" fill="${palette.primary}" transform="scale(${side} 1) translate(${side === -1 ? -560 : 0} 0) scale(${limb} 1)"/>`;
  const fore = (side: -1 | 1) => `<path d="M${280 + side * 62} 220q${side * 56} 29 ${side * 61} 91l${side * 31} 35q10 17-10 27-22 9-34-14l-19-34-${side * stride} -69Z" fill="${palette.primary}"/>`;
  return { leftHind: hind(-1), rightHind: hind(1), leftFore: fore(-1), rightFore: fore(1) };
}

export function renderAppendages(identity: HeartboundIdentityV2, palette: HeartboundPalette) {
  const ear = variantNumber(identity.appendageMorphs.ears);
  const tail = variantNumber(identity.appendageMorphs.tail);
  const wing = variantNumber(identity.appendageMorphs.wings);
  const ears = `<path d="M194 110Q${126 - ear * 3} ${43 - ear * 4} ${151 - ear} ${18 + ear * 2}Q205 43 231 85M366 110Q${434 + ear * 3} ${43 - ear * 4} ${409 + ear} ${18 + ear * 2}Q355 43 329 85" fill="${palette.accent}" stroke="${palette.primary}" stroke-width="5"/>`;
  const tailPath = identity.family.locomotion === "serpentine" ? "" : `<path d="M383 286Q${465 + tail * 4} ${205 - tail * 3} ${508 - tail * 2} 274Q516 337 427 348Q478 312 432 283Q414 271 383 301Z" fill="${palette.secondary}" stroke="${palette.accent}" stroke-width="4"/>`;
  const wings = identity.family.locomotion === "flying" || identity.family.signatureDetail.includes("wing") ? `<path d="M207 210Q${78 - wing * 3} 113 70 232Q108 288 221 284M353 210Q${482 + wing * 3} 113 490 232Q452 288 339 284" fill="${palette.secondary}" stroke="${palette.accent}" stroke-width="5" opacity=".92"/>` : "";
  const crest = identity.family.signatureDetail.includes("crest") ? `<path d="M244 68L280 ${10 + variantNumber(identity.appendageMorphs.crest) * 3} 316 68L280 91Z" fill="${palette.accent}"/>` : "";
  return { ears, tail: tailPath, wings, crest };
}

export function renderMarkings(identity: HeartboundIdentityV2, palette: HeartboundPalette) {
  const offset = identity.markings.asymmetry * 70;
  const opacity = identity.markings.density;
  const paths: Record<HeartboundIdentityV2["markings"]["topology"], string> = {
    bloom: `M280 62c-19 19-19 37 0 55 19-18 19-36 0-55Z`,
    mask: `M188 115Q230 83 268 116L247 161Q211 173 188 145M372 115Q330 83 292 116L313 161Q349 173 372 145`,
    comet: `M217 91Q276 51 344 75Q294 92 246 135Z`,
    crown: `M226 92l17-37 37 31 37-31 17 37-54 24Z`,
    tide: `M194 103Q248 69 285 105T370 103`,
    constellation: `M215 95l38 27 42-42 49 48M253 122l-9 38`,
    ribbon: `M198 82Q280 136 362 82Q329 135 280 151Q231 135 198 82Z`,
    ember: `M280 52Q319 88 286 127Q249 101 280 52ZM245 120q35 23 70 0`
  };
  return `<g data-marking-topology="${identity.markings.topology}" transform="translate(${offset.toFixed(2)} 0)" opacity="${opacity}"><path d="${paths[identity.markings.topology]}" fill="${palette.accent}" stroke="${palette.glow}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}
