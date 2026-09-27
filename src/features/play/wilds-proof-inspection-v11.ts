import { verifyWildsV11Birth, WILDS_CREATURE_CARD_V11, type WildsV11CreatureCard } from "./wilds-card-proof-v11";
import { verifyEncounterResultV11, WILDS_ENCOUNTER_PROOF_V11, type WildsV11EncounterResult } from "./wilds-encounter-proof-v11";
import { verifyLocalWildsV11Card, WILDS_V11_LOCAL_CARD_SCHEMA, type WildsV11LocalCard } from "./wilds-portable-card-v11";
import { WILDS_V11_CONFORMANCE_KEY_ID, WILDS_V11_CONFORMANCE_PUBLIC_KEYS } from "./wilds-v11-conformance-keys";
import { WILDS_V11_ENCOUNTER_PUBLIC_KEYS } from "./wilds-v11-release-keys";

export type WildsProofInspectionV11 = Readonly<{
  artifact: "encounter" | "birth" | "local-card";
  example: boolean;
  result: WildsV11EncounterResult;
  birth?: WildsV11CreatureCard["birth"];
}>;

/** Offline-only. A local card seal establishes intact bytes, not globally admitted custody. */
export async function inspectWildsProofFile(value: unknown): Promise<WildsProofInspectionV11 | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    const schema = (value as { schema?: unknown }).schema;
    const artifact = schema === WILDS_V11_LOCAL_CARD_SCHEMA ? "local-card"
      : schema === WILDS_CREATURE_CARD_V11 ? "birth"
        : schema === WILDS_ENCOUNTER_PROOF_V11 ? "encounter" : null;
    if (!artifact) return null;
    const localCard = artifact === "local-card" ? value as WildsV11LocalCard : null;
    const card = artifact === "birth" ? value as WildsV11CreatureCard : localCard?.birth;
    const result = card?.encounter ?? value as WildsV11EncounterResult;
    const example = result.input?.keyId === WILDS_V11_CONFORMANCE_KEY_ID;
    const keys = example ? WILDS_V11_CONFORMANCE_PUBLIC_KEYS : WILDS_V11_ENCOUNTER_PUBLIC_KEYS;
    const verified = localCard ? await verifyLocalWildsV11Card(localCard, keys)
      : card ? await verifyWildsV11Birth(card, keys)
        : await verifyEncounterResultV11(result, keys);
    return verified ? { artifact, example, result, ...(card ? { birth: card.birth } : {}) } : null;
  } catch {
    return null;
  }
}
