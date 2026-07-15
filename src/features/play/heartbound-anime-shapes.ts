import type { HeartboundPresentationV3 } from "./heartbound-anime-types";
import type { HeartboundPose } from "./heartbound-renderer";
import type { LivingCardGenome } from "./living-card-types";

type Palette = LivingCardGenome["palette"];

function headPath(shape: HeartboundPresentationV3["face"]["head"]) {
  const paths = {
    round: "M155 101Q171 22 242 8Q280-2 318 8Q389 22 405 101Q421 166 386 214Q347 258 280 262Q213 258 174 214Q139 166 155 101Z",
    tapered: "M164 91Q190 13 280 6Q370 13 396 91Q417 160 375 218L280 270L185 218Q143 160 164 91Z",
    broad: "M139 103Q148 26 240 8H320Q412 26 421 103Q431 174 388 220Q344 260 280 260Q216 260 172 220Q129 174 139 103Z",
    heart: "M151 105Q157 28 226 10Q272 0 280 41Q288 0 334 10Q403 28 409 105Q417 176 374 220Q331 258 280 277Q229 258 186 220Q143 176 151 105Z",
    long: "M177 65Q209 7 280 7Q351 7 383 65Q410 126 385 205Q358 268 280 279Q202 268 175 205Q150 126 177 65Z",
    crested: "M157 107Q164 35 225 17L280 2L335 17Q396 35 403 107Q413 174 378 219Q339 260 280 264Q221 260 182 219Q147 174 157 107Z"
  } as const;
  return paths[shape];
}

function bodyPath(p: HeartboundPresentationV3) {
  const width = Math.round(75 * p.body.torso);
  const top = p.maturity === "baby" ? 216 : 203;
  const bottom = p.maturity === "baby" ? 386 : 402;
  if (p.body.build === "serpentine") return "M225 205Q280 174 335 205Q389 237 350 290Q321 330 383 398Q305 430 249 389Q187 345 212 293Q238 241 225 205Z";
  if (p.body.build === "floating") return `M${280 - width} ${top}Q280 178 ${280 + width} ${top}Q382 283 334 ${bottom}Q280 432 226 ${bottom}Q178 283 ${280 - width} ${top}Z`;
  if (p.template === "plush-quadruped" || p.template === "guardian-beast") return `M${280 - width - 23} 226Q280 181 ${280 + width + 23} 226L409 295Q393 367 322 378H211Q151 358 153 296Z`;
  return `M${280 - width} ${top}Q280 170 ${280 + width} ${top}Q${378 + width / 5} 272 ${337 + width / 5} ${bottom}H${223 - width / 5}Q${182 - width / 5} 272 ${280 - width} ${top}Z`;
}

function eyes(p: HeartboundPresentationV3, palette: Palette) {
  const y = p.maturity === "baby" ? 139 : 143;
  const dx = 56 * p.face.eyeSpacing;
  const rx = 27 * p.face.eyeSize;
  const ry = 34 * p.face.eyeSize;
  const irisRx = rx * p.face.irisScale;
  const irisRy = ry * p.face.irisScale;
  const ink = "#102633";
  const eye = (x: number) => `<g><ellipse cx="${x}" cy="${y}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill="#fff8f2" stroke="${ink}" stroke-width="5"/><ellipse cx="${x}" cy="${y + 2}" rx="${irisRx.toFixed(2)}" ry="${irisRy.toFixed(2)}" fill="${palette.glow}"/><ellipse cx="${x}" cy="${y + 4}" rx="${(irisRx * .48).toFixed(2)}" ry="${(irisRy * .55).toFixed(2)}" fill="${ink}"/><circle cx="${x + irisRx * .32}" cy="${y - irisRy * .35}" r="${Math.max(5, irisRx * .25).toFixed(2)}" fill="#fff"/><circle cx="${x - irisRx * .2}" cy="${y + irisRy * .12}" r="${Math.max(2.8, irisRx * .12).toFixed(2)}" fill="#fff"/>${p.face.catchlights === 3 ? `<circle cx="${x + irisRx * .24}" cy="${y + irisRy * .35}" r="2.5" fill="#fff"/>` : ""}</g>`;
  const browLift = p.face.brow === "brave" ? -8 : p.face.brow === "playful" ? 3 : -3;
  return `<g data-anime-eyes="${p.face.pupil}" transform="rotate(${p.face.eyeTilt} 280 ${y})">${eye(280 - dx)}${eye(280 + dx)}<path d="M${280 - dx - 24} ${y - ry - 10}q24 ${browLift} 48 0M${280 + dx - 24} ${y - ry - 10}q24 ${browLift} 48 0" fill="none" stroke="${palette.accent}" stroke-width="6" stroke-linecap="round"/><ellipse cx="${280 - dx - 34}" cy="${y + 44}" rx="19" ry="8" fill="#ff91ac" opacity="${p.face.blush}"/><ellipse cx="${280 + dx + 34}" cy="${y + 44}" rx="19" ry="8" fill="#ff91ac" opacity="${p.face.blush}"/></g>`;
}

