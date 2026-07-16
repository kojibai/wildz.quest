import { canonicalPortableCardJson, sha256PortableBasis, verifiedPortableCardPin, type PortableCardAsset } from "./portable-card";

/** Deeper civilization roles layered above the bounded raid roles. */
export const WILDS_MASTERY_ROLES = ["anchor", "breaker", "bulwark", "conductor", "pathfinder", "caretaker", "duelist", "artificer"] as const;
export type WildsMasteryRole = (typeof WILDS_MASTERY_ROLES)[number];
export type WildsCardMasteryProjection = { assetId: string; proofDigest: string; primary: WildsMasteryRole; secondary: WildsMasteryRole; scores: Record<WildsMasteryRole, number>; affinity: string };
export type CardMasteryState = { xp: number; level: number; eventIds: string[] };
function bounded(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Math.round(value))); }
function roleTie(seed: string, role: string) { return Number.parseInt(seed.slice(role.charCodeAt(0) % 48, role.charCodeAt(0) % 48 + 2), 16); }

export function projectWildsCardMastery(card: PortableCardAsset): WildsCardMasteryProjection {
  const pin = verifiedPortableCardPin(card); const stats = card.manifest.stats; const traits = card.manifest.variant?.traits; const potential = traits?.potential ?? 50; const ability = traits?.abilityModifier ?? 0;
  const scores: Record<WildsMasteryRole, number> = {
    anchor: bounded(stats.health * 2 + stats.guard + potential / 5, 0, 200), breaker: bounded(stats.power * 2 + stats.speed + ability, 0, 200), bulwark: bounded(stats.guard * 2 + stats.health + potential / 8, 0, 200), conductor: bounded(stats.bond * 2 + stats.power + ability * 2, 0, 200),
    pathfinder: bounded(stats.speed * 2 + stats.bond + potential / 6, 0, 200), caretaker: bounded(stats.bond * 2 + stats.health + stats.guard / 2, 0, 200), duelist: bounded(stats.power + stats.speed * 2 + ability, 0, 200), artificer: bounded(potential + stats.power / 2 + stats.bond + ability * 2, 0, 200)
  };
  const ranked = [...WILDS_MASTERY_ROLES].sort((a, b) => scores[b] - scores[a] || roleTie(pin.proofDigest, a) - roleTie(pin.proofDigest, b));
  return { assetId: pin.assetId, proofDigest: pin.proofDigest, primary: ranked[0]!, secondary: ranked[1]!, scores, affinity: `${card.manifest.familyId}:${card.manifest.formId}` };
}

export function regionalCardUtility(card: PortableCardAsset, regionId: string) {
  const projection = projectWildsCardMastery(card); const normalizedRegion = regionId.trim().toLowerCase(); const digest = sha256PortableBasis(canonicalPortableCardJson({ region: normalizedRegion, affinity: projection.affinity, proof: projection.proofDigest })); const bonus = Number.parseInt(digest.slice(-2), 16) % 21;
  return { regionId: normalizedRegion, role: projection.primary, bonus, reason: bonus >= 14 ? "resonant_terrain" : "field_familiarity" } as const;
}

export function deriveLoadoutSynergy(cards: PortableCardAsset[], regionId: string) {
  const projections = cards.map(projectWildsCardMastery); const roles = [...new Set(projections.flatMap((p) => [p.primary, p.secondary]))].sort() as WildsMasteryRole[]; const regionalBonus = cards.reduce((sum, card) => sum + regionalCardUtility(card, regionId).bonus, 0); const score = bounded((cards.length ? 30 : 0) + Math.min(40, Math.max(0, roles.length - 1) * 9) + Math.min(25, regionalBonus / Math.max(1, cards.length)), 0, 100); const signature = sha256PortableBasis(canonicalPortableCardJson({ cards: projections.map((p) => p.proofDigest).sort(), regionId: regionId.trim().toLowerCase() }));
  return { score, coverage: roles.length, roles, regionalBonus, signature };
}

export function advanceCardMastery(input: { card: PortableCardAsset; state: CardMasteryState; event: { id: string; kind: string; amount: number } }): CardMasteryState {
  const state = { xp: bounded(input.state.xp, 0, 1_000_000), level: Math.max(1, Math.floor(input.state.level)), eventIds: [...input.state.eventIds] }; if (!input.event.id.trim() || state.eventIds.includes(input.event.id)) return state; const xp = state.xp + bounded(input.event.amount, 0, 100); return { xp, level: Math.min(100, 1 + Math.floor(xp / 100)), eventIds: [...state.eventIds, input.event.id].slice(-500) };
}

export function normalizeCompetitiveLoadout(cards: PortableCardAsset[], context: { regionId: string; maxPower?: number }) {
  const maxPower = Math.max(1, context.maxPower ?? 100); const projections = cards.map(projectWildsCardMastery); const raw = projections.reduce((sum, p) => sum + p.scores[p.primary], 0); const synergy = deriveLoadoutSynergy(cards, context.regionId); const totalPower = Math.min(maxPower, bounded(raw / Math.max(1, cards.length) * (0.75 + synergy.coverage / 32), 0, maxPower));
  return { cards: projections, totalPower, roleCoverage: synergy.coverage, synergyScore: synergy.score };
}

export type BossArtifact = {
  id: string;
  bossId: string;
  victoryEventId: string;
  ownerReceizId: string;
  rewardIndex: number;
  rarity: "rare" | "mythic" | "legendary";
  kind: "boss-core" | "boss-relic" | "boss-sigil";
  issuedAt: string;
  proof: { digest: string; kind: "receiz.wilds_boss_artifact.v1" };
};

function basis(input: Omit<BossArtifact, "id" | "rarity" | "kind" | "proof">) {
  return canonicalPortableCardJson(input);
}

export function issueBossArtifact(input: { bossId: string; victoryEventId: string; ownerReceizId: string; issuedAt: string; rewardIndex: number }): BossArtifact {
  if (!input.bossId || !input.victoryEventId || !input.ownerReceizId || !Number.isInteger(input.rewardIndex) || input.rewardIndex < 0 || !Number.isFinite(Date.parse(input.issuedAt))) throw new Error("boss_artifact_basis_invalid");
  const digest = sha256PortableBasis(basis(input));
  const value = Number.parseInt(digest.slice(-2), 16);
  const rarity = value > 230 ? "legendary" : value > 150 ? "mythic" : "rare";
  const kinds = ["boss-core", "boss-relic", "boss-sigil"] as const;
  const artifact: BossArtifact = { ...input, id: `artifact:${digest.slice(7, 31)}`, rarity, kind: kinds[value % kinds.length]!, proof: { digest: "", kind: "receiz.wilds_boss_artifact.v1" } };
  artifact.proof.digest = artifactDigest(artifact);
  return artifact;
}

export function artifactDigest(artifact: BossArtifact) {
  const { proof: _proof, ...unsigned } = artifact;
  return sha256PortableBasis(canonicalPortableCardJson(unsigned));
}
