import { creatureFamilies, creatureForm, creatureForms, type CreatureRarity } from "./creature-catalog";
import {
  evolvePortableCard,
  canonicalPortableCardJson,
  sealDiscoveredCard,
  sealCollectedCard,
  sha256PortableBasis,
  verifyPortableCard,
  type PortableCardAsset
} from "./portable-card";
import {
  admitLocallySealedWildsInventory,
  isAdmittedWildsCard,
  restoreAdmittedWildsInventory,
  retainAdmittedWildsInventory,
  verifyAndAdmitWildsCard,
  type AdmittedWildsInventory
} from "./admitted-inventory";
import { encounterFromSearch, idleEncounterState, isCapturableEncounter, type EncounterState } from "./encounter-state";
import { hotspotsForRegion, nearbyHiddenHotspots, searchHiddenHotspots } from "./hidden-hotspots";
import { applyKaiAffinityToHotspot } from "./kai-encounter-affinity";
import { deriveKaiKlokMoment, deriveKaiKlokMomentFromUPulse, kaiUPulseToISOString } from "./kai-klok-moment";
import { rootWildsInputInKai } from "./wilds-input-temporal-root";
import { discoverLivingCreature, validateLivingCreatureIdentity, type LivingCreatureIdentityV3 } from "./living-taxonomy";
import { applyBattleAction, battleGrowthAwards, battleTranscriptDigest, startWildBattle, type BattleAction, type BattleState } from "./battle-engine";
import type { FusionInheritance } from "./card-fusion";
import { applyGrowthEvent, buildTransformationCandidate, growthReadiness, nextGrowthRequirements, type GrowthEvent } from "./growth-engine";
import {
  admitLegacyCard,
  appendLivingCardHistory,
  appendLivingCardRevision,
  compareLivingCardHistoryHeads,
  currentCreatureHistoryProjection,
  currentLivingGenome,
  currentRevision,
  emptyLivingGrowth
} from "./living-card-proof";
import { deriveAscensionGenome } from "./heartbound-genome";
import { isLivingCardAsset, type GrowthPath, type LivingGrowthSnapshot } from "./living-card-types";
import { createLivingChildTransaction, lineageEligibility } from "./living-lineage";
import { worldMasteryAward, type WorldMasteryVerb } from "./world-progression";
import { validateRiftGrant, type RiftTravelGrant } from "./wilds-rift-travel";
import { movementScale, type WildsMovementMode } from "./wilds-movement";
import { resolveWildsGroundMovement } from "./wilds-grounded-movement";
import { regionForPosition } from "./multiplayer-core";
import {
  createInitialWildsExplorationAtlas,
  discoverWildsExplorationSite,
  normalizeWildsExplorationAtlas,
  revealWildsExplorationAt,
  type WildsExplorationAtlas
} from "./wilds-exploration-atlas";
import { admitWildsDiscoveryPhysicalNeighborhood, isCanonicalWildsDiscoverySiteKey, normalizeWildsSiteSpaceState, type WildsSiteSpaceState } from "./wilds-discovery-sites";
import { enterWildsSiteRuntime, exitWildsSiteRuntime, writeWildsSiteRuntimeDiscovery, writeWildsSiteRuntimeMovement, type WildsSiteDiscoveryOutput, type WildsSiteMovementOutput, type WildsSiteRuntimeProjection } from "./wilds-site-runtime";
import {
  projectWildsTraversalCapabilities,
  type WildsTraversalCapability
} from "./wilds-traversal-capabilities";
import type { WildsEncounterInteractionLayer } from "./wilds-layered-encounters";
import { wildsTerrainElevation } from "./wilds-terrain-authority";
import type { WildsStructureSupport } from "./wilds-structure-support";
import type { WildsTerrainObstacle } from "./wilds-terrain-obstacles";
import { projectWildsCivicHistory, type WildsCivicEvent } from "./wilds-civic-history";
import { projectWildsEcologyHistory, type WildsEcologyKnowledge, type WildsEcologyReceipt } from "./wilds-ecology-history";
import { projectWildsRaidHistory, type WildsBossKnowledge, type WildsRaidReceipt } from "./wilds-raid-history";
import {
  adventureConditionToHearttree,
  emptyHearttreeCondition,
  hearttreeConditionToAdventure,
  projectHearttreeCard,
  type HearttreeCardCondition
} from "./hearttree/card-capability";
import { applyHearttreeConsequences } from "./hearttree/consequences";
import { verifyHearttreeReceipt, type HearttreeReceipt } from "./hearttree/receipt";
import { emptyAdventureCondition, validateAdventureCondition, type AdventureCardCondition } from "./adventure/card-condition";
import { healWildBattleCard, settleWildBattleCard } from "./wild-battle-life";
import { sealRetirement } from "../games/lifecycle/creature-retirement";
import type { ArenaSettlement } from "../games/mortal-arena/settlement";
import type { CreatureObserverMemoryTurn } from "./creature-history-types";
import { livingSubjectContinuityV120 } from "./creature-continuity";
import { careForCreature, settleCreatureCare, type CreatureCareAction } from "./creature-care";
import {
  EMPTY_WILDS_SUPPORT_ASSET_IDS,
  type WildsBossFamilyId,
  type WildsEcologyFamilyId,
  type WildsSupportAssetIds
} from "./wilds-v3-contracts";

export type { WildsSupportAssetIds } from "./wilds-v3-contracts";

export type GameAction = "explore" | "train" | "mission";
export type MoveDirection = "north" | "south" | "west" | "east";
export type WildsInput = (
  | { type: "move"; direction: MoveDirection; aerialMode?: "glide" | "flight"; verticalClearance?: number; verticalWorldY?: number; structureSupports?: readonly WildsStructureSupport[]; additionalObstacles?: readonly WildsTerrainObstacle[]; siteRuntime?: WildsSiteRuntimeProjection; siteMovementOutput?: WildsSiteMovementOutput; siteDiscoveryOutput?: WildsSiteDiscoveryOutput }
  | { type: "move-vector"; x: number; z: number; mode?: WildsMovementMode; aerialMode?: "glide" | "flight"; verticalClearance?: number; verticalWorldY?: number; structureSupports?: readonly WildsStructureSupport[]; additionalObstacles?: readonly WildsTerrainObstacle[]; siteRuntime?: WildsSiteRuntimeProjection; siteMovementOutput?: WildsSiteMovementOutput; siteDiscoveryOutput?: WildsSiteDiscoveryOutput }
  | { type: "site-portal"; direction: "enter" | "exit"; siteKey: string; siteRuntime: WildsSiteRuntimeProjection }
  | { type: "apply-rift-grant"; grant: RiftTravelGrant; playerId: string }
  | { type: "discover" }
  | { type: "capture"; encounterId: string; capturedAt: string; ownerReceizId: string }
  | { type: "search-point"; x: number; z: number; surfaceWorldY?: number; searchedAt: string; ownerReceizId: string; verticalLayer?: WildsEncounterInteractionLayer; verticalWorldY?: number; verticalMinWorldY?: number; verticalMaxWorldY?: number; traversalCapabilities?: readonly WildsTraversalCapability[]; siteKey?: string | null; siteSpaceId?: string }
  | { type: "advance-encounter"; at: string }
  | { type: "start-battle"; at: string }
  | { type: "battle-action"; action: BattleAction; at?: string }
  | { type: "dismiss-reveal" }
  | { type: "mark-synced"; assetId: string; synchronizedAt: string }
  | { type: "mark-listed"; assetId: string; synchronizedAt: string }
  | { type: "record-creature-observation"; turn: CreatureObserverMemoryTurn }
  | { type: "activate-creature-continuity"; assetId: string; ownerReceizId: string; at: string }
  | { type: "pause-creature-continuity"; assetId: string; ownerReceizId: string; at: string }
  | { type: "settle-creature-continuity"; assetId: string; ownerReceizId: string; at: string }
  | { type: "care-for-creature"; assetId: string; ownerReceizId: string; action: CreatureCareAction; at: string }
  | { type: "settle-creature-care"; assetId: string; ownerReceizId: string; at: string }
  | { type: "import-card"; asset: PortableCardAsset }
  | { type: "transfer-card-out"; assetId: string }
  | { type: "fuse-cards"; parentAId: string; parentBId: string; inheritance: FusionInheritance; fusedAt: string }
  | { type: "evolve"; assetId: string; evolvedAt: string }
  | { type: "record-growth"; assetId: string; event: GrowthEvent }
  | { type: "settle-pending-travel-growth" }
  | { type: "record-civic-event"; event: WildsCivicEvent }
  | { type: "record-ecology-event"; event: WildsEcologyReceipt }
  | { type: "record-raid-event"; event: WildsRaidReceipt }
  | { type: "hearttree-admit"; receipt: HearttreeReceipt }
  | { type: "hearttree-select-squad"; assetIds: string[] }
  | { type: "ascend-card"; assetId: string; at: string }
  | { type: "finish-transformation" }
  | { type: "finish-lineage-reveal" }
  | { type: "train"; cardId?: string; at?: string }
  | { type: "use-field-ability"; assetId: string; abilityIndex: number; usedAt: string }
  | { type: "mission" }
  | { type: "rest"; at?: string }
  | { type: "select-card"; cardId: string }
  | { type: "select-asset"; assetId: string }
  | { type: "assign-support"; slot: 0 | 1; assetId: string | null }
  | { type: "reset" }
) & { /** Exact local gameplay time authority. */ kaiUPulse?: number };

export type Vec3 = readonly [number, number, number];

export type CreatureCard = {
  id: string;
  name: string;
  species: string;
  role: string;
  power: number;
  rarity: CreatureRarity;
  color: string;
  accent: string;
  position: Vec3;
  businessLogic: string;
};

export type HabitatNode = {
  id: string;
  label: string;
  position: Vec3;
  tone: "grove" | "spark" | "trade" | "reward" | "gate";
};

export type RewardCard = {
  id: string;
  title: string;
  businessUse: string;
  value: string;
};

export type PlayState = {
  activeAction: GameAction;
  beans: number;
  cardXp: number;
  challenge: number;
  combo: number;
  companionProgress: Record<string, { level: number; xp: number; bond: number }>;
  completed: boolean;
  completedMissionIds: string[];
  capturedHotspotIds: string[];
  discoveredCardIds: string[];
  energy: number;
  encounter: EncounterState;
  inventory: PortableCardAsset[];
  lastEvent: string;
  level: number;
  missionProgress: number;
  lastSearchPoint: { x: number; z: number } | null;
  player: {
    x: number;
    z: number;
  };
  explorationAtlas: WildsExplorationAtlas;
  siteSpace: WildsSiteSpaceState;
  pendingSyncAssetIds: string[];
  pendingTravelGrowthEvents: Array<{ assetId: string; event: GrowthEvent }>;
  appliedArenaSettlementIds: string[];
  rewardCards: RewardCard[];
  selectedCardId: string;
  selectedAssetId: string;
  supportAssetIds: WildsSupportAssetIds;
  streak: number;
  bossUnlocked: boolean;
  battle: BattleState | null;
  fusionSparks: number;
  fusionCooldowns: Record<string, string>;
  achievements: string[];
  livingProgress: Record<string, LivingGrowthSnapshot>;
  ascensionCatalysts: string[];
  bondCooldowns: Record<string, string>;
  transformation: null | {
    assetId: string;
    fromRevision: number;
    toRevision: number;
    reason: string;
  };
  lineageReveal: null | {
    childId: string;
    parentIds: [string, string];
    eventId: string;
  };
  worldRank: "Grove scout" | "Trail keeper" | "Wilds ranger" | "Titan challenger";
  worldMastery: number;
  civicEvents: WildsCivicEvent[];
  regionalReputation: Record<string, number>;
  ecologyEvents: WildsEcologyReceipt[];
  ecologyKnowledge: Record<string, WildsEcologyKnowledge>;
  ecologyMastery: Record<WildsEcologyFamilyId, number>;
  raidEvents: WildsRaidReceipt[];
  bossKnowledge: Record<string, WildsBossKnowledge>;
  bossMastery: Record<WildsBossFamilyId, number>;
  raidAchievements: string[];
  adventureConditions: Record<string, AdventureCardCondition>;
  hearttreeConditions: Record<string, HearttreeCardCondition>;
  hearttreeReceipts: HearttreeReceipt[];
  hearttreeSquadAssetIds: string[];
};

export const worldBounds = {
  min: -500_000_000,
  max: 500_000_000,
  analogStep: 0.42,
  step: 1.05
} as const;

const flagshipPositions: Record<string, Vec3> = {
  mintcub: [-2.8, 0, -1.4],
  voltray: [1.6, 0, -2.1],
  ledgerfox: [-0.4, 0, 1.5],
  titanseal: [3.1, 0, 1.2]
};

export const creatureCards: CreatureCard[] = creatureFamilies.map((family, index) => {
  const form = creatureForm(family.formIds[0])!;
  return {
    id: family.id,
    name: form.name,
    species: form.species,
    role: form.role,
    power: form.stats.power,
    rarity: form.rarity,
    color: form.palette.primary,
    accent: form.palette.accent,
    position: flagshipPositions[family.id] ?? [index * 120_000 - 15_000_000, 0, ((index * 7919) % 30_000_000) - 15_000_000],
    businessLogic: `${form.habitat} · ${form.abilities[0].name}`
  };
});

const MAX_NEARBY_CREATURES = 12;
const ENCOUNTER_REGION_SIZE = 24;
const nearbyCreatureRegionCache = new Map<string, CreatureCard[]>();

