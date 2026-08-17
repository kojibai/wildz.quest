import type { AdventureCardCondition, AdventureConditionDelta } from "./adventure/card-condition";
import type { CreatureStage } from "./creature-catalog";
import type { GrowthEvent } from "./growth-engine";
import type { LivingGrowthSnapshot } from "./living-card-types";

export const CREATURE_HISTORY_NAMESPACE = "receiz.wildz.creature-history" as const;

export type CreatureHistoryAuthority = "local" | "admitted" | "verified-receipt" | "canonical" | "legacy-migration";
export type CreatureHistoryAdmittedAuthority = Extract<CreatureHistoryAuthority, "admitted" | "verified-receipt" | "canonical">;
export type CreatureHistorySourceMode =
  | "birth"
  | "training"
  | "world"
  | "wild-battle"
  | "arena"
  | "hearttree"
  | "market"
  | "lineage"
  | "transformation"
  | "living-revision"
  | "conversation"
  | "continuity"
  | "recovery"
  | "migration";

export type CreatureObserverMemoryTurn = Readonly<{
  schema: "receiz.wildz.creature_observer_turn.v1";
  assetId: string;
  turnId: string;
  observedAt: string;
  observer: "receiz-twin" | "receiz-twin-local";
  ownerActorId: string;
  userText: string;
  creatureText: string;
  contextDigest: string;
  previousTurnDigest: string | null;
  digest: string;
}>;

export type CreatureObserverMemoryProjection = Readonly<{
  schema: "receiz.wildz.creature_observer_memory.v1";
  turns: readonly CreatureObserverMemoryTurn[];
  headDigest: string | null;
}>;

export type CreatureAutonomyAction = "explore" | "meet" | "bond" | "discover" | "barter-keepsake";
export type CreatureCareAction = "feed" | "comfort" | "treat";

export type CreatureAutonomyMandate = Readonly<{
  schema: "receiz.wildz.creature_autonomy_mandate.v1";
  mandateId: string;
  assetId: string;
  ownerReceizId: string;
  status: "active" | "paused";
  allowedActions: readonly CreatureAutonomyAction[];
  maxActionsPerDay: number;
  maxAwayHours: number;
  issuedAt: string;
  changedAt: string;
  previousMandateDigest: string | null;
  digest: string;
}>;

export type CreatureContinuityEventKind = CreatureAutonomyAction | CreatureCareAction | "neglect" | "mandate-activated" | "mandate-paused";

export type CreatureContinuityEvent = Readonly<{
  schema: "receiz.wildz.creature_continuity_event.v1";
  eventId: string;
  commandId: string;
  attemptId: string;
  transactionId: string | null;
  assetId: string;
  ownerReceizId: string;
  mandateDigest: string;
  previousEventDigest: string | null;
  kind: CreatureContinuityEventKind;
  occurredAt: string;
  locationId: string;
  counterpartyId: string | null;
  counterpartyName: string | null;
  summary: string;
  relationshipDelta: number;
  keepsakeGiven: string | null;
  keepsakeReceived: string | null;
  discoveryId: string | null;
  digest: string;
}>;

export type CreatureContinuityRelationship = Readonly<{
  subjectId: string;
  name: string;
  affinity: number;
  meetings: number;
  lastMetAt: string;
}>;

export type CreatureContinuityProjection = Readonly<{
  schema: "receiz.wildz.creature_continuity.v1";
  mandate: CreatureAutonomyMandate | null;
  headDigest: string | null;
  lastSettledAt: string | null;
  events: readonly CreatureContinuityEvent[];
  relationships: readonly CreatureContinuityRelationship[];
  keepsakes: readonly string[];
  discoveries: readonly string[];
  locationId: string;
}>;

export type CreatureHistoryKaiCoordinate = Readonly<{
  uPulse: number;
  pulse: number;
  beat: number;
  stepIndex: number;
  weekday: string;
  chakra: string;
  coordinate: string;
}>;

export type CreatureHistoryRecord = Readonly<{
  wins: number;
  losses: number;
  draws: number;
  retreats: number;
  rescues: number;
  tags: number;
  bossVictories: number;
}>;

export type CreatureHistoryProjection = Readonly<{
  schema: "receiz.wildz.creature_history_projection.v1";
  assetId: string;
  level: number;
  xp: number;
  bond: number;
  growth: LivingGrowthSnapshot;
  condition: AdventureCardCondition;
  mastery: Readonly<Record<string, number>>;
  record: CreatureHistoryRecord;
  achievements: readonly string[];
  relationships: readonly string[];
  scars: readonly string[];
  upgrades: readonly string[];
  formId: string;
  stage: CreatureStage;
  ascensionRank: number;
  livingRevisionDigest: string;
  observerMemory?: CreatureObserverMemoryProjection;
  continuity?: CreatureContinuityProjection;
}>;

