import {
  createReceizSubjectMandateV122,
  digestReceizCanonicalV122,
  validateReceizMandateUseV122,
  type ReceizSubjectMandateV122
} from "@receiz/sdk";

export type WildsCrewSubjectBindings = Readonly<{
  ownerSubjectId: string;
  workerSubjectId: string;
  ownerHead: string;
  workerHead: string;
  currentOwnerSubjectId: string;
  currentKai: string;
}>;
export type WildsCrewProofObjects = Readonly<{ ownerProofObject: Blob; workerProofObject: Blob }>;
export type WildsCrewUsage = Readonly<{ resourcePhiMicro: string; geometryUnits: string; actions: string }>;
export type WildsCrewPreparedMandate = Readonly<{
  mandate: ReceizSubjectMandateV122;
  maximumActions: string;
  confirmationDigest: string;
}>;
export type WildsCrewCommand = Readonly<{
  commandKind: string;
  worldId: string;
  regionId: string;
  resourcePhiMicro: string;
  geometryUnits: string;
  /** Digest of the exact typed command including targets, material lots and effects. */
  commandDigest: string;
}>;
type Failure = Readonly<{ ok: false; code: string; writesOnFailure: 0 }>;
const fail = (code: string): Failure => Object.freeze({ ok: false, code, writesOnFailure: 0 });
const uint = (value: string) => typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
const nonempty = (value: string) => typeof value === "string" && value.trim().length > 0;
const list = (values: readonly string[]) => Array.isArray(values) && values.length > 0 && values.every(nonempty);
const subjectsValid = (s: WildsCrewSubjectBindings) => s && [s.ownerSubjectId, s.workerSubjectId, s.ownerHead, s.workerHead].every(nonempty)
  && s.ownerSubjectId !== s.workerSubjectId && s.currentOwnerSubjectId === s.ownerSubjectId && uint(s.currentKai);
const proofsValid = (p: WildsCrewProofObjects) => p.ownerProofObject instanceof Blob && p.ownerProofObject.size > 0
  && p.workerProofObject instanceof Blob && p.workerProofObject.size > 0;
const confirmationBasis = (mandate: ReceizSubjectMandateV122, maximumActions: string) => ({
  schema: "wildz.crew.mandate-confirmation.v1", mandateDigest: mandate.mandateDigest, maximumActions
});

/** Pure preparation, never issuance. The verifier is a trusted application port: it must open
 * both exact proof objects through SDK verification and verify ownership/current heads.
 * A subject-state row, cache, UI record, digest-shaped ID or receipt is not sufficient. */
export async function prepareWildsCrewMandate(input: WildsCrewProofObjects & Readonly<{
  verifySubjects: (proofs: WildsCrewProofObjects) => Promise<WildsCrewSubjectBindings | null>;
  allowedCommandKinds: readonly string[];
  worldIds: readonly string[];
  regionIds: readonly string[];
  maximumResourcePhiMicro: string;
  maximumGeometryUnits: string;
  maximumActions: string;
  expiresAtKai: string;
  nonce: string;
  revocationHead: string;
}>): Promise<Readonly<{ ok: true; prepared: WildsCrewPreparedMandate }> | Failure> {
  try {
    if (!proofsValid(input) || typeof input.verifySubjects !== "function") return fail("crew_proof_verifier_required");
    if (![input.maximumResourcePhiMicro, input.maximumGeometryUnits, input.maximumActions, input.expiresAtKai].every(uint)
      || BigInt(input.maximumActions) === 0n || ![input.allowedCommandKinds, input.worldIds, input.regionIds].every(list)
      || !nonempty(input.nonce) || !nonempty(input.revocationHead)) return fail("crew_mandate_input_invalid");
    // Capture caller-owned inputs before awaiting a verifier.
    const bounds = structuredClone({ allowedCommandKinds: input.allowedCommandKinds, worldIds: input.worldIds,
      regionIds: input.regionIds, maximumResourcePhiMicro: input.maximumResourcePhiMicro,
      maximumGeometryUnits: input.maximumGeometryUnits, expiresAtKai: input.expiresAtKai,
      nonce: input.nonce, revocationHead: input.revocationHead });
    const maximumActions = input.maximumActions;
    const bindings = structuredClone(await input.verifySubjects(Object.freeze({ ownerProofObject: input.ownerProofObject, workerProofObject: input.workerProofObject })));
    if (!bindings || !subjectsValid(bindings)) return fail("crew_subject_verification_failed");
    if (BigInt(bindings.currentKai) >= BigInt(bounds.expiresAtKai)) return fail("mandate_expired");
    const mandate = await createReceizSubjectMandateV122({ ...bounds, ownerSubjectId: bindings.ownerSubjectId,
      workerSubjectId: bindings.workerSubjectId, expectedOwnerHead: bindings.ownerHead, expectedWorkerHead: bindings.workerHead });
    Object.freeze(mandate.allowedCommandKinds); Object.freeze(mandate.worldIds); Object.freeze(mandate.regionIds);
    const confirmationDigest = await digestReceizCanonicalV122(confirmationBasis(mandate, maximumActions));
    return Object.freeze({ ok: true, prepared: Object.freeze({ mandate, maximumActions, confirmationDigest }) });
  } catch { return fail("crew_mandate_preparation_failed"); }
}

