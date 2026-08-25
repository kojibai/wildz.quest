import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export type WildsCreatureConsentDecision = "accept" | "pause" | "request-help" | "refuse";

export type WildsCreatureConsentInputV1 = Readonly<{
  creatureSubjectId: string;
  creatureHead: string;
  condition: Readonly<{ energy: number; fatigue: number; injury: number; stress: number }>;
  bond: number;
  preferences: Readonly<{ professions: readonly string[]; avoidHazards: readonly string[] }>;
  capabilities: Readonly<{ professions: readonly string[] }>;
  safety: Readonly<{ risk: number; hazards: readonly string[]; supportAvailable: boolean }>;
  requested: Readonly<{ professions: readonly string[]; maxActions: number }>;
  kaiUPulse: number;
}>;

export type WildsCreatureConsentProjectionV1 = Readonly<{
  schema: "wildz.creature-consent.v1";
  creatureSubjectId: string;
  creatureHead: string;
  decision: WildsCreatureConsentDecision;
  reasons: readonly string[];
  acceptedProfessions: readonly string[];
  maxActions: number;
  evaluatedAtKaiUPulse: number;
  consentDigest: string;
}>;

export type WildsCreatureMandateV1 = Readonly<{
  schema: "wildz.creature-mandate.v1";
  mandateId: string;
  creatureSubjectId: string;
  creatureHead: string;
  consentDigest: string;
  region: Readonly<{ x: number; z: number }>;
  professions: readonly string[];
  allowedResourceIds: readonly string[];
  maxActions: number;
  issuedAtKaiUPulse: number;
  expiresAtKaiUPulse: number;
  mandateDigest: string;
}>;

export type WildsCreatureMandateCurrentHeads = Readonly<{
  creatureHead: string;
  kaiUPulse: number;
  revokedMandateIds: readonly string[];
}>;

const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,159}$/;
const HEAD = /^(?:sha256:)?[a-f0-9]{64}$/;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
  }
  return value;
}

function boundedInteger(value: number, maximum = 100) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function canonicalStrings(values: readonly string[], allowEmpty = false) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0) || values.length > 32
    || values.some((value) => !IDENTIFIER.test(value))) {
    throw new Error("wilds_creature_mandate_values_invalid");
  }
  const result = [...new Set(values)].sort((left, right) => left.localeCompare(right));
  if (result.length !== values.length) throw new Error("wilds_creature_mandate_values_duplicate");
  return result;
}

function digest(value: unknown) {
  return sha256PortableBasis(canonicalPortableCardJson(value));
}

export function evaluateWildsCreatureConsent(input: WildsCreatureConsentInputV1): WildsCreatureConsentProjectionV1 {
  if (!IDENTIFIER.test(input.creatureSubjectId) || !HEAD.test(input.creatureHead)
    || !boundedInteger(input.condition.energy) || !boundedInteger(input.condition.fatigue)
    || !boundedInteger(input.condition.injury) || !boundedInteger(input.condition.stress)
    || !boundedInteger(input.bond) || !boundedInteger(input.safety.risk)
    || typeof input.safety.supportAvailable !== "boolean"
    || !Number.isSafeInteger(input.requested.maxActions) || input.requested.maxActions < 1 || input.requested.maxActions > 128
    || !Number.isSafeInteger(input.kaiUPulse) || input.kaiUPulse < 0) {
    throw new Error("wilds_creature_consent_input_invalid");
  }
  const preferences = canonicalStrings(input.preferences.professions, true);
  const avoidedHazards = canonicalStrings(input.preferences.avoidHazards, true);
  const capabilities = canonicalStrings(input.capabilities.professions, true);
  const requested = canonicalStrings(input.requested.professions);
  const hazards = canonicalStrings(input.safety.hazards, true);
  let decision: WildsCreatureConsentDecision = "accept";
  const reasons: string[] = [];

  if (input.condition.energy <= 10 || input.condition.fatigue >= 85 || input.condition.injury >= 75) {
    decision = "pause";
    reasons.push("I need rest and care before we continue.");
  } else if (input.safety.risk >= 80
    || (hazards.some((hazard) => avoidedHazards.includes(hazard)) && !input.safety.supportAvailable)) {
    decision = "refuse";
    reasons.push("That path does not feel safe to me.");
  } else if (requested.some((profession) => !capabilities.includes(profession))
    || input.condition.stress >= 70 || input.bond < 20) {
    decision = "request-help";
    reasons.push("I can help if we bring the right support.");
  } else if (requested.some((profession) => !preferences.includes(profession))) {
    reasons.push("I will try this with you, though it is not my favored work.");
  } else {
    reasons.push("I am ready to work beside you.");
  }

  const basis = {
    schema: "wildz.creature-consent.v1" as const,
    creatureSubjectId: input.creatureSubjectId,
    creatureHead: input.creatureHead,
    decision,
    reasons,
    acceptedProfessions: decision === "accept" ? requested : [],
    maxActions: decision === "accept" ? input.requested.maxActions : 0,
    evaluatedAtKaiUPulse: input.kaiUPulse
  };
  return freeze({ ...basis, consentDigest: digest(basis) });
}