function encounterUnit(x: number, z: number, salt: number) {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

export function nearbyCreatureCards(player: Pick<PlayState, "player">["player"]): CreatureCard[] {
  const regionX = Math.floor(player.x / ENCOUNTER_REGION_SIZE);
  const regionZ = Math.floor(player.z / ENCOUNTER_REGION_SIZE);
  const regionKey = `${regionX}:${regionZ}`;
  const cached = nearbyCreatureRegionCache.get(regionKey);
  if (cached) return cached;
  const regionSeed = Math.abs((regionX * 73856093) ^ (regionZ * 19349663));
  const cards: CreatureCard[] = [];
  if (Math.abs(regionX) <= 1 && Math.abs(regionZ) <= 1) cards.push(...creatureCards.slice(0, 4));
  for (let slot = 0; cards.length < MAX_NEARBY_CREATURES && slot < 20; slot += 1) {
    const index = 4 + ((regionSeed + slot * 47) % (creatureCards.length - 4));
    const source = creatureCards[index]!;
    if (cards.some((card) => card.id === source.id)) continue;
    cards.push({
      ...source,
      position: [
        regionX * ENCOUNTER_REGION_SIZE + 2 + encounterUnit(regionX, regionZ, slot) * 20,
        0,
        regionZ * ENCOUNTER_REGION_SIZE + 2 + encounterUnit(regionZ, regionX, slot + 31) * 20
      ]
    });
  }
  const nearby = cards.slice(0, MAX_NEARBY_CREATURES);
  nearbyCreatureRegionCache.set(regionKey, nearby);
  if (nearbyCreatureRegionCache.size > 64) {
    const oldest = nearbyCreatureRegionCache.keys().next().value;
    if (oldest !== undefined) nearbyCreatureRegionCache.delete(oldest);
  }
  return nearby;
}

export const habitatNodes: HabitatNode[] = [
  { id: "grove", label: "Mint Grove", position: [-3.2, 0, -1.7], tone: "grove" },
  { id: "spark-den", label: "Spark Den", position: [1.3, 0, -2.4], tone: "spark" },
  { id: "trade-crossing", label: "Trade Crossing", position: [-0.7, 0, 1.8], tone: "trade" },
  { id: "reward-nest", label: "Reward Nest", position: [1.7, 0, 2.8], tone: "reward" },
  { id: "titan-gate", label: "Titan Gate", position: [3.4, 0, 1.5], tone: "gate" }
];

const LEGACY_PLACEHOLDER_OWNER = "wilds.player.receiz.id";

function legacyStarterCardForOwner(ownerReceizId: string) {
  return sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId,
    encounterId: "starter-mintcub",
    capturedAt: "2026-06-29T12:00:00.000Z"
  });
}

function kaiBornStarterCardForOwner(ownerReceizId: string, createdAt: string) {
  const capturedAt = new Date(createdAt).toISOString();
  const choice = sha256PortableBasis(canonicalPortableCardJson({
    generator: "receiz.wilds.starter.v2",
    ownerReceizId,
    capturedAt
  }));
  const familyIndex = Number.parseInt(choice.slice(7, 15), 16) % creatureFamilies.length;
  const family = creatureFamilies[familyIndex]!;
  const form = creatureForm(family.formIds[0]);
  if (!form) throw new Error("wilds_starter_form_missing");
  const encounterId = `starter:${choice.slice(7, 31)}`;
  const identity = discoverLivingCreature({
    encounterId,
    form,
    discoveredAt: capturedAt,
    location: { x: 0, z: 0 },
    ownerScope: ownerReceizId,
    moment: deriveKaiKlokMoment({ occurredAt: capturedAt, authority: "world" })
  });
  return sealDiscoveredCard({ identity, formId: form.id, ownerReceizId, capturedAt });
}

const starterCardAsset = legacyStarterCardForOwner(LEGACY_PLACEHOLDER_OWNER);

export const initialPlayState: PlayState = {
  activeAction: "explore",
  beans: 28,
  cardXp: 136,
  challenge: 42,
  combo: 0,
  companionProgress: Object.fromEntries(creatureCards.map((card) => [card.id, { level: 1, xp: 0, bond: 0 }])),
  completed: false,
  completedMissionIds: [],
  capturedHotspotIds: [],
  discoveredCardIds: ["mintcub"],
  energy: 84,
  encounter: idleEncounterState,
  inventory: admitLocallySealedWildsInventory([{ ...starterCardAsset, status: "verified", synchronizedAt: "2026-06-29T12:00:00.000Z" }]),
  lastEvent: "SealCub joined your deck. Walk near another wild companion.",
  level: 7,
  missionProgress: 38,
  lastSearchPoint: null,
  player: {
    x: -2.15,
    z: -0.85
  },
  explorationAtlas: createInitialWildsExplorationAtlas(),
  siteSpace: normalizeWildsSiteSpaceState(undefined, { x: -2.15, y: wildsTerrainElevation(-2.15, -.85), z: -.85 }),
  pendingSyncAssetIds: [],
  pendingTravelGrowthEvents: [],
  appliedArenaSettlementIds: [],
  rewardCards: [],
  selectedCardId: "mintcub",
  selectedAssetId: starterCardAsset.id,
  supportAssetIds: EMPTY_WILDS_SUPPORT_ASSET_IDS,
  streak: 9,
  bossUnlocked: false,
  battle: null,
  fusionSparks: 1,
  fusionCooldowns: {},
  achievements: ["first_spark"],
  livingProgress: { [starterCardAsset.id]: emptyLivingGrowth(0) },
  ascensionCatalysts: [],
  bondCooldowns: {},
  transformation: null,
  lineageReveal: null,
  worldRank: "Grove scout",
  worldMastery: 38,
  civicEvents: [],
  regionalReputation: {},
  ecologyEvents: [],
  ecologyKnowledge: {},
  ecologyMastery: projectWildsEcologyHistory([]).mastery,
  raidEvents: [],
  bossKnowledge: {},
  bossMastery: projectWildsRaidHistory([]).mastery,
  raidAchievements: [],
  adventureConditions: { [starterCardAsset.id]: emptyAdventureCondition(starterCardAsset.id) },
  hearttreeConditions: { [starterCardAsset.id]: emptyHearttreeCondition(starterCardAsset.id) },
  hearttreeReceipts: [],
  hearttreeSquadAssetIds: [starterCardAsset.id]
};

export function createOwnerBoundInitialPlayState(ownerReceizId: string, createdAt = new Date().toISOString()): PlayState {
  const owner = ownerReceizId.trim();
  if (!owner) throw new Error("wilds_player_owner_required");
  const starter = kaiBornStarterCardForOwner(owner, createdAt);
  return {
    ...structuredClone(initialPlayState),
    discoveredCardIds: [starter.manifest.familyId],
    inventory: admitLocallySealedWildsInventory([{ ...starter, status: "verified", synchronizedAt: starter.manifest.capturedAt }]),
    lastEvent: `${starter.manifest.name} joined your deck. Walk near another wild companion.`,
    selectedCardId: starter.manifest.familyId,
    selectedAssetId: starter.id,
    supportAssetIds: EMPTY_WILDS_SUPPORT_ASSET_IDS,
    livingProgress: { [starter.id]: emptyLivingGrowth(0) },
    adventureConditions: { [starter.id]: emptyAdventureCondition(starter.id) },
    hearttreeConditions: { [starter.id]: emptyHearttreeCondition(starter.id) },
    hearttreeReceipts: [],
    hearttreeSquadAssetIds: [starter.id]
  };
}

const PLAY_SAVE_SCHEMA = "receiz.wilds.save.v9";
const LEGACY_PLAY_SAVE_SCHEMAS = new Set(["receiz.wilds.save.v2", "receiz.wilds.save.v3", "receiz.wilds.save.v4", "receiz.wilds.save.v5", "receiz.wilds.save.v6", "receiz.wilds.save.v7", "receiz.wilds.save.v8"]);

export function serializePlayState(state: PlayState) {
  return JSON.stringify({ schema: PLAY_SAVE_SCHEMA, state });
}

function admitAndMergeInventory(assets: PortableCardAsset[]) {
  const merged = new Map<string, PortableCardAsset>();
  for (const source of assets) {
    const asset = isLivingCardAsset(source) ? source : admitLegacyCard(source, source.manifest.capturedAt);
    const existing = merged.get(asset.id);
    if (!existing) {
      merged.set(asset.id, asset);
      continue;
    }
    const existingRevision = isLivingCardAsset(existing) ? currentRevision(existing) : null;
    const candidateRevision = currentRevision(asset);
    if (isLivingCardAsset(existing) && existing.manifest.history && asset.manifest.history) {
      const latest = compareLivingCardHistoryHeads(existing, asset);
      if (latest === "right") merged.set(asset.id, asset);
      continue;
    }
    if (!existingRevision || candidateRevision.revision > existingRevision.revision) {
      merged.set(asset.id, asset);
    }
  }
  return [...merged.values()];
}

function fallbackPlayState(ownerReceizId?: string) {
  return ownerReceizId ? createOwnerBoundInitialPlayState(ownerReceizId) : initialPlayState;
}

function reissuePlaceholderAsset(asset: PortableCardAsset, ownerReceizId: string): PortableCardAsset {
  if (asset.manifest.ownerReceizId !== LEGACY_PLACEHOLDER_OWNER || ownerReceizId === LEGACY_PLACEHOLDER_OWNER) return asset;
  const baseFormId = `${asset.manifest.familyId}-1`;
  let issued: PortableCardAsset = sealCollectedCard({
    formId: baseFormId,
    ownerReceizId,
    encounterId: asset.manifest.encounterId,
    capturedAt: asset.manifest.capturedAt,
    kaiPulse: asset.manifest.variant.kaiPulse,
    battleTranscriptDigest: asset.manifest.variant.battleTranscriptDigest
  });
  for (let stage = 2; stage <= asset.manifest.stage; stage += 1) {
    const evolvedAt = isLivingCardAsset(asset)
      ? asset.manifest.revisions.find((revision) => revision.stage === stage)?.sealedAt ?? asset.proof.sealedAt
      : asset.proof.sealedAt;
    issued = evolvePortableCard({ previous: issued, nextFormId: `${asset.manifest.familyId}-${stage}`, evolvedAt });
  }
  return { ...issued, status: asset.status, synchronizedAt: asset.synchronizedAt };
}

export function normalizeWildsSupportAssetIds(
  values: unknown,
  inventory: readonly PortableCardAsset[],
  leaderAssetId: string
): WildsSupportAssetIds {
  const input = Array.isArray(values) ? values : [];
  const admitted = new Set(inventory.map((asset) => asset.id));
  const seen = new Set<string>();
  const normalized = [0, 1].map((slot) => {
    const value = input[slot];
    if (typeof value !== "string" || !value || value === leaderAssetId || !admitted.has(value) || seen.has(value)) return null;
    seen.add(value);
    return value;
  });
  return [normalized[0] ?? null, normalized[1] ?? null];
}

