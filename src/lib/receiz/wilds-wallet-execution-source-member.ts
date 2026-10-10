import {
  RECEIZ_CURRENT_CONSTITUTION_REGISTRY,
  bindReceizCurrentArtifactAppendRegistryAuthority,
  createReceizArtifactAdmissionEngine,
  createReceizCapabilityIssuerResolver,
  createReceizCapabilityVerifier,
  planArtifactAppend,
  readReceizArtifactAppendDerivedEffects,
  readReceizIdentityArtifact,
  receizArtifactAppendCapabilityContext,
  receizBase64UrlDecode,
  sealArtifactTransitionCandidate,
  signReceizCapability,
  signReceizIdentityLoginProof,
  transportReceizSealedArtifactV124,
  validateReceizOperationPlanV124,
  verifyReceizArtifact,
  verifyReceizArtifactAdmission,
  verifyReceizIdentityPortableStateProof,
  verifyReceizPortableExecutionTransitionSetV124,
  type ReceizArtifactTransitionSealer,
  type ReceizKeyFile,
  type ReceizClient,
  type ReceizOperationPlanV124,
  type ReceizPortableExecutionTransitionMemberV124,
  type ReceizPortableExecutionTransitionSetV124,
  type ReceizPortableSealedArtifactV124,
  type ReceizVerifiedArtifactAdmission,
  type ReceizVerifiedProofHistory
} from "@receiz/sdk";

type MemberPreparation = Readonly<{
  keyFile: ReceizKeyFile;
  passphrase?: string;
  operationPlan: ReceizOperationPlanV124;
  participantId: string;
  planning: Omit<ReceizPortableExecutionTransitionMemberV124["planning"], "expectedHead">;
  currentKai: string;
  expiresAtKai: string;
  sealer: ReceizArtifactTransitionSealer;
}>;

export type WildsWalletExecutionSourceMemberInput = MemberPreparation & Readonly<{
  predecessor: ReceizPortableSealedArtifactV124;
  identityArtifact: ReceizPortableSealedArtifactV124;
}>;

const KAI = /^(0|[1-9][0-9]*)$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;

function fail(code: string): never { throw new TypeError(`WILDS_WALLET_EXECUTION_${code}`); }

/** Submit the exact SDK-generated successor bytes to the native Record + Seal
 * API. No application projection or JSON reserialization enters the seal. */
export function createWildsWalletExecutionSourceSealer(client: Pick<ReceizClient, "assets">): ReceizArtifactTransitionSealer {
  return ({ plan, successorPayloadBytes }) => client.assets.createProofObject({
    assetType: "proof_object", payload: { bytes: successorPayloadBytes.slice(), mimeType: "application/vnd.receiz.portable-asset+json" }
  }, { idempotencyKey: `wildz:wallet-source:${plan.planDigest.value}`, filename: `wallet-source-${plan.planDigest.value}.receiz` });
}

async function exactInput(input: MemberPreparation) {
  if (!KAI.test(input.currentKai) || !KAI.test(input.expiresAtKai)
    || BigInt(input.expiresAtKai) <= BigInt(input.currentKai)) fail("KAI_INVALID");
  const plan = await validateReceizOperationPlanV124(input.operationPlan);
  const expectedHead = plan.expectedParticipantHeads[input.participantId];
  if (!expectedHead || !SHA.test(expectedHead)) fail("PARTICIPANT_INVALID");
  if (input.planning.event.participantId !== input.participantId
    || input.planning.event.applicationId !== plan.applicationId
    || input.planning.event.exactPlanDigest !== plan.exactPlanDigest) fail("PARTICIPANT_PLAN_MISMATCH");
  return plan;
}

