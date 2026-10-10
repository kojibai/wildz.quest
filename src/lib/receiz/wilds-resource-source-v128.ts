import {
  buildReceizCompositeBoundedTree, buildReceizCompositeMerkleParent,
  canonicalizeReceizV122, createReceizDomainAppendCommandsV124,
  createReceizDomainReplaySourceAuthorityV124, createReceizDomainReplaySourceIntentV124,
  createReceizProofAuthorityChallenge, digestReceizCanonicalV122, digestReceizCompositeCanonical,
  prepareReceizDomainReplaySegmentProofObjectCandidateV124, receizBase64UrlDecode, receizBase64UrlEncode,
  receizCompositeFibonacciDistancesUpTo, receizKaiNow, signReceizIdentityLoginProof,
  type ReceizDomainReplayAppendIndexValueV124, type ReceizDomainReplayAppendIndexWitnessV124,
  type ReceizDomainReplayFibonacciWitnessV124, type ReceizDomainReplayProofHeadV124,
  type ReceizDomainReplayReceiptV124, type ReceizDomainReplaySourceAuthoringEvidenceV124,
  type ReceizDomainReplayV124, type ReceizKeyFile, type ReceizPortableSealedArtifactV124,
  type ReceizProofAuthorityV123,
} from "@receiz/sdk";

export const WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128 = Object.freeze([
  "openid", "profile", "receiz:domains.read", "receiz:domains.write", "receiz:record", "receiz:seal", "receiz:subjects.read", "receiz:subjects.write",
] as const);

export type WildsResourceSourceAuthorV128 = Readonly<{
  grant: ReceizProofAuthorityV123;
  keyFile: ReceizKeyFile;
  passphrase?: string;
  ownerReceizId: string;
  actorSubjectId: string;
  actorSubjectHead: string;
}>;

/** Indexes are witnesses, never authority. The SDK checks their roots against
 * the pinned Original before the candidate can be sealed. */
export type WildsResourceSourcePredecessorV128 = Readonly<{
  artifact: ReceizPortableSealedArtifactV124;
  head: ReceizDomainReplayProofHeadV124;
  appendIndex: ReadonlyMap<string, ReceizDomainReplayAppendIndexValueV124>;
  segmentIds: readonly string[];
  sourceArtifactShas: readonly string[];
}>;

export type WildsResourceSourcePageV128 = Readonly<{
  domainId: string;
  registryDigest: string;
  reducerDigest: string;
  genesisHead: string;
  appendId: string;
  event: unknown;
  namespace: unknown;
  namespaceName: string;
  namespaceHead: string;
  predecessor: WildsResourceSourcePredecessorV128 | null;
}>;

const DIGEST = /^[a-f0-9]{64}$/;
const encode = (value: unknown) => new TextEncoder().encode(canonicalizeReceizV122(value));
const fail = (reason: string): never => { throw new Error(`wilds_resource_source_${reason}`); };

function checkAuthor(author: WildsResourceSourceAuthorV128) {
  const grant = author.grant, username = author.keyFile.owner.username?.trim().toLowerCase();
  if (!username || author.ownerReceizId !== `${username}.receiz.id` || grant.keyId !== author.keyFile.keyId) fail("identity_mismatch");
  if (grant.schema !== "receiz.identity.proof-authority.v123" || typeof grant.applicationId !== "string" || !grant.applicationId.trim()
    || !WILDS_RESOURCE_SOURCE_WRITE_SCOPES_V128.every(scope => grant.grantedScopes.includes(scope))) fail("write_authority_required");
  if (![grant.keyId, grant.artifactDigest, grant.authorityDigest, grant.revocationHead, author.actorSubjectHead].every(value => DIGEST.test(value))
    || !/^receiz:subject:[a-f0-9]{64}$/.test(author.actorSubjectId)) fail("authority_coordinates_invalid");
  const now = receizKaiNow().pulse;
  if (grant.issuedAtKai > now || grant.expiresAtKai <= now) fail("authority_expired");
}

