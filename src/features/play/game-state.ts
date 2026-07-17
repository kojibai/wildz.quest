import { creatureFamilies, creatureForm, creatureForms, type CreatureRarity } from "./creature-catalog";
import {
  evolvePortableCard,
  sealCollectedCard,
  verifyAnyWildsCard,
  verifyPortableCard,
  type PortableCardAsset
} from "./portable-card";
import { encounterFromSearch, idleEncounterState, isCapturableEncounter, type EncounterState } from "./encounter-state";
import { nearbyHiddenHotspots, searchHiddenHotspots } from "./hidden-hotspots";
import { applyKaiAffinityToHotspot } from "./kai-encounter-affinity";
import { deriveKaiKlokMoment } from "./kai-klok-moment";
import { applyBattleAction, battleGrowthAwards, battleTranscriptDigest, startWildBattle, type BattleAction, type BattleState } from "./battle-engine";
import type { FusionInheritance } from "./card-fusion";
import { applyGrowthEvent, buildTransformationCandidate, growthReadiness, nextGrowthRequirements, type GrowthEvent } from "./growth-engine";
import { admitLegacyCard, appendLivingCardRevision, currentLivingGenome, currentRevision, emptyLivingGrowth } from "./living-card-proof";
import { deriveAscensionGenome } from "./heartbound-genome";
import { isLivingCardAsset, type GrowthPath, type LivingGrowthSnapshot } from "./living-card-types";
import { createLivingChildTransaction, lineageEligibility } from "./living-lineage";
import { worldMasteryAward, type WorldMasteryVerb } from "./world-progression";
import { validateRiftGrant, type RiftTravelGrant } from "./wilds-rift-travel";
import { movementScale, type WildsMovementMode } from "./wilds-movement";
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
import {
  EMPTY_WILDS_SUPPORT_ASSET_IDS,
  type WildsBossFamilyId,
  type WildsEcologyFamilyId,
  type WildsSupportAssetIds
} from "./wilds-v3-contracts";

export type { WildsSupportAssetIds } from "./wilds-v3-contracts";

export type GameAction = "explore" | "train" | "mission";
export type MoveDirection = "north" | "south" | "west" | "east";
export type WildsInput =
  | { type: "move"; direction: MoveDirection }
  | { type: "move-vector"; x: number; z: number; mode?: WildsMovementMode }
  | { type: "apply-rift-grant"; grant: RiftTravelGrant; playerId: string }
  | { type: "discover" }
  | { type: "capture"; encounterId: string; capturedAt: string; ownerReceizId: string }
  | { type: "search-point"; x: number; z: number; searchedAt: string; ownerReceizId: string }
  | { type: "advance-encounter"; at: string }
  | { type: "start-battle"; at: string }
  | { type: "battle-action"; action: BattleAction }
  | { type: "dismiss-reveal" }
  | { type: "mark-synced"; assetId: string; synchronizedAt: string }
  | { type: "mark-listed"; assetId: string; synchronizedAt: string }
  | { type: "import-card"; asset: PortableCardAsset }
  | { type: "fuse-cards"; parentAId: string; parentBId: string; inheritance: FusionInheritance; fusedAt: string }
  | { type: "evolve"; assetId: string; evolvedAt: string }
  | { type: "record-growth"; assetId: string; event: GrowthEvent }
  | { type: "record-civic-event"; event: WildsCivicEvent }
  | { type: "record-ecology-event"; event: WildsEcologyReceipt }
  | { type: "record-raid-event"; event: WildsRaidReceipt }
  | { type: "hearttree-admit"; receipt: HearttreeReceipt }
  | { type: "hearttree-select-squad"; assetIds: string[] }
  | { type: "ascend-card"; assetId: string; at: string }
  | { type: "finish-transformation" }
  | { type: "finish-lineage-reveal" }
  | { type: "train"; cardId?: string; at?: string }
  | { type: "mission" }
  | { type: "rest" }
  | { type: "select-card"; cardId: string }
  | { type: "select-asset"; assetId: string }
  | { type: "assign-support"; slot: 0 | 1; assetId: string | null }
  | { type: "reset" };

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

