import { admitVerifiedWildsV11LocalCard, type WildsV11LocalCard } from "./wilds-portable-card-v11";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";

export type WildsV11CollectionAdmission = Readonly<{
  cards: readonly WildsV11LocalCard[];
  rejected: readonly number[];
}>;

/** Evidence is never promoted by Vault shape or payload digest alone. Each birth is replayed offline. */
export async function admitWildsV11Collection(input: {
  evidence: readonly WildsV11LocalCard[];
  ownerId: string;
  pinnedKeys: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  yieldToFrame?: () => Promise<void>;
}): Promise<WildsV11CollectionAdmission> {
  const selected = new Map<string, WildsV11LocalCard>();
  const rejected: number[] = [];
  for (let index = 0; index < input.evidence.length; index += 1) {
    if (input.signal?.aborted) throw new Error("wilds_v11_collection_aborted");
    const value = input.evidence[index]!;
    if (value.ownerId !== input.ownerId && !sameWildzPlayerCoordinate(value.ownerId, input.ownerId)) { rejected.push(index); continue; }
    try {
      const card = await admitVerifiedWildsV11LocalCard(value, input.pinnedKeys);
      const previous = selected.get(card.id);
      // This chooses a stable presentation envelope, never an ownership or chronology head.
      if (!previous || card.proofDigest < previous.proofDigest) selected.set(card.id, card);
    } catch {
      rejected.push(index);
    }
    if ((index + 1) % 8 === 0 && input.yieldToFrame) await input.yieldToFrame();
  }
  if (input.signal?.aborted) throw new Error("wilds_v11_collection_aborted");
  return { cards: [...selected.values()].sort((a, b) => a.id.localeCompare(b.id)), rejected };
}