export function restorePlayState(
  value: string | null | undefined,
  ownerReceizId?: string,
  admittedInventory?: AdmittedWildsInventory
): PlayState {
  const fallback = fallbackPlayState(ownerReceizId);
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as { schema?: unknown; state?: unknown };
    if ((parsed.schema !== PLAY_SAVE_SCHEMA && !LEGACY_PLAY_SAVE_SCHEMAS.has(String(parsed.schema))) || !parsed.state || typeof parsed.state !== "object") return fallback;
    const saved = parsed.state as Partial<PlayState>;
    if (!saved.player || typeof saved.player.x !== "number" || typeof saved.player.z !== "number") return fallback;
    const discoveredCardIds = Array.isArray(saved.discoveredCardIds)
      ? saved.discoveredCardIds.filter((id): id is string => typeof id === "string" && creatureCards.some((card) => card.id === id))
      : fallback.discoveredCardIds;
    const sameSessionInventory = ownerReceizId ? restoreAdmittedWildsInventory(admittedInventory, ownerReceizId) : null;
    const restoredInventory = sameSessionInventory ?? (Array.isArray(saved.inventory)
      ? saved.inventory.filter((asset): asset is PortableCardAsset => Boolean(asset) && verifyAndAdmitWildsCard(asset as PortableCardAsset))
      : []);
    const ownerScopedInventory = ownerReceizId && !sameSessionInventory
      ? restoredInventory.map((asset) => reissuePlaceholderAsset(asset, ownerReceizId))
      : restoredInventory;
    const migratedAssetIds = new Map(restoredInventory.map((asset, index) => [asset.id, ownerScopedInventory[index]?.id ?? asset.id]));
    const inventoryWithMigrations = discoveredCardIds.reduce<PortableCardAsset[]>((assets, cardId, index) => {
      if (assets.some((asset) => asset.manifest.familyId === cardId)) return assets;
      const sealed = sealCollectedCard({
        formId: `${cardId}-1`,
        ownerReceizId: ownerReceizId ?? LEGACY_PLACEHOLDER_OWNER,
        encounterId: `legacy-${cardId}`,
        capturedAt: new Date(Date.UTC(2026, 5, 29, 12, index)).toISOString()
      });
      return [...assets, sealed];
    }, ownerScopedInventory);
    const migratedInventory = sameSessionInventory ?? admitLocallySealedWildsInventory(admitAndMergeInventory(inventoryWithMigrations));
    const restoredHearttreeReceipts = Array.isArray(saved.hearttreeReceipts)
      ? saved.hearttreeReceipts.filter((receipt): receipt is HearttreeReceipt => Boolean(receipt) && verifyHearttreeReceipt(receipt as HearttreeReceipt).ok).slice(-512)
      : [];
    const adventureConditions: Record<string, AdventureCardCondition> = Object.fromEntries(migratedInventory.map((asset) => {
      const originalId = [...migratedAssetIds].find(([, migratedId]) => migratedId === asset.id)?.[0] ?? asset.id;
      if (isLivingCardAsset(asset) && asset.manifest.history) {
        const sealed = currentCreatureHistoryProjection(asset).condition;
        validateAdventureCondition(sealed);
        if (sealed.assetId === asset.id) return [asset.id, {
          ...sealed,
          injuries: [...sealed.injuries],
          xp: { ...sealed.xp },
          mastery: { ...sealed.mastery },
          upgradeIds: [...sealed.upgradeIds],
          receiptDigests: [...sealed.receiptDigests]
        }];
      }
      const shared = saved.adventureConditions?.[asset.id] ?? saved.adventureConditions?.[originalId];
      if (shared) {
        try {
          validateAdventureCondition(shared);
          return [asset.id, { ...shared, assetId: asset.id, injuries: [...shared.injuries], xp: { ...shared.xp }, mastery: { ...shared.mastery }, upgradeIds: [...shared.upgradeIds], receiptDigests: [...shared.receiptDigests] }];
        } catch {
          // Invalid local projections fall through to the legacy Hearttree projection.
        }
      }
      const legacy = saved.hearttreeConditions?.[asset.id] ?? saved.hearttreeConditions?.[originalId];
      if (legacy) {
        try {
          const remapped = { ...legacy, assetId: asset.id };
          projectHearttreeCard(asset, remapped);
          return [asset.id, hearttreeConditionToAdventure(remapped)];
        } catch {
          // Invalid local projections fall back to an alive baseline; verified receipts impose death below.
        }
      }
      return [asset.id, emptyAdventureCondition(asset.id)];
    }));
    for (const receipt of restoredHearttreeReceipts) {
      for (const [assetId, consequence] of Object.entries(receipt.consequences.cards)) {
        const condition = adventureConditions[assetId];
        if (condition && consequence.lifeAfter === "dead") adventureConditions[assetId] = {
          ...condition,
          life: "dead",
          retiredAt: condition.retiredAt ?? receipt.createdAt,
          retirementCauseEventId: condition.retirementCauseEventId ?? `hearttree:${receipt.definition.id}:${receipt.digest}`,
          receiptDigests: [...new Set([...condition.receiptDigests, receipt.digest])].slice(-512)
        };
      }
    }
    const hearttreeConditions = Object.fromEntries(Object.entries(adventureConditions).map(([assetId, condition]) => [assetId, adventureConditionToHearttree(condition)]));
    const civicProjection = projectWildsCivicHistory(Array.isArray(saved.civicEvents) ? saved.civicEvents.slice(-2_048) : []);
    const ecologyProjection = projectWildsEcologyHistory(Array.isArray(saved.ecologyEvents) ? saved.ecologyEvents.slice(-2_048) : []);
    const raidProjection = projectWildsRaidHistory(Array.isArray(saved.raidEvents) ? saved.raidEvents.slice(-4_096) : []);
    const restoredEncounter = restoreEncounter(
      saved.encounter,
      new Set(migratedInventory.map((asset) => asset.manifest.name.toLowerCase()))
    );
    const requestedSelectedAssetId = typeof saved.selectedAssetId === "string"
      ? migratedAssetIds.get(saved.selectedAssetId) ?? saved.selectedAssetId
      : "";
    const livingInventory = migratedInventory.filter((asset) => {
      if (adventureConditions[asset.id]?.life === "dead") return false;
      const life = isLivingCardAsset(asset) ? currentRevision(asset).growth.life : null;
      return !life || (!life.retired && life.vitality > 0);
    });
    const restoredSelectedAssetId = requestedSelectedAssetId && livingInventory.some((asset) => asset.id === requestedSelectedAssetId)
      ? requestedSelectedAssetId
      : [...livingInventory].reverse().find((asset) => asset.manifest.familyId === saved.selectedCardId)?.id ?? livingInventory[0]?.id ?? "";
    const requestedHearttreeSquad = Array.isArray(saved.hearttreeSquadAssetIds) ? saved.hearttreeSquadAssetIds : [restoredSelectedAssetId];
    const hearttreeSquadAssetIds = [...new Set(requestedHearttreeSquad)]
      .filter((id): id is string => typeof id === "string" && livingInventory.some((asset) => asset.id === id))
      .slice(0, 3);
    const restoredPlayer = {
      x: clamp(saved.player.x, worldBounds.min, worldBounds.max),
      z: clamp(saved.player.z, worldBounds.min, worldBounds.max)
    };
    return withWorldProgress({
      ...fallback,
      ...saved,
      player: restoredPlayer,
      siteSpace: normalizeWildsSiteSpaceState(saved.siteSpace, { x: restoredPlayer.x, y: wildsTerrainElevation(restoredPlayer.x, restoredPlayer.z), z: restoredPlayer.z }),
      explorationAtlas: normalizeWildsExplorationAtlas(saved.explorationAtlas, restoredPlayer),
      discoveredCardIds,
      inventory: migratedInventory,
      selectedAssetId: restoredSelectedAssetId,
      selectedCardId: livingInventory.find((asset) => asset.id === restoredSelectedAssetId)?.manifest.familyId ?? "",
      supportAssetIds: normalizeWildsSupportAssetIds(
        Array.isArray(saved.supportAssetIds)
          ? saved.supportAssetIds.map((id) => typeof id === "string" ? migratedAssetIds.get(id) ?? id : id)
          : EMPTY_WILDS_SUPPORT_ASSET_IDS,
        migratedInventory,
        restoredSelectedAssetId
      ),
      capturedHotspotIds: Array.isArray(saved.capturedHotspotIds)
        ? saved.capturedHotspotIds.filter((id): id is string => typeof id === "string")
        : [],
      encounter: restoredEncounter.phase === "sealed" ? { ...restoredEncounter, phase: "revealed" } : restoredEncounter,
      lastSearchPoint: saved.lastSearchPoint && typeof saved.lastSearchPoint.x === "number" && typeof saved.lastSearchPoint.z === "number"
        ? { x: saved.lastSearchPoint.x, z: saved.lastSearchPoint.z }
        : null,
      pendingSyncAssetIds: Array.isArray(saved.pendingSyncAssetIds)
        ? saved.pendingSyncAssetIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => migratedAssetIds.get(id) ?? id)
          .filter((id) => migratedInventory.some((asset) => asset.id === id))
        : migratedInventory.filter((asset) => asset.status === "sealed_local").map((asset) => asset.id),
      pendingTravelGrowthEvents: Array.isArray(saved.pendingTravelGrowthEvents)
        ? saved.pendingTravelGrowthEvents.flatMap((value) => {
            if (!value || typeof value !== "object") return [];
            const pending = value as { assetId?: unknown; event?: Partial<GrowthEvent> };
            const assetId = typeof pending.assetId === "string" ? migratedAssetIds.get(pending.assetId) ?? pending.assetId : "";
            const event = pending.event;
            const eventPrefix = `active_travel:${assetId}:`;
            if (!assetId
              || !migratedInventory.some((asset) => asset.id === assetId)
              || !event
              || typeof event.eventId !== "string"
              || !event.eventId.startsWith(eventPrefix)
              || !/^-?\d+:-?\d+$/.test(event.eventId.slice(eventPrefix.length))
              || event.kind !== "active_travel"
              || event.path !== "bond"
              || event.amount !== 1
              || typeof event.occurredAt !== "string"
              || !Number.isFinite(Date.parse(event.occurredAt))
              || (event.kaiUPulse !== undefined && (!Number.isSafeInteger(event.kaiUPulse) || event.kaiUPulse < 0))) return [];
            return [{
              assetId,
              event: {
                eventId: event.eventId,
                kind: "active_travel" as const,
                path: "bond" as const,
                amount: 1,
                occurredAt: event.occurredAt,
                ...(event.kaiUPulse !== undefined ? { kaiUPulse: event.kaiUPulse } : {})
              }
            }];
          }).slice(-256)
        : [],
      appliedArenaSettlementIds: Array.isArray(saved.appliedArenaSettlementIds)
        ? Array.from(new Set(saved.appliedArenaSettlementIds.filter((id): id is string => typeof id === "string" && /^arena-settlement:[a-f0-9]{24}$/.test(id)))).slice(-512)
        : [],
      companionProgress: {
        ...initialPlayState.companionProgress,
        ...(saved.companionProgress ?? {})
      },
      livingProgress: Object.fromEntries(migratedInventory.map((asset) => {
        const originalId = [...migratedAssetIds].find(([, migratedId]) => migratedId === asset.id)?.[0] ?? asset.id;
        const savedProgress = saved.livingProgress?.[asset.id] ?? saved.livingProgress?.[originalId];
        const admitted = isLivingCardAsset(asset) ? currentRevision(asset).growth : emptyLivingGrowth(0);
        return [asset.id, savedProgress && Array.isArray(savedProgress.eventIds) ? savedProgress : admitted];
      })),
      ascensionCatalysts: Array.isArray(saved.ascensionCatalysts)
        ? saved.ascensionCatalysts.filter((id): id is string => typeof id === "string")
        : [],
      bondCooldowns: saved.bondCooldowns && typeof saved.bondCooldowns === "object" ? saved.bondCooldowns : {},
      transformation: saved.transformation ?? null,
      lineageReveal: saved.lineageReveal ?? null,
      worldMastery: typeof saved.worldMastery === "number" && Number.isFinite(saved.worldMastery) ? Math.max(0, Math.floor(saved.worldMastery)) : fallback.worldMastery,
      civicEvents: civicProjection.events,
      regionalReputation: civicProjection.reputation > 0 ? { "wayfinder-hollow": civicProjection.reputation } : {},
      ecologyEvents: ecologyProjection.events,
      ecologyKnowledge: ecologyProjection.knowledge,
      ecologyMastery: ecologyProjection.mastery,
      raidEvents: raidProjection.events,
      bossKnowledge: raidProjection.knowledge,
      bossMastery: raidProjection.mastery,
      raidAchievements: raidProjection.achievements,
      adventureConditions,
      hearttreeConditions,
      hearttreeReceipts: restoredHearttreeReceipts,
      hearttreeSquadAssetIds: hearttreeSquadAssetIds.length ? hearttreeSquadAssetIds : livingInventory[0] ? [livingInventory[0].id] : []
    });
  } catch {
    return fallback;
  }
}

function reconstructEncounterDiscoveryIdentity(
  encounter: {
    hotspotId?: string;
    formId?: string;
    searchedAt: string;
    location: { x: number; z: number };
    ownerReceizId: string;
  },
  occupiedNames: ReadonlySet<string>
) {
  if (!encounter.hotspotId || !encounter.formId || !encounter.ownerReceizId.trim()) return undefined;
  const form = creatureForm(encounter.formId);
  if (!form) return undefined;
  try {
    return discoverLivingCreature({
      encounterId: encounter.hotspotId,
      form,
      discoveredAt: encounter.searchedAt,
      location: encounter.location,
      ownerScope: encounter.ownerReceizId,
      moment: deriveKaiKlokMoment({ occurredAt: encounter.searchedAt, authority: "world" })
    }, occupiedNames);
  } catch {
    return undefined;
  }
}

function discoveredFormForIdentity(identity: LivingCreatureIdentityV3) {
  return creatureForms.find((form) => form.stage === 1
    && form.familyId === identity.family.id
    && form.anatomy.body === identity.anatomy.body
    && form.anatomy.detail === identity.anatomy.detail);
}

function restoredEncounterPlacement(candidate: Record<string, unknown>) {
  const match = typeof candidate.hotspotId === "string"
    ? candidate.hotspotId.match(/^hotspot:(-?\d+):(-?\d+):(\d+)(?::|$)/)
    : null;
  if (!match) return undefined;
  const regionX = Number(match[1]);
  const regionZ = Number(match[2]);
  const slot = Number(match[3]);
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionZ) || !Number.isSafeInteger(slot)) return undefined;
  return hotspotsForRegion(regionX, regionZ)[slot]?.placement;
}

function canonicalEncounterSiteContext(siteKey: unknown, spaceId: unknown, placement: ReturnType<typeof restoredEncounterPlacement>) {
  if (typeof siteKey !== "string" || typeof spaceId !== "string" || !placement || !isCanonicalWildsDiscoverySiteKey(siteKey)) return undefined;
  const match = siteKey.match(/^wildz\.site\.v1:(-?\d+):(-?\d+):/);
  if (!match) return undefined;
  const regionX = Number(match[1]), regionZ = Number(match[2]);
  if (!Number.isSafeInteger(regionX) || !Number.isSafeInteger(regionZ)) return undefined;
  try {
    const physical = admitWildsDiscoveryPhysicalNeighborhood(regionX, regionZ);
    const volume = physical.encounterVolumes.find((entry) => entry.siteKey === siteKey && entry.spaceId === spaceId
      && Math.abs(placement.x - entry.center.x) <= entry.halfExtents.x && Math.abs(placement.z - entry.center.z) <= entry.halfExtents.z
      && placement.worldY >= entry.center.y - entry.halfExtents.y && placement.worldY <= entry.center.y + entry.halfExtents.y);
    return volume ? Object.freeze({ siteKey: volume.siteKey, spaceId: volume.spaceId }) : undefined;
  } catch { return undefined; }
}

function restoredEncounterSiteContext(candidate: Record<string, unknown>, placement: ReturnType<typeof restoredEncounterPlacement>) {
  const context = candidate.siteContext as Record<string, unknown> | undefined;
  return canonicalEncounterSiteContext(context?.siteKey, context?.spaceId, placement);
}

function restoreEncounter(value: unknown, occupiedNames: ReadonlySet<string> = new Set()): EncounterState {
  if (!value || typeof value !== "object") return idleEncounterState;
  const candidate = value as Record<string, unknown>;
  if (candidate.phase === "idle") return idleEncounterState;
  const phases = new Set(["searching", "hint", "battle_intro", "player_turn", "capture_ready", "fled", "defeated", "emerging", "capsule", "sealed", "revealed"]);
  if (!phases.has(String(candidate.phase)) || typeof candidate.searchedAt !== "string" || typeof candidate.ownerReceizId !== "string") return idleEncounterState;
  const point = candidate.searchPoint as Record<string, unknown> | undefined;
  if (!point || typeof point.x !== "number" || typeof point.z !== "number") return idleEncounterState;
  const searchPoint = {
    x: point.x,
    z: point.z,
    ...(typeof point.surfaceWorldY === "number" && Number.isFinite(point.surfaceWorldY) ? { surfaceWorldY: point.surfaceWorldY } : {})
  };
  const proximity = candidate.proximity === "warm" || candidate.proximity === "hot" ? candidate.proximity : "cold";
  const trend = candidate.trend === "closer" || candidate.trend === "farther" || candidate.trend === "steady" ? candidate.trend : null;
  let discoveryIdentity: LivingCreatureIdentityV3 | undefined;
  if (candidate.discoveryIdentity && typeof candidate.discoveryIdentity === "object") {
    try {
      const restored = candidate.discoveryIdentity as LivingCreatureIdentityV3;
      if (restored.encounterId === candidate.hotspotId && validateLivingCreatureIdentity(restored).ok) discoveryIdentity = restored;
    } catch {
      discoveryIdentity = undefined;
    }
  }
  const visibleIdentityPhases = new Set(["battle_intro", "player_turn", "capture_ready", "fled", "defeated", "emerging", "capsule", "sealed", "revealed"]);
  const placement = restoredEncounterPlacement(candidate);
  const siteContext = restoredEncounterSiteContext(candidate, placement);
  if (candidate.siteContext !== undefined && !siteContext) return idleEncounterState;
  if (!discoveryIdentity && visibleIdentityPhases.has(String(candidate.phase))) {
    discoveryIdentity = reconstructEncounterDiscoveryIdentity({
      hotspotId: typeof candidate.hotspotId === "string" ? candidate.hotspotId : undefined,
      formId: typeof candidate.formId === "string" ? candidate.formId : undefined,
      searchedAt: candidate.searchedAt,
      location: placement ? { x: placement.x, z: placement.z } : { x: point.x, z: point.z },
      ownerReceizId: candidate.ownerReceizId
    }, occupiedNames);
  }
  const canonicalForm = discoveryIdentity ? discoveredFormForIdentity(discoveryIdentity) : undefined;
  return {
    ...candidate,
    searchPoint,
    proximity,
    trend,
    ...(canonicalForm ? { familyId: canonicalForm.familyId, formId: canonicalForm.id } : {}),
    ...(placement ? { placement } : {}),
    ...(siteContext ? { siteContext } : { siteContext: undefined }),
    discoveryIdentity
  } as EncounterState;
}

export function selectedCard(state: PlayState) {
  const asset = selectedAsset(state);
  return creatureCards.find((card) => card.id === (asset?.manifest.familyId ?? state.selectedCardId)) ?? creatureCards[0];
}