async function openExact(artifact: ReceizPortableSealedArtifactV124) {
  if (artifact.schema !== "receiz.sealed-artifact-bytes.v124" || !SHA.test(artifact.artifactSha256)
    || !SHA.test(artifact.payloadSha256) || !/^[A-Za-z0-9_-]+$/.test(artifact.exactBytesB64u)
    || artifact.exactBytesB64u.length > Math.ceil(MAX_SOURCE_BYTES * 4 / 3)
    || !artifact.filename || !artifact.mimeType) fail("SOURCE_INVALID");
  const bytes = receizBase64UrlDecode(artifact.exactBytesB64u);
  const checked = await verifyReceizArtifact(new File([bytes.slice().buffer], artifact.filename, { type: artifact.mimeType }));
  if (checked.status !== "verified-artifact" || checked.artifactDigest.value !== artifact.artifactSha256
    || checked.payloadDigest.value !== artifact.payloadSha256) fail("SOURCE_ARTIFACT_UNVERIFIED");
  return checked;
}

function identityChallenge(identity: ReceizPortableSealedArtifactV124, keyFile: ReceizKeyFile, registryDigest: string) {
  // Exactly the native SDK's six-line transition-member identity challenge.
  // Its transition variant is not a public export; no outcome is fabricated
  // just to invoke the public authority-evidence variant.
  return ["RECEIZ-IDENTITY-ADMISSION-V112", identity.artifactSha256, identity.payloadSha256,
    keyFile.keyId, keyFile.owner.uid, registryDigest].join("\n");
}

function revocations(history: ReceizVerifiedProofHistory) {
  const revoked = new Set<string>();
  for (const node of history.nodes) {
    const receipt = node.receipt;
    if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)
      || !("revokedCapabilityDigests" in receipt)) continue;
    const values = receipt.revokedCapabilityDigests;
    if (!Array.isArray(values) || values.some(value => typeof value !== "string" || !SHA.test(value))) fail("REVOCATION_EVIDENCE_INVALID");
    for (const value of values) revoked.add(value as string);
  }
  return revoked;
}

async function currentIdentity(input: MemberPreparation, identity: ReceizVerifiedArtifactAdmission) {
  if (identity.profile !== "identity" || identity.verdict !== "canonical-identity") fail("IDENTITY_ADMISSION_REQUIRED");
  const carried = await readReceizIdentityArtifact(identity.verifiedPayload.bytes);
  if (carried.keyId !== input.keyFile.keyId || carried.alg !== input.keyFile.alg
    || carried.owner.uid !== input.keyFile.owner.uid
    || carried.crypto.publicKeyRawB64u !== input.keyFile.crypto.publicKeyRawB64u) fail("SIGNING_KEY_MISMATCH");
  if (await verifyReceizIdentityPortableStateProof(carried) !== "verified"
    || carried.portableState?.schema !== "receiz.identity-key-state.v113") fail("REVOCATION_EVIDENCE_REQUIRED");
  const snapshot = carried.portableState.snapshot;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) fail("REVOCATION_EVIDENCE_REQUIRED");
  const state = snapshot as Record<string, unknown>;
  if (Object.keys(state).sort().join(",") !== "actorId,issuerKeyId,observedThroughKai,registryDigest,revokedAtKai"
    || state.issuerKeyId !== carried.keyId || state.actorId !== carried.owner.uid
    || state.actorId !== identity.actor.actorId || state.registryDigest !== identity.actor.registryDigest.value
    || typeof state.observedThroughKai !== "string" || !KAI.test(state.observedThroughKai)
    || BigInt(state.observedThroughKai) < BigInt(input.currentKai)
    || (state.revokedAtKai !== null && (typeof state.revokedAtKai !== "string" || !KAI.test(state.revokedAtKai)
      || BigInt(state.revokedAtKai) > BigInt(state.observedThroughKai)))) fail("REVOCATION_EVIDENCE_REQUIRED");
  if (state.revokedAtKai !== null && BigInt(state.revokedAtKai as string) <= BigInt(input.currentKai)) fail("SIGNING_KEY_REVOKED");
  return carried;
}

