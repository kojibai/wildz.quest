import {
  canonicalizeReceizV122, digestReceizCanonicalV122,
  parseReceizPortableAssetDocument, prepareReceizDomainReplaySegmentProofObjectCandidateV124,
  proofAuthorityChallengeBasisV123, readReceizIdentityArtifact, verifyReceizIdentityLoginProof,
  prepareReceizSubjectSourceProofObjectCandidateV124, receizBase64UrlDecode, receizBase64UrlEncode, receizKaiNow,
  serializeReceizPortableAssetDocument, sha256ReceizBytes, transportReceizSealedArtifactV124,
  type ReceizAuthoritySessionV124, type ReceizClient, type ReceizKeyFile,
  type ReceizPortableSealedArtifactV124, type ReceizProofAuthorityChallengeV123,
  type ReceizProofAuthorityV123,
} from "@receiz/sdk";
import type { WildzContinuityDatabase } from "../storage/wildz-indexed-db";
import { prepareWildsPortableDocumentV128 } from "./wilds-portable-document-v128";
import { prepareWildsResourceSourcePageV128, WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128,
  type WildsResourceSourceAuthorV128, type WildsResourceSourcePageV128 } from "./wilds-resource-source-v128";

type Prepared = Awaited<ReturnType<typeof prepareWildsResourceSourcePageV128>>;
type StoredPreparation = Omit<Prepared, "appendIndex"> & { appendIndex: Array<[string, Prepared["appendIndex"] extends Map<string, infer V> ? V : never]> };
type SourceAttempt = Readonly<{
  schema: "wildz.resource-source-attempt.v128";
  ownerReceizId: string;
  attemptId: string;
  requestDigest: string;
  idempotencyKey: string;
  preparation: StoredPreparation;
  predecessorArtifact: ReceizPortableSealedArtifactV124 | null;
  sourceArtifact: ReceizPortableSealedArtifactV124 | null;
}>;
const keyFor = (owner: string, attempt: string) => JSON.stringify(["wildz.resource-source-attempt.v128", owner, attempt]);
const conflict = () => { throw Error("wilds_resource_source_attempt_conflict"); };

export type WildsResourceSourceRecoveryStoreV128 = Readonly<{
  read(owner: string, attempt: string): Promise<SourceAttempt | null>;
  reserve(value: SourceAttempt): Promise<SourceAttempt>;
  retainSource(value: SourceAttempt, source: ReceizPortableSealedArtifactV124): Promise<SourceAttempt>;
}>;

/** Exact source preparation/Original custody in the existing continuity DB.
 * No access token, authority session handle or private signing key is stored. */
export function createWildsResourceSourceRecoveryStoreV128(database: WildzContinuityDatabase): WildsResourceSourceRecoveryStoreV128 {
  return {
    read: (owner, attempt) => database.read("meta", keyFor(owner, attempt)),
    reserve: value => database.transaction(["meta"], "readwrite", async tx => {
      const key = keyFor(value.ownerReceizId, value.attemptId), prior = await tx.get<SourceAttempt>("meta", key);
      if (prior) { if (prior.requestDigest !== value.requestDigest) conflict(); return prior; }
      await tx.put("meta", value, key); return value;
    }),
    retainSource: (value, source) => database.transaction(["meta"], "readwrite", async tx => {
      const key = keyFor(value.ownerReceizId, value.attemptId), prior = await tx.get<SourceAttempt>("meta", key);
      if (!prior || prior.requestDigest !== value.requestDigest || prior.idempotencyKey !== value.idempotencyKey) return conflict();
      if (prior.sourceArtifact && canonicalizeReceizV122(prior.sourceArtifact) !== canonicalizeReceizV122(source)) return conflict();
      const next = { ...prior, sourceArtifact: source }; await tx.put("meta", next, key); return next;
    }),
  };
}

export type WildsResourceSourcePublishResultV128 =
  | Readonly<{ status: "published"; sourceArtifact: ReceizPortableSealedArtifactV124; preparation: Prepared; publication: Awaited<ReturnType<ReceizClient["sources"]["publishSealedSourceV124"]>> }>
  | Readonly<{ status: "pending"; attemptId: string; message: string; retryable: boolean }>;