export function selectedAsset(state: PlayState) {
  return state.inventory.find((asset) => asset.id === state.selectedAssetId) ?? state.inventory.find((asset) => asset.manifest.familyId === state.selectedCardId) ?? state.inventory[0];
}

export function isPlayableAsset(state: PlayState, assetId: string) {
  const asset = state.inventory.find((candidate) => candidate.id === assetId);
  if (!asset || (!isAdmittedWildsCard(asset) && !verifyAndAdmitWildsCard(asset)) || state.adventureConditions[assetId]?.life === "dead") return false;
  const life = isLivingCardAsset(asset) ? currentRevision(asset).growth.life : null;
  return !life || (!life.retired && life.vitality > 0);
}

export function playableInventory(state: PlayState) {
  return state.inventory.filter((asset) => isPlayableAsset(state, asset.id));
}

export function applyCommittedArenaSettlement(state: PlayState, settlement: ArenaSettlement): PlayState {
  if (settlement.status !== "committed") throw new Error("Arena settlement must be committed before it can change play state");
  if ((state.appliedArenaSettlementIds ?? []).includes(settlement.id)) return state;
  const cards = [...settlement.cards];
  const pins = [...settlement.cardPins];
  if (!cards.length
    || new Set(cards.map((card) => card.id)).size !== cards.length
    || pins.length !== cards.length
    || new Set(pins.map((pin) => pin.assetId)).size !== pins.length) {
    throw new Error("Arena settlement roster is invalid");
  }
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const pinById = new Map(pins.map((pin) => [pin.assetId, pin]));
  for (const card of cards) {
    const current = state.inventory.find((candidate) => candidate.id === card.id);
    const pin = pinById.get(card.id);
    if (!current || !pin || current.proof.digest !== pin.proofDigest) {
      throw new Error(`Arena settlement proof pin is stale for ${card.id}`);
    }
    if (!verifyAndAdmitWildsCard(card)) throw new Error(`Arena settlement card proof is invalid for ${card.id}`);
  }

  const inventory = admitLocallySealedWildsInventory(state.inventory.map((card) => cardById.get(card.id) ?? card));
  const livingProgress = { ...state.livingProgress };
  const adventureConditions = { ...state.adventureConditions };
  const hearttreeConditions = { ...state.hearttreeConditions };
  for (const card of cards) {
    if (!isLivingCardAsset(card)) continue;
    livingProgress[card.id] = currentRevision(card).growth;
    const condition = currentCreatureHistoryProjection(card).condition;
    validateAdventureCondition(condition);
    adventureConditions[card.id] = condition;
    hearttreeConditions[card.id] = adventureConditionToHearttree(condition);
  }

  const provisional: PlayState = {
    ...state,
    inventory,
    livingProgress,
    adventureConditions,
    hearttreeConditions,
    pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, ...cards.map((card) => card.id)])),
    appliedArenaSettlementIds: [...(state.appliedArenaSettlementIds ?? []), settlement.id].slice(-512)
  };
  const selectedStillPlayable = isPlayableAsset(provisional, state.selectedAssetId);
  const fallback = selectedStillPlayable ? null : playableInventory(provisional)[0] ?? null;
  const selectedAssetId = selectedStillPlayable ? state.selectedAssetId : fallback?.id ?? "";
  const selected = inventory.find((card) => card.id === selectedAssetId) ?? null;
  const companionProgress = selected
    ? { ...state.companionProgress, [selected.manifest.familyId]: exactCompanionProgress(provisional, selected) }
    : state.companionProgress;
  const mode = settlement.result.canonical?.mode ?? (settlement.result.mortal ? "mortal" : "adventure");
  const retiredNames = cards
    .filter((card) => settlement.result.retiredCreatureIds.includes(card.id))
    .map((card) => card.manifest.name);

  return {
    ...provisional,
    selectedAssetId,
    selectedCardId: selected?.manifest.familyId ?? "",
    companionProgress,
    supportAssetIds: normalizeWildsSupportAssetIds(state.supportAssetIds, inventory, selectedAssetId),
    lastEvent: retiredNames.length
      ? `${retiredNames.join(", ")} ${retiredNames.length === 1 ? "was" : "were"} sealed into the memorial Vault after the Mortal Arena.`
      : settlement.result.winnerSide === settlement.playerSide
        ? `${mode === "mortal" ? "Mortal Arena" : "Arena"} victory was written into every affected creature's living history.`
        : `${mode === "mortal" ? "Mortal Arena" : "Arena"} consequences were written into every affected creature's living history.`
  };
}

export function discoveredCards(state: PlayState) {
  return creatureCards.filter((card) => state.discoveredCardIds.includes(card.id));
}

export function nearestCreature(state: Pick<PlayState, "player">) {
  let nearest: { card: CreatureCard; distance: number } | undefined;
  for (const card of nearbyCreatureCards(state.player)) {
    const distance = distance2d(state.player, { x: card.position[0], z: card.position[2] });
    if (!nearest || distance < nearest.distance) nearest = { card, distance };
  }
  return nearest;
}

export function canDiscover(state: PlayState) {
  const nearest = nearestCreature(state);
  return Boolean(nearest && nearest.distance <= 1.25 && !state.discoveredCardIds.includes(nearest.card.id));
}

function growthForAsset(state: PlayState, asset: PortableCardAsset) {
  return state.livingProgress[asset.id]
    ?? (isLivingCardAsset(asset) ? currentRevision(asset).growth : emptyLivingGrowth(state.companionProgress[asset.manifest.familyId]?.bond ?? 0));
}

function exactCompanionProgress(state: PlayState, asset: PortableCardAsset) {
  if (isLivingCardAsset(asset)) {
    const projection = currentCreatureHistoryProjection(asset);
    return { level: projection.level, xp: projection.xp, bond: projection.bond };
  }
  return state.companionProgress[asset.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
}

function appendRecordedGrowthToExactCard(state: PlayState, assetId: string, event: GrowthEvent): PlayState {
  const asset = state.inventory.find((candidate) => candidate.id === assetId);
  if (!asset || !isLivingCardAsset(asset)) return state;
  const prior = currentCreatureHistoryProjection(asset);
  const familyProgress = state.selectedAssetId === asset.id
    ? state.companionProgress[asset.manifest.familyId] ?? { level: prior.level, xp: prior.xp, bond: prior.bond }
    : { level: prior.level, xp: prior.xp, bond: prior.bond };
  const recordedGrowth = growthForAsset(state, asset);
  const growth = { ...recordedGrowth, bond: Math.max(recordedGrowth.bond, familyProgress.bond) };
  const condition = state.adventureConditions[asset.id] ?? prior.condition;
  const eventKai = event.kaiUPulse === undefined
    ? null
    : deriveKaiKlokMomentFromUPulse({ uPulse: event.kaiUPulse, authority: "local" });
  try {
    const updated = appendLivingCardHistory({
      asset,
      event: {
        eventId: `history:${event.eventId}`,
        rulesetVersion: "wildz.gameplay.v4-alpha",
        occurredAt: event.occurredAt,
        ...(eventKai ? { kai: {
          uPulse: eventKai.uPulse,
          pulse: eventKai.pulse,
          beat: eventKai.beat,
          stepIndex: eventKai.stepIndex,
          weekday: eventKai.weekday,
          chakra: eventKai.chakra,
          coordinate: eventKai.coordinate
        } } : {}),
        source: {
          mode: event.kind === "bond_moment" ? "training" : "world",
          activityId: event.eventId,
          actorId: asset.manifest.ownerReceizId,
          authority: "local"
        },
        evidence: { sourceEventIds: [event.eventId] },
        effects: [{
          kind: "legacy-checkpoint",
          projection: {
            ...prior,
            level: familyProgress.level,
            xp: familyProgress.xp,
            bond: growth.bond,
            growth,
            condition,
            mastery: { ...condition.mastery },
            achievements: Array.from(new Set([...prior.achievements, ...growth.achievementIds])),
            upgrades: Array.from(new Set([...prior.upgrades, ...condition.upgradeIds]))
          }
        }]
      }
    });
    if (updated === asset) return state;
    return {
      ...state,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((candidate) => candidate.id === updated.id ? updated : candidate)),
      livingProgress: { ...state.livingProgress, [updated.id]: growth },
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, updated.id]))
    };
  } catch {
    return { ...state, lastEvent: "That creature history event could not be verified." };
  }
}

function applyRecordedGrowth(state: PlayState, asset: PortableCardAsset, event: GrowthEvent): PlayState {
  const prior = growthForAsset(state, asset);
  let prepared = event;
  if (isLivingCardAsset(asset) && event.kind) {
    const quest = nextGrowthRequirements(asset, event.occurredAt).quest;
    const matchingEvents = prior.eventIds.filter((id) => id.startsWith(`${event.kind}:`)).length + (prior.eventIds.includes(event.eventId) ? 0 : 1);
    if (quest.eventKind === event.kind && matchingEvents >= quest.target) prepared = { ...event, questId: quest.id };
  }
  let progress: LivingGrowthSnapshot;
  try {
    progress = applyGrowthEvent(prior, prepared);
  } catch {
    return { ...state, lastEvent: "That growth event could not be verified." };
  }
  if (progress === state.livingProgress[asset.id]) return state;
  const catalyst = event.achievementId?.startsWith("boss_victory")
    ? `ascension:tier:2:${event.eventId.replace(/[^a-zA-Z0-9_-]/g, "-")}`
    : null;
  const next = {
    ...state,
    livingProgress: { ...state.livingProgress, [asset.id]: progress },
    ascensionCatalysts: catalyst ? Array.from(new Set([...state.ascensionCatalysts, catalyst])) : state.ascensionCatalysts,
    lastEvent: event.achievementId ? `${asset.manifest.name} earned ${event.achievementId.replaceAll("_", " ")}.` : `${asset.manifest.name} grew through ${event.path}.`
  };
  return appendRecordedGrowthToExactCard(next, asset.id, prepared);
}

function applyRecordedGrowthEvents(state: PlayState, asset: PortableCardAsset, events: GrowthEvent[]) {
  return events.reduce((next, event) => applyRecordedGrowth(next, asset, event), state);
}

