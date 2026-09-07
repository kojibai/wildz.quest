import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

/** Constitutional predicates consume source facts, never model predictions or administrator rank. */
export const WILDS_CONSTITUTION = Object.freeze({
  id: "wildz:constitution:truth-of-breath:0.1", version: "0.1", predecessor: null,
  sourceDigest: "sha256:a749af1c56ffb4c6eb787314b2b274d9eed8dfdb5155740bfad7cb12369d0bde",
  source: "docs/constitution/TRUTH-OF-BREATH-v0.1.md",
  challengePath: "wildz:constitutional-dispute:claim-and-source",
  unamendable: ["human-ownership", "founder-supremacy", "unbounded-anonymous-authority", "historical-fact-rewriting", "majority-manufactured-sovereignty", "machine-sovereignty"] as const
});
export type ConstitutionalResult = "VALID" | "INVALID" | "UNRESOLVED" | "DISPUTED";
export type ConstitutionalPredicate = Readonly<{ rule: string; predicate: string; value: boolean | null; evidence: readonly string[] }>;
export type ConstitutionalDecision = Readonly<{
  schema: "wildz.constitutional-decision.v1"; constitution: string; result: ConstitutionalResult;
  sourceState: string; actor: string; standing: string; authority: string;
  rulesApplied: readonly string[]; predicatesPassed: readonly ConstitutionalPredicate[];
  predicatesFailed: readonly ConstitutionalPredicate[]; predicatesUnresolved: readonly ConstitutionalPredicate[];
  evidence: readonly string[]; conflicts: readonly string[]; successor: string | null;
  challengePath: string; digest: string;
}>;
export const constitutionalDigest = (value: unknown) => sha256PortableBasis(canonicalPortableCardJson(value));
export function deriveConstitutionalDecision(input: {
  sourceState: string; actor: string; standing: string; authority: string; predicates: readonly ConstitutionalPredicate[];
  conflicts?: readonly string[]; successor?: string | null;
}): ConstitutionalDecision {
  const conflicts = input.conflicts ?? [];
  const predicates = [...input.predicates,
    { rule: "TOB-01/02/82", predicate: "Decision has an identified source, actor, standing, authority and defined predicates", value: Boolean(input.sourceState && input.actor && input.standing && input.authority && input.predicates.length), evidence: [input.sourceState] }
  ];
  const predicatesFailed = predicates.filter(p => p.value === false);
  const predicatesUnresolved = predicates.filter(p => p.value === null);
  const result: ConstitutionalResult = predicatesFailed.length ? "INVALID" : conflicts.length ? "DISPUTED" : predicatesUnresolved.length ? "UNRESOLVED" : "VALID";
  const basis = {
    schema: "wildz.constitutional-decision.v1" as const, constitution: `${WILDS_CONSTITUTION.id}:${WILDS_CONSTITUTION.sourceDigest}`, result,
    sourceState: input.sourceState, actor: input.actor, standing: input.standing, authority: input.authority,
    rulesApplied: [...new Set(predicates.map(p => p.rule))],
    predicatesPassed: predicates.filter(p => p.value === true), predicatesFailed, predicatesUnresolved,
    evidence: [...new Set(predicates.flatMap(p => p.evidence))], conflicts,
    successor: result === "VALID" ? input.successor ?? null : null, challengePath: WILDS_CONSTITUTION.challengePath
  };
  return { ...basis, digest: constitutionalDigest(basis) };
}
export class WildsConstitutionalError extends Error {
  constructor(message: string, readonly decision: ConstitutionalDecision) { super(message); this.name = "WildsConstitutionalError"; }
}
export const constitutionalPredicate = (rule: string, predicate: string, value: boolean | null, evidence: readonly string[] = []): ConstitutionalPredicate => ({ rule, predicate, value, evidence });
export type ClaimStatus = "ALLEGED" | "SUPPORTED" | "DISPUTED" | "ADMITTED" | "ESTABLISHED" | "ADJUDICATED" | "REJECTED" | "OVERTURNED" | "UNRESOLVED";
/** An admission is receipt of a claim, not establishment of the proposition. */
export function publicClaimStatus(source: ClaimStatus): ClaimStatus { return source; }
export function mayRepresentAsEstablished(source: ClaimStatus) { return source === "ESTABLISHED" || source === "ADJUDICATED"; }
export function mayOwn(subject: { type: string; sourceClass: string }) { return ["RESOURCE", "TOOL", "IMPROVEMENT", "MACHINE", "VEHICLE", "BUILDING", "GOODS", "CREATIVE_WORK", "EQUIPMENT", "MONEY", "CREATURE"].includes(subject.type) && ["PRODUCED", "INFORMATIONAL", "BIOLOGICAL", "INFRASTRUCTURE"].includes(subject.sourceClass); }
export function originalStanding(actor: { kind: "PERSON" | "AI" | "INSTITUTION" }) { return actor.kind === "PERSON"; }
export function validAcquisition(basis: string, predecessorAuthority: boolean, transferAuthority: boolean, competingSuccessor: boolean) {
  return ["CREATION", "VOLUNTARY_TRANSFER", "GIFT", "INHERITANCE", "RESTITUTION", "ADJUDICATED_TRANSFER"].includes(basis)
    && predecessorAuthority && transferAuthority && !competingSuccessor;
}
export type ConstitutionalPermission = Readonly<{
  id: string; grantor: string; grantee: string; subject: string; allowed: readonly string[]; forbidden: readonly string[];
  begin: number; expiration: number; revokedAt: number | null; basis: string;
}>;
export function verifyPermission(permission: ConstitutionalPermission, input: { actor: string; subject: string; action: string; at: number; standing: { id: string; holder: string; subject: string; allowed: readonly string[]; begin: number; expiration: number } }) {
  const basis = input.standing;
  return permission.basis === basis.id && permission.grantor === basis.holder && permission.subject === basis.subject
    && permission.grantee === input.actor && permission.subject === input.subject
    && [permission.begin, permission.expiration, input.at, basis.begin, basis.expiration].every(Number.isSafeInteger)
    && permission.begin >= basis.begin && permission.expiration <= basis.expiration && permission.expiration > permission.begin
    && permission.allowed.every(action => basis.allowed.includes(action))
    && input.at >= permission.begin && input.at < permission.expiration
    && (permission.revokedAt === null || input.at < permission.revokedAt)
    && permission.allowed.includes(input.action) && !permission.forbidden.includes(input.action);
}
export function evaluateFruit(input: { baseline: string; result: string; attributable: boolean; evidence: readonly string[]; beneficial: boolean; preservesThreatenedState: boolean; basis: string }) {
  return input.evidence.length > 0 && input.attributable && input.beneficial
    && (input.baseline !== input.result || input.preservesThreatenedState)
    && !["PRICE_APPRECIATION", "REVENUE_ONLY", "EXCLUSION_ONLY", "OWNERSHIP_ONLY"].includes(input.basis);
}
export function evaluateExternalities<T>(fruit: readonly T[], unauthorizedHarm: readonly T[]) {
  return { fruit: [...fruit], unauthorizedHarm: [...unauthorizedHarm] }; // No scalar offset erases an attributable harm.
}
export function deriveResponsibility(input: { actor: string; outcome: string; causalLinks: readonly string[]; causationEstablished: boolean; intent?: string }) {
  return { actor: input.actor, outcome: input.outcome, causalLinks: [...input.causalLinks], status: input.causationEstablished && input.causalLinks.length ? "ESTABLISHED" as const : "CAUSATION_UNPROVEN" as const };
}
export function punishableOmission(input: { duty: boolean; knowledge: boolean; opportunity: boolean; capacity: boolean; causation: boolean }) { return input.duty === true && input.knowledge === true && input.opportunity === true && input.capacity === true && input.causation === true; }
export function verifyEmergency(input: { begin: number; expiration: number; at: number; threat: boolean; necessary: boolean; evidence: readonly string[] }) {
  return [input.begin, input.expiration, input.at].every(Number.isSafeInteger) && input.expiration > input.begin && input.at >= input.begin && input.at < input.expiration && input.threat && input.necessary && input.evidence.length > 0;
}
export function verifyDefense(input: { ongoingThreat: boolean; necessary: boolean; proportionate: boolean }) { return input.ongoingThreat && input.necessary && input.proportionate; }
export function guardianScope(granted: readonly string[], capacityReturned: readonly string[]) { return granted.filter(action => !capacityReturned.includes(action)); }
export function verifyCompletion(input: { status: "ACTIVE" | "COMPLETED"; predicates: readonly boolean[]; terminationRule: string | null }) {
  if (!input.terminationRule || input.predicates.length === 0) return "UNRESOLVED";
  return input.status === "COMPLETED" || input.predicates.every(Boolean) ? "COMPLETED" : "ACTIVE";
}
export function verifySuccession(input: { current: string; predecessor: string | null; proposed: string; candidates: readonly string[]; authorized: boolean; reversalReferencesCurrent?: string }) {
  const candidates = [...new Set([...input.candidates, input.proposed])];
  if (!input.authorized) return { result: "AUTHORITY_UNPROVEN", candidates };
  if (!input.current || !input.proposed || input.predecessor !== input.current) return { result: "STALE_PREDECESSOR", candidates };
  return { result: candidates.length > 1 ? "FORK" : "VALID", candidates };
}
export function mayAbandon(input: { state: "ACTIVE" | "INTERRUPTED" | "AT_RISK"; objectiveIndicators: boolean; predicatesComplete: boolean; provenWrongfulInterference: boolean }) {
  return input.state === "AT_RISK" && input.objectiveIndicators && input.predicatesComplete && !input.provenWrongfulInterference;
}
export function scarcityRecord(available: number, eligibleNeed: number) {
  if (![available, eligibleNeed].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error("constitutional_capacity_unproven");
  return { available, eligibleNeed, unmetDemand: Math.max(0, eligibleNeed - available), scarcity: eligibleNeed > available };
}
export function coerciveDependency(input: { indispensable: boolean; unilateralExclusion: boolean; unrelatedRightsDemanded: boolean; realisticAlternatives: boolean }) {
  return input.indispensable && input.unilateralExclusion && input.unrelatedRightsDemanded && !input.realisticAlternatives;
}
export function validAmendment(input: { predecessor: string | null; current: string; authority: boolean; ratified: boolean; effects: readonly string[] }) {
  return Boolean(input.current) && input.predecessor === input.current && input.authority && input.ratified && !input.effects.some(effect => (WILDS_CONSTITUTION.unamendable as readonly string[]).includes(effect));
}

export const CONSTITUTIONAL_OBJECT_TYPES = ["PERSON", "IDENTITY", "STANDING", "POSSESSION", "OWNERSHIP", "STEWARDSHIP", "RESOURCE", "IMPROVEMENT", "PERMISSION", "GUARDIANSHIP", "DUTY", "ACTION", "OUTCOME", "CAUSAL_LINK", "RESPONSIBILITY", "FRUIT", "EXTERNALITY", "CLAIM", "EVIDENCE", "DISPUTE", "FINDING", "CULPABILITY", "REMEDY", "CONSEQUENCE", "COMPLETION", "RESTORATION", "COMMONS", "DELEGATION", "AUTHORITY", "GOVERNANCE_DECISION", "EMERGENCY_AUTHORITY", "SUCCESSION", "AMENDMENT", "EXIT", "BASELINE_HABITATION", "DEBT", "CONTRADICTION"] as const;
export type ConstitutionalObject = Readonly<{
  object_id: string; object_type: typeof CONSTITUTIONAL_OBJECT_TYPES[number]; version: number;
  predecessor_id: string | null; created_by: string; created_at_position: number; authority_reference: string;
  claims: readonly string[]; evidence: readonly string[]; signatures: readonly { signer: string; signature: string }[];
  status: string;
}>;
/** A well-shaped representation still needs verified source authority and a defined transition law. */
export function constitutionalObjectShape(value: ConstitutionalObject) {
  return Boolean(value.object_id && value.created_by && value.authority_reference && value.status)
    && CONSTITUTIONAL_OBJECT_TYPES.includes(value.object_type) && Number.isSafeInteger(value.version) && value.version > 0
    && Number.isSafeInteger(value.created_at_position) && (value.version === 1 || Boolean(value.predecessor_id))
    && Array.isArray(value.claims) && Array.isArray(value.evidence) && Array.isArray(value.signatures);
}
