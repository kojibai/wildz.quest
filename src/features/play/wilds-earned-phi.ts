import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { verifyWildsStewardPhiAward, type WildsStewardPhiAwardV1 } from "./wilds-steward-construction";

const verifiedRecords = new Map<string, boolean>();
const MAX_VERIFIED_RECORDS = 2_048;

function isVerifiedAward(award: WildsStewardPhiAwardV1): boolean {
  // Worker snapshots clone records, so object identity cannot cache their hashes.
  // Every award field is a string. Include every own data field in the cache
  // key; do not let getters, toJSON or nested objects disguise a changed record.
  const descriptors = Object.getOwnPropertyDescriptors(award);
  if (Object.getOwnPropertySymbols(award).length || Object.values(descriptors).some((field) => !field.enumerable || !("value" in field) || typeof field.value !== "string")) return false;
  const serialized = JSON.stringify(Object.fromEntries(Object.entries(descriptors).map(([key, field]) => [key, field.value])));
  const cached = verifiedRecords.get(serialized);
  if (cached !== undefined) {
    verifiedRecords.delete(serialized);
    verifiedRecords.set(serialized, cached);
    return cached;
  }
  const valid = verifyWildsStewardPhiAward(award);
  if (verifiedRecords.size >= MAX_VERIFIED_RECORDS) verifiedRecords.delete(verifiedRecords.keys().next().value!);
  verifiedRecords.set(serialized, valid);
  return valid;
}

/** Display projection of admitted world awards; never a network wallet balance or credit. */
export function projectWildsEarnedPhi(input: Readonly<{
  awards: readonly WildsStewardPhiAwardV1[];
  ownerReceizId: string;
  previousAwardIds?: readonly string[];
}>): Readonly<{ totalPhiMicro: string; freshPhiMicro: string; awardIds: readonly string[]; freshAwardCount: number }> {
  const prior = new Set(input.previousAwardIds ?? []);
  const awardIds = new Set<string>();
  const operationIds = new Set<string>();
  let total = 0n;
  let fresh = 0n;
  let freshAwardCount = 0;
  for (const award of input.awards) {
    if (!award || typeof award !== "object") continue;
    const valid = isVerifiedAward(award);
    if (!valid || !(award.ownerReceizId === input.ownerReceizId || sameWildzPlayerCoordinate(award.ownerReceizId, input.ownerReceizId))
      || awardIds.has(award.awardId) || operationIds.has(award.operationId)) continue;
    awardIds.add(award.awardId);
    operationIds.add(award.operationId);
    const amount = BigInt(award.amountPhiMicro);
    total += amount;
    if (!prior.has(award.awardId)) {
      fresh += amount;
      freshAwardCount += 1;
    }
  }
  return { totalPhiMicro: total.toString(), freshPhiMicro: fresh.toString(), awardIds: [...awardIds], freshAwardCount };
}