function strongestGrowthPath(progress: LivingGrowthSnapshot): GrowthPath {
  return (Object.entries(progress.paths) as Array<[GrowthPath, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "character";
}

function awardWorldMastery(state: PlayState, verb: WorldMasteryVerb) {
  return { ...state, worldMastery: state.worldMastery + worldMasteryAward(verb) };
}

export function applyWildsInput(state: PlayState, input: WildsInput): PlayState {
  if (input.kaiUPulse !== undefined) input = rootWildsInputInKai(input, input.kaiUPulse);
  if (input.type === "reset") {
    const owner = selectedAsset(state)?.manifest.ownerReceizId ?? state.inventory[0]?.manifest.ownerReceizId;
    return owner ? createOwnerBoundInitialPlayState(owner) : initialPlayState;
  }

  if (input.type === "settle-pending-travel-growth") {
    if (!state.pendingTravelGrowthEvents.length) return state;
    return state.pendingTravelGrowthEvents.reduce<PlayState>((next, pending) => {
      const asset = next.inventory.find((candidate) => candidate.id === pending.assetId);
      return asset ? applyRecordedGrowth(next, asset, pending.event) : next;
    }, { ...state, pendingTravelGrowthEvents: [] });
  }

  if (input.type === "record-creature-observation") {
    const asset = state.inventory.find((candidate) => candidate.id === input.turn.assetId);
    if (!asset || !isPlayableAsset(state, asset.id)) return state;
    try {
      const living = isLivingCardAsset(asset)
        ? asset
        : admitLegacyCard(asset, input.turn.observedAt);
      const observed = appendLivingCardHistory({
        asset: living,
        event: {
          eventId: `conversation:${input.turn.turnId}`,
          rulesetVersion: "wildz.creature-observer.v1",
          occurredAt: input.turn.observedAt,
          source: {
            mode: "conversation",
            activityId: `creature:${input.turn.turnId}`,
            actorId: input.turn.ownerActorId,
            authority: "local"
          },
          evidence: { sourceEventDigest: input.turn.contextDigest },
          effects: [{ kind: "observer-memory", turn: input.turn }]
        }
      });
      return {
        ...state,
        inventory: admitLocallySealedWildsInventory(state.inventory.map((candidate) => candidate.id === observed.id ? observed : candidate)),
        livingProgress: { ...state.livingProgress, [observed.id]: currentRevision(observed).growth },
        pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, observed.id])),
        lastEvent: `${observed.manifest.name} remembered your conversation in its portable proof brain.`
      };
    } catch {
      return { ...state, lastEvent: `${asset.manifest.name}'s observed reply could not be appended to its verified brain.` };
    }
  }

  if (input.type === "care-for-creature") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id)) return state;
    const requiredBeans = input.action === "feed" ? 3 : input.action === "treat" ? 8 : 0;
    if (state.beans < requiredBeans) {
      return { ...state, lastEvent: `Play the world to earn ${requiredBeans - state.beans} more trail bean${requiredBeans - state.beans === 1 ? "" : "s"} for ${asset.manifest.name}.` };
    }
    const result = careForCreature({ asset, ownerReceizId: input.ownerReceizId, action: input.action, at: input.at });
    if (!result.ok) {
      const message = result.code === "care_mandate_inactive"
        ? `Awaken ${asset.manifest.name}'s Life while away before beginning its care cycle.`
        : result.code === "care_creature_dead"
          ? `${asset.manifest.name}'s living journey has ended; its proof memory remains.`
          : `${asset.manifest.name}'s care action was denied. Nothing was spent or appended.`;
      return { ...state, lastEvent: message };
    }
    return {
      ...state,
      beans: state.beans - result.cost,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((candidate) => candidate.id === result.asset.id ? result.asset : candidate)),
      livingProgress: isLivingCardAsset(result.asset)
        ? { ...state.livingProgress, [result.asset.id]: currentRevision(result.asset).growth }
        : state.livingProgress,
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, result.asset.id])),
      lastEvent: input.action === "feed"
        ? `${result.asset.manifest.name} ate 3 trail beans earned through play.`
        : input.action === "comfort"
          ? `${result.asset.manifest.name} felt your attention and grew calmer.`
          : `${result.asset.manifest.name} received restorative care using 8 trail beans.`
    };
  }

  if (input.type === "settle-creature-care") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id)) return state;
    const result = settleCreatureCare({ asset, ownerReceizId: input.ownerReceizId, at: input.at });
    if (!result.ok) return state;
    return {
      ...state,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((candidate) => candidate.id === result.asset.id ? result.asset : candidate)),
      adventureConditions: isLivingCardAsset(result.asset)
        ? { ...state.adventureConditions, [result.asset.id]: currentCreatureHistoryProjection(result.asset).condition }
        : state.adventureConditions,
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, result.asset.id])),
      lastEvent: `${result.asset.manifest.name}'s active care mandate went unanswered until its wellness reached zero. Its living journey is now permanently remembered.`
    };
  }

  if (input.type === "activate-creature-continuity"
    || input.type === "pause-creature-continuity"
    || input.type === "settle-creature-continuity") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id)) return state;
    const command = input.type === "activate-creature-continuity"
      ? livingSubjectContinuityV120.activate
      : input.type === "pause-creature-continuity"
        ? livingSubjectContinuityV120.pause
        : livingSubjectContinuityV120.settle;
    const result = command({ asset, ownerReceizId: input.ownerReceizId, at: input.at });
    if (!result.ok) {
      if (result.code === "continuity_no_action_due") return state;
      const message = result.code === "continuity_owner_mismatch"
        ? `${asset.manifest.name}'s roaming mandate belongs to a different Receiz owner and remains inactive.`
        : result.code === "continuity_mandate_missing" || result.code === "continuity_mandate_inactive"
          ? `${asset.manifest.name} is resting in the Vault. Activate Life while away to let it roam.`
          : `${asset.manifest.name}'s continuity command was denied. Its proof brain was not changed.`;
      return { ...state, lastEvent: message };
    }
    const verb = input.type === "activate-creature-continuity"
      ? "can now live between visits under your bounded roaming mandate"
      : input.type === "pause-creature-continuity"
        ? "is resting safely in the Vault; its lived history remains intact"
        : `remembered ${result.appended} real ${result.appended === 1 ? "moment" : "moments"} that settled into its proof brain`;
    return {
      ...state,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((candidate) => candidate.id === result.asset.id ? result.asset : candidate)),
      livingProgress: isLivingCardAsset(result.asset)
        ? { ...state.livingProgress, [result.asset.id]: currentRevision(result.asset).growth }
        : state.livingProgress,
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, result.asset.id])),
      lastEvent: `${result.asset.manifest.name} ${verb}.`
    };
  }

  if (input.type === "use-field-ability") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id) || !Number.isInteger(input.abilityIndex) || !Number.isFinite(Date.parse(input.usedAt))) return state;
    const form = creatureForm(asset.manifest.formId);
    const ability = form?.abilities[input.abilityIndex];
    if (!ability) return state;
    const familyId = asset.manifest.familyId;
    const current = exactCompanionProgress(state, asset);
    const xpGain = Math.max(1, Math.round(ability.power / 12));
    const totalXp = current.xp + xpGain;
    const levelGain = Math.floor(totalXp / 100);
    const next = {
      level: Math.min(10, current.level + levelGain),
      xp: totalXp % 100,
      bond: Math.min(100, current.bond + input.abilityIndex + 1)
    };
    const nextState: PlayState = {
      ...state,
      activeAction: "explore",
      companionProgress: { ...state.companionProgress, [familyId]: next },
      energy: Math.max(0, state.energy - input.abilityIndex - 1),
      lastEvent: `${asset.manifest.name} used ${ability.name}. ${ability.text}`
    };
    const grown = applyRecordedGrowth(nextState, asset, {
      eventId: `ability_mastery:${asset.id}:${input.abilityIndex}:${input.usedAt}`,
      kind: "ability_mastery",
      path: "battle",
      amount: 1,
      occurredAt: input.usedAt,
      kaiUPulse: input.kaiUPulse
    });
    return grown.lastEvent.endsWith("could not be verified.")
      ? grown
      : { ...grown, lastEvent: nextState.lastEvent };
  }


  if (input.type === "hearttree-select-squad") {
    const assetIds = [...new Set(input.assetIds)];
    if (assetIds.length < 1 || assetIds.length > 3 || assetIds.some((assetId) => !isPlayableAsset(state, assetId))) return state;
    return { ...state, hearttreeSquadAssetIds: assetIds, lastEvent: `${assetIds.length} living card${assetIds.length === 1 ? "" : "s"} ready for the Hearttree.` };
  }

  if (input.type === "hearttree-admit") {
    if (!verifyHearttreeReceipt(input.receipt).ok || state.hearttreeReceipts.some((receipt) => receipt.digest === input.receipt.digest)) return state;
    const conditions = { ...state.adventureConditions };
    let inventory = state.inventory;
    let livingProgress = state.livingProgress;
    let pendingSyncAssetIds = state.pendingSyncAssetIds;
    try {
      for (const [assetId, consequence] of Object.entries(input.receipt.consequences.cards)) {
        const current = conditions[assetId] ?? emptyAdventureCondition(assetId);
        const prior = input.receipt.priorConditions[assetId];
        if (!prior || JSON.stringify(adventureConditionToHearttree(current)) !== JSON.stringify(prior) || !state.inventory.some((asset) => asset.id === assetId)) throw new Error("hearttree_receipt_prior_invalid");
        const applied = hearttreeConditionToAdventure(applyHearttreeConsequences(adventureConditionToHearttree(current), consequence));
        conditions[assetId] = {
          ...current,
          life: applied.life,
          fatigue: applied.fatigue,
          injuries: applied.injuries,
          xp: { ...current.xp, hearttree: applied.xp.hearttree ?? 0 },
          mastery: { ...current.mastery, hearttree: applied.mastery.hearttree ?? 0 },
          upgradeIds: [...new Set([...current.upgradeIds, ...applied.upgradeIds])],
          receiptDigests: [...new Set([...current.receiptDigests, input.receipt.digest])].slice(-512),
          ...(current.life === "alive" && applied.life === "dead" ? {
            retiredAt: input.receipt.createdAt,
            retirementCauseEventId: `hearttree:${input.receipt.definition.id}:${input.receipt.digest}`
          } : {})
        };
        const asset = inventory.find((candidate) => candidate.id === assetId);
        if (current.life === "alive" && applied.life === "dead" && asset && isLivingCardAsset(asset) && !currentRevision(asset).growth.life?.retired) {
          const sealed = sealRetirement(asset, {
            creatureId: asset.id,
            previousRevisionDigest: currentRevision(asset).digest,
            matchReceiptDigest: input.receipt.digest,
            finalVitality: 0,
            teamOutcome: "defeat",
            retiredAt: input.receipt.createdAt,
            cause: "hearttree-mortal-death"
          }, { verified: true, mortalOptIn: input.receipt.definition.mortal });
          inventory = inventory.map((candidate) => candidate.id === assetId ? sealed.card : candidate);
          livingProgress = { ...livingProgress, [assetId]: currentRevision(sealed.card).growth };
          pendingSyncAssetIds = Array.from(new Set([...pendingSyncAssetIds, assetId]));
        }
        const exactCard = inventory.find((candidate) => candidate.id === assetId);
        if (exactCard && isLivingCardAsset(exactCard)) {
          const priorProjection = currentCreatureHistoryProjection(exactCard);
          const condition = conditions[assetId]!;
          const updated = appendLivingCardHistory({
            asset: exactCard,
            event: {
              eventId: `history:hearttree:${input.receipt.digest}:${assetId}`,
              rulesetVersion: "wildz.hearttree.v1",
              occurredAt: input.receipt.createdAt,
              source: {
                mode: "hearttree",
                activityId: input.receipt.definition.id,
                actorId: input.receipt.actorId,
                authority: "local"
              },
              evidence: {
                receiptDigest: input.receipt.digest,
                replayDigest: input.receipt.transcript.digest
              },
              effects: [{
                kind: "legacy-checkpoint",
                projection: {
                  ...priorProjection,
                  condition,
                  mastery: { ...condition.mastery },
                  upgrades: Array.from(new Set([...priorProjection.upgrades, ...condition.upgradeIds]))
                }
              }]
            }
          });
          inventory = inventory.map((candidate) => candidate.id === assetId ? updated : candidate);
          pendingSyncAssetIds = Array.from(new Set([...pendingSyncAssetIds, assetId]));
        }
      }
    } catch {
      return state;
    }
    const hearttreeConditions = Object.fromEntries(Object.entries(conditions).map(([assetId, condition]) => [assetId, adventureConditionToHearttree(condition)]));
    const provisional = { ...state, inventory, livingProgress, pendingSyncAssetIds, adventureConditions: conditions, hearttreeConditions };
    const playable = playableInventory(provisional);
    const selected = isPlayableAsset(provisional, state.selectedAssetId) ? state.selectedAssetId : playable[0]?.id ?? "";
    const squad = state.hearttreeSquadAssetIds.filter((assetId) => isPlayableAsset(provisional, assetId));
    return {
      ...provisional,
      selectedAssetId: selected,
      selectedCardId: playable.find((asset) => asset.id === selected)?.manifest.familyId ?? state.selectedCardId,
      supportAssetIds: normalizeWildsSupportAssetIds(state.supportAssetIds, playable, selected),
      hearttreeSquadAssetIds: squad.length ? squad : playable[0] ? [playable[0].id] : [],
      hearttreeReceipts: [...state.hearttreeReceipts, input.receipt].slice(-512),
      lastEvent: input.receipt.consequences.outcome === "squad-defeated" && input.receipt.definition.mortal
        ? "The Mortal Heart has spoken. Fallen cards remain forever in the memorial inventory."
        : "The Hearttree receipt was verified and its consequences are now permanent."
    };
  }

  if (input.type === "assign-support") {
    const current = [...state.supportAssetIds] as [string | null, string | null];
    if (input.assetId !== null) {
      const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
      const otherSlot = input.slot === 0 ? 1 : 0;
      if (!asset || !isPlayableAsset(state, asset.id) || asset.id === state.selectedAssetId || current[otherSlot] === asset.id) {
        return { ...state, lastEvent: "That companion cannot occupy this support slot." };
      }
    }
    current[input.slot] = input.assetId;
    return {
      ...state,
      supportAssetIds: normalizeWildsSupportAssetIds(current, state.inventory, state.selectedAssetId),
      lastEvent: input.assetId ? "Trail Pack support updated." : "Trail Pack support slot cleared."
    };
  }

  if (input.type === "record-civic-event") {
    const projection = projectWildsCivicHistory([...state.civicEvents, input.event].slice(-2_048));
    if (projection.events.length === state.civicEvents.length) return state;
    return {
      ...state,
      civicEvents: projection.events,
      regionalReputation: { ...state.regionalReputation, "wayfinder-hollow": projection.reputation },
      lastEvent: `Wayfinder Hollow remembers this moment. Reputation ${projection.reputation}.`
    };
  }

  if (input.type === "record-ecology-event") {
    const projection = projectWildsEcologyHistory([...state.ecologyEvents, input.event].slice(-2_048));
    if (projection.events.length === state.ecologyEvents.length) return state;
    return {
      ...state,
      ecologyEvents: projection.events,
      ecologyKnowledge: projection.knowledge,
      ecologyMastery: projection.mastery,
      lastEvent: `${input.event.familyId.replaceAll("-", " ")} remembered. Ecology mastery ${projection.mastery[input.event.familyId]}.`
    };
  }

  if (input.type === "record-raid-event") {
    const projection = projectWildsRaidHistory([...state.raidEvents, input.event].slice(-4_096));
    if (projection.events.length === state.raidEvents.length) return state;
    return {
      ...state,
      raidEvents: projection.events,
      bossKnowledge: projection.knowledge,
      bossMastery: projection.mastery,
      raidAchievements: projection.achievements,
      lastEvent: `${input.event.familyId.replaceAll("-", " ")} raid remembered. Mastery ${projection.mastery[input.event.familyId]}.`
    };
  }

  if (input.type === "finish-transformation") return state.transformation ? { ...state, transformation: null } : state;
  if (input.type === "finish-lineage-reveal") return state.lineageReveal ? { ...state, lineageReveal: null } : state;

  if (input.type === "record-growth") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    return asset && isPlayableAsset(state, asset.id)
      ? applyRecordedGrowth(state, asset, { ...input.event, kaiUPulse: input.kaiUPulse ?? input.event.kaiUPulse })
      : state;
  }

  if (input.type === "ascend-card") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id) || !isLivingCardAsset(asset) || asset.manifest.stage !== 3) return state;
    const progress = growthForAsset(state, asset);
    const readiness = growthReadiness(asset, { progress, catalystIds: state.ascensionCatalysts }, input.at);
    if (!readiness.ready) return { ...state, lastEvent: `${asset.manifest.name} still needs ${readiness.missing.join(", ")}.` };
    const candidate = buildTransformationCandidate(asset, readiness, input.at);
    const kai = input.kaiUPulse === undefined
      ? deriveKaiKlokMoment({ occurredAt: input.at, authority: "local" })
      : deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: "local" });
    const prior = currentRevision(asset);
    const nextGrowth: LivingGrowthSnapshot = {
      ...progress,
      consumedAchievementIds: Array.from(new Set([...progress.consumedAchievementIds, candidate.achievementId])),
      recoveryUntil: new Date(Date.parse(input.at) + readiness.requirements.recoveryMs).toISOString()
    };
    const nextGenome = deriveAscensionGenome({
      previous: currentLivingGenome(asset),
      rank: candidate.ascensionRank,
      achievementId: candidate.achievementId,
      questId: candidate.questId,
      kaiPulse: String(kai.uPulse),
      path: strongestGrowthPath(progress)
    });
    let ascended;
    try {
      ascended = appendLivingCardRevision({
        asset,
        revision: {
          sealedAt: input.at,
          kaiPulse: String(kai.uPulse),
          reason: { kind: "ascension", label: `Ascension ${candidate.ascensionRank} earned through ${candidate.achievementId.replaceAll("_", " ")}` },
          stage: 3,
          ascensionRank: candidate.ascensionRank,
          formId: asset.manifest.formId,
          growth: nextGrowth,
          qualifyingAchievementIds: [candidate.achievementId],
          consumedCatalystId: candidate.catalystId,
          genomeDelta: nextGenome,
          stats: { ...asset.manifest.stats },
          abilityNames: asset.manifest.abilityNames,
          title: `${asset.manifest.name} · Ascension ${candidate.ascensionRank}`,
          childEventIds: [...prior.childEventIds]
        }
      });
    } catch {
      return { ...state, lastEvent: "Ascension sealing failed. Nothing was consumed." };
    }
    return awardWorldMastery({
      ...state,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((item) => item.id === ascended.id ? ascended : item)),
      livingProgress: { ...state.livingProgress, [ascended.id]: nextGrowth },
      ascensionCatalysts: state.ascensionCatalysts.filter((id) => id !== candidate.catalystId),
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, ascended.id])),
      transformation: { assetId: ascended.id, fromRevision: prior.revision, toRevision: currentRevision(ascended).revision, reason: currentRevision(ascended).reason.label },
      lastEvent: `${asset.manifest.name} reached Ascension ${candidate.ascensionRank}. Its living proof history grew in place.`
    }, "ascension");
  }

  if (input.type === "import-card") {
    const asset = input.asset;
    if (!verifyAndAdmitWildsCard(asset)) return { ...state, lastEvent: "That PNG did not pass the offline card verifier." };
    const importedCondition = state.adventureConditions[asset.id]
      ?? (isLivingCardAsset(asset)
        ? currentCreatureHistoryProjection(asset).condition
        : emptyAdventureCondition(asset.id));
    const importedConditions = {
      adventureConditions: { ...state.adventureConditions, [asset.id]: importedCondition },
      hearttreeConditions: {
        ...state.hearttreeConditions,
        [asset.id]: adventureConditionToHearttree(importedCondition)
      }
    };
    const existing = state.inventory.find((candidate) => candidate.id === asset.id);
    if (existing) {
      const canExtend = isLivingCardAsset(asset) && (!isLivingCardAsset(existing) || (
        asset.manifest.revisions.length > existing.manifest.revisions.length
        && existing.manifest.revisions.every((revision, index) => asset.manifest.revisions[index]?.digest === revision.digest)
      ));
      if (canExtend) {
        const progress = currentRevision(asset).growth;
        return withWorldProgress({
          ...state,
          ...importedConditions,
          inventory: retainAdmittedWildsInventory(state.inventory.map((candidate) => candidate.id === asset.id ? asset : candidate)),
          livingProgress: { ...state.livingProgress, [asset.id]: progress },
          pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, asset.id])),
          selectedAssetId: asset.id,
          selectedCardId: asset.manifest.familyId,
          lastEvent: `${asset.manifest.name}'s newer verified proof history merged into your living card.`
        });
      }
      return {
        ...state,
        ...importedConditions,
        inventory: retainAdmittedWildsInventory(state.inventory),
        selectedAssetId: asset.id,
        selectedCardId: asset.manifest.familyId,
        lastEvent: `${asset.manifest.name} is already in your inventory and now leads your active deck.`
      };
    }
    const discoveredCardIds = Array.from(new Set([...state.discoveredCardIds, asset.manifest.familyId]));
    return withWorldProgress({
      ...state,
      ...importedConditions,
      discoveredCardIds,
      inventory: retainAdmittedWildsInventory([...state.inventory, asset]),
      selectedAssetId: asset.id,
      selectedCardId: asset.manifest.familyId,
      lastEvent: `${asset.manifest.name} passed offline verification and joined your playable inventory.`
    });
  }

  if (input.type === "transfer-card-out") {
    if (!state.inventory.some((asset) => asset.id === input.assetId)) return state;
    const inventory = retainAdmittedWildsInventory(state.inventory.filter((asset) => asset.id !== input.assetId));
    const selected = inventory[0] ?? null;
    return {
      ...state,
      inventory,
      pendingSyncAssetIds: state.pendingSyncAssetIds.filter((id) => id !== input.assetId),
      selectedAssetId: state.selectedAssetId === input.assetId ? selected?.id ?? "" : state.selectedAssetId,
      selectedCardId: state.selectedAssetId === input.assetId ? selected?.manifest.familyId ?? "" : state.selectedCardId,
      supportAssetIds: state.supportAssetIds.map((id) => id === input.assetId ? null : id) as [string | null, string | null],
      hearttreeSquadAssetIds: state.hearttreeSquadAssetIds.filter((id) => id !== input.assetId),
      lastEvent: "A claimed bearer transfer moved that card out of this Vault. Its permanent proof history remains preserved."
    };
  }

  if (input.type === "fuse-cards") {
    const parentA = state.inventory.find((asset) => asset.id === input.parentAId);
    const parentB = state.inventory.find((asset) => asset.id === input.parentBId);
    if (!parentA || !parentB || !isPlayableAsset(state, parentA.id) || !isPlayableAsset(state, parentB.id)) return state;
    const kai = input.kaiUPulse === undefined
      ? deriveKaiKlokMoment({ occurredAt: input.fusedAt, authority: "local" })
      : deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: "local" });
    const transactionInput = {
      parentA,
      parentB,
      inheritance: input.inheritance,
      sparkId: `spark:${input.fusedAt}`,
      kaiPulse: String(kai.uPulse),
      createdAt: input.fusedAt,
      fusionSparks: state.fusionSparks,
      recovery: state.fusionCooldowns
    };
    const eligibility = lineageEligibility(transactionInput);
    if (!eligibility.ok) return { ...state, lastEvent: eligibility.availableAt ? `A parent is resting until ${eligibility.availableAt}.` : "Earn a Fusion Spark and choose two eligible parents." };
    let transaction;
    try {
      transaction = createLivingChildTransaction(transactionInput);
    } catch {
      return { ...state, lastEvent: "The living lineage seal failed. Both parents and the Spark remain unchanged." };
    }
    if (state.inventory.some((asset) => asset.id === transaction.child.id)) return state;
    const replacements = new Map([[transaction.parentA.id, transaction.parentA], [transaction.parentB.id, transaction.parentB]]);
    return awardWorldMastery({
      ...state,
      achievements: Array.from(new Set([...state.achievements, "first_fusion_child"])),
      discoveredCardIds: Array.from(new Set([...state.discoveredCardIds, transaction.child.manifest.familyId])),
      fusionSparks: state.fusionSparks - transaction.sparkConsumed,
      fusionCooldowns: { ...state.fusionCooldowns, [parentA.id]: transaction.recoveryUntil, [parentB.id]: transaction.recoveryUntil },
      inventory: admitLocallySealedWildsInventory([...state.inventory.map((asset) => replacements.get(asset.id) ?? asset), transaction.child]),
      livingProgress: {
        ...state.livingProgress,
        [transaction.parentA.id]: currentRevision(transaction.parentA).growth,
        [transaction.parentB.id]: currentRevision(transaction.parentB).growth,
        [transaction.child.id]: currentRevision(transaction.child).growth
      },
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, transaction.parentA.id, transaction.parentB.id, transaction.child.id])),
      selectedAssetId: transaction.child.id,
      selectedCardId: transaction.child.manifest.familyId,
      lineageReveal: { childId: transaction.child.id, parentIds: [parentA.id, parentB.id], eventId: transaction.eventId },
      lastEvent: `${parentA.manifest.name} and ${parentB.manifest.name} created ${transaction.child.manifest.name}. Both parents remain usable.`
    }, "lineage");
  }

  if (input.type === "dismiss-reveal") {
    if (state.encounter.phase === "idle") return state;
    return { ...state, battle: null, encounter: idleEncounterState };
  }

  if (input.type === "start-battle") {
    if (state.encounter.phase !== "battle_intro" || !state.encounter.formId || !state.encounter.hotspotId) return state;
    const wild = creatureForm(state.encounter.formId);
    const playerAsset = selectedAsset(state);
    if (!wild || !playerAsset || !isPlayableAsset(state, playerAsset.id)) return { ...state, encounter: { ...state.encounter, phase: "defeated" }, lastEvent: "No verified playable card was available for battle." };
    const wildName = state.encounter.discoveryIdentity?.name.display ?? wild.name;
    const persistentLife = isLivingCardAsset(playerAsset) ? currentRevision(playerAsset).growth.life : null;
    const battle = startWildBattle({
      encounterSeed: state.encounter.hotspotId,
      player: {
        assetId: playerAsset.id,
        name: playerAsset.manifest.name,
        element: creatureForm(playerAsset.manifest.formId)?.element,
        ...playerAsset.manifest.stats,
        health: persistentLife?.maxVitality ?? playerAsset.manifest.stats.health * 2,
        currentHealth: persistentLife?.vitality
      },
      wild: { formId: wild.id, name: wildName, element: wild.element, ...wild.stats }
    });
    return { ...state, battle, encounter: { ...state.encounter, phase: "player_turn" }, lastEvent: `${wildName} emerged. Weaken it below 30% before capture.` };
  }

  if (input.type === "battle-action") {
    if (!state.battle || (state.encounter.phase !== "player_turn" && state.encounter.phase !== "capture_ready")) return state;
    let action: BattleAction = input.action;
    if (action.type === "switch") {
      const switchAction = action;
      const switching = state.inventory.find((asset) => asset.id === switchAction.player.assetId);
      if (!switching || !isPlayableAsset(state, switching.id)) return state;
      const life = switching && isLivingCardAsset(switching) ? currentRevision(switching).growth.life : null;
      if (life) action = { ...switchAction, player: { ...switchAction.player, health: life.maxVitality, currentHealth: life.vitality } };
    }
    const battle = applyBattleAction(state.battle, action);
    if (battle === state.battle) return state;
    const phase: EncounterState["phase"] = battle.phase === "captured" ? "capsule" : battle.phase === "capture_ready" ? "capture_ready" : battle.phase === "fled" ? "fled" : battle.phase === "defeated" ? "defeated" : "player_turn";
    const last = battle.transcript.at(-1)?.detail ?? "Battle turn resolved.";
    let resolved: PlayState = { ...state, battle, encounter: { ...state.encounter, phase }, lastEvent: battle.phase === "captured" ? "Capture locked. Sealing the portable card now." : last };
    if (battle.phase === "captured" || battle.phase === "fled" || battle.phase === "defeated") {
      const combatAsset = state.inventory.find((candidate) => candidate.id === battle.player.id);
      if (combatAsset) {
        const settledCard = settleWildBattleCard(combatAsset, battle, input.at ?? state.encounter.searchedAt);
        resolved = {
          ...resolved,
          inventory: admitLocallySealedWildsInventory(state.inventory.map((asset) => asset.id === settledCard.id ? settledCard : asset)),
          ...(isLivingCardAsset(settledCard) ? {
            livingProgress: { ...resolved.livingProgress, [settledCard.id]: currentRevision(settledCard).growth },
            pendingSyncAssetIds: Array.from(new Set([...resolved.pendingSyncAssetIds, settledCard.id]))
          } : {})
        };
        if (!isPlayableAsset(resolved, settledCard.id)) {
          const fallback = playableInventory(resolved)[0];
          resolved = { ...resolved, selectedAssetId: fallback?.id ?? "", selectedCardId: fallback?.manifest.familyId ?? "" };
        }
      }
    }
    if (battle.phase === "captured") return resolved;
    const asset = state.inventory.find((candidate) => candidate.id === battle.player.id);
    if (!asset) return resolved;
    const wild = state.encounter.formId ? creatureForm(state.encounter.formId) : null;
    const occurredAt = state.encounter.searchedAt;
    const awards = battleGrowthAwards(state.battle, battle, { boss: wild?.rarity === "mythic" || wild?.rarity === "eternal" });
    const progressed = applyRecordedGrowthEvents(resolved, asset, awards.map((award) => ({
      ...award,
      path: "battle" as const,
      occurredAt,
      kaiUPulse: input.kaiUPulse
    })));
    return awards.some((award) => award.kind === "battle_win")
      ? awardWorldMastery({ ...progressed, lastEvent: last }, "battle")
      : { ...progressed, lastEvent: last };
  }

  if (input.type === "search-point") {
    if (!Number.isFinite(input.x) || !Number.isFinite(input.z) || !Number.isFinite(Date.parse(input.searchedAt)) || !input.ownerReceizId.trim()) return state;
    const point = {
      x: clamp(input.x, worldBounds.min, worldBounds.max),
      z: clamp(input.z, worldBounds.min, worldBounds.max),
      ...(Number.isFinite(input.surfaceWorldY) ? { surfaceWorldY: input.surfaceWorldY! } : {})
    };
    if (distance2d(point, state.player) > 8) return { ...state, lastEvent: "That signal is beyond reach. Move closer before scanning." };
    const ownerScope = input.ownerReceizId.trim();
    const moment = input.kaiUPulse === undefined
      ? deriveKaiKlokMoment({ occurredAt: input.searchedAt, authority: "world" })
      : deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: "world" });
    const leader = selectedAsset(state);
    const admittedCapabilities = leader
      ? projectWildsTraversalCapabilities(leader, state.adventureConditions[leader.id] ?? emptyAdventureCondition(leader.id)).capabilities
      : [];
    const suppliedCapabilities = input.traversalCapabilities ?? admittedCapabilities;
    const searchCapabilities = suppliedCapabilities.filter((capability) => admittedCapabilities.includes(capability));
    const verticalWorldY = Number.isFinite(input.verticalWorldY)
      ? input.verticalWorldY!
      : wildsTerrainElevation(state.player.x, state.player.z);
    const verticalMinWorldY = Number.isFinite(input.verticalMinWorldY) ? input.verticalMinWorldY! : verticalWorldY - .65;
    const verticalMaxWorldY = Number.isFinite(input.verticalMaxWorldY) ? input.verticalMaxWorldY! : verticalWorldY + .65;
    const verticalLayer = input.verticalLayer === "air" || input.verticalLayer === "water" ? input.verticalLayer : "ground";
    const spatialResult = searchHiddenHotspots(nearbyHiddenHotspots(point), point, state.capturedHotspotIds, {
      layer: verticalLayer,
      worldY: verticalWorldY,
      interactionBand: {
        minY: Math.min(verticalMinWorldY, verticalMaxWorldY),
        maxY: Math.max(verticalMinWorldY, verticalMaxWorldY)
      },
      capabilities: searchCapabilities
    });
    const result = spatialResult.kind === "hit"
      ? { ...spatialResult, hotspot: applyKaiAffinityToHotspot(spatialResult.hotspot, moment, ownerScope) }
      : spatialResult;
    let discoveryIdentity: LivingCreatureIdentityV3 | undefined;
    if (result.kind === "hit") {
      const previousIdentity = state.encounter.phase !== "idle" && state.encounter.hotspotId === result.hotspot.id
        ? state.encounter.discoveryIdentity
        : undefined;
      if (previousIdentity) {
        discoveryIdentity = previousIdentity;
      } else {
        const form = creatureForm(result.hotspot.formId);
        if (!form) return { ...state, lastEvent: "The living signal could not stabilize into a known form." };
        try {
          discoveryIdentity = discoverLivingCreature({
            encounterId: result.hotspot.id,
            form,
            discoveredAt: input.searchedAt,
            location: result.hotspot.position,
            ownerScope,
            moment
          }, new Set(state.inventory.map((asset) => asset.manifest.name.toLowerCase())));
        } catch {
          return { ...state, lastEvent: "The living signal could not stabilize into a permanent identity." };
        }
      }
    }
    const baseEncounter = encounterFromSearch(result, point, input.searchedAt, ownerScope, state.encounter, discoveryIdentity);
    const canonicalSiteContext = canonicalEncounterSiteContext(input.siteKey, input.siteSpaceId, baseEncounter.placement);
    const encounter = canonicalSiteContext
      ? { ...baseEncounter, siteContext: canonicalSiteContext }
      : baseEncounter;
    const lastEvent = result.kind === "hit"
      ? `${discoveryIdentity?.name.display ?? "A living signal"} revealed itself beneath the ${result.hotspot.cover}. This is its permanent name.`
      : result.kind === "near_miss"
        ? `Signal ${encounter.proximity}${encounter.trend ? ` · ${encounter.trend}` : ""}. Follow the search clue.`
        : result.kind === "captured"
          ? "This hotspot is quiet now. Its sealed card is already in your inventory."
          : "Signal cold. Try another point and keep moving.";
    const searched = { ...state, activeAction: "explore" as const, encounter, lastEvent, lastSearchPoint: point };
    if (result.kind !== "hit" || !leader) return searched;
    const progressed = applyRecordedGrowth(searched, leader, {
      eventId: `habitat_discovery:${result.hotspot.id}`,
      kind: "habitat_discovery",
      path: "exploration",
      amount: 6,
      occurredAt: input.searchedAt,
      kaiUPulse: input.kaiUPulse
    });
    return { ...progressed, lastEvent };
  }

  if (input.type === "advance-encounter") {
    if (!Number.isFinite(Date.parse(input.at)) || !isCapturableEncounter(state.encounter)) return state;
    const encounter = state.encounter;
    if (encounter.phase === "emerging") return { ...state, encounter: { ...encounter, phase: "capsule" }, lastEvent: "Capsule locked. Sealing the portable card now." };
    if (encounter.phase === "sealed") return { ...state, encounter: { ...encounter, phase: "revealed" }, lastEvent: "Capture complete. Your verified portable card is ready." };
    if (encounter.phase !== "capsule") return state;

    const existing = state.inventory.find((asset) => asset.manifest.encounterId === encounter.hotspotId);
    if (existing) {
      return {
        ...state,
        capturedHotspotIds: Array.from(new Set([...state.capturedHotspotIds, encounter.hotspotId])),
        encounter: { ...encounter, phase: "sealed", assetId: existing.id },
        lastEvent: `${existing.manifest.name} is already sealed in your inventory.`
      };
    }
    let sealed: PortableCardAsset;
    const restoredIdentity = encounter.discoveryIdentity;
    const restoredForm = restoredIdentity ? discoveredFormForIdentity(restoredIdentity) : undefined;
    const discoveryIdentity = restoredIdentity && restoredForm
      ? restoredIdentity
      : reconstructEncounterDiscoveryIdentity(
          {
            ...encounter,
            location: encounter.placement
              ? { x: encounter.placement.x, z: encounter.placement.z }
              : encounter.searchPoint
          },
          new Set(state.inventory.map((asset) => asset.manifest.name.toLowerCase()))
        );
    if (!discoveryIdentity) {
      return { ...state, lastEvent: "Capture remains locked while its permanent identity is recovered." };
    }
    const discoveredForm = restoredForm ?? discoveredFormForIdentity(discoveryIdentity);
    if (!discoveredForm) {
      return { ...state, lastEvent: `Capture remains locked. ${discoveryIdentity.name.display}'s discovered form is still being recovered.` };
    }
    const normalizedEncounter = {
      ...encounter,
      ownerReceizId: discoveryIdentity.discovery.ownerScope,
      familyId: discoveryIdentity.family.id,
      formId: discoveredForm.id,
      discoveryIdentity
    };
    const capturedAt = new Date(Math.max(Date.parse(input.at), Date.parse(discoveryIdentity.discoveredAt))).toISOString();
    try {
      sealed = sealDiscoveredCard({
        identity: discoveryIdentity,
        formId: discoveredForm.id,
        ownerReceizId: discoveryIdentity.discovery.ownerScope,
        capturedAt,
        battleTranscriptDigest: state.battle ? battleTranscriptDigest(state.battle) : undefined
      });
    } catch {
      return {
        ...state,
        encounter: normalizedEncounter,
        lastEvent: `Capture remains locked. ${discoveryIdentity.name.display} is still here while verification completes.`
      };
    }
    if (!verifyPortableCard(sealed).ok) {
      return {
        ...state,
        encounter: normalizedEncounter,
        lastEvent: `Capture remains locked. ${discoveryIdentity.name.display} is still here while verification completes.`
      };
    }
    const nextDiscovered = Array.from(new Set([...state.discoveredCardIds, sealed.manifest.familyId]));
    return withWorldProgress(awardWorldMastery({
      ...state,
      beans: state.beans + 6,
      cardXp: state.cardXp + 12,
      capturedHotspotIds: [...state.capturedHotspotIds, encounter.hotspotId],
      combo: state.combo + 1,
      discoveredCardIds: nextDiscovered,
      encounter: { ...normalizedEncounter, phase: "sealed", assetId: sealed.id },
      inventory: admitLocallySealedWildsInventory([...state.inventory, sealed]),
      lastEvent: `${sealed.manifest.name} was captured and sealed as one portable card.`,
      level: nextDiscovered.length >= 3 ? Math.max(state.level, 8) : state.level,
      missionProgress: Math.min(100, state.missionProgress + 12),
      pendingSyncAssetIds: [...state.pendingSyncAssetIds, sealed.id],
      selectedAssetId: sealed.id,
      selectedCardId: sealed.manifest.familyId,
      streak: state.streak + 1
    }, "capture"));
  }

  if (input.type === "mark-synced" || input.type === "mark-listed") {
    if (!Number.isFinite(Date.parse(input.synchronizedAt))) return state;
    const target = state.inventory.find((asset) => asset.id === input.assetId);
    if (!target || !isPlayableAsset(state, target.id) || target.status === "suspended" || target.status === "revoked") return state;
    const nextStatus = input.type === "mark-listed" ? "listed" : "verified";
    return {
      ...state,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((asset) => asset.id === input.assetId
        ? { ...asset, status: nextStatus, synchronizedAt: input.synchronizedAt }
        : asset)),
      pendingSyncAssetIds: state.pendingSyncAssetIds.filter((id) => id !== input.assetId),
      lastEvent: input.type === "mark-listed"
        ? `${target.manifest.name} passed offline verification and is listed on the Exchange.`
        : `${target.manifest.name} synchronized and is Exchange eligible.`
    };
  }

  if (input.type === "evolve") {
    const previous = state.inventory.find((asset) => asset.id === input.assetId);
    if (!previous || !isPlayableAsset(state, previous.id) || previous.manifest.stage >= 3) return state;
    const next = creatureForm(`${previous.manifest.familyId}-${previous.manifest.stage + 1}`);
    const progress = state.companionProgress[previous.manifest.familyId] ?? { level: 1, xp: 0, bond: 0 };
    if (!next || progress.level < next.evolution.level || progress.bond < next.evolution.bond) {
      return { ...state, lastEvent: `${previous.manifest.name} needs more levels and bond before evolving.` };
    }
    const evolved = evolvePortableCard({ previous, nextFormId: next.id, evolvedAt: input.evolvedAt, growth: growthForAsset(state, previous) });
    return {
      ...state,
      inventory: admitLocallySealedWildsInventory(state.inventory.map((asset) => asset.id === evolved.id ? evolved : asset)),
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, evolved.id])),
      cardXp: state.cardXp + 25,
      lastEvent: `${previous.manifest.name} evolved into ${next.name}. Its living history was sealed in place.`
    };
  }

  if (input.type === "select-card") {
    if (!state.discoveredCardIds.includes(input.cardId)) return state;
    const asset = [...state.inventory].reverse().find((candidate) => candidate.manifest.familyId === input.cardId && isPlayableAsset(state, candidate.id));
    if (!asset) return state;
    const selectedAssetId = asset?.id ?? state.selectedAssetId;
    return {
      ...state,
      selectedAssetId,
      selectedCardId: input.cardId,
      companionProgress: { ...state.companionProgress, [asset.manifest.familyId]: exactCompanionProgress(state, asset) },
      supportAssetIds: normalizeWildsSupportAssetIds(state.supportAssetIds, state.inventory, selectedAssetId),
      lastEvent: `${cardName(input.cardId)} is now leading your deck.`
    };
  }

  if (input.type === "select-asset") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id)) return state;
    return {
      ...state,
      selectedAssetId: asset.id,
      selectedCardId: asset.manifest.familyId,
      companionProgress: { ...state.companionProgress, [asset.manifest.familyId]: exactCompanionProgress(state, asset) },
      supportAssetIds: normalizeWildsSupportAssetIds(state.supportAssetIds, state.inventory, asset.id),
      lastEvent: `${asset.manifest.name} is now leading your active deck.`
    };
  }

  if (input.type === "apply-rift-grant") {
    if (!validateRiftGrant(input.grant, { playerId: input.playerId }).ok) return state;
    const player = { ...input.grant.destination };
    return {
      ...state,
      activeAction: "explore",
      player,
      siteSpace: normalizeWildsSiteSpaceState(undefined, { x: player.x, y: wildsTerrainElevation(player.x, player.z), z: player.z }),
      explorationAtlas: revealWildsExplorationAt(state.explorationAtlas, player),
      lastEvent: "Rift complete. Walk the surrounding world to reach the landmark entrance."
    };
  }

  if (input.type === "site-portal") {
    const currentSpace = state.siteSpace ?? normalizeWildsSiteSpaceState(undefined, {
      x: state.player.x,
      y: wildsTerrainElevation(state.player.x, state.player.z),
      z: state.player.z
    });
    const nextSpace = input.direction === "enter"
      ? enterWildsSiteRuntime(input.siteRuntime, input.siteKey, {
        x: state.player.x,
        y: wildsTerrainElevation(state.player.x, state.player.z),
        z: state.player.z
      })
      : exitWildsSiteRuntime(input.siteRuntime, currentSpace, input.siteKey);
    if (!nextSpace) return state;
    return {
      ...state,
      activeAction: "explore",
      player: { x: nextSpace.position.x, z: nextSpace.position.z },
      siteSpace: nextSpace,
      explorationAtlas: discoverWildsExplorationSite(state.explorationAtlas, nextSpace.siteKey ?? currentSpace.siteKey ?? input.siteKey),
      lastEvent: input.direction === "enter" ? "Entered a persistent hidden world site." : "Returned to the living outer world."
    };
  }

  if (input.type === "move" || input.type === "move-vector") {
    const leader = selectedAsset(state);
    const traversalCapabilities = leader
      ? projectWildsTraversalCapabilities(
        leader,
        state.adventureConditions[leader.id] ?? emptyAdventureCondition(leader.id)
      ).capabilities
      : [];
    const admittedAirborne = input.aerialMode === "flight"
      ? traversalCapabilities.includes("flight")
      : input.aerialMode === "glide"
        ? traversalCapabilities.includes("glide")
        : false;
    const movementCapabilities = traversalCapabilities;
    const currentSpace = state.siteSpace ?? normalizeWildsSiteSpaceState(undefined, {
      x: state.player.x,
      y: wildsTerrainElevation(state.player.x, state.player.z),
      z: state.player.z
    });
    const movement = currentSpace.spaceId === "wildz.space.outer.v1"
      ? input.type === "move"
        ? movePlayer(state.player, input.direction, movementCapabilities, admittedAirborne ? input.aerialMode : undefined, input.verticalClearance, input.verticalWorldY, input.structureSupports, input.additionalObstacles)
        : movePlayerVector(state.player, input.x, input.z, movementScale(input.mode ?? "walk"), movementCapabilities, admittedAirborne ? input.aerialMode : undefined, input.verticalClearance, input.verticalWorldY, input.structureSupports, input.additionalObstacles)
      : movePlayerInsideSite(state.player, input);
    const siteMovement = input.siteRuntime ? writeWildsSiteRuntimeMovement(
      input.siteMovementOutput ?? { x: movement.position.x, z: movement.position.z, floorY: movement.elevation, ceilingY: Number.POSITIVE_INFINITY, surfaceId: null, flooded: false, blocked: false, blockedByClimb: false },
      input.siteRuntime,
      currentSpace.spaceId,
      state.player.x,
      currentSpace.spaceId === "wildz.space.outer.v1" ? wildsTerrainElevation(state.player.x, state.player.z) : currentSpace.position.y,
      state.player.z,
      movement.position.x,
      movement.position.z,
      .38,
      movement.elevation,
      movementCapabilities.includes("climb"),
      admittedAirborne ? input.verticalWorldY : undefined
    ) : null;
    const nextPlayer = siteMovement ? { x: siteMovement.x, z: siteMovement.z } : movement.position;
    const previousRegion = regionForPosition(state.player);
    const nextRegion = regionForPosition(nextPlayer);
    let explorationAtlas = previousRegion.x === nextRegion.x && previousRegion.z === nextRegion.z
      ? state.explorationAtlas
      : revealWildsExplorationAt(state.explorationAtlas, nextPlayer);
    if (input.siteRuntime) {
      const discovery = writeWildsSiteRuntimeDiscovery(input.siteDiscoveryOutput ?? { siteKey: null }, input.siteRuntime, currentSpace.spaceId, nextPlayer.x, siteMovement?.floorY ?? movement.elevation, nextPlayer.z);
      if (discovery.siteKey) explorationAtlas = discoverWildsExplorationSite(explorationAtlas, discovery.siteKey);
    }
    const nearest = nearestCreature({ player: nextPlayer });
    const nearbyText = movement.traversalBlockedBy === "swim"
      ? "Deep water ahead. Lead with an aquatic creature to swim."
      : movement.traversalBlockedBy === "climb" || siteMovement?.blockedByClimb
        ? "Mountain slope too steep. Lead with a creature built to climb higher."
        : (movement.traversalMode === "flight" || movement.traversalMode === "glide") && leader
          ? `${movement.traversalMode === "flight" ? "Flying" : "Gliding"} with ${leader.manifest.name}.`
          : movement.traversalMode === "swim" && leader
          ? `Swimming with ${leader.manifest.name}.`
          : movement.traversalMode === "climb" && leader
            ? `Climbing with ${leader.manifest.name}.`
            : nearest && nearest.distance <= 1.25
        ? `${nearest.card.name} is within discovery range.`
        : "Explore the wilds and look for companion signals.";

    const moved: PlayState = {
      ...state,
      activeAction: "explore",
      energy: Math.max(0, state.energy - 1),
      explorationAtlas,
      siteSpace: currentSpace.spaceId === "wildz.space.outer.v1" ? {
        version: "wildz.site-space-state.v1",
        spaceId: "wildz.space.outer.v1",
        siteKey: null,
        surfaceId: siteMovement?.surfaceId ?? null,
        position: { x: nextPlayer.x, y: siteMovement?.floorY ?? movement.elevation, z: nextPlayer.z },
        flooded: siteMovement?.flooded ?? false
      } : {
        ...currentSpace,
        surfaceId: siteMovement?.surfaceId ?? currentSpace.surfaceId,
        position: { x: nextPlayer.x, y: siteMovement?.floorY ?? currentSpace.position.y, z: nextPlayer.z },
        flooded: siteMovement?.flooded ?? currentSpace.flooded
      },
      lastEvent: nearbyText,
      player: nextPlayer
    };
    const crossedMilestone = Math.floor(state.player.x / 8) !== Math.floor(nextPlayer.x / 8) || Math.floor(state.player.z / 8) !== Math.floor(nextPlayer.z / 8);
    if (!crossedMilestone || !leader) return moved;
    const milestoneId = `${Math.floor(nextPlayer.x / 8)}:${Math.floor(nextPlayer.z / 8)}`;
    const event: GrowthEvent = {
      eventId: `active_travel:${leader.id}:${milestoneId}`,
      kind: "active_travel",
      path: "bond",
      amount: 1,
      occurredAt: input.kaiUPulse === undefined
        ? new Date(Date.UTC(2026, 6, 13, 12, Math.abs(Math.floor(nextPlayer.x / 8)) % 60, Math.abs(Math.floor(nextPlayer.z / 8)) % 60)).toISOString()
        : kaiUPulseToISOString(input.kaiUPulse),
      kaiUPulse: input.kaiUPulse
    };
    const alreadyRecorded = growthForAsset(state, leader).eventIds.includes(event.eventId)
      || state.pendingTravelGrowthEvents.some((pending) => pending.assetId === leader.id && pending.event.eventId === event.eventId);
    const queued = alreadyRecorded ? moved : {
      ...moved,
      pendingTravelGrowthEvents: [...state.pendingTravelGrowthEvents, { assetId: leader.id, event }].slice(-256)
    };
    return awardWorldMastery({ ...queued, lastEvent: nearbyText }, "travel");
  }

  if (input.type === "rest") {
    const leader = selectedAsset(state);
    const maxVitality = leader && isLivingCardAsset(leader) ? currentRevision(leader).growth.life?.maxVitality : null;
    const recovered = leader && input.at
      ? healWildBattleCard(leader, Math.max(1, Math.round((maxVitality ?? 20) * .25)), input.at)
      : leader;
    const exactRecovery = Boolean(recovered && recovered !== leader && isLivingCardAsset(recovered));
    return {
      ...state,
      inventory: recovered
        ? admitLocallySealedWildsInventory(state.inventory.map((asset) => asset.id === recovered.id ? recovered : asset))
        : state.inventory,
      livingProgress: exactRecovery && recovered && isLivingCardAsset(recovered)
        ? { ...state.livingProgress, [recovered.id]: currentRevision(recovered).growth }
        : state.livingProgress,
      pendingSyncAssetIds: exactRecovery && recovered
        ? Array.from(new Set([...state.pendingSyncAssetIds, recovered.id]))
        : state.pendingSyncAssetIds,
      activeAction: "explore",
      combo: 0,
      energy: Math.min(100, state.energy + 35),
      lastEvent: recovered !== leader ? "Camp restored 35 energy and recovered 25% companion vitality." : "Camp restored 35 energy. Your expedition combo reset."
    };
  }

  if (input.type === "discover" || input.type === "capture") {
    const nearest = nearestCreature(state);
    if (!nearest || nearest.distance > 1.25) {
      return {
        ...state,
        activeAction: "explore",
        lastEvent: "Move closer to a wild companion before discovering."
      };
    }

    if (state.discoveredCardIds.includes(nearest.card.id)) {
      return {
        ...state,
        activeAction: "explore",
        selectedAssetId: [...state.inventory].reverse().find((asset) => asset.manifest.familyId === nearest.card.id)?.id ?? state.selectedAssetId,
        selectedCardId: nearest.card.id,
        lastEvent: `${nearest.card.name} is already in your deck.`
      };
    }

    const encounterId = input.type === "capture" ? input.encounterId : `legacy-encounter-${nearest.card.id}`;
    const capturedAt = input.type === "capture" ? input.capturedAt : "2026-07-13T12:00:00.000Z";
    const ownerReceizId = input.type === "capture" ? input.ownerReceizId : "wilds.player.receiz.id";
    const existingEncounter = state.inventory.find((asset) => asset.manifest.encounterId === encounterId);
    if (existingEncounter) {
      return {
        ...state,
        selectedAssetId: existingEncounter.id,
        selectedCardId: existingEncounter.manifest.familyId,
        lastEvent: `${existingEncounter.manifest.name} is already sealed in your inventory.`
      };
    }
    let sealed: PortableCardAsset;
    try {
      const form = creatureForm(`${nearest.card.id}-1`);
      if (!form) throw new Error("wilds_capture_form_missing");
      const identity = discoverLivingCreature({
        encounterId,
        form,
        discoveredAt: capturedAt,
        location: { ...state.player },
        ownerScope: ownerReceizId,
        moment: input.kaiUPulse === undefined
          ? deriveKaiKlokMoment({ occurredAt: capturedAt, authority: "world" })
          : deriveKaiKlokMomentFromUPulse({ uPulse: input.kaiUPulse, authority: "world" })
      }, new Set(state.inventory.map((asset) => asset.manifest.name.toLowerCase())));
      sealed = sealDiscoveredCard({
        identity,
        formId: form.id,
        ownerReceizId,
        capturedAt
      });
    } catch {
      return { ...state, lastEvent: "The Receiz Capsule reopened because the local seal could not be verified. Try again." };
    }
    if (!verifyPortableCard(sealed).ok) {
      return { ...state, lastEvent: "The Receiz Capsule reopened because the local seal could not be verified. Try again." };
    }

    const nextDiscovered = [...state.discoveredCardIds, nearest.card.id];
    return withWorldProgress(awardWorldMastery({
      ...state,
      activeAction: "explore",
      beans: state.beans + 6,
      cardXp: state.cardXp + 12,
      discoveredCardIds: nextDiscovered,
      inventory: admitLocallySealedWildsInventory([...state.inventory, sealed]),
      lastEvent: `${nearest.card.name} card collected and sealed for offline use. ${nearest.card.businessLogic}.`,
      combo: state.combo + 1,
      level: nextDiscovered.length >= 3 ? Math.max(state.level, 8) : state.level,
      missionProgress: Math.min(100, state.missionProgress + 12),
      pendingSyncAssetIds: [...state.pendingSyncAssetIds, sealed.id],
      selectedAssetId: sealed.id,
      selectedCardId: nearest.card.id,
      streak: state.streak + 1
    }, "capture"));
  }

  if (input.type === "train") {
    const targetCardId = input.cardId ?? state.selectedCardId;
    if (!state.discoveredCardIds.includes(targetCardId)) return state;
    if (state.energy < 6) {
      return { ...state, lastEvent: "Not enough energy to train. Make camp before the next session." };
    }
    const selectedTarget = state.inventory.find((asset) => asset.id === state.selectedAssetId
      && asset.manifest.familyId === targetCardId
      && isPlayableAsset(state, asset.id));
    const targetAsset = selectedTarget
      ?? [...state.inventory].reverse().find((asset) => asset.manifest.familyId === targetCardId && isPlayableAsset(state, asset.id));
    if (!targetAsset) return state;
    const currentProgress = exactCompanionProgress(state, targetAsset);
    const trainedAt = input.at ?? new Date(Date.UTC(2026, 6, 13, 12, currentProgress.bond * 15)).toISOString();
    if (!Number.isFinite(Date.parse(trainedAt))) return state;
    const cooldownUntil = state.bondCooldowns[targetAsset.id];
    if (cooldownUntil && Date.parse(cooldownUntil) > Date.parse(trainedAt)) {
      return { ...state, lastEvent: `${targetAsset.manifest.name} is resting after your last bond moment.` };
    }
    const totalXp = currentProgress.xp + 40;
    const leveledUp = totalXp >= 100;
    const nextProgress = {
      level: Math.min(10, currentProgress.level + (leveledUp ? 1 : 0)),
      xp: leveledUp ? totalXp - 100 : totalXp,
      bond: Math.min(100, currentProgress.bond + 1)
    };

    const trained = withWorldProgress(awardWorldMastery({
      ...state,
      activeAction: "train",
      beans: state.beans + 4,
      cardXp: state.cardXp + 10,
      challenge: Math.min(100, state.challenge + 4),
      combo: state.combo + 1,
      companionProgress: { ...state.companionProgress, [targetCardId]: nextProgress },
      bondCooldowns: { ...state.bondCooldowns, [targetAsset.id]: new Date(Date.parse(trainedAt) + 10 * 60 * 1000).toISOString() },
      energy: Math.max(0, state.energy - 6),
      lastEvent: leveledUp
        ? `${targetAsset.manifest.name} reached Level ${nextProgress.level}. A new mastery tier is active.`
        : `${targetAsset.manifest.name} gained 40 XP and strengthened your bond.`,
      missionProgress: Math.min(100, state.missionProgress + 9),
      selectedAssetId: targetAsset.id,
      selectedCardId: targetCardId,
      streak: state.streak + 1
    }, "training"));
    const progressed = applyRecordedGrowth(trained, targetAsset, {
      eventId: `bond_moment:${targetAsset.id}:${trainedAt}`,
      kind: "bond_moment",
      path: "bond",
      amount: 1,
      occurredAt: trainedAt,
      kaiUPulse: input.kaiUPulse
    });
    return { ...progressed, lastEvent: trained.lastEvent };
  }

  if (state.energy < 10) {
    return { ...state, lastEvent: "Not enough energy for a mission. Make camp to recover." };
  }

  const progressGain = 16 + discoveredCards(state).length * 4 + Math.floor(selectedCard(state).power / 24);
  const nextProgress = Math.min(100, state.missionProgress + progressGain);
  const earnedAchievement = nextProgress >= 100 && !state.achievements.includes("first-light");

  return withWorldProgress(awardWorldMastery({
    ...state,
    activeAction: "mission",
    beans: state.beans + 10,
    cardXp: state.cardXp + 18,
    challenge: Math.min(100, state.challenge + 7),
    combo: state.combo + 1,
    completed: state.completed || earnedAchievement,
    energy: Math.max(0, state.energy - 10),
    lastEvent: earnedAchievement
      ? "Mission cleared. First Light is now part of your story."
      : `${selectedCard(state).name} played a mission power.`,
    level: earnedAchievement ? Math.max(state.level, 9) : state.level,
    missionProgress: nextProgress,
    rewardCards: state.rewardCards,
    achievements: earnedAchievement
      ? Array.from(new Set([...state.achievements, "first-light"]))
      : state.achievements,
    completedMissionIds: earnedAchievement
      ? Array.from(new Set([...state.completedMissionIds, "daily-expedition"]))
      : state.completedMissionIds,
    streak: state.streak + 1
  }, "mission"));
}

