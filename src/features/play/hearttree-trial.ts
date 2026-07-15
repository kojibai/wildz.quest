import { canonicalPortableCardJson, sha256PortableBasis, verifiedPortableCardPin, type PortableCardAsset } from "./portable-card";

export type HearttreeIntent = "pulse" | "north" | "guard" | "ability:0";
export type HearttreeTrialEvent = { id: string; intent: HearttreeIntent; message: string };
export type HearttreeTrialState = {
  seed: string;
  admittedAssetId: string;
  admittedProofDigest: string;
  phase: "trial" | "master" | "result";
  chamber: number;
  chamberOrder: readonly string[];
  cluePattern: readonly string[];
  clueRevealed: boolean;
  guard: number;
  masterPower: number;
  masterHealth: number;
  events: HearttreeTrialEvent[];
  reward: { id: string; unlockId: "hearttree-awakened"; kind: "achievement"; label: string } | null;
};

function boundedSeed(seed: string, proofDigest: string) {
  if (!seed.trim() || seed.length > 128) throw new Error("hearttree_seed_invalid");
  return sha256PortableBasis(canonicalPortableCardJson({ seed, proofDigest, activity: "hearttree.v1" }));
}

export function createHearttreeTrial(seed: string, card: PortableCardAsset): HearttreeTrialState {
  const pin = verifiedPortableCardPin(card);
  const digest = boundedSeed(seed, pin.proofDigest);
  const chamberNames = ["Root Memory", "Moonwell", "First Promise", "Crown Door"];
  const offset = Number.parseInt(digest.slice(7, 9), 16) % chamberNames.length;
  const chamberOrder = [...chamberNames.slice(offset), ...chamberNames.slice(0, offset)];
  const cluePattern = Array.from({ length: 3 }, (_, index) => ["leaf", "star", "ember", "wave"][Number.parseInt(digest.slice(9 + index * 2, 11 + index * 2), 16) % 4]!);
  return {
    seed: digest,
    admittedAssetId: pin.assetId,
    admittedProofDigest: pin.proofDigest,
    phase: "trial",
    chamber: 0,
    chamberOrder,
    cluePattern,
    clueRevealed: false,
    guard: 0,
    masterPower: 18 + (Number.parseInt(digest.slice(17, 19), 16) % 8),
    masterHealth: 1,
    events: [],
    reward: null
  };
}

export function applyHearttreeIntent(state: HearttreeTrialState, intent: HearttreeIntent): HearttreeTrialState {
  if (state.phase === "result") return state;
  let next: HearttreeTrialState = state;
  let message = "The Hearttree listens.";
  if (intent === "pulse" && state.phase === "trial") {
    next = { ...state, clueRevealed: true };
    message = `Memory pattern: ${state.cluePattern.join(" · ")}.`;
  } else if (intent === "north" && state.phase === "trial" && state.clueRevealed) {
    const chamber = Math.min(state.chamber + 1, state.chamberOrder.length - 1);
    next = { ...state, chamber, phase: chamber >= 1 ? "master" : "trial" };
    message = chamber >= 1 ? "The Root Master steps from the living bark." : `Entered ${state.chamberOrder[chamber]}.`;
  } else if (intent === "guard" && state.phase === "master") {
    next = { ...state, guard: Math.min(3, state.guard + 1) };
    message = "Your card remembers every hand that protected it.";
  } else if (intent === "ability:0" && state.phase === "master" && state.guard > 0) {
    next = {
      ...state,
      masterHealth: 0,
      phase: "result",
      reward: { id: `hearttree:${state.admittedProofDigest.slice(7, 23)}`, unlockId: "hearttree-awakened", kind: "achievement", label: "Hearttree Awakened" }
    };
    message = "The Root Master bows. Your lineage has awakened.";
  }
  const index = state.events.length + 1;
  const event = { id: sha256PortableBasis(`${state.seed}:${index}:${intent}`), intent, message };
  return { ...next, events: [...state.events, event] };
}