async function revalidatePreparation(value: SourceAttempt, page: WildsResourceSourcePageV128, applicationId: string) {
  const prepared = value.preparation;
  const bytes = new Uint8Array(prepared.candidate.proofObject.payload.bytes);
  const portable = await parseReceizPortableAssetDocument(JSON.parse(new TextDecoder().decode(bytes)));
  const carrier = JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(portable.payload.bytesBase64Url)));
  if (carrier.schema !== "receiz.domain-replay-segment-proof.v124") throw Error("wilds_resource_source_recovery_invalid");
  const child = JSON.parse(new TextDecoder().decode(receizBase64UrlDecode(carrier.segment.exactSegmentBytesB64u)));
  const addition = child.replay.additions[0];
  if (value.idempotencyKey !== `wildz:resource-source:${value.requestDigest}`
    || child.replay.applicationId !== applicationId || child.replay.domainId !== page.domainId
    || child.replay.registryDigest !== page.registryDigest || child.replay.reducerDigest !== page.reducerDigest
    || carrier.head.genesisHead !== page.genesisHead || child.replay.additions.length !== 1
    || addition.appendId !== page.appendId || addition.exactEventBytesB64u !== receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(page.event)))
    || child.replay.namespace.name !== page.namespaceName || child.replay.namespace.head !== page.namespaceHead
    || child.replay.namespace.exactBytesB64u !== receizBase64UrlEncode(new TextEncoder().encode(canonicalizeReceizV122(page.namespace)))
    || canonicalizeReceizV122(value.predecessorArtifact) !== canonicalizeReceizV122(page.predecessor?.artifact ?? null)
    || child.replay.afterHead !== (page.predecessor?.head.head ?? null)
    || child.replay.afterCursor !== (page.predecessor?.head.cursor ?? 0)) throw Error("wilds_resource_source_recovery_request_mismatch");
  const candidate = await prepareReceizDomainReplaySegmentProofObjectCandidateV124({
    replay: child.replay, replayReceipt: child.replayReceipt, journalAppends: child.journalAppends,
    sourceAuthority: child.sourceAuthority, authoringEvidence: child.authoringEvidence, kai: child.kai,
    predecessorArtifact: value.predecessorArtifact, insertionWitnesses: child.insertionWitnesses,
    causalParentWitnesses: child.causalParentWitnesses, fibonacci: carrier.head.fibonacci,
    fibonacciWitnesses: carrier.fibonacciWitnesses,
    portable: { ownership: portable.ownership, provenance: portable.provenance, settlement: portable.settlement },
  });
  if (await sha256ReceizBytes(bytes) !== await sha256ReceizBytes(candidate.proofObject.payload.bytes)
    || candidate.portableAssetDigest !== prepared.candidate.portableAssetDigest
    || canonicalizeReceizV122(candidate.carrier) !== canonicalizeReceizV122(prepared.candidate.carrier)
    || canonicalizeReceizV122(child.replay) !== canonicalizeReceizV122(prepared.replay)
    || child.sourceAuthority.ownerReceizId !== value.ownerReceizId) throw Error("wilds_resource_source_recovery_invalid");
  return { ...prepared, candidate, appendIndex: new Map(prepared.appendIndex) };
}

function checkSession(authority: WildsResourceSourceAuthorV128, session: ReceizAuthoritySessionV124) {
  if (session.applicationId !== authority.grant.applicationId || session.audience !== authority.grant.applicationId || session.actorSubjectId !== authority.actorSubjectId
    || session.identityKeyId !== authority.keyFile.keyId || session.identityArtifactSha256 !== authority.grant.artifactDigest
    || session.expiresAtKaiUPulse <= receizKaiNow().uPulse) throw Error("wilds_resource_source_authority_session_invalid");
}

/** Authenticated publication is always retried against the actual SDK. A local
 * retained success flag is never accepted as source publication evidence. */