// Released V124 sparse append-index wire. Native candidate preparation checks
// every witness below; these calculations confer no custody or source truth.
let emptyHashes: readonly string[] | undefined;
function sparseEmpty() {
  if (emptyHashes) return emptyHashes;
  const hashes = new Array<string>(257);
  hashes[256] = digestReceizCompositeCanonical({ kind: "receiz.domain-replay-append-index-empty-leaf.v124" });
  for (let depth = 255; depth >= 0; depth--) hashes[depth] = buildReceizCompositeMerkleParent(hashes[depth + 1]!, hashes[depth + 1]!);
  emptyHashes = hashes;
  return hashes;
}
const indexKey = (appendId: string) => digestReceizCompositeCanonical({ kind: "receiz.domain-replay-append-index-key.v124", appendId });
function bit(key: string, depth: number) { return (Number.parseInt(key.slice(Math.floor(depth / 8) * 2, Math.floor(depth / 8) * 2 + 2), 16) >> (7 - depth % 8)) & 1; }
type IndexLeaf = Readonly<{ key: string; leaf: string }>;
function subtree(entries: readonly IndexLeaf[], depth: number): string {
  if (entries.length === 0) return sparseEmpty()[depth]!;
  if (depth === 256) { if (entries.length !== 1) fail("append_index_collision"); return entries[0]!.leaf; }
  return buildReceizCompositeMerkleParent(subtree(entries.filter(entry => bit(entry.key, depth) === 0), depth + 1), subtree(entries.filter(entry => bit(entry.key, depth) === 1), depth + 1));
}
function indexWitness(index: ReadonlyMap<string, ReceizDomainReplayAppendIndexValueV124>, appendId: string): ReceizDomainReplayAppendIndexWitnessV124 {
  const key = indexKey(appendId);
  let entries = [...index].map(([id, value]) => ({ key: indexKey(id), leaf: digestReceizCompositeCanonical({ kind: "receiz.domain-replay-append-index-leaf.v124", keyDigest: indexKey(id), appendId: id, eventDigest: value.eventDigest, cursor: value.cursor, newHead: value.newHead }) }));
  const siblings: { depth: number; digest: string }[] = [];
  for (let depth = 0; depth < 256; depth++) {
    const direction = bit(key, depth), digest = subtree(entries.filter(entry => bit(entry.key, depth) !== direction), depth + 1);
    if (digest !== sparseEmpty()[depth + 1]) siblings.push({ depth, digest });
    entries = entries.filter(entry => bit(entry.key, depth) === direction);
  }
  return { schema: "receiz.domain-replay-append-index-witness.v124", appendId, value: index.get(appendId) ?? null, siblings };
}

function fibonacciWitness(segmentIds: readonly string[], position: number, artifactSha256: string): ReceizDomainReplayFibonacciWitnessV124 {
  let remaining = segmentIds.length, offset = 0;
  while (remaining > 0) {
    const peakLevel = Math.floor(Math.log2(remaining)), count = 2 ** peakLevel;
    if (position - 1 < offset + count) {
      const tree = buildReceizCompositeBoundedTree(segmentIds.slice(offset, offset + count));
      return { schema: "receiz.domain-replay-fibonacci-witness.v124", segmentPosition: position, segmentId: segmentIds[position - 1]!, artifactSha256, peakLevel, siblings: tree.witnesses[position - 1 - offset]! };
    }
    offset += count; remaining -= count;
  }
  return fail("fibonacci_history_missing");
}

/** Prepare bytes and device consent only. This never admits inventory/title.
 * Collection/reservation law must first execute against admitted source. The
 * released SDK then supplies the seal and authenticated shared domain CAS. */
