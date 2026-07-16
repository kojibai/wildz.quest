import { sha256PortableBasis } from "./portable-card";
import type { WildsEcologyFamilyId, WildsEcologySite } from "./wilds-ecology";

export type WildsEcologyActivityPhase = "ready" | "active" | "submitted";
export type WildsEcologyActivityInput = "attune" | "carry" | "seal" | "trace" | "listen" | "align" | "anchor" | "channel" | "release" | "gather" | "answer" | "celebrate" | "call" | "guide" | "shelter" | "water" | "shield" | "harvest" | "brace" | "repair" | "ground" | "signal" | "rescue" | "rebuild";

export type WildsEcologyObjective = {
  id: string;
  label: string;
  hint: string;
  input: WildsEcologyActivityInput;
};

export type WildsEcologyActivity = {
  schema: "receiz.wilds_ecology_activity.v1";
  id: string;
  siteId: string;
  familyId: WildsEcologyFamilyId;
  moduleId: string;
  title: string;
  instruction: string;
  objectives: readonly WildsEcologyObjective[];
  sequence: readonly WildsEcologyActivityInput[];
  phase: WildsEcologyActivityPhase;
  progress: number;
  misses: number;
  message: string;
};

type ModuleDefinition = Pick<WildsEcologyActivity, "moduleId" | "title" | "instruction"> & { steps: readonly [WildsEcologyActivityInput, string, string][] };

const MODULES: Record<WildsEcologyFamilyId, ModuleDefinition> = {
  "wandering-market": { moduleId: "verified-delivery", title: "The Lantern Delivery", instruction: "Attune a verified companion, carry the parcel, then seal its handoff.", steps: [["attune", "Attune", "Pin your verified card"], ["carry", "Carry", "Cross the market trail"], ["seal", "Seal", "Confirm the receiving mark"]] },
  "echo-ruin": { moduleId: "symbol-route", title: "The Remembered Route", instruction: "Read the ruin in the order its builders left behind.", steps: [["listen", "Listen", "Find the first echo"], ["trace", "Trace", "Follow the carved route"], ["align", "Align", "Restore the final symbol"]] },
  "unstable-portal": { moduleId: "node-stabilization", title: "Prism Stabilization", instruction: "Anchor the near ring before releasing its stored charge.", steps: [["anchor", "Anchor", "Hold the near node"], ["channel", "Channel", "Balance the prism current"], ["release", "Release", "Close the unstable loop"]] },
  "convergence-festival": { moduleId: "public-harmony", title: "Convergence Chorus", instruction: "Join the public rhythm and complete its shared refrain.", steps: [["gather", "Gather", "Take your place"], ["answer", "Answer", "Return the world phrase"], ["celebrate", "Celebrate", "Raise the convergence light"]] },
  "creature-migration": { moduleId: "migration-escort", title: "Lumen Herd Escort", instruction: "Call the herd, guide its turn, and shelter the youngest crossing.", steps: [["call", "Call", "Signal the moving herd"], ["guide", "Guide", "Hold the safe route"], ["shelter", "Shelter", "Guard the final crossing"]] },
  "resource-bloom": { moduleId: "bloom-sustain", title: "Lumen Bloomkeeping", instruction: "Water the roots, shield the glow, then harvest without breaking the field.", steps: [["water", "Water", "Wake the root lattice"], ["shield", "Shield", "Hold the bloom temperature"], ["harvest", "Harvest", "Take only the offered light"]] },
  stormfront: { moduleId: "shelter-repair", title: "Stormline Repair", instruction: "Brace the shelter, repair its conductor, and ground the storm charge.", steps: [["brace", "Brace", "Hold the windward frame"], ["repair", "Repair", "Reconnect the conductor"], ["ground", "Ground", "Send the charge to earth"]] },
  "settlement-distress": { moduleId: "rescue-stations", title: "Wayfinder Rescue", instruction: "Signal the lost party, guide them home, then rebuild the edge beacon.", steps: [["signal", "Signal", "Answer the distress pulse"], ["rescue", "Rescue", "Bring the party through"], ["rebuild", "Rebuild", "Restore the boundary light"]] }
};

export function createWildsEcologyActivity(site: WildsEcologySite): WildsEcologyActivity {
  const definition = MODULES[site.familyId];
  const objectives = definition.steps.map(([input, label, hint], index) => ({ id: `${definition.moduleId}:${index + 1}`, label, hint, input }));
  const digest = sha256PortableBasis(`${site.seedDigest}:${definition.moduleId}`);
  return {
    schema: "receiz.wilds_ecology_activity.v1",
    id: `ecology-activity:${digest.slice("sha256:".length, "sha256:".length + 24)}`,
    siteId: site.id,
    familyId: site.familyId,
    moduleId: definition.moduleId,
    title: definition.title,
    instruction: definition.instruction,
    objectives,
    sequence: objectives.map((objective) => objective.input),
    phase: "ready",
    progress: 0,
    misses: 0,
    message: "The site is listening. Begin when your party is ready."
  };
}

export function applyWildsEcologyActivityInput(state: WildsEcologyActivity, input: WildsEcologyActivityInput): WildsEcologyActivity {
  if (state.phase === "submitted") return state;
  const expected = state.sequence[state.progress];
  if (input !== expected) return { ...state, phase: "active", misses: state.misses + 1, message: "The pattern slipped. Read the living signal and try the current step again." };
  const progress = state.progress + 1;
  const submitted = progress === state.objectives.length;
  return {
    ...state,
    phase: submitted ? "submitted" : "active",
    progress,
    message: submitted ? "Contribution pattern complete. The canonical world can now admit it." : `${state.objectives[progress - 1]?.label ?? "Step"} held. The next signal is ready.`
  };
}