/** Opens original bytes under the SDK's pinned roots. Preparation never commits. */
export async function prepareWildsWalletExecutionSourceMember(input: WildsWalletExecutionSourceMemberInput) {
  const operationPlan = await exactInput(input);
  const [predecessorVerification, identityVerification] = await Promise.all([openExact(input.predecessor), openExact(input.identityArtifact)]);
  const admit = createReceizArtifactAdmissionEngine();
  const predecessorAdmission = await admit(predecessorVerification, { profile: "portable-state" });
  if (predecessorAdmission.verdict !== "bearer-recovery" || !predecessorAdmission.proofHistory) fail("SOURCE_ADMISSION_REQUIRED");
  const challengeText = identityChallenge(input.identityArtifact, input.keyFile, predecessorAdmission.admissionProof.registryDigest);
  const identityProof = await signReceizIdentityLoginProof({ keyFile: input.keyFile, challengeText,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {}) });
  const identityAdmission = await admit(identityVerification, { profile: "identity",
    ...(predecessorAdmission.ownerReceizId ? { ownerConstraint: predecessorAdmission.ownerReceizId } : {}),
    ...(predecessorAdmission.actorConstraint ? { actorConstraint: predecessorAdmission.actorConstraint } : {}),
    identityExactChallenge: challengeText, identityProof });
  if (identityAdmission.verdict !== "canonical-identity" || identityAdmission.profile !== "identity") fail("IDENTITY_ADMISSION_REQUIRED");
  return prepareWildsWalletExecutionSourceMemberFromAdmissions({ ...input, operationPlan, predecessorAdmission, identityAdmission });
}

/** Reuses real SDK custody; returned wire members remain uncommitted and require
 * the pinned set verifier below. Diagnostic admissions never become production sets. */
export async function prepareWildsWalletExecutionSourceMemberFromAdmissions(input: MemberPreparation & Readonly<{
  predecessorAdmission: ReceizVerifiedArtifactAdmission;
  identityAdmission: ReceizVerifiedArtifactAdmission;
}>): Promise<ReceizPortableExecutionTransitionMemberV124> {
  const operationPlan = await exactInput(input);
  const [predecessor, identity] = await Promise.all([
    verifyReceizArtifactAdmission(input.predecessorAdmission), verifyReceizArtifactAdmission(input.identityAdmission)
  ]);
  if ("code" in predecessor || predecessor.verdict !== "bearer-recovery" || !predecessor.proofHistory) fail("SOURCE_ADMISSION_REQUIRED");
  if ("code" in identity || identity.verdict !== "canonical-identity" || identity.profile !== "identity" || !identity.openedArtifact) fail("IDENTITY_ADMISSION_REQUIRED");
  if (predecessor.openedArtifact.sealedArtifact.kind !== "receiz.native-record-seal"
    || identity.openedArtifact.sealedArtifact.kind !== "receiz.native-record-seal") fail("NATIVE_SOURCE_REQUIRED");
  if (predecessor.proofHistory.headDigests[0] !== operationPlan.expectedParticipantHeads[input.participantId]
    || (predecessor.ownerReceizId !== null && predecessor.ownerReceizId !== identity.actor.actorId)
    || (predecessor.actorConstraint !== null && predecessor.actorConstraint !== identity.actor.actorId)) fail("SOURCE_HEAD_OR_OWNER_MISMATCH");
  await currentIdentity(input, identity);
  await bindReceizCurrentArtifactAppendRegistryAuthority({ admission: predecessor, registry: RECEIZ_CURRENT_CONSTITUTION_REGISTRY });
  const append = await planArtifactAppend({ admission: predecessor, verifiedHistory: predecessor.proofHistory,
    verifiedActorEvidence: identity, ...input.planning,
    expectedHead: { algorithm: "sha-256", binds: "verified-proof-history", value: operationPlan.expectedParticipantHeads[input.participantId]! } });
  const signedCapability = await signReceizCapability({ keyFile: input.keyFile,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {}), payload: {
      schema: "receiz.capability.v112", capabilityId: `wildz:wallet:${append.planDigest.value}`,
      issuerKeyId: input.keyFile.keyId, actorId: append.actor.actorId, tenantId: null, audience: operationPlan.applicationId,
      authorityProfile: "artifact-local", operations: ["artifact.append"], resourceScopes: [append.resource],
      maximumEffects: readReceizArtifactAppendDerivedEffects(append), registryDigest: append.registryDigest.value,
      validFromKai: input.currentKai, expiresAtKai: input.expiresAtKai, nonce: `wildz:wallet:${append.planDigest.value}`,
      parentDigest: null, delegationDepth: 0, maximumDelegationDepth: 0, offline: true,
      operationConstraints: { planDigest: append.planDigest, commitDomain: append.commitDomain }
    } });
  const resolveIssuer = await createReceizCapabilityIssuerResolver({ identityAdmissions: [identity], revokedIssuerKeyIds: new Set() });
  const verifiedCapability = await createReceizCapabilityVerifier({ resolveAdmittedIssuer: resolveIssuer,
    currentKai: input.currentKai, audience: operationPlan.applicationId, revokedCapabilityDigests: revocations(predecessor.proofHistory)
  })(signedCapability, receizArtifactAppendCapabilityContext(append));
  if (!verifiedCapability.ok) fail(verifiedCapability.code);
  const candidate = await sealArtifactTransitionCandidate({ plan: append, capability: verifiedCapability.capability, sealer: input.sealer });
  const [predecessorWire, identityWire, candidateWire] = await Promise.all([
    transportReceizSealedArtifactV124(predecessor.openedArtifact.sealedArtifact),
    transportReceizSealedArtifactV124(identity.openedArtifact.sealedArtifact), transportReceizSealedArtifactV124(candidate.artifact)
  ]);
  const identityProof = await signReceizIdentityLoginProof({ keyFile: input.keyFile,
    challengeText: identityChallenge(identityWire, input.keyFile, append.registryDigest.value),
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {}) });
  return Object.freeze({ schema: "receiz.portable-execution-transition-member.v124", profile: "portable-state",
    participantId: input.participantId, operationPlan,
    planning: { ...input.planning, expectedHead: append.transition.expectedHead }, predecessor: predecessorWire,
    candidate: candidateWire, identityArtifact: identityWire, signedCapability, identityProof,
    authority: { memberIsProofAuthority: false, candidateIsCommitted: false, strongerTruth: "sealed-receiz-proof-object" } as const
  });
}

