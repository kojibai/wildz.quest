import { receizBase64UrlDecode, receizBase64UrlEncode } from "@receiz/sdk";
import { verifyPortableCardPng, readWildzProofAppendsFromPng } from "../../features/play/card-export";
import { canonicalPortableCardJson, verifyAnyWildsCard, type PortableCardAsset } from "../../features/play/portable-card";
import { replayWildsRoamingBattle, type WildsRoamingBattle } from "../../features/play/wilds-roaming-battle";
import { openWildzArtifactEvidence, sha256WildzArtifactBytes, type WildzAdmittedArtifact } from "./wildz-artifact-custody";
import { claimWildzBearerArtifact, type WildzBearerOwnershipPort } from "./wildz-bearer-ownership";
import { isVerifiedWildzCardDescendant } from "./wildz-card-descendant";
import { verifyWildsRoamingCardPayload } from "./wilds-roaming-card-source";
import { sameWildzPlayerCoordinate, parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

export type WildsRoamingHandoff = Readonly<{
  schema: "wildz.roaming-handoff.v1";
  battleId: string;
  winnerHandle: string;
  previousOwnerHandle: string;
  assetId: string;
  source: Readonly<{ exactBytesB64u: string; artifactSha256: string; filename: string; mimeType: string }>;
  /** Full causal gameplay projection; never an ownership proof or replacement root. */
  currentCard: PortableCardAsset;
}>;

/** Reject Vault/private payloads and require one original card with an exact or
 * verified causal descendant sidecar. Unknown native namespaces remain untouched. */
export function validateWildsRoamingHandoffCard(payload: Uint8Array, currentCard: PortableCardAsset) {
  const checked = verifyPortableCardPng(payload);
  if (!checked.ok || !checked.asset || !verifyAnyWildsCard(currentCard).ok) throw new Error("wilds_handoff_card_invalid");
  const appends = readWildzProofAppendsFromPng(payload);
  const tail = appends.at(-1);
  const base = tail && tail.kind !== "player-vault" ? tail.asset : checked.asset;
  verifyWildsRoamingCardPayload(payload, base);
  if (base.id !== currentCard.id || (canonicalPortableCardJson(base) !== canonicalPortableCardJson(currentCard)
    && !isVerifiedWildzCardDescendant(base, currentCard))) throw new Error("wilds_handoff_card_history_mismatch");
  return base;
}

/** Holder-side release only. The authenticated coordinator must first bind this
 * replay to its accepted encounter/expedition. Replay proves legal gameplay, not
 * permission to claim. Exact source bytes stay private until this function wins. */
export async function prepareWildsRoamingHandoff(input: Readonly<{
  source: WildzAdmittedArtifact;
  currentCard: PortableCardAsset;
  ownerHandle: string;
  winnerHandle: string;
  battle: WildsRoamingBattle;
  challengerAsset: PortableCardAsset;
  defenderAsset: PortableCardAsset;
}>): Promise<WildsRoamingHandoff> {
  const card = structuredClone(input.currentCard), source = structuredClone(input.source);
  const battle = replayWildsRoamingBattle(structuredClone(input.battle), {
    challengerAsset: structuredClone(input.challengerAsset), defenderAsset: structuredClone(input.defenderAsset)
  });
  if (battle.outcome !== "capture-eligible" || !sameWildzPlayerCoordinate(battle.challengerId, input.winnerHandle)
    || !sameWildzPlayerCoordinate(battle.defenderId, input.ownerHandle)
    || !sameWildzPlayerCoordinate(source.ownerReceizId, input.ownerHandle)
    || card.id !== input.defenderAsset.id || !parseWildzPlayerCoordinate(input.winnerHandle)
    || source.compatibility !== "current-native") throw new Error("wilds_handoff_not_eligible");
  validateWildsRoamingHandoffCard(source.payloadBytes, input.defenderAsset);
  validateWildsRoamingHandoffCard(source.payloadBytes, card);
  if (canonicalPortableCardJson(input.defenderAsset) !== canonicalPortableCardJson(card)
    && !isVerifiedWildzCardDescendant(input.defenderAsset, card)) throw new Error("wilds_handoff_battle_history_mismatch");
  if (await sha256WildzArtifactBytes(source.artifactBytes) !== source.artifactSha256) throw new Error("wilds_handoff_source_digest_mismatch");
  return Object.freeze({ schema: "wildz.roaming-handoff.v1", battleId: battle.sessionId, winnerHandle: input.winnerHandle,
    previousOwnerHandle: input.ownerHandle, assetId: card.id, source: Object.freeze({ exactBytesB64u: receizBase64UrlEncode(source.artifactBytes),
      artifactSha256: source.artifactSha256, filename: source.filename, mimeType: source.mimeType }), currentCard: card });
}

/** Uses the original native ownership rail only, then independently reopens its
 * exact successor. Neither transport fields nor the sidecar authorize ownership. */
export async function claimWildsRoamingHandoff(input: Readonly<{
  handoff: WildsRoamingHandoff;
  winnerHandle: string;
  port: WildzBearerOwnershipPort;
}>): Promise<Readonly<{ admitted: WildzAdmittedArtifact; currentCard: PortableCardAsset }>> {
  const handoff = structuredClone(input.handoff);
  if (handoff.schema !== "wildz.roaming-handoff.v1" || !handoff.battleId
    || !parseWildzPlayerCoordinate(input.winnerHandle) || !sameWildzPlayerCoordinate(handoff.winnerHandle, input.winnerHandle)
    || handoff.assetId !== handoff.currentCard.id) throw new Error("wilds_handoff_binding_invalid");
  const bytes = receizBase64UrlDecode(handoff.source.exactBytesB64u);
  if (await sha256WildzArtifactBytes(bytes) !== handoff.source.artifactSha256) throw new Error("wilds_handoff_source_digest_mismatch");
  const file = new File([bytes.slice().buffer], handoff.source.filename, { type: handoff.source.mimeType });
  const original = (await openWildzArtifactEvidence(file, file.name, input.port.artifacts)).admitted;
  if (original.compatibility !== "current-native" || !sameWildzPlayerCoordinate(original.ownerReceizId, handoff.previousOwnerHandle))
    throw new Error("wilds_handoff_source_owner_mismatch");
  const base = validateWildsRoamingHandoffCard(original.payloadBytes, handoff.currentCard);
  const admitted = await claimWildzBearerArtifact(file, file.name, input.port);
  const witness = admitted.ownershipWitness;
  if (!sameWildzPlayerCoordinate(admitted.ownerReceizId, input.winnerHandle) || !witness
    || !sameWildzPlayerCoordinate(witness.ownerReceizId, input.winnerHandle)
    || !sameWildzPlayerCoordinate(witness.previousOwnerReceizId, original.ownerReceizId)
    || admitted.payloadSha256 !== original.payloadSha256
    || admitted.payloadBytes.length !== original.payloadBytes.length
    || !admitted.payloadBytes.every((byte, index) => byte === original.payloadBytes[index])) throw new Error("wilds_handoff_claim_binding_invalid");
  const claimedBase = validateWildsRoamingHandoffCard(admitted.payloadBytes, handoff.currentCard);
  if (canonicalPortableCardJson(claimedBase) !== canonicalPortableCardJson(base)) throw new Error("wilds_handoff_base_changed");
  return Object.freeze({ admitted, currentCard: handoff.currentCard });
}