export function createWildsResourceSourceClientV128(input: Readonly<{
  sdk: ReceizClient;
  authority: WildsResourceSourceAuthorV128;
  session: ReceizAuthoritySessionV124;
  recoveryStore: WildsResourceSourceRecoveryStoreV128;
}>) {
  const pending = new Map<string, Promise<WildsResourceSourcePublishResultV128>>();
  const execute = async (request: Readonly<{ attemptId: string; page: WildsResourceSourcePageV128; beforeCommit?: () => Promise<void> }>): Promise<WildsResourceSourcePublishResultV128> => {
    if (!/^[A-Za-z0-9:._-]{6,180}$/.test(request.attemptId)) throw Error("wilds_resource_source_attempt_invalid");
    checkSession(input.authority, input.session);
    const page = structuredClone(request.page), ownerReceizId = input.authority.ownerReceizId;
    // Witness caches are rebuilt/checkable, so only the exact semantic source
    // coordinates belong to this attempt's immutable request binding.
    const requestDigest = await digestReceizCanonicalV122({ schema: "wildz.resource-source-request.v128", ownerReceizId, applicationId: input.authority.grant.applicationId,
      attemptId: request.attemptId, domainId: page.domainId, registryDigest: page.registryDigest, reducerDigest: page.reducerDigest,
      genesisHead: page.genesisHead, appendId: page.appendId, event: page.event, namespace: page.namespace,
      namespaceName: page.namespaceName, namespaceHead: page.namespaceHead, predecessorArtifactSha256: page.predecessor?.artifact.artifactSha256 ?? null });
    let retained = await input.recoveryStore.read(ownerReceizId, request.attemptId);
    if (retained && (retained.schema !== "wildz.resource-source-attempt.v128" || retained.ownerReceizId !== ownerReceizId
      || retained.attemptId !== request.attemptId || retained.requestDigest !== requestDigest)) return conflict();
    if (!retained) {
      const prepared = await prepareWildsResourceSourcePageV128({ authority: input.authority, page });
      retained = await input.recoveryStore.reserve({ schema: "wildz.resource-source-attempt.v128", ownerReceizId,
        attemptId: request.attemptId, requestDigest, idempotencyKey: `wildz:resource-source:${requestDigest}`,
        preparation: { ...prepared, appendIndex: [...prepared.appendIndex] },
        predecessorArtifact: page.predecessor?.artifact ?? null, sourceArtifact: null });
    }
    const prepared = await revalidatePreparation(retained, page, input.authority.grant.applicationId);
    try {
      if (!retained.sourceArtifact) {
        const sealed = await input.sdk.assets.createProofObject(prepared.candidate.proofObject, {
          idempotencyKey: retained.idempotencyKey, filename: `wildz-resource-source-${requestDigest}.receizbundle`,
        });
        const source = await transportReceizSealedArtifactV124(sealed);
        if (source.payloadSha256 !== await sha256ReceizBytes(prepared.candidate.proofObject.payload.bytes)) throw Error("wilds_resource_source_seal_binding_invalid");
        retained = await input.recoveryStore.retainSource(retained, source);
      }
      const sourceArtifact = retained.sourceArtifact!;
      // Gameplay reach/head fences are ephemeral. Recheck after asynchronous
      // proof preparation and durable Original retention, immediately before
      // the source CAS. They never become replay bytes or recovery authority.
      await request.beforeCommit?.();
      const publication = await input.sdk.sources.publishSealedSourceV124({ applicationId: input.authority.grant.applicationId, authoritySessionHandle: input.session.authoritySessionHandle, sourceArtifact });
      if (publication.artifactSha256 !== sourceArtifact.artifactSha256 || publication.sourceKind !== "replay-segment"
        || !["published", "idempotent"].includes(publication.status)) throw Error("wilds_resource_source_publication_unconfirmed");
      return { status: "published", sourceArtifact, preparation: prepared, publication };
    } catch (cause) {
      return { status: "pending", attemptId: request.attemptId,
        message: cause instanceof Error ? cause.message : "wilds_resource_source_publication_pending", retryable: true };
    }
  };
  return {
    publish(request: Readonly<{ attemptId: string; page: WildsResourceSourcePageV128; beforeCommit?: () => Promise<void> }>) {
      const running = pending.get(request.attemptId);
      // Separate requests still pass durable request conflict checks; serialize
      // this client rather than returning another request's apparent success.
      const operation = (running ? running.then(() => execute(request)) : execute(request));
      pending.set(request.attemptId, operation);
      void operation.finally(() => { if (pending.get(request.attemptId) === operation) pending.delete(request.attemptId); }).catch(() => {});
      return operation;
    },
  };
}

/** A lawful non-value actor genesis. The production SDK verifies actual owner,
 * root seal, subject admission, public source and device grant before opening
 * the authority session. No subject ID is synthesized from a player handle. */
