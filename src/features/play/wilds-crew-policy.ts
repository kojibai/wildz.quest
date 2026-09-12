import { deriveBirthGenome } from "./heartbound-genome";
import { emptyAdventureCondition } from "./adventure/card-condition";
import { isLivingCardAsset } from "./living-card-types";
import { creatureForm } from "./creature-catalog";
import { currentCreatureHistoryProjection, currentLivingGenome } from "./living-card-proof";
import { verifyAnyWildsCard, sha256PortableBasis, type PortableCardAsset } from "./portable-card";
import { canWildsCrewTravel } from "./wilds-crew-physical-navigation";
import { projectWildsCreatureWorkFamilies } from "./wilds-steward-construction";
import { isCanonicalWildsResourceSource, type WildsResourceSource, type WildsResourceWorkFamily } from "./wilds-resource-authority";
import type { AdventureCardCondition } from "./adventure/card-condition";

/** A deterministic game policy, not a grant of capability, consent or mandate authority.
 * Prepare on card revision. Never replay card history or hash identity in a frame loop. */
export type WildsCrewDisposition = Readonly<{
  assetId: string; proofDigest: string; identityAnchor: string; temperament: string;
  workFamilies: readonly WildsResourceWorkFamily[];
  riskTolerance: number; restAtFatigue: number; preferenceSeed: number;
}>;
export function prepareWildsCrewDisposition(card: PortableCardAsset): WildsCrewDisposition | null {
  if (!verifyAnyWildsCard(card).ok) return null;
  const genome = isLivingCardAsset(card) ? currentLivingGenome(card) : deriveBirthGenome({formId:card.manifest.formId,proofDigest:card.proof.digest,variant:card.manifest.variant.traits});
  const expression = genome.face.expressionSet;
  return Object.freeze({
    assetId: card.id, proofDigest: card.proof.digest, identityAnchor: genome.identityAnchor,
    temperament: genome.behavior.temperament,
    workFamilies: projectWildsCreatureWorkFamilies(creatureForm(card.manifest.formId)?.element ?? ""),
    riskTolerance: expression === "brave" ? 30 : expression === "curious" ? 22 : expression === "mischievous" ? 18 : 12,
    restAtFatigue: Math.min(75, 55 + Math.floor(card.manifest.stats.health / 10)),
    preferenceSeed: Number.parseInt(sha256PortableBasis(genome.identityAnchor).replace(/^sha256:/, "").slice(0, 8), 16)
  });
}

export type WildsCrewOpportunity = Readonly<{
  source: WildsResourceSource; sourceHead: string; availableCapacity: number;
  /** Supplied by current physical/environment projection; unknown means unavailable. */
  risk: number; reachable: boolean;
}>;
export type WildsCrewChoice = Readonly<{
  kind: "gather"; assetId: string; proofDigest: string; sourceId: string; sourceHead: string;
  family: WildsResourceWorkFamily; position: WildsResourceSource["position"];
  quantity: 1; observedKaiUPulse: number; reason: string; authority: "proposal-only";
}> | Readonly<{ kind: "rest" | "wait"; reason: string; authority: "proposal-only" }>;

/** Called by the bounded job scheduler, never render. Sources must be a local observed
 * neighborhood. Claims, material custody and authorization happen only on admission. */
export function chooseWildsCrewWork(input: {
  disposition: WildsCrewDisposition; currentProofDigest: string; condition: AdventureCardCondition;
  position: Readonly<{ x: number; z: number }>; opportunities: readonly WildsCrewOpportunity[];
  reservedSourceIds: ReadonlySet<string>; recentSourceIds: ReadonlySet<string>;
  kaiUPulse: number; maximumDistance?: number; requestedFamily?: WildsResourceWorkFamily;
}): WildsCrewChoice {
  const wait = (reason: string): WildsCrewChoice => ({ kind: "wait", reason, authority: "proposal-only" });
  const d = input.disposition, maxDistance = input.maximumDistance ?? 24;
  if (!Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < 0 || !Number.isFinite(input.position.x)
    || !Number.isFinite(input.position.z) || !Number.isFinite(maxDistance) || maxDistance < 0 || maxDistance > 64
    || input.opportunities.length > 128) return wait("The local work area needs to be refreshed.");
  if (d.proofDigest !== input.currentProofDigest || input.condition.assetId !== d.assetId)
    return wait("This creature changed; review its current abilities first.");
  if (!canWildsCrewTravel(input.condition) || input.condition.fatigue >= d.restAtFatigue)
    return { kind: "rest", reason: "This creature needs rest or care before taking more work.", authority: "proposal-only" };
  if (input.requestedFamily && !d.workFamilies.includes(input.requestedFamily))
    return wait("This task is outside this creature’s current abilities.");
  let selected: WildsCrewOpportunity | undefined, best = -Infinity;
  for (const opportunity of input.opportunities) {
    const { source } = opportunity;
    if (!isCanonicalWildsResourceSource(source) || !/^(?:sha256:)?[a-f0-9]{64}$/.test(opportunity.sourceHead)
      || !Number.isSafeInteger(opportunity.availableCapacity) || opportunity.availableCapacity < 1
      || opportunity.availableCapacity > source.capacity || !opportunity.reachable
      || !Number.isFinite(opportunity.risk) || opportunity.risk < 0 || opportunity.risk > d.riskTolerance
      || !d.workFamilies.includes(source.requirements.creature)
      || (input.requestedFamily && input.requestedFamily !== source.requirements.creature)
      || input.reservedSourceIds.has(source.sourceId)) continue;
    const distance = Math.hypot(source.position.x - input.position.x, source.position.z - input.position.z);
    if (distance > maxDistance) continue;
    // Stable individuality breaks otherwise equal choices. Novelty never outweighs safety.
    const affinity = ((d.preferenceSeed ^ source.slot) >>> 0) % 17 / 17;
    const score = 100 - distance * 2 - opportunity.risk * 3 + affinity
      - (input.recentSourceIds.has(source.sourceId) ? 3 : 0);
    if (score > best || (score === best && source.sourceId < selected!.source.sourceId)) { selected = opportunity; best = score; }
  }
  if (!selected) return wait("No safe, available task within this creature’s abilities is nearby.");
  return Object.freeze({ kind: "gather", assetId: d.assetId, proofDigest: d.proofDigest,
    sourceId: selected.source.sourceId, sourceHead: selected.sourceHead,
    family: selected.source.requirements.creature, position: selected.source.position, quantity: 1,
    observedKaiUPulse: input.kaiUPulse, reason: `Gather nearby ${selected.source.kind}, then return with the material.`, authority: "proposal-only" });
}

export function readWildsCrewCondition(card: PortableCardAsset, conditions: Readonly<Record<string, AdventureCardCondition | undefined>>) {
  if (!verifyAnyWildsCard(card).ok) return undefined;
  return conditions[card.id] ?? (isLivingCardAsset(card) ? currentCreatureHistoryProjection(card).condition : emptyAdventureCondition(card.id));
}
