import { currentRevision } from "../../play/living-card-proof";
import type { LivingCardAsset } from "../../play/living-card-types";

export function projectCreatureMemorial(card: LivingCardAsset) {
  const revision = currentRevision(card);
  const record = revision.growth.life?.retirement;
  if (!record) throw new Error("Creature has no canonical memorial");
  return {
    creatureId: card.id,
    name: revision.title,
    honor: record.honor,
    teamOutcome: record.teamOutcome,
    retiredAt: record.retiredAt,
    sealDigest: record.sealDigest,
    epitaph: record.honor === "victorious-sacrifice" ? `${revision.title} carried the team beyond the final bell.` : `${revision.title} is remembered in the Wildz.`
  };
}
