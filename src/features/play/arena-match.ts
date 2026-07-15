import { canonicalPortableCardJson, sha256PortableBasis, verifiedPortableCardPin, type PortableCardAsset } from "./portable-card";

export type ArenaIntent = "focus" | "guard" | "strike";
export type ArenaMatchState = {
  seed: string;
  admittedAssetId: string;
  admittedProofDigest: string;
  phase: "duel" | "result";
  focus: number;
  guard: number;
  rivalHealth: number;
  rivalName: string;
  streak: number;
  events: Array<{ id: string; intent: ArenaIntent; message: string }>;
  reward: { id: string; unlockId: "echo-victor"; kind: "achievement"; label: string } | null;
};

export function createArenaMatch(seed: string, card: PortableCardAsset): ArenaMatchState {
  const pin = verifiedPortableCardPin(card);
  if (!seed.trim() || seed.length > 128) throw new Error("arena_seed_invalid");
  const digest = sha256PortableBasis(canonicalPortableCardJson({ activity: "arena.v1", proofDigest: pin.proofDigest, seed }));
  const rivals = ["The Golden Echo", "Vanta Keeper", "Crownless One", "The Last Bell"];
  return {
    seed: digest,
    admittedAssetId: pin.assetId,
    admittedProofDigest: pin.proofDigest,
    phase: "duel",
    focus: 0,
    guard: 0,
    rivalHealth: 2,
    rivalName: rivals[Number.parseInt(digest.slice(7, 9), 16) % rivals.length]!,
    streak: 0,
    events: [],
    reward: null
  };
}

export function applyArenaIntent(state: ArenaMatchState, intent: ArenaIntent): ArenaMatchState {
  if (state.phase === "result") return state;
  let next = state;
  let message = "The arena waits for your move.";
  if (intent === "focus") {
    next = { ...state, focus: Math.min(2, state.focus + 1) };
    message = "Your card reads the rival's echo.";
  } else if (intent === "guard" && state.focus > 0) {
    next = { ...state, guard: Math.min(2, state.guard + 1), streak: state.streak + 1 };
    message = "Perfect guard. The crowd becomes a wave.";
  } else if (intent === "strike" && state.focus > 0) {
    const rivalHealth = Math.max(0, state.rivalHealth - 1);
    next = rivalHealth === 0 ? {
      ...state,
      rivalHealth,
      phase: "result",
      streak: state.streak + 1,
      reward: { id: `arena:${state.admittedProofDigest.slice(7, 23)}`, unlockId: "echo-victor", kind: "achievement", label: "Echo Victor" }
    } : { ...state, rivalHealth, streak: state.streak + 1 };
    message = rivalHealth === 0 ? `${state.rivalName} yields. Your victory is sealed.` : "A clean strike rings through every tier.";
  }
  const index = state.events.length + 1;
  return { ...next, events: [...state.events, { id: sha256PortableBasis(`${state.seed}:${index}:${intent}`), intent, message }] };
}
