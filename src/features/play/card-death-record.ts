import type { AdventureCardCondition } from "./adventure/card-condition";
import { currentRevision } from "./living-card-proof";
import { isLivingCardAsset } from "./living-card-types";
import type { PortableCardAsset } from "./portable-card";

export type WildsCardDeathRecord = Readonly<{
  eventId: string;
  occurredAt: string;
  cause: string;
  sourceReceiptDigest: string;
  outcome: string;
  honor: string;
}>;

export function cardDeathRecord(asset: PortableCardAsset, condition?: AdventureCardCondition | null): WildsCardDeathRecord | null {
  if (isLivingCardAsset(asset)) {
    const retirement = currentRevision(asset).growth.life?.retirement;
    if (retirement) return {
      eventId: `retirement:${retirement.sealDigest}`,
      occurredAt: retirement.retiredAt,
      cause: retirement.cause,
      sourceReceiptDigest: retirement.matchReceiptDigest,
      outcome: retirement.teamOutcome,
      honor: retirement.honor
    };
  }
  if (condition?.life !== "dead") return null;
  return {
    eventId: condition.retirementCauseEventId ?? `death:${condition.receiptDigests.at(-1) ?? asset.id}`,
    occurredAt: condition.retiredAt ?? "Recorded by an earlier verified receipt",
    cause: condition.retirementCauseEventId?.startsWith("hearttree:") ? "hearttree-mortal-death" : "verified-permanent-death",
    sourceReceiptDigest: condition.receiptDigests.at(-1) ?? "Legacy verified death record",
    outcome: "defeat",
    honor: "fallen"
  };
}
