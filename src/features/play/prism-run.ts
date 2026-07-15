import { canonicalPortableCardJson, sha256PortableBasis, verifiedPortableCardPin, type PortableCardAsset } from "./portable-card";

export type PrismIntent = "sync" | "left" | "right" | "burst";
export type PrismRunState = {
  seed: string;
  admittedAssetId: string;
  admittedProofDigest: string;
  phase: "syncing" | "run" | "result";
  harmony: number;
  leftGate: boolean;
  rightGate: boolean;
  worldName: string;
  events: Array<{ id: string; intent: PrismIntent; message: string }>;
  reward: { id: string; unlockId: "prism-trail"; kind: "cosmetic"; label: string } | null;
};

export function createPrismRun(seed: string, card: PortableCardAsset): PrismRunState {
  const pin = verifiedPortableCardPin(card);
  if (!seed.trim() || seed.length > 128) throw new Error("prism_seed_invalid");
  const digest = sha256PortableBasis(canonicalPortableCardJson({ activity: "prism.v1", proofDigest: pin.proofDigest, seed }));
  const worlds = ["Chromafall", "Neon Orchard", "Glasswave", "Star Circuit"];
  return {
    seed: digest,
    admittedAssetId: pin.assetId,
    admittedProofDigest: pin.proofDigest,
    phase: "syncing",
    harmony: 0,
    leftGate: false,
    rightGate: false,
    worldName: worlds[Number.parseInt(digest.slice(7, 9), 16) % worlds.length]!,
    events: [],
    reward: null
  };
}

export function applyPrismIntent(state: PrismRunState, intent: PrismIntent): PrismRunState {
  if (state.phase === "result") return state;
  let next = state;
  let message = "The prism hums in four colors.";
  if (intent === "sync") {
    next = { ...state, phase: "run", harmony: Math.max(1, state.harmony) };
    message = `Linked to ${state.worldName}. Follow the light together.`;
  } else if (intent === "left" && state.phase === "run") {
    next = { ...state, leftGate: true, harmony: Math.min(3, state.harmony + 1) };
    message = "Cyan lane aligned.";
  } else if (intent === "right" && state.phase === "run") {
    next = { ...state, rightGate: true, harmony: Math.min(3, state.harmony + 1) };
    message = "Magenta lane aligned.";
  } else if (intent === "burst" && state.leftGate && state.rightGate) {
    next = {
      ...state,
      harmony: 4,
      phase: "result",
      reward: { id: `prism:${state.admittedProofDigest.slice(7, 23)}`, unlockId: "prism-trail", kind: "cosmetic", label: "Prism Trail" }
    };
    message = "Harmony burst! A permanent light trail joins your explorer.";
  }
  const index = state.events.length + 1;
  return { ...next, events: [...state.events, { id: sha256PortableBasis(`${state.seed}:${index}:${intent}`), intent, message }] };
}