export type MissionCard = {
  id: string;
  title: string;
  reward: string;
  requirement: string;
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
  pendingSyncAssetIds: string[];
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

function encounterUnit(x: number, z: number, salt: number) {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
}

export function nearbyCreatureCards(player: Pick<PlayState, "player">["player"]): CreatureCard[] {
  const regionX = Math.floor(player.x / ENCOUNTER_REGION_SIZE);
  const regionZ = Math.floor(player.z / ENCOUNTER_REGION_SIZE);
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
  return cards.slice(0, MAX_NEARBY_CREATURES);
}

export const habitatNodes: HabitatNode[] = [
  { id: "grove", label: "Mint Grove", position: [-3.2, 0, -1.7], tone: "grove" },
  { id: "spark-den", label: "Spark Den", position: [1.3, 0, -2.4], tone: "spark" },
  { id: "trade-crossing", label: "Trade Crossing", position: [-0.7, 0, 1.8], tone: "trade" },
  { id: "reward-nest", label: "Reward Nest", position: [1.7, 0, 2.8], tone: "reward" },
  { id: "titan-gate", label: "Titan Gate", position: [3.4, 0, 1.5], tone: "gate" }
];

export const missionCards: MissionCard[] = [
  {
    id: "daily-expedition",
    title: "Daily Wild Expedition",
    reward: "Brandable reward card",
    requirement: "Discover one companion and play a mission."
  },
  {
    id: "bond-training",
    title: "Train 3 companion cards",
    reward: "+450 beans",
    requirement: "Use card powers to raise mission progress."
  },
  {
    id: "titan-challenge",
    title: "Clear the Titan Gate",
    reward: "Custom coupon slot",
    requirement: "Bring a trained card into the gate mission."
  }
];

const LEGACY_PLACEHOLDER_OWNER = "wilds.player.receiz.id";

function starterCardForOwner(ownerReceizId: string) {
  return sealCollectedCard({
  formId: "mintcub-1",
  ownerReceizId,
  encounterId: "starter-mintcub",
  capturedAt: "2026-06-29T12:00:00.000Z"
  });
}

const starterCardAsset = starterCardForOwner(LEGACY_PLACEHOLDER_OWNER);

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
  inventory: [{ ...starterCardAsset, status: "verified", synchronizedAt: "2026-06-29T12:00:00.000Z" }],
  lastEvent: "SealCub joined your deck. Walk near another wild companion.",
  level: 7,
  missionProgress: 38,
  lastSearchPoint: null,
  player: {
    x: -2.15,
    z: -0.85
  },
  pendingSyncAssetIds: [],
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

export function createOwnerBoundInitialPlayState(ownerReceizId: string): PlayState {
  const owner = ownerReceizId.trim();
  if (!owner) throw new Error("wilds_player_owner_required");
  const starter = starterCardForOwner(owner);
  return {
    ...structuredClone(initialPlayState),
    inventory: [{ ...starter, status: "verified", synchronizedAt: "2026-06-29T12:00:00.000Z" }],
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
    if (!existingRevision
      || candidateRevision.revision > existingRevision.revision
      || (candidateRevision.revision === existingRevision.revision && Date.parse(candidateRevision.sealedAt) > Date.parse(existingRevision.sealedAt))) {
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
  const admitted = new Set(inventory.filter((asset) => verifyAnyWildsCard(asset).ok).map((asset) => asset.id));
  const seen = new Set<string>();
  const normalized = [0, 1].map((slot) => {
    const value = input[slot];
    if (typeof value !== "string" || !value || value === leaderAssetId || !admitted.has(value) || seen.has(value)) return null;
    seen.add(value);
    return value;
  });
  return [normalized[0] ?? null, normalized[1] ?? null];
}

export function restorePlayState(value: string | null | undefined, ownerReceizId?: string): PlayState {
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
    const restoredInventory = Array.isArray(saved.inventory)
      ? saved.inventory.filter((asset): asset is PortableCardAsset => Boolean(asset) && verifyAnyWildsCard(asset as PortableCardAsset).ok)
      : [];
    const ownerScopedInventory = ownerReceizId
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
    const migratedInventory = admitAndMergeInventory(inventoryWithMigrations);
    const restoredHearttreeReceipts = Array.isArray(saved.hearttreeReceipts)
      ? saved.hearttreeReceipts.filter((receipt): receipt is HearttreeReceipt => Boolean(receipt) && verifyHearttreeReceipt(receipt as HearttreeReceipt).ok).slice(-512)
      : [];
    const adventureConditions: Record<string, AdventureCardCondition> = Object.fromEntries(migratedInventory.map((asset) => {
      const originalId = [...migratedAssetIds].find(([, migratedId]) => migratedId === asset.id)?.[0] ?? asset.id;
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
        if (condition && consequence.lifeAfter === "dead") adventureConditions[assetId] = { ...condition, life: "dead" };
      }
    }
    const hearttreeConditions = Object.fromEntries(Object.entries(adventureConditions).map(([assetId, condition]) => [assetId, adventureConditionToHearttree(condition)]));
    const civicProjection = projectWildsCivicHistory(Array.isArray(saved.civicEvents) ? saved.civicEvents.slice(-2_048) : []);
    const ecologyProjection = projectWildsEcologyHistory(Array.isArray(saved.ecologyEvents) ? saved.ecologyEvents.slice(-2_048) : []);
    const raidProjection = projectWildsRaidHistory(Array.isArray(saved.raidEvents) ? saved.raidEvents.slice(-4_096) : []);
    const restoredEncounter = restoreEncounter(saved.encounter);
    const requestedSelectedAssetId = typeof saved.selectedAssetId === "string"
      ? migratedAssetIds.get(saved.selectedAssetId) ?? saved.selectedAssetId
      : "";
    const livingInventory = migratedInventory.filter((asset) => adventureConditions[asset.id]?.life !== "dead");
    const restoredSelectedAssetId = requestedSelectedAssetId && livingInventory.some((asset) => asset.id === requestedSelectedAssetId)
      ? requestedSelectedAssetId
      : [...livingInventory].reverse().find((asset) => asset.manifest.familyId === saved.selectedCardId)?.id ?? livingInventory[0]?.id ?? "";
    const requestedHearttreeSquad = Array.isArray(saved.hearttreeSquadAssetIds) ? saved.hearttreeSquadAssetIds : [restoredSelectedAssetId];
    const hearttreeSquadAssetIds = [...new Set(requestedHearttreeSquad)]
      .filter((id): id is string => typeof id === "string" && livingInventory.some((asset) => asset.id === id))
      .slice(0, 3);
    return withWorldProgress({
      ...fallback,
      ...saved,
      player: {
        x: clamp(saved.player.x, worldBounds.min, worldBounds.max),
        z: clamp(saved.player.z, worldBounds.min, worldBounds.max)
      },
      discoveredCardIds,
      inventory: migratedInventory,
      selectedAssetId: restoredSelectedAssetId,
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

function restoreEncounter(value: unknown): EncounterState {
  if (!value || typeof value !== "object") return idleEncounterState;
  const candidate = value as Record<string, unknown>;
  if (candidate.phase === "idle") return idleEncounterState;
  const phases = new Set(["searching", "hint", "battle_intro", "player_turn", "capture_ready", "fled", "defeated", "emerging", "capsule", "sealed", "revealed"]);
  if (!phases.has(String(candidate.phase)) || typeof candidate.searchedAt !== "string" || typeof candidate.ownerReceizId !== "string") return idleEncounterState;
  const point = candidate.searchPoint as Record<string, unknown> | undefined;
  if (!point || typeof point.x !== "number" || typeof point.z !== "number") return idleEncounterState;
  const proximity = candidate.proximity === "warm" || candidate.proximity === "hot" ? candidate.proximity : "cold";
  const trend = candidate.trend === "closer" || candidate.trend === "farther" || candidate.trend === "steady" ? candidate.trend : null;
  return { ...candidate, proximity, trend } as EncounterState;
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
  if (!asset || !verifyAnyWildsCard(asset).ok || state.adventureConditions[assetId]?.life === "dead") return false;
  return !isLivingCardAsset(asset) || !currentRevision(asset).growth.life?.retired;
}

export function playableInventory(state: PlayState) {
  return state.inventory.filter((asset) => isPlayableAsset(state, asset.id));
}

export function discoveredCards(state: PlayState) {
  return creatureCards.filter((card) => state.discoveredCardIds.includes(card.id));
}

export function nearestCreature(state: Pick<PlayState, "player">) {
  return nearbyCreatureCards(state.player)
    .map((card) => ({
      card,
      distance: distance2d(state.player, { x: card.position[0], z: card.position[2] })
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

export function canDiscover(state: PlayState) {
  const nearest = nearestCreature(state);
  return Boolean(nearest && nearest.distance <= 1.25 && !state.discoveredCardIds.includes(nearest.card.id));
}

function growthForAsset(state: PlayState, asset: PortableCardAsset) {
  return state.livingProgress[asset.id]
    ?? (isLivingCardAsset(asset) ? currentRevision(asset).growth : emptyLivingGrowth(state.companionProgress[asset.manifest.familyId]?.bond ?? 0));
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
  return {
    ...state,
    livingProgress: { ...state.livingProgress, [asset.id]: progress },
    ascensionCatalysts: catalyst ? Array.from(new Set([...state.ascensionCatalysts, catalyst])) : state.ascensionCatalysts,
    lastEvent: event.achievementId ? `${asset.manifest.name} earned ${event.achievementId.replaceAll("_", " ")}.` : `${asset.manifest.name} grew through ${event.path}.`
  };
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
  if (input.type === "reset") {
    const owner = selectedAsset(state)?.manifest.ownerReceizId ?? state.inventory[0]?.manifest.ownerReceizId;
    return owner ? createOwnerBoundInitialPlayState(owner) : initialPlayState;
  }

  if (input.type === "hearttree-select-squad") {
    const assetIds = [...new Set(input.assetIds)];
    if (assetIds.length < 1 || assetIds.length > 3 || assetIds.some((assetId) => !isPlayableAsset(state, assetId))) return state;
    return { ...state, hearttreeSquadAssetIds: assetIds, lastEvent: `${assetIds.length} living card${assetIds.length === 1 ? "" : "s"} ready for the Hearttree.` };
  }

  if (input.type === "hearttree-admit") {
    if (!verifyHearttreeReceipt(input.receipt).ok || state.hearttreeReceipts.some((receipt) => receipt.digest === input.receipt.digest)) return state;
    const conditions = { ...state.adventureConditions };
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
          receiptDigests: [...new Set([...current.receiptDigests, input.receipt.digest])].slice(-512)
        };
      }
    } catch {
      return state;
    }
    const hearttreeConditions = Object.fromEntries(Object.entries(conditions).map(([assetId, condition]) => [assetId, adventureConditionToHearttree(condition)]));
    const provisional = { ...state, adventureConditions: conditions, hearttreeConditions };
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
    return asset && isPlayableAsset(state, asset.id) ? applyRecordedGrowth(state, asset, input.event) : state;
  }

  if (input.type === "ascend-card") {
    const asset = state.inventory.find((candidate) => candidate.id === input.assetId);
    if (!asset || !isPlayableAsset(state, asset.id) || !isLivingCardAsset(asset) || asset.manifest.stage !== 3) return state;
    const progress = growthForAsset(state, asset);
    const readiness = growthReadiness(asset, { progress, catalystIds: state.ascensionCatalysts }, input.at);
    if (!readiness.ready) return { ...state, lastEvent: `${asset.manifest.name} still needs ${readiness.missing.join(", ")}.` };
    const candidate = buildTransformationCandidate(asset, readiness, input.at);
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
      kaiPulse: String(Date.parse(input.at)),
      path: strongestGrowthPath(progress)
    });
    let ascended;
    try {
      ascended = appendLivingCardRevision({
        asset,
        revision: {
          sealedAt: input.at,
          kaiPulse: String(Date.parse(input.at)),
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
      inventory: state.inventory.map((item) => item.id === ascended.id ? ascended : item),
      livingProgress: { ...state.livingProgress, [ascended.id]: nextGrowth },
      ascensionCatalysts: state.ascensionCatalysts.filter((id) => id !== candidate.catalystId),
      pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, ascended.id])),
      transformation: { assetId: ascended.id, fromRevision: prior.revision, toRevision: currentRevision(ascended).revision, reason: currentRevision(ascended).reason.label },
      lastEvent: `${asset.manifest.name} reached Ascension ${candidate.ascensionRank}. Its living proof history grew in place.`
    }, "ascension");
  }

  if (input.type === "import-card") {
    const asset = input.asset;
    if (!verifyAnyWildsCard(asset).ok) return { ...state, lastEvent: "That PNG did not pass the offline card verifier." };
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
          inventory: state.inventory.map((candidate) => candidate.id === asset.id ? asset : candidate),
          livingProgress: { ...state.livingProgress, [asset.id]: progress },
          pendingSyncAssetIds: Array.from(new Set([...state.pendingSyncAssetIds, asset.id])),
          selectedAssetId: asset.id,
          selectedCardId: asset.manifest.familyId,
          lastEvent: `${asset.manifest.name}'s newer verified proof history merged into your living card.`
        });
      }
      return { ...state, selectedAssetId: asset.id, selectedCardId: asset.manifest.familyId, lastEvent: `${asset.manifest.name} is already in your inventory and now leads your active deck.` };
    }
    const discoveredCardIds = Array.from(new Set([...state.discoveredCardIds, asset.manifest.familyId]));
    return withWorldProgress({
      ...state,
      discoveredCardIds,
      inventory: [...state.inventory, asset],
      selectedAssetId: asset.id,
      selectedCardId: asset.manifest.familyId,
      lastEvent: `${asset.manifest.name} passed offline verification and joined your playable inventory.`
    });
  }

  if (input.type === "fuse-cards") {
    const parentA = state.inventory.find((asset) => asset.id === input.parentAId);
    const parentB = state.inventory.find((asset) => asset.id === input.parentBId);
    if (!parentA || !parentB || !isPlayableAsset(state, parentA.id) || !isPlayableAsset(state, parentB.id)) return state;
    const transactionInput = {
      parentA,
      parentB,
      inheritance: input.inheritance,
      sparkId: `spark:${input.fusedAt}`,
      kaiPulse: String(Date.parse(input.fusedAt)),
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
      inventory: [...state.inventory.map((asset) => replacements.get(asset.id) ?? asset), transaction.child],
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
    const battle = startWildBattle({
      encounterSeed: state.encounter.hotspotId,
      player: { assetId: playerAsset.id, name: playerAsset.manifest.name, element: creatureForm(playerAsset.manifest.formId)?.element, ...playerAsset.manifest.stats, health: playerAsset.manifest.stats.health * 2 },
      wild: { formId: wild.id, name: wild.name, element: wild.element, ...wild.stats }
    });
    return { ...state, battle, encounter: { ...state.encounter, phase: "player_turn" }, lastEvent: `${wild.name} emerged. Weaken it below 30% before capture.` };
  }

  if (input.type === "battle-action") {
    if (!state.battle || (state.encounter.phase !== "player_turn" && state.encounter.phase !== "capture_ready")) return state;
    const battle = applyBattleAction(state.battle, input.action);
    if (battle === state.battle) return state;
    if (battle.phase === "captured") {
      return { ...state, battle, encounter: { ...state.encounter, phase: "capsule" }, lastEvent: "Capture locked. Sealing the portable card now." };
    }
    const phase: EncounterState["phase"] = battle.phase === "capture_ready" ? "capture_ready" : battle.phase === "fled" ? "fled" : battle.phase === "defeated" ? "defeated" : "player_turn";
    const last = battle.transcript.at(-1)?.detail ?? "Battle turn resolved.";
    const resolved: PlayState = { ...state, battle, encounter: { ...state.encounter, phase }, lastEvent: last };
    const asset = state.inventory.find((candidate) => candidate.id === state.battle?.player.id);
    if (!asset) return resolved;
    const wild = state.encounter.formId ? creatureForm(state.encounter.formId) : null;
    const occurredAt = state.encounter.searchedAt;
    const awards = battleGrowthAwards(state.battle, battle, { boss: wild?.rarity === "mythic" || wild?.rarity === "eternal" });
    const progressed = applyRecordedGrowthEvents(resolved, asset, awards.map((award) => ({
      ...award,
      path: "battle" as const,
      occurredAt
    })));
    return awards.some((award) => award.kind === "battle_win")
      ? awardWorldMastery({ ...progressed, lastEvent: last }, "battle")
      : { ...progressed, lastEvent: last };
  }

  if (input.type === "search-point") {
    if (!Number.isFinite(input.x) || !Number.isFinite(input.z) || !Number.isFinite(Date.parse(input.searchedAt)) || !input.ownerReceizId.trim()) return state;
    const point = {
      x: clamp(input.x, worldBounds.min, worldBounds.max),
      z: clamp(input.z, worldBounds.min, worldBounds.max)
    };
    const spatialResult = searchHiddenHotspots(nearbyHiddenHotspots(point), point, state.capturedHotspotIds);
    const result = spatialResult.kind === "hit"
      ? { ...spatialResult, hotspot: applyKaiAffinityToHotspot(spatialResult.hotspot, deriveKaiKlokMoment({ occurredAt: input.searchedAt, authority: "world" }), input.ownerReceizId.trim()) }
      : spatialResult;
    const encounter = encounterFromSearch(result, point, input.searchedAt, input.ownerReceizId.trim(), state.encounter);
    const lastEvent = result.kind === "hit"
      ? `Something is moving beneath the ${result.hotspot.cover}. Keep watching.`
      : result.kind === "near_miss"
        ? `Signal ${encounter.proximity}${encounter.trend ? ` · ${encounter.trend}` : ""}. Follow the search clue.`
        : result.kind === "captured"
          ? "This hotspot is quiet now. Its sealed card is already in your inventory."
          : "Signal cold. Try another point and keep moving.";
    const searched = { ...state, activeAction: "explore" as const, encounter, lastEvent, lastSearchPoint: point };
    const leader = selectedAsset(state);
    if (result.kind !== "hit" || !leader) return searched;
    const progressed = applyRecordedGrowth(searched, leader, {
      eventId: `habitat_discovery:${result.hotspot.id}`,
      kind: "habitat_discovery",
      path: "exploration",
      amount: 6,
      occurredAt: input.searchedAt
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
    try {
      sealed = sealCollectedCard({
        formId: encounter.formId,
        ownerReceizId: encounter.ownerReceizId,
        encounterId: encounter.hotspotId,
        capturedAt: input.at,
        generatorVersion: 2,
        battleTranscriptDigest: state.battle ? battleTranscriptDigest(state.battle) : undefined
      });
    } catch {
      return { ...state, encounter: { ...encounter, phase: "emerging" }, lastEvent: "The capsule reopened because its offline seal could not be verified." };
    }
    if (!verifyPortableCard(sealed).ok) return { ...state, encounter: { ...encounter, phase: "emerging" }, lastEvent: "The capsule reopened because its offline seal could not be verified." };
    const nextDiscovered = Array.from(new Set([...state.discoveredCardIds, sealed.manifest.familyId]));
    return withWorldProgress(awardWorldMastery({
      ...state,
      beans: state.beans + 6,
      cardXp: state.cardXp + 12,
      capturedHotspotIds: [...state.capturedHotspotIds, encounter.hotspotId],
      combo: state.combo + 1,
      discoveredCardIds: nextDiscovered,
      encounter: { ...encounter, phase: "sealed", assetId: sealed.id },
      inventory: [...state.inventory, sealed],
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
      inventory: state.inventory.map((asset) => asset.id === input.assetId
        ? { ...asset, status: nextStatus, synchronizedAt: input.synchronizedAt }
        : asset),
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
      inventory: state.inventory.map((asset) => asset.id === evolved.id ? evolved : asset),
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
      supportAssetIds: normalizeWildsSupportAssetIds(state.supportAssetIds, state.inventory, asset.id),
      lastEvent: `${asset.manifest.name} is now leading your active deck.`
    };
  }

  if (input.type === "apply-rift-grant") {
    if (!validateRiftGrant(input.grant, { playerId: input.playerId }).ok) return state;
    return {
      ...state,
      activeAction: "explore",
      player: { ...input.grant.destination },
      lastEvent: "Rift complete. Walk the surrounding world to reach the landmark entrance."
    };
  }

  if (input.type === "move" || input.type === "move-vector") {
    const nextPlayer = input.type === "move"
      ? movePlayer(state.player, input.direction)
      : movePlayerVector(state.player, input.x, input.z, movementScale(input.mode ?? "walk"));
    const nearest = nearestCreature({ player: nextPlayer });
    const nearbyText =
      nearest.distance <= 1.25
        ? `${nearest.card.name} is within discovery range.`
        : "Explore the wilds and look for companion signals.";

    const moved: PlayState = {
      ...state,
      activeAction: "explore",
      energy: Math.max(0, state.energy - 1),
      lastEvent: nearbyText,
      player: nextPlayer
    };
    const crossedMilestone = Math.floor(state.player.x / 8) !== Math.floor(nextPlayer.x / 8) || Math.floor(state.player.z / 8) !== Math.floor(nextPlayer.z / 8);
    const leader = selectedAsset(state);
    if (!crossedMilestone || !leader) return moved;
    const milestoneId = `${Math.floor(nextPlayer.x / 8)}:${Math.floor(nextPlayer.z / 8)}`;
    const progressed = applyRecordedGrowth(moved, leader, {
      eventId: `active_travel:${leader.id}:${milestoneId}`,
      kind: "active_travel",
      path: "bond",
      amount: 1,
      occurredAt: new Date(Date.UTC(2026, 6, 13, 12, Math.abs(Math.floor(nextPlayer.x / 8)) % 60, Math.abs(Math.floor(nextPlayer.z / 8)) % 60)).toISOString()
    });
    return awardWorldMastery({ ...progressed, lastEvent: nearbyText }, "travel");
  }

  if (input.type === "rest") {
    return {
      ...state,
      activeAction: "explore",
      combo: 0,
      energy: Math.min(100, state.energy + 35),
      lastEvent: "Camp restored 35 energy. Your expedition combo reset."
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
      sealed = sealCollectedCard({
        formId: `${nearest.card.id}-1`,
        ownerReceizId,
        encounterId,
        capturedAt,
        ...(input.type === "capture" ? { generatorVersion: 2 as const } : {})
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
      inventory: [...state.inventory, sealed],
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
    const currentProgress = state.companionProgress[targetCardId] ?? { level: 1, xp: 0, bond: 0 };
    const trainedAt = input.at ?? new Date(Date.UTC(2026, 6, 13, 12, currentProgress.bond * 15)).toISOString();
    if (!Number.isFinite(Date.parse(trainedAt))) return state;
    const targetAsset = [...state.inventory].reverse().find((asset) => asset.manifest.familyId === targetCardId && isPlayableAsset(state, asset.id));
    if (!targetAsset) return state;
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
        ? `${cardName(targetCardId)} reached Level ${nextProgress.level}. A new mastery tier is active.`
        : `${cardName(targetCardId)} gained 40 XP and strengthened your bond.`,
      missionProgress: Math.min(100, state.missionProgress + 9),
      selectedAssetId: [...state.inventory].reverse().find((asset) => asset.manifest.familyId === targetCardId)?.id ?? state.selectedAssetId,
      selectedCardId: targetCardId,
      streak: state.streak + 1
    }, "training"));
    const progressed = applyRecordedGrowth(trained, targetAsset, {
      eventId: `bond_moment:${targetAsset.id}:${trainedAt}`,
      kind: "bond_moment",
      path: "bond",
      amount: 1,
      occurredAt: trainedAt
    });
    return { ...progressed, lastEvent: trained.lastEvent };
  }

  if (state.energy < 10) {
    return { ...state, lastEvent: "Not enough energy for a mission. Make camp to recover." };
  }

  const progressGain = 16 + discoveredCards(state).length * 4 + Math.floor(selectedCard(state).power / 24);
  const nextProgress = Math.min(100, state.missionProgress + progressGain);
  const earnedReward = nextProgress >= 100 && !state.rewardCards.some((reward) => reward.id === "merchant-perk");

  return withWorldProgress(awardWorldMastery({
    ...state,
    activeAction: "mission",
    beans: state.beans + 10,
    cardXp: state.cardXp + 18,
    challenge: Math.min(100, state.challenge + 7),
    combo: state.combo + 1,
    completed: state.completed || earnedReward,
    energy: Math.max(0, state.energy - 10),
    lastEvent: earnedReward
      ? "Mission cleared. A brandable merchant reward card is now portable."
      : `${selectedCard(state).name} played a mission power.`,
    level: earnedReward ? Math.max(state.level, 9) : state.level,
    missionProgress: nextProgress,
    rewardCards: earnedReward
      ? [
          ...state.rewardCards,
          {
            id: "merchant-perk",
            title: "Boost Coffee Wild Perk",
            businessUse: "Merchant can map this to a coupon, VIP access, free item, or custom proof reward.",
            value: "Customizable"
          }
        ]
      : state.rewardCards,
    completedMissionIds: earnedReward
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

function movePlayer(player: PlayState["player"], direction: MoveDirection) {
  const next = { ...player };

  if (direction === "north") next.z -= worldBounds.step;
  if (direction === "south") next.z += worldBounds.step;
  if (direction === "west") next.x -= worldBounds.step;
  if (direction === "east") next.x += worldBounds.step;

  return {
    x: clamp(next.x, worldBounds.min, worldBounds.max),
    z: clamp(next.z, worldBounds.min, worldBounds.max)
  };
}

function movePlayerVector(player: PlayState["player"], x: number, z: number, movementMultiplier: number) {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeZ = Number.isFinite(z) ? z : 0;
  const magnitude = Math.hypot(safeX, safeZ);
  if (magnitude < 0.08) return player;
  const scale = worldBounds.analogStep * movementMultiplier / Math.max(1, magnitude);
  return {
    x: clamp(player.x + safeX * scale, worldBounds.min, worldBounds.max),
    z: clamp(player.z + safeZ * scale, worldBounds.min, worldBounds.max)
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