function mouth(p: HeartboundPresentationV3, palette: Palette) {
  if (p.face.mouth === "beak-smile") return `<g data-friendly-mouth="beak-smile"><path d="M258 185l22-13 22 13-22 17Z" fill="${palette.accent}"/><path d="M267 190q13 10 26 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g>`;
  const open = p.face.mouth === "tiny-open" ? `<path d="M268 207Q280 219 292 207Q280 235 268 207Z" fill="#7d3853"/><ellipse cx="280" cy="220" rx="7" ry="3" fill="#ff9db1"/>` : `<path d="M252 205Q266 220 280 207Q294 220 308 205" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;
  return `<g data-friendly-mouth="${p.face.mouth}"><path d="M270 184q10-8 20 0-10 11-20 0Z" fill="${palette.accent}"/>${open}</g>`;
}

export function animeHeartboundMarkup(genome: LivingCardGenome, p: HeartboundPresentationV3, pose: HeartboundPose) {
  const color = genome.palette;
  const lift = pose === "celebrate" ? -9 : pose === "damage" ? 5 : 0;
  const stride = pose === "run" ? 17 : pose === "walk" ? 9 : 0;
  const baby = p.maturity === "baby";
  const paw = Math.round(18 * p.body.paw);
  const winged = p.archetype === "bird" || p.archetype === "dragon" || p.appendages.wings !== "none";
  const longEars = p.archetype === "long-ear";
  const ears = p.appendages.ears === "none" && !longEars ? "" : longEars
    ? `<path d="M207 94Q137 21 178 4Q224 30 239 82M353 94Q423 21 382 4Q336 30 321 82" fill="${color.secondary}" stroke="${color.accent}" stroke-width="5"/>`
    : `<path d="M202 100Q153 42 174 20Q220 43 239 88M358 100Q407 42 386 20Q340 43 321 88" fill="${color.secondary}" stroke="${color.accent}" stroke-width="5"/>`;
  const horns = p.appendages.horns === "none" ? "" : `<path d="M202 89Q168 47 193 25L231 82M358 89Q392 47 367 25L329 82" fill="${color.glow}" stroke="${color.accent}" stroke-width="4"/>`;
  const wings = !winged ? "" : `<path d="M207 226Q102 118 72 225Q112 293 220 289M353 226Q458 118 488 225Q448 293 340 289" fill="${color.secondary}" stroke="${color.accent}" stroke-width="5" opacity=".92"/>`;
  const tail = p.body.build === "serpentine" || p.appendages.tail === "none" ? "" : `<path d="M374 290Q474 221 495 285Q503 341 420 351Q464 320 426 291Q407 277 374 302Z" fill="${color.secondary}" stroke="${color.accent}" stroke-width="4"/>`;
  const limbWidth = baby ? 25 : 19;
  const limbs = p.body.build === "serpentine" || p.body.build === "floating" ? { hind: "", fore: "" } : {
    hind: `<path d="M230 308q-31 38-25 77l-${paw} 14q-12 15 8 19h${58 + paw}q17-5 7-20l-12-19 ${stride - 8}-67Z" fill="${color.primary}"/><path d="M330 308q31 38 25 77l${paw} 14q12 15-8 19h-${58 + paw}q-17-5-7-20l12-19 ${8 - stride}-67Z" fill="${color.primary}"/>`,
    fore: `<path d="M218 231q-${limbWidth + 28} 27-${limbWidth + 37} 91l-${paw} 28q-9 17 10 25 20 7 31-14l14-32 ${-stride}-65Z" fill="${color.primary}"/><path d="M342 231q${limbWidth + 28} 27 ${limbWidth + 37} 91l${paw} 28q9 17-10 25-20 7-31-14l-14-32 ${stride}-65Z" fill="${color.primary}"/>`
  };
  // The genome stores a semantic head-to-body ratio; authored SVG heads are already
  // oversized, so project that ratio into a restrained transform that keeps the
  // torso, paws, and signature silhouette visible on compact cards.
  const headScale = Number((.82 + (p.body.headToBody - .9) * .22).toFixed(3));
  const headTransform = `translate(${(280 * (1 - headScale)).toFixed(2)} ${(132 * (1 - headScale)).toFixed(2)}) scale(${headScale.toFixed(3)})`;
  const marking = `<path d="M215 89Q280 ${55 + Math.round((1 - p.markings.density) * 30)} 345 89Q316 111 280 116Q244 111 215 89Z" fill="${color.accent}" opacity="${Math.min(.72, p.markings.density + .15)}"/>`;
  const crest = p.appendages.crest === "none" ? "" : `<path d="M246 67L280 10 314 67 280 88Z" fill="${color.accent}"/>`;
  const adornment = p.adornments.length ? `<path d="M177 79Q280 5 383 79" fill="none" stroke="${color.glow}" stroke-width="5" stroke-dasharray="5 11" opacity=".8"/>` : "";
  return {
    auraBack: `<ellipse cx="280" cy="226" rx="205" ry="174" fill="${color.glow}" opacity="${p.maturity === "legendary" ? .28 : .16}"/><circle cx="280" cy="219" r="${p.maturity === "legendary" ? 194 : 173}" fill="none" stroke="${color.glow}" stroke-width="3" stroke-dasharray="4 17" opacity=".45"/>`,
    tail: `${tail}${wings}`,
    hind: limbs.hind,
    torso: `<g transform="translate(0 ${lift})"><path d="${bodyPath(p)}" fill="${color.primary}" stroke="${color.accent}" stroke-width="5"/><path d="M224 241Q280 214 336 241Q326 325 280 357Q234 325 224 241Z" fill="${color.secondary}" opacity=".2"/></g>`,
    fore: limbs.fore,
    neck: `<path d="M207 221Q280 ${184 - p.body.neckClearance / 2} 353 221L334 250Q280 226 226 250Z" fill="${color.accent}" opacity=".92"/>`,
    ears: `${ears}${horns}`,
    head: `<g transform="${headTransform}"><path d="${headPath(p.face.head)}" fill="${color.primary}" stroke="${color.accent}" stroke-width="6"/></g>`,
    markings: `<g transform="${headTransform}">${marking}</g>`,
    eyes: `<g transform="${headTransform}">${eyes(p, color)}</g>`,
    mouth: `<g transform="${headTransform}">${mouth(p, color)}</g>`,
    crest: `<g transform="${headTransform}">${crest}${adornment}</g>`,
    auraFront: `<g data-motion="${p.motion.gesture}"><path d="M112 172l7-11 7 11-7 11Z" fill="${color.glow}"/><circle cx="445" cy="102" r="7" fill="${color.glow}"/></g>`
  };
}
