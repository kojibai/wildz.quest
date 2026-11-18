import type { WildzContinuitySnapshot } from "../../lib/receiz/wildz-identity-adapter";
import type { WildzPlayerStateReceipt } from "../../lib/performance/wildz-player-state-transport";
import { sameWildzPlayerCoordinate } from "../../lib/receiz/wildz-player-coordinate";
import { isCurrentWildzGameplaySource } from "./wildz-gameplay-source";

/** V1 app-state carries an inventory projection and a recomputable content
 * digest. Its delivery head acknowledges publication. Signed Originals
 * and custody transitions enter gameplay through their owning source readers. */
export function readWildzPlayerDeliveryHead(
  source: WildzContinuitySnapshot,
  envelope: WildzPlayerStateReceipt | null | undefined,
  current: WildzContinuitySnapshot | null
): WildzPlayerStateReceipt | null {
  if (!current?.playState || !isCurrentWildzGameplaySource(current, source) || !envelope
    || typeof envelope.playerId !== "string" || !sameWildzPlayerCoordinate(source.session.actorId, envelope.playerId)
    || typeof envelope.sourceDigest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(envelope.sourceDigest)
    || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1) return null;
  return { playerId: envelope.playerId, revision: envelope.revision, sourceDigest: envelope.sourceDigest };
}