function withWorldProgress(state: PlayState): PlayState {
  const highestLevel = Math.max(1, ...Object.values(state.companionProgress).map((progress) => progress.level));
  const bossUnlocked = state.discoveredCardIds.length >= 3 && highestLevel >= 3;
  const worldRank: PlayState["worldRank"] = bossUnlocked
    ? "Titan challenger"
    : state.discoveredCardIds.length >= 3
      ? "Wilds ranger"
      : state.discoveredCardIds.length >= 2
        ? "Trail keeper"
        : "Grove scout";
  return { ...state, bossUnlocked, worldRank };
}

function movePlayer(
  player: PlayState["player"],
  direction: MoveDirection,
  capabilities: readonly WildsTraversalCapability[],
  aerialMode?: "glide" | "flight",
  verticalClearance?: number,
  verticalWorldY?: number,
  structureSupports?: readonly WildsStructureSupport[],
  additionalObstacles?: readonly WildsTerrainObstacle[]
) {
  const next = { ...player };

  if (direction === "north") next.z -= worldBounds.step;
  if (direction === "south") next.z += worldBounds.step;
  if (direction === "west") next.x -= worldBounds.step;
  if (direction === "east") next.x += worldBounds.step;

  const intended = {
    x: clamp(next.x, worldBounds.min, worldBounds.max),
    z: clamp(next.z, worldBounds.min, worldBounds.max)
  };
  return resolveWildsGroundMovement(player, intended, { capabilities, aerialMode, verticalClearance, verticalWorldY, structureSupports, additionalObstacles });
}

