import type { PortableCardAsset } from "../../features/play/portable-card";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import type { WildzProofSession } from "./wildz-proof-session";
import { verifyWildzVaultCardMembershipProof } from "./wildz-vault-card-admission";

export function canCurrentWildzOwnerObserveCreature(input: Readonly<{
  actorId: string;
  profileHandle: string;
  proofSession: WildzProofSession | null;
  card: PortableCardAsset;
  cardAdmission: unknown;
}>) {
  if (!sameWildzPlayerCoordinate(input.actorId, input.profileHandle)) return false;
  if (sameWildzPlayerCoordinate(input.card.manifest.ownerReceizId, input.profileHandle)) return true;
  const root = input.proofSession?.vaultCardRootSha256;
  return Boolean(root && verifyWildzVaultCardMembershipProof({
    expectedRoot: root,
    expectedPlayerHandle: input.profileHandle,
    card: input.card,
    proof: input.cardAdmission
  }));
}
