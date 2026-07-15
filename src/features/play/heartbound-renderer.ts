import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";
import type { LivingCardGenome } from "./living-card-types";
import { renderAppendages, renderEyes, renderHeadShape, renderLimbs, renderMarkings, renderMouth, renderTorso } from "./heartbound-shapes";
import { animeHeartboundMarkup } from "./heartbound-anime-shapes";

export type HeartboundPose = "idle" | "card" | "walk" | "run" | "battle" | "damage" | "celebrate" | "bond" | "transform";
export type HeartboundSlot =
  | "aura_back" | "tail" | "left_hindlimb" | "right_hindlimb" | "torso"
  | "left_forelimb" | "right_forelimb" | "neck_ruff" | "ears_back" | "head"
  | "face_markings" | "eyes" | "mouth" | "crest_front" | "aura_front";

export type HeartboundLayer = { slot: HeartboundSlot; markup: string };

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function layer(slot: HeartboundSlot, markup: string): HeartboundLayer {
  return { slot, markup: `<g data-slot="${slot}">${markup}</g>` };
}

function legacyHeartboundLayers(genome: LivingCardGenome, pose: HeartboundPose): HeartboundLayer[] {
  const p = genome.palette;
  const stride = pose === "run" ? 18 : pose === "walk" ? 9 : 0;
  const lift = pose === "celebrate" ? -12 : pose === "damage" ? 8 : 0;
  const tail = genome.appendages.tail === "none" ? "" : `<path d="M391 238q96-62 105 8 5 45-72 54 52-31 7-62-17-12-45 12Z" fill="${p.secondary}"/>`;
  const ears = genome.appendages.ears === "none" ? "" : `<path d="M189 113 142 25l91 57m98 31 47-88-91 57" fill="${p.accent}"/>`;
  const crest = genome.appendages.crest === "none" ? "" : `<path d="m260 67 28-52 26 52-27 22Z" fill="${p.accent}"/>`;
  return [
    layer("aura_back", `<ellipse cx="280" cy="220" rx="206" ry="174" fill="${p.glow}" opacity="${Math.min(.3, genome.auraProfile.intensity / 4)}"/>`),
    layer("tail", tail),
    layer("left_hindlimb", `<path d="M225 260q-37 39-33 104l-24 31q-9 18 15 20h70q19-3 9-22l-17-31 26-94Z" fill="${p.primary}" transform="translate(${-stride} 0)"/>`),
    layer("right_hindlimb", `<path d="M337 260q37 39 33 104l24 31q9 18-15 20h-70q-19-3-9-22l17-31-26-94Z" fill="${p.primary}" transform="translate(${stride} 0)"/>`),
    layer("torso", `<path d="M192 191q88-62 176 0 47 47 29 143-10 57-66 83H229q-56-26-66-83-18-96 29-143Z" fill="${p.primary}" stroke="${p.accent}" stroke-width="5" transform="translate(0 ${lift})"/>`),
    layer("left_forelimb", `<path d="M200 220q-55 25-69 85l-35 39q-10 19 13 28 25 9 39-17l18-35 61-51Z" fill="${p.primary}" transform="rotate(${-stride / 2} 190 230)"/>`),
    layer("right_forelimb", `<path d="M360 220q55 25 69 85l35 39q10 19-13 28-25 9-39-17l-18-35-61-51Z" fill="${p.primary}" transform="rotate(${stride / 2} 370 230)"/>`),
    layer("neck_ruff", `<path d="m194 195 34-44 52 19 52-19 34 44-37 38-49-17-49 17Z" fill="${p.accent}"/>`),
    layer("ears_back", ears),
    layer("head", `<path d="M154 101q18-91 126-96 109 5 126 96 19 62-18 113-35 49-108 52-73-3-108-52-37-51-18-113Z" fill="${p.primary}" stroke="${p.accent}" stroke-width="6"/>`),
    layer("face_markings", `<path d="M215 87q65-43 130 0" fill="none" stroke="${p.accent}" stroke-width="12" stroke-linecap="round"/>`),
    layer("eyes", `<ellipse cx="221" cy="142" rx="27" ry="35" fill="#142c32"/><ellipse cx="339" cy="142" rx="27" ry="35" fill="#142c32"/><circle cx="230" cy="130" r="10" fill="#fff"/><circle cx="348" cy="130" r="10" fill="#fff"/>`),
    layer("mouth", `<path d="m280 169 15 13-15 15-15-15Z" fill="${p.accent}"/><path d="M250 209q30 29 60 0" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`),
    layer("crest_front", crest),
    layer("aura_front", `<circle cx="442" cy="94" r="8" fill="${p.glow}"/><circle cx="116" cy="175" r="6" fill="${p.glow}"/>`)
  ];
}