function movePlayerVector(
  player: PlayState["player"],
  x: number,
  z: number,
  movementMultiplier: number,
  capabilities: readonly WildsTraversalCapability[],
  aerialMode?: "glide" | "flight",
  verticalClearance?: number,
  verticalWorldY?: number,
  structureSupports?: readonly WildsStructureSupport[],
  additionalObstacles?: readonly WildsTerrainObstacle[]
) {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z) ? z : 0;
  const magnitude = Math.hypot(safeX, safeZ);
  if (magnitude < 0.08) return resolveWildsGroundMovement(player, player, { capabilities, aerialMode, obstacles: [], verticalClearance, verticalWorldY, structureSupports });
  const scale = worldBounds.analogStep * movementMultiplier / Math.max(1, magnitude);
  const intended = {
    x: clamp(player.x + safeX * scale, worldBounds.min, worldBounds.max),
    z: clamp(player.z + safeZ * scale, worldBounds.min, worldBounds.max)
  };
  return resolveWildsGroundMovement(player, intended, { capabilities, aerialMode, verticalClearance, verticalWorldY, structureSupports, additionalObstacles });
}

function movePlayerInsideSite(player: PlayState["player"], input: Extract<WildsInput, { type: "move" | "move-vector" }>) {
  let dx = 0, dz = 0;
  if (input.type === "move") {
    if (input.direction === "north") dz = -worldBounds.step;
    if (input.direction === "south") dz = worldBounds.step;
    if (input.direction === "west") dx = -worldBounds.step;
    if (input.direction === "east") dx = worldBounds.step;
  } else {
    const safeX = Number.isFinite(input.x) ? input.x : 0, safeZ = Number.isFinite(input.z) ? input.z : 0;
    const magnitude = Math.hypot(safeX, safeZ);
    if (magnitude >= .08) { const scale = worldBounds.analogStep * movementScale(input.mode ?? "walk") / Math.max(1, magnitude); dx = safeX * scale; dz = safeZ * scale; }
  }
  return {
    position: { x: clamp(player.x + dx, worldBounds.min, worldBounds.max), z: clamp(player.z + dz, worldBounds.min, worldBounds.max) },
    elevation: 0,
    surface: "land" as const,
    speedMultiplier: 1,
    traversalMode: input.aerialMode ?? "walk" as const,
    blockedBy: [] as readonly string[],
    traversalBlockedBy: null
  };
}

function distance2d(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function cardName(cardId: string) {
  return creatureCards.find((card) => card.id === cardId)?.name ?? "Companion";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