function mandateBasis(value: Omit<WildsCreatureMandateV1, "mandateDigest">) {
  return canonicalPortableCardJson(value);
}

export function createWildsCreatureMandate(input: Readonly<{
  consent: WildsCreatureConsentProjectionV1;
  creatureSubjectId: string;
  creatureHead: string;
  region: Readonly<{ x: number; z: number }>;
  professions: readonly string[];
  allowedResourceIds: readonly string[];
  maxActions: number;
  issuedAtKaiUPulse: number;
  expiresAtKaiUPulse: number;
}>): WildsCreatureMandateV1 {
  const { consentDigest: _consentDigest, ...consentBasis } = input.consent;
  if (input.consent.decision !== "accept" || input.consent.creatureSubjectId !== input.creatureSubjectId
    || input.consent.creatureHead !== input.creatureHead || input.consent.consentDigest !== digest(consentBasis)) {
    throw new Error("wilds_creature_mandate_consent_invalid");
  }
  const professions = canonicalStrings(input.professions);
  const allowedResourceIds = canonicalStrings(input.allowedResourceIds, true);
  if (professions.some((profession) => !input.consent.acceptedProfessions.includes(profession))
    || !Number.isSafeInteger(input.region.x) || !Number.isSafeInteger(input.region.z)
    || Math.abs(input.region.x) > 3_906_250 || Math.abs(input.region.z) > 3_906_250
    || !Number.isSafeInteger(input.maxActions) || input.maxActions < 1 || input.maxActions > input.consent.maxActions
    || input.issuedAtKaiUPulse !== input.consent.evaluatedAtKaiUPulse
    || !Number.isSafeInteger(input.expiresAtKaiUPulse) || input.expiresAtKaiUPulse <= input.issuedAtKaiUPulse) {
    throw new Error("wilds_creature_mandate_bounds_invalid");
  }
  const idBasis = {
    creatureSubjectId: input.creatureSubjectId,
    creatureHead: input.creatureHead,
    consentDigest: input.consent.consentDigest,
    region: input.region,
    professions,
    allowedResourceIds,
    maxActions: input.maxActions,
    issuedAtKaiUPulse: input.issuedAtKaiUPulse,
    expiresAtKaiUPulse: input.expiresAtKaiUPulse
  };
  const mandateId = `mandate:${digest(idBasis).slice(7, 39)}`;
  const basis: Omit<WildsCreatureMandateV1, "mandateDigest"> = {
    schema: "wildz.creature-mandate.v1",
    mandateId,
    ...idBasis,
    region: { ...input.region }
  };
  return freeze({ ...basis, mandateDigest: sha256PortableBasis(mandateBasis(basis)) });
}

export function reverifyWildsCreatureMandate(
  mandate: WildsCreatureMandateV1,
  current: WildsCreatureMandateCurrentHeads
): Readonly<{ ok: boolean; errors: readonly string[] }> {
  const errors: string[] = [];
  if (!mandate || mandate.schema !== "wildz.creature-mandate.v1") errors.push("mandate_invalid");
  else {
    const { mandateDigest, ...basis } = mandate;
    if (mandateDigest !== sha256PortableBasis(mandateBasis(basis))) errors.push("mandate_digest_invalid");
    if (mandate.creatureHead !== current.creatureHead) errors.push("mandate_creature_head_stale");
    if (!Number.isSafeInteger(current.kaiUPulse) || current.kaiUPulse < mandate.issuedAtKaiUPulse
      || current.kaiUPulse > mandate.expiresAtKaiUPulse) errors.push("mandate_expired");
    if (current.revokedMandateIds.includes(mandate.mandateId)) errors.push("mandate_revoked");
  }
  return freeze({ ok: errors.length === 0, errors });
}