export type WildsCrewVerifiedRuntime = WildsCrewSubjectBindings & Readonly<{
  activeMandateDigest: string;
  revocationHead: string;
  revoked: boolean;
  /** Verified owner authorization for the exact confirmation envelope, not a UI boolean. */
  ownerConfirmedDigest: string;
  /** Reverified current willingness, capability, injuries and affected-party consent. */
  consentCommandDigest: string;
  consentGranted: boolean;
  /** From verified admitted history, including other devices; never a caller's counter. */
  usage: WildsCrewUsage;
}>;

/** Pure preflight, not command admission. The caller must perform this inside its atomic
 * execution/reservation boundary and consume budgets only with an admitted transaction.
 * verifyRuntime must reverify exact bytes, mandate state, authority, usage and consent for
 * this exact command. Missing production proof verification must block execution. */
export async function validateWildsCrewMandateCommand(input: WildsCrewProofObjects & Readonly<{
  prepared: WildsCrewPreparedMandate;
  command: WildsCrewCommand;
  verifyRuntime: (request: WildsCrewProofObjects & Readonly<{ prepared: WildsCrewPreparedMandate; command: WildsCrewCommand }>) => Promise<WildsCrewVerifiedRuntime | null>;
}>): Promise<Readonly<{ ok: true; mandateDigest: string; confirmationDigest: string; ownerHead: string; workerHead: string; worldId: string; regionId: string; commandDigest: string; nextUsage: WildsCrewUsage }> | Failure> {
  try {
    if (!proofsValid(input) || typeof input.verifyRuntime !== "function") return fail("crew_proof_verifier_required");
    const prepared = structuredClone(input.prepared);
    const command: WildsCrewCommand = Object.freeze({
      commandKind: input.command.commandKind, worldId: input.command.worldId,
      regionId: input.command.regionId, resourcePhiMicro: input.command.resourcePhiMicro,
      geometryUnits: input.command.geometryUnits, commandDigest: input.command.commandDigest
    });
    const { mandate, maximumActions, confirmationDigest } = prepared;
    if (![maximumActions, mandate.maximumResourcePhiMicro, mandate.maximumGeometryUnits, mandate.expiresAtKai, command.resourcePhiMicro, command.geometryUnits].every(uint)
      || BigInt(maximumActions) === 0n || ![command.commandKind, command.worldId, command.regionId, command.commandDigest].every(nonempty)
      || ![mandate.allowedCommandKinds, mandate.worldIds, mandate.regionIds].every(list)) return fail("crew_mandate_input_invalid");
    Object.freeze(mandate.allowedCommandKinds); Object.freeze(mandate.worldIds); Object.freeze(mandate.regionIds);
    Object.freeze(mandate); Object.freeze(prepared);
    if (await digestReceizCanonicalV122(confirmationBasis(mandate, maximumActions)) !== confirmationDigest) return fail("crew_confirmation_digest_mismatch");
    const current = structuredClone(await input.verifyRuntime(Object.freeze({ prepared, command, ownerProofObject: input.ownerProofObject, workerProofObject: input.workerProofObject })));
    if (!current || !subjectsValid(current) || current.ownerSubjectId !== mandate.ownerSubjectId || current.workerSubjectId !== mandate.workerSubjectId) return fail("crew_subject_verification_failed");
    if (current.revoked || current.activeMandateDigest !== mandate.mandateDigest) return fail("mandate_revoked_or_stale");
    if (current.ownerConfirmedDigest !== confirmationDigest) return fail("crew_owner_confirmation_required");
    if (!current.consentGranted || current.consentCommandDigest !== command.commandDigest) return fail("crew_consent_required");
    if (![current.usage.resourcePhiMicro, current.usage.geometryUnits, current.usage.actions].every(uint)) return fail("crew_usage_invalid");
    const nextUsage = Object.freeze({ resourcePhiMicro: String(BigInt(current.usage.resourcePhiMicro) + BigInt(command.resourcePhiMicro)),
      geometryUnits: String(BigInt(current.usage.geometryUnits) + BigInt(command.geometryUnits)), actions: String(BigInt(current.usage.actions) + 1n) });
    if (BigInt(nextUsage.actions) > BigInt(maximumActions)) return fail("crew_action_limit_exceeded");
    if (BigInt(current.currentKai) >= BigInt(mandate.expiresAtKai)) return fail("mandate_expired");
    const checked = await validateReceizMandateUseV122({ ...command, ...nextUsage, mandate, currentKai: current.currentKai,
      ownerHead: current.ownerHead, workerHead: current.workerHead, revocationHead: current.revocationHead });
    if (!checked.ok) return fail(checked.code);
    return Object.freeze({ ok: true, mandateDigest: checked.mandateDigest, confirmationDigest, ownerHead: current.ownerHead, workerHead: current.workerHead, worldId: command.worldId, regionId: command.regionId, commandDigest: command.commandDigest, nextUsage });
  } catch { return fail("crew_mandate_validation_failed"); }
}