export type CreatureHistoryEffect =
  | Readonly<{
      kind: "progress";
      xpDelta: number;
      growthEvents: readonly GrowthEvent[];
    }>
  | Readonly<{
      kind: "condition";
      delta: AdventureConditionDelta;
    }>
  | Readonly<{
      kind: "record";
      counters: Partial<CreatureHistoryRecord>;
      achievementIds: readonly string[];
      relationshipIds: readonly string[];
      scarIds: readonly string[];
      upgradeIds: readonly string[];
    }>
  | Readonly<{
      kind: "transformation";
      fromRevisionDigest: string;
      toRevisionDigest: string;
      formId: string;
      stage: CreatureStage;
      ascensionRank: number;
    }>
  | Readonly<{
      kind: "observer-memory";
      turn: CreatureObserverMemoryTurn;
    }>
  | Readonly<{
      kind: "continuity-mandate";
      mandate: CreatureAutonomyMandate;
    }>
  | Readonly<{
      kind: "continuity-event";
      event: CreatureContinuityEvent;
    }>
  | Readonly<{
      kind: "legacy-checkpoint";
      projection: CreatureHistoryProjection;
    }>;

export type CreatureHistorySource = Readonly<{
  mode: CreatureHistorySourceMode;
  activityId: string;
  actorId: string;
  authority: CreatureHistoryAuthority;
}>;

export type CreatureHistoryEvidence = Readonly<{
  receiptDigest?: string;
  replayDigest?: string;
  sourceEventDigest?: string;
  sourceEventIds?: readonly string[];
  admission?: CreatureHistoryAdmissionEnvelope;
}>;

export type CreatureHistoryAdmissionNode = Readonly<{
  schema: "receiz.wildz.creature_history_admission_node.v1";
  authority: CreatureHistoryAdmittedAuthority;
  issuerId: string;
  verificationDigest: string;
  assetId: string;
  rootProofDigest: string;
  rootDigest: string;
  parentDigest: string;
  eventId: string;
  rulesetVersion: string;
  occurredAt: string;
  kai: CreatureHistoryKaiCoordinate;
  sourceDigest: string;
  evidenceDigest: string;
  effectsDigest: string;
  resultingProjectionDigest: string;
  receiptDigest: string;
  replayDigest: string;
}>;

export type CreatureHistoryAdmissionEnvelope = Readonly<{
  schema: "receiz.wildz.creature_history_admission.v1";
  node: CreatureHistoryAdmissionNode;
  digest: string;
}>;

/** The envelope digest is integrity, not authority. This verifier is the trust boundary. */
export type CreatureHistoryAuthorityVerifier = Readonly<{
  verifyAdmission(input: Readonly<{
    envelope: CreatureHistoryAdmissionEnvelope;
    event: CreatureHistoryEvent;
    chain: CreatureHistoryChain;
  }>): boolean;
}>;

export type CreatureRetirementAuthorityEvidence = Readonly<{
  schema: "receiz.wildz.creature_retirement_authority_evidence.v1";
  assetId: string;
  cardProofDigest: string;
  revisionDigest: string;
  historyHeadDigest: string;
  matchReceiptDigest: string;
  retirementSealDigest: string;
  retiredAt: string;
  previousRevisionDigest: string;
}>;

/** Verifies the external receipt/signature behind an irreversible retirement. */
export type CreatureRetirementAuthorityVerifier = Readonly<{
  verifyRetirement(evidence: CreatureRetirementAuthorityEvidence): boolean;
}>;

export type CreateCreatureHistoryAdmissionInput = Readonly<{
  chain: CreatureHistoryChain;
  event: CreatureHistoryEventDraft;
  issuerId: string;
  verificationDigest: string;
}>;

export type CreatureHistoryEventDraft = Readonly<{
  eventId: string;
  rulesetVersion: string;
  occurredAt: string;
  kai?: CreatureHistoryKaiCoordinate;
  source: CreatureHistorySource;
  evidence: CreatureHistoryEvidence;
  effects: readonly CreatureHistoryEffect[];
}>;

export type CreatureHistoryEvent = Readonly<{
  schema: "receiz.wildz.creature_history_event.v1";
  namespace: typeof CREATURE_HISTORY_NAMESPACE;
  rulesetVersion: string;
  sequence: number;
  eventId: string;
  assetId: string;
  rootProofDigest: string;
  parentDigest: string;
  occurredAt: string;
  kai: CreatureHistoryKaiCoordinate;
  source: CreatureHistorySource;
  evidence: CreatureHistoryEvidence;
  effects: readonly CreatureHistoryEffect[];
  resultingProjectionDigest: string;
  digest: string;
}>;

export type CreatureHistoryChain = Readonly<{
  schema: "receiz.wildz.creature_history.v1";
  namespace: typeof CREATURE_HISTORY_NAMESPACE;
  assetId: string;
  rootProofDigest: string;
  rootDigest: string;
  completeness: "complete" | "legacy-checkpoint";
  events: readonly CreatureHistoryEvent[];
  headDigest: string;
  projection: CreatureHistoryProjection;
  projectionDigest: string;
}>;

export type CreateCreatureHistoryInput = Readonly<{
  assetId: string;
  rootProofDigest: string;
  rulesetVersion: string;
  occurredAt: string;
  kai?: CreatureHistoryKaiCoordinate;
  actorId: string;
  projection: CreatureHistoryProjection;
  completeness?: CreatureHistoryChain["completeness"];
}>;
