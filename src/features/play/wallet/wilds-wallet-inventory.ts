import type { WildsStewardPhiAwardV1 } from "../wilds-steward-construction";

export function totalWildsStewardPhiMicro(
  awards: readonly Pick<WildsStewardPhiAwardV1, "amountPhiMicro">[]
) {
  return awards.reduce((total, award) => {
    if (!/^[0-9]+$/.test(award.amountPhiMicro)) throw new Error("wilds_wallet_phi_award_invalid");
    return total + BigInt(award.amountPhiMicro);
  }, 0n).toString();
}