export function heartboundLayers(genome: LivingCardGenome, pose: HeartboundPose): HeartboundLayer[] {
  if (genome.generatorVersion === 3 && genome.presentation) {
    const art = animeHeartboundMarkup(genome, genome.presentation, pose);
    return [
      layer("aura_back", art.auraBack), layer("tail", art.tail),
      layer("left_hindlimb", art.hind), layer("right_hindlimb", ""),
      layer("torso", art.torso), layer("left_forelimb", art.fore), layer("right_forelimb", ""),
      layer("neck_ruff", art.neck), layer("ears_back", art.ears), layer("head", art.head),
      layer("face_markings", art.markings), layer("eyes", art.eyes), layer("mouth", art.mouth),
      layer("crest_front", art.crest), layer("aura_front", art.auraFront)
    ];
  }
  if (genome.generatorVersion !== 2 || !genome.identity) return legacyHeartboundLayers(genome, pose);
  const identity = genome.identity;
  const p = genome.palette;
  const appendages = renderAppendages(identity, p);
  const limbs = renderLimbs(identity, p, pose);
  const auraOpacity = Math.min(.34, genome.auraProfile.intensity / 3.6);
  return [
    layer("aura_back", `<ellipse cx="280" cy="223" rx="${194 + identity.body.shoulder * 12}" ry="${164 + identity.body.torso * 8}" fill="${p.glow}" opacity="${auraOpacity}"/><path d="M102 255Q280 58 458 255" fill="none" stroke="${p.glow}" stroke-width="3" stroke-dasharray="4 18" opacity=".5"/>`),
    layer("tail", `${appendages.tail}${appendages.wings}`),
    layer("left_hindlimb", limbs.leftHind),
    layer("right_hindlimb", limbs.rightHind),
    layer("torso", renderTorso(identity, p, pose)),
    layer("left_forelimb", limbs.leftFore),
    layer("right_forelimb", limbs.rightFore),
    layer("neck_ruff", `<path d="M196 198Q280 ${145 + identity.body.neck * 10} 364 198L338 235Q280 209 222 235Z" fill="${p.accent}" opacity=".9"/>`),
    layer("ears_back", appendages.ears),
    layer("head", renderHeadShape(identity, p)),
    layer("face_markings", renderMarkings(identity, p)),
    layer("eyes", renderEyes(identity, p)),
    layer("mouth", renderMouth(identity, p)),
    layer("crest_front", appendages.crest),
    layer("aura_front", `<g data-gesture="${identity.behavior.gesture}"><circle cx="442" cy="94" r="8" fill="${p.glow}"/><path d="M111 177l7-11 7 11-7 11Z" fill="${p.glow}"/></g>`)
  ];
}

export function renderHeartboundSvg(genome: LivingCardGenome, pose: HeartboundPose, options: { width: number; height: number; title: string; fit?: "native" | "full-body" }) {
  const body = heartboundLayers(genome, pose).map((item) => item.markup).join("");
  const framing = options.fit ?? "native";
  const scale = framing === "full-body" ? Number((genome.variant.bodyScale * 0.82).toFixed(3)) : genome.variant.bodyScale;
  const identity = genome.identity;
  const presentation = genome.presentation;
  const presentationAttributes = presentation ? ` data-presentation-signature="${presentation.signature}" data-template="${presentation.template}" data-archetype="${presentation.archetype}" data-maturity="${presentation.maturity}"` : "";
  const identityAttributes = identity ? ` data-identity-signature="${identity.signature}" data-body-build="${identity.body.build}" data-locomotion="${identity.family.locomotion}" style="--heartbound-blink:${identity.behavior.blinkMs}ms;--heartbound-idle:${genome.behavior.idleCadenceMs}ms;--heartbound-gesture:${Math.round((identity.behavior.blinkMs + genome.behavior.idleCadenceMs) / 2)}ms"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" data-heartbound="heroic-companion"${identityAttributes}${presentationAttributes} width="${options.width}" height="${options.height}" viewBox="0 0 560 440" role="img" aria-label="${xml(options.title)} full-body companion"><g data-framing="${framing}" transform="translate(0 8) scale(${scale})" transform-origin="280px 220px">${body}</g></svg>`;
}

export function renderedHeartboundDigest(genome: LivingCardGenome, pose: HeartboundPose, title: string) {
  return sha256PortableBasis(canonicalPortableCardJson({ renderer: genome.generatorVersion === 3 ? "heartbound.v3" : "heartbound.v1", pose, title, genome }));
}