/** Combines every exact participant and returns the wire set only after the
 * native pinned verifier admits all seals, heads, capabilities and key state. */
export async function combineWildsWalletExecutionSourceMembers(input: Readonly<{
  operationPlan: ReceizOperationPlanV124;
  members: readonly ReceizPortableExecutionTransitionMemberV124[];
  currentKai: string;
}>): Promise<ReceizPortableExecutionTransitionSetV124> {
  const operationPlan = await validateReceizOperationPlanV124(input.operationPlan);
  const members = [...input.members].sort((left, right) => left.participantId.localeCompare(right.participantId));
  const participants = Object.keys(operationPlan.expectedParticipantHeads);
  if (members.length !== participants.length || members.some((member, index) => member.participantId !== participants[index]
    || member.operationPlan.exactPlanDigest !== operationPlan.exactPlanDigest)) fail("PARTICIPANT_SET_MISMATCH");
  // The proposed history heads are derived by the native verifier, never guessed
  // from metadata. Verify each candidate's carried history under pinned roots.
  const admit = createReceizArtifactAdmissionEngine();
  const proposedParticipantHeads: Record<string, string> = {};
  for (const member of members) {
    const candidate = await admit(await openExact(member.candidate), { profile: "portable-state" });
    if (candidate.verdict !== "bearer-recovery" || !candidate.proofHistory?.headDigests[0]) fail("CANDIDATE_ADMISSION_REQUIRED");
    proposedParticipantHeads[member.participantId] = candidate.proofHistory.headDigests[0];
  }
  const set: ReceizPortableExecutionTransitionSetV124 = Object.freeze({ schema: "receiz.portable-execution-transition-set.v124",
    applicationId: operationPlan.applicationId, exactPlanDigest: operationPlan.exactPlanDigest,
    expectedParticipantHeads: operationPlan.expectedParticipantHeads, proposedParticipantHeads, members,
    authority: { transitionSetIsProofAuthority: false, committed: false, strongerTruth: "sealed-receiz-proof-object" } as const });
  await verifyReceizPortableExecutionTransitionSetV124(set, { audience: operationPlan.applicationId });
  return set;
}