export async function openWildsResourceSourceAuthorityV128(input: Readonly<{
  sdk: ReceizClient;
  keyFile: ReceizKeyFile;
  passphrase?: string;
  grant: ReceizProofAuthorityV123;
  identityArtifact: Blob | ArrayBuffer | Uint8Array | string;
  signedGrantChallenge: ReceizProofAuthorityChallengeV123;
}>) {
  const username = input.keyFile.owner.username?.trim().toLowerCase();
  if (!username || input.grant.keyId !== input.keyFile.keyId || !input.grant.applicationId.trim()
    || input.signedGrantChallenge.audience !== input.grant.applicationId || input.signedGrantChallenge.nonce !== input.grant.nonce
    || input.signedGrantChallenge.proof.keyId !== input.keyFile.keyId) throw Error("wilds_resource_source_identity_mismatch");
  if (!WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128.every(scope => input.grant.grantedScopes.includes(scope))) throw Error("wilds_resource_source_write_authority_required");
  const bytes = typeof input.identityArtifact === "string" ? new TextEncoder().encode(input.identityArtifact)
    : input.identityArtifact instanceof Blob ? new Uint8Array(await input.identityArtifact.arrayBuffer())
      : new Uint8Array(input.identityArtifact);
  if (bytes.byteLength > 512 * 1024 || await sha256ReceizBytes(bytes) !== input.grant.artifactDigest) throw Error("wilds_resource_source_identity_artifact_binding_invalid");
  const identity = await readReceizIdentityArtifact(bytes);
  if (identity.crypto.privateKeyPkcs8B64u) throw Error("wilds_resource_source_identity_private_key_forbidden");
  if (identity.keyId !== input.keyFile.keyId || identity.alg !== input.keyFile.alg
    || identity.owner.uid !== input.keyFile.owner.uid || identity.owner.username?.trim().toLowerCase() !== username
    || identity.crypto.publicKeyRawB64u !== input.keyFile.crypto.publicKeyRawB64u) throw Error("wilds_resource_source_identity_artifact_binding_invalid");
  const challenge = input.signedGrantChallenge, now = receizKaiNow().pulse;
  const basis = proofAuthorityChallengeBasisV123({ challenge, applicationId: input.grant.applicationId, artifactDigest: input.grant.artifactDigest, scopes: input.grant.grantedScopes });
  if (!challenge.consent.approved || input.grant.issuedAtKai > now || input.grant.expiresAtKai <= now
    || challenge.issuedAtKai > now || challenge.expiresAtKai <= now
    || new TextDecoder().decode(receizBase64UrlDecode(challenge.proof.challengeB64Url)) !== canonicalizeReceizV122(basis)
    || !await verifyReceizIdentityLoginProof({ keyFile: identity, challengeB64Url: challenge.proof.challengeB64Url, signatureB64Url: challenge.proof.signatureB64Url })) throw Error("wilds_resource_source_identity_challenge_invalid");
  const ownerReceizId = `${username}.receiz.id`;
  const body = { schema: "wildz.resource-source-actor.v128", ownerReceizId, keyId: input.keyFile.keyId,
    identityArtifactDigest: input.grant.artifactDigest, value: "0", authority: "receiz-identity-artifact" };
  const portable = await prepareWildsPortableDocumentV128({ assetType: "proof_object", payload: { bytes: new TextEncoder().encode(canonicalizeReceizV122(body)), mimeType: "application/vnd.wildz.resource-source-actor.v128+json" },
    ownership: { ownerReceizId, custody: "current", proofRef: "genesis" }, provenance: { root: `profile:${username}`, appends: [] }, settlement: { state: "none" } });
  const sealedActor = await input.sdk.assets.createProofObject({ assetType: "proof_object", payload: { bytes: serializeReceizPortableAssetDocument(portable), mimeType: "application/vnd.receiz.portable-asset.v1+json" } },
    { idempotencyKey: `wildz:resource-actor:${input.grant.artifactDigest}`, filename: `wildz-resource-actor-${input.keyFile.keyId}.receizbundle` });
  const admitted = await input.sdk.subjects.admit({ proofObject: sealedActor.artifact, ownerReceizId,
    idempotencyKey: `wildz:resource-actor-admit:${sealedActor.artifactSha256}`, expectedAbsent: true });
  if (!admitted.ok) throw Error(`wilds_resource_source_actor_${admitted.code}`);
  const actorSubject = await input.sdk.subjects.state(admitted.subjectId);
  if (actorSubject.ownerReceizId !== ownerReceizId || actorSubject.admittedProofDigest !== sealedActor.artifactSha256) throw Error("wilds_resource_source_actor_binding_invalid");
  const subjectCandidate = await prepareReceizSubjectSourceProofObjectCandidateV124({ subjectState: actorSubject, portable: {
    ownership: { ownerReceizId, custody: "current", proofRef: actorSubject.admittedProofDigest },
    provenance: { root: `profile:${username}`, appends: [] }, settlement: { state: "none" },
  } });
  const sealedSubject = await input.sdk.assets.createProofObject(subjectCandidate.proofObject,
    { idempotencyKey: `wildz:resource-actor-source:${actorSubject.stateDigest}`, filename: `wildz-resource-subject-${actorSubject.stateDigest}.receizbundle` });
  const subjectSourceArtifact = await transportReceizSealedArtifactV124(sealedSubject);
  await input.sdk.sources.publishSealedSourceV124({ applicationId: input.grant.applicationId, authoritySessionHandle: null, sourceArtifact: subjectSourceArtifact });
  const session = await input.sdk.runtime.openAuthoritySessionV124({ applicationId: input.grant.applicationId, actorSubjectId: actorSubject.subjectId,
    subjectSourceArtifact, proofArtifact: input.identityArtifact, signedChallenge: input.signedGrantChallenge,
    requestedRails: [], requiredNamespaces: [], audience: input.grant.applicationId });
  return { session, subjectSourceArtifact, author: { grant: input.grant, keyFile: input.keyFile,
    ...(input.passphrase === undefined ? {} : { passphrase: input.passphrase }), ownerReceizId, actorSubjectId: actorSubject.subjectId, actorSubjectHead: actorSubject.head } satisfies WildsResourceSourceAuthorV128 };
}