export async function prepareWildsResourceSourcePageV128(input: Readonly<{
  authority: WildsResourceSourceAuthorV128;
  page: WildsResourceSourcePageV128;
}>) {
  checkAuthor(input.authority);
  const author = input.authority, APP = author.grant.applicationId, page = structuredClone(input.page), previous = page.predecessor;
  if (![page.genesisHead, page.registryDigest, page.reducerDigest, page.namespaceHead].every(value => DIGEST.test(value))
    || !page.domainId || !page.appendId || !page.namespaceName) fail("page_invalid");
  if (previous && (previous.head.applicationId !== APP || previous.head.domainId !== page.domainId
    || previous.head.registryDigest !== page.registryDigest || previous.head.reducerDigest !== page.reducerDigest
    || previous.head.genesisHead !== page.genesisHead || previous.segmentIds.length !== previous.head.segmentCount
    || previous.sourceArtifactShas.length !== previous.head.segmentCount
    || previous.sourceArtifactShas.at(-1) !== previous.artifact.artifactSha256
    || previous.appendIndex.size !== previous.head.cursor)) fail("predecessor_coordinates_invalid");
  if (previous?.appendIndex.has(page.appendId)) fail("append_duplicate");

  const afterHead = previous?.head.head ?? null, afterCursor = previous?.head.cursor ?? 0;
  const priorHead = afterHead ?? page.genesisHead, cursor = afterCursor + 1;
  const causalParents = previous ? [([...previous.appendIndex].find(([, value]) => value.cursor === afterCursor) ?? fail("causal_parent_missing"))[0]] : [];
  const namespace = { name: page.namespaceName, head: page.namespaceHead, exactBytesB64u: receizBase64UrlEncode(encode(page.namespace)), digest: await digestReceizCanonicalV122(page.namespace) };
  const eventDigest = await digestReceizCanonicalV122(page.event);
  const newHead = await digestReceizCanonicalV122({ schema: "receiz.domain.replay-head.v124", applicationId: APP, domainId: page.domainId, registryDigest: page.registryDigest, reducerDigest: page.reducerDigest, priorHead, appendId: page.appendId, sequence: cursor, cursor, eventDigest, causalParents, namespace: { name: namespace.name, head: namespace.head, digest: namespace.digest } });
  const additions = [{ appendId: page.appendId, sequence: cursor, cursor, exactEventBytesB64u: receizBase64UrlEncode(encode(page.event)), eventDigest, causalParents, priorHead, newHead, namespaceHead: namespace.head, namespaceDigest: namespace.digest }];
  const receiptBasis = { schema: "receiz.domain.replay-receipt.v124" as const, applicationId: APP, domainId: page.domainId, registryDigest: page.registryDigest, reducerDigest: page.reducerDigest, afterHead, priorHead, head: newHead, afterCursor, cursor, namespace: { name: namespace.name, head: namespace.head, digest: namespace.digest }, additionsDigest: await digestReceizCanonicalV122(additions), authority: { receiptIsProofAuthority: false as const, strongerTruth: "sealed-receiz-proof-object" as const } };
  const replayReceipt: ReceizDomainReplayReceiptV124 = { ...receiptBasis, receiptDigest: await digestReceizCanonicalV122(receiptBasis) };
  const replay: ReceizDomainReplayV124 = { schema: "receiz.domain.replay.v124", status: "authenticated", applicationId: APP, domainId: page.domainId, registryDigest: page.registryDigest, reducerDigest: page.reducerDigest, afterHead, afterCursor, cursor, priorHead, head: newHead, namespace, additions, receiptDigest: replayReceipt.receiptDigest, authority: { replayIsProofAuthority: false, strongerTruth: "sealed-receiz-proof-object" } };
  const moment = receizKaiNow(), kai = { pulse: moment.pulse, uPulse: moment.uPulse };
  const insertionWitnesses = [indexWitness(previous?.appendIndex ?? new Map(), page.appendId)];
  const causalParentWitnesses = causalParents.map(id => indexWitness(previous!.appendIndex, id));
  const journalAppends = await createReceizDomainAppendCommandsV124({ replay, replayReceipt, kai, acceptedAtKaiUPulses: [kai.uPulse], externalCausalParentHeads: causalParents.map(appendId => ({ appendId, head: previous!.appendIndex.get(appendId)!.newHead })) });
  const portable = { ownership: { ownerReceizId: author.ownerReceizId, custody: "current" as const, proofRef: "genesis" }, provenance: { root: `profile:${author.keyFile.owner.username!.trim().toLowerCase()}`, appends: [] }, settlement: { state: "none" } };
  const actorSubjectBindingDigest = await digestReceizCanonicalV122({ schema: "receiz.v124.actor-subject-binding", applicationId: APP, ownerReceizId: author.ownerReceizId, keyId: author.grant.keyId });
  const proofHeadBindingDigest = await digestReceizCanonicalV122({ schema: "receiz.v124.proof-head-binding", applicationId: APP, authorityDigest: author.grant.authorityDigest, artifactDigest: author.grant.artifactDigest, revocationHead: author.grant.revocationHead, actorSubjectBindingDigest });
  const sourceAuthority = await createReceizDomainReplaySourceAuthorityV124({ applicationId: APP, audience: APP, domainId: page.domainId, ownerReceizId: author.ownerReceizId, actorSubjectId: author.actorSubjectId, actorSubjectHead: author.actorSubjectHead, v123AuthorityDigest: author.grant.authorityDigest, v123KeyId: author.grant.keyId, v123IdentityArtifactDigest: author.grant.artifactDigest, proofHeadBindingDigest, acceptedHead: replay.head, ownership: portable.ownership, provenance: portable.provenance });
  const sourceIntent = await createReceizDomainReplaySourceIntentV124({ applicationId: APP, audience: APP, domainId: page.domainId, registryDigest: page.registryDigest, reducerDigest: page.reducerDigest, acceptedHead: replay.head, sourceKai: kai, predecessorArtifactSha256: previous?.artifact.artifactSha256 ?? null, replay, replayReceipt, journalAppends, causalParentWitnesses, sourceAuthority, ownership: portable.ownership, provenance: portable.provenance });
  const challenge = createReceizProofAuthorityChallenge({ applicationId: APP, artifactDigest: author.grant.artifactDigest, scopes: author.grant.grantedScopes, consentStatementDigest: sourceIntent.consentStatementDigest, ttlPulses: Math.min(60, author.grant.expiresAtKai - receizKaiNow().pulse) });
  const proof = await signReceizIdentityLoginProof({ keyFile: author.keyFile, challengeText: new TextDecoder().decode(receizBase64UrlDecode(challenge.challengeB64Url)), ...(author.passphrase === undefined ? {} : { passphrase: author.passphrase }) });
  const authoringEvidence: ReceizDomainReplaySourceAuthoringEvidenceV124 = { schema: "receiz.domain-replay-source-authoring-evidence.v124", identity: { schema: "receiz.identity-public-verification.v124", identityArtifactDigest: author.grant.artifactDigest, keyId: author.keyFile.keyId, alg: author.keyFile.alg, publicKeyRawB64u: author.keyFile.crypto.publicKeyRawB64u, authority: { projectionIsIdentityAuthority: false, strongerTruth: "receiz-identity-artifact" } }, signedChallenge: { ...challenge.challenge, proof }, scopes: author.grant.grantedScopes, consentStatementDigest: sourceIntent.consentStatementDigest, authority: { evidenceIsProofAuthority: false, evidenceIsIdentityAuthority: false, grantIsIdentityAuthority: false, strongerTruth: "receiz-identity-artifact" } };

  const segmentIndex = (previous?.head.segmentCount ?? 0) + 1;
  const fibonacci = { basis: "sparse-checkpoint/v1" as const, operationCount: segmentIndex, checkpoints: receizCompositeFibonacciDistancesUpTo(segmentIndex).filter(distance => distance < segmentIndex).map(distance => ({ distance, operationCount: segmentIndex - distance, artifactDigest: previous!.sourceArtifactShas[segmentIndex - distance - 1]! })) };
  const proofObjectId = previous?.head.proofObjectId ?? digestReceizCompositeCanonical({ kind: "receiz.domain-replay-proof-object-id.v124", applicationId: APP, domainId: page.domainId, registryDigest: page.registryDigest, reducerDigest: page.reducerDigest, genesisHead: page.genesisHead });
  const child = { schema: "receiz.domain-replay-page-segment.v124", proofObjectId, segmentIndex, kai, sourceAuthority, authoringEvidence, replay, replayReceipt, journalAppends, insertionWitnesses, causalParentWitnesses, authority: { segmentIsProofAuthority: false, witnessIsProofAuthority: false, strongerTruth: "sealed-receiz-proof-object" } };
  const segmentBytesDigest = await digestReceizCanonicalV122(child);
  const eventRoot = buildReceizCompositeBoundedTree(additions.map(addition => digestReceizCompositeCanonical({ kind: "receiz.domain-replay-segment-event-leaf.v124", appendId: addition.appendId, eventDigest: addition.eventDigest, cursor: addition.cursor, newHead: addition.newHead }))).root;
  const segmentId = digestReceizCompositeCanonical({ kind: "receiz.domain-replay-page-segment-id.v124", proofObjectId, segmentIndex, startCursor: afterCursor, endCursor: cursor, additionCount: 1, eventRoot, segmentBytesDigest });
  const segmentIds = [...(previous?.segmentIds ?? []), segmentId];
  const fibonacciWitnesses = fibonacci.checkpoints.filter(checkpoint => checkpoint.operationCount !== previous?.head.segmentCount && !previous?.head.fibonacci.checkpoints.some(known => known.operationCount === checkpoint.operationCount)).map(checkpoint => fibonacciWitness(segmentIds, checkpoint.operationCount, checkpoint.artifactDigest));
  const candidate = await prepareReceizDomainReplaySegmentProofObjectCandidateV124({ replay, replayReceipt, journalAppends, sourceAuthority, authoringEvidence, kai, predecessorArtifact: previous?.artifact ?? null, insertionWitnesses, causalParentWitnesses, fibonacci, fibonacciWitnesses, portable });
  if (candidate.carrier.head.currentSegment.segmentId !== segmentId) fail("segment_binding_invalid");
  const appendIndex = new Map(previous?.appendIndex ?? []);
  appendIndex.set(page.appendId, { eventDigest, cursor, newHead });
  return { candidate, sourceIntent, replay, replayReceipt, appendIndex, segmentIds };
}
