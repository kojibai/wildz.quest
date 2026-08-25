import type { CreatureSpecialtyFamily } from "./creature-capability-identity";
import type { WildsVisibleWorkFamily } from "./wilds-work-capability";

export type WildsWorldCapabilityFamily = CreatureSpecialtyFamily | WildsVisibleWorkFamily;

export type WildsCapabilityIconKey =
  | CreatureSpecialtyFamily
  | "timber"
  | "quarry";

export type WildsCapabilityActionKind = "aerial" | "aquatic" | "route" | "sustained" | "source" | "support";
export type WildsCapabilityContextKind =
  | "open-air"
  | "launch"
  | "deep-water"
  | "water-column"
  | "water-flow"
  | "climb-face"
  | "excavation"
  | "narrow-crossing"
  | "darkness"
  | "cover"
  | "trace"
  | "breakable"
  | "hazard"
  | "force"
  | "emergency"
  | "tree"
  | "stone";

export type WildsCapabilityProgressionDimension =
  | "duration"
  | "lift"
  | "recovery"
  | "control"
  | "range"
  | "speed"
  | "depth"
  | "pressure"
  | "height"
  | "grip"
  | "precision"
  | "efficiency"
  | "stability"
  | "radius"
  | "clarity"
  | "blend"
  | "force"
  | "strength"
  | "margin"
  | "yield";

export type WildsCapabilityDefinition = Readonly<{
  family: WildsWorldCapabilityFamily;
  label: string;
  icon: WildsCapabilityIconKey;
  actionKind: WildsCapabilityActionKind;
  contextKind: WildsCapabilityContextKind;
  baseCost: number;
  progression: readonly WildsCapabilityProgressionDimension[];
  actorPose: string;
  worldEffect: string;
  ready: string;
  guidance: string;
}>;

function define(
  family: WildsWorldCapabilityFamily,
  label: string,
  icon: WildsCapabilityIconKey,
  actionKind: WildsCapabilityActionKind,
  contextKind: WildsCapabilityContextKind,
  baseCost: number,
  progression: readonly WildsCapabilityProgressionDimension[],
  actorPose: string,
  worldEffect: string,
  ready: string,
  guidance: string
): WildsCapabilityDefinition {
  return Object.freeze({
    family,
    label,
    icon,
    actionKind,
    contextKind,
    baseCost,
    progression: Object.freeze([...progression]),
    actorPose,
    worldEffect,
    ready,
    guidance
  });
}

export const WILDS_WORLD_CAPABILITY_REGISTRY = Object.freeze({
  flight: define("flight", "Flight", "flight", "aerial", "open-air", 3, ["duration", "lift", "recovery"], "powered-flight", "lift-wake", "Open sky is within reach.", "Move into open sky to take flight."),
  glide: define("glide", "Glide", "glide", "aerial", "launch", 1, ["duration", "control", "range"], "glide-spread", "glide-ribbon", "A launch edge is within reach.", "The nearest safe launch edge is marked."),
  swim: define("swim", "Swim", "swim", "aquatic", "deep-water", 2, ["duration", "speed", "recovery"], "aquatic-stroke", "water-column", "Deep water is within reach.", "The nearest deep-water entry is marked."),
  dive: define("dive", "Dive", "dive", "aquatic", "water-column", 3, ["depth", "duration", "pressure"], "dive-pitch", "depth-column", "The water column continues below.", "Enter deep water to dive."),
  current: define("current", "Read current", "current", "route", "water-flow", 2, ["range", "speed", "control"], "current-read", "current-ribbon", "A living current is readable here.", "The nearest readable current is marked."),
  climb: define("climb", "Climb", "climb", "route", "climb-face", 3, ["height", "grip", "recovery"], "climb-grip", "grip-line", "A climbable face is within reach.", "The nearest climb-readable face is marked."),
  burrow: define("burrow", "Burrow", "burrow", "source", "excavation", 4, ["depth", "precision", "efficiency"], "burrow-dig", "earth-arc", "Compatible ground is within reach.", "Move beside compatible soil or qualified rock."),
  balance: define("balance", "Balance", "balance", "support", "narrow-crossing", 2, ["stability", "range", "recovery"], "balance-center", "footing-line", "A narrow crossing is within reach.", "The nearest balance-readable crossing is marked."),
  light: define("light", "Living light", "light", "sustained", "darkness", 1, ["radius", "duration", "clarity"], "living-light", "light-field", "Living light is ready.", "Light can awaken here whenever you need it."),
  camouflage: define("camouflage", "Camouflage", "camouflage", "sustained", "cover", 1, ["duration", "blend", "recovery"], "camouflage-blend", "cover-field", "Compatible cover surrounds you.", "Move near terrain cover to strengthen the blend."),
  track: define("track", "Track", "track", "route", "trace", 1, ["range", "precision", "clarity"], "track-read", "trace-ribbon", "A proof-sealed trace is nearby.", "Fresh admitted traces will awaken this sense."),
  break: define("break", "Break", "break", "source", "breakable", 4, ["force", "precision", "efficiency"], "break-impact", "fracture-burst", "A cracked obstacle is within reach.", "Only cracked or explicitly breakable sources respond."),
  resist: define("resist", "Resist", "resist", "sustained", "hazard", 2, ["strength", "duration", "range"], "resist-stance", "resistance-envelope", "A matching hazard is present.", "This protection awakens beside a matching hazard."),
  anchor: define("anchor", "Anchor", "anchor", "sustained", "force", 2, ["strength", "duration", "range"], "anchor-stance", "anchor-line", "A physical force can be held here.", "Anchor awakens against current, wind, or unstable footing."),
  rescue: define("rescue", "Rescue", "rescue", "support", "emergency", 4, ["range", "margin", "recovery"], "rescue-reach", "rescue-tether", "Someone nearby needs safe intervention.", "The nearby party is safe."),
  lumber: define("lumber", "Gather timber", "timber", "source", "tree", 3, ["yield", "efficiency", "recovery"], "lumber-work", "timber-chips", "A ready tree is within reach.", "The nearest ready tree is marked."),
  quarry: define("quarry", "Gather stone", "quarry", "source", "stone", 3, ["yield", "precision", "recovery"], "quarry-work", "stone-sparks", "A ready stone is within reach.", "The nearest ready stone is marked.")
} satisfies Readonly<Record<WildsWorldCapabilityFamily, WildsCapabilityDefinition>>);

