import {
  createReceizArtifactAdmissionEngine, readReceizIdentityArtifact, readReceizIdentityPublicBinding,
  createReceizClient,
  receizBase64UrlDecode, signReceizIdentityLoginProof, verifyReceizArtifact, verifyReceizIdentityPortableStateProof,
  serializeReceizIdentityArtifact,
  type ReceizIdentityLoginProof, type ReceizKeyFile, type ReceizPortableSealedArtifactV124,
} from "@receiz/sdk";
import { defaultContinuityDatabase, defaultIdentityRepository } from "@/lib/receiz/wildz-active-identity";
import { createWildzIdentityAuthorizationArtifact } from "@/lib/receiz/wildz-identity-authorization-artifact";
import { createWildzArtifactHistory } from "@/lib/receiz/wildz-artifact-history";
import { createWildzProofSourceRepository } from "@/lib/receiz/wildz-proof-source-repository";
import { readWildzIdentityForSigning } from "@/lib/receiz/wildz-identity-signing-read";
import { parseWildzPlayerCoordinate, sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { admitWildsWalletStagedTradeApproval } from "./wilds-wallet-staged-trade-recovery";
import { canonicalPortableCardJson } from "../portable-card";
import { wildsWalletStagedTradeApprovalChallenge, type WildsWalletStagedTradeApproval, type WildsWalletStagedTradeBinding, type WildsWalletStagedTradeChallenge, type WildsWalletStagedTradePlan } from "./wilds-wallet-staged-trade-types";

export type WildsWalletStagedTradeIdentityEvidence = Readonly<{
  schema: "wildz.wallet.staged-trade-identity-proof.v1";
  original: ReceizPortableSealedArtifactV124;
  proof: ReceizIdentityLoginProof;
  approvalWitness: ReceizPortableSealedArtifactV124;
}>;
export type WildsWalletStagedTradeAdmittedIdentity = WildsWalletStagedTradeBinding & Readonly<{ ownerReceizId: string; publicKeyRawB64u: string; alg: ReceizIdentityLoginProof["alg"]; approvalKai: string }>;
const MAX_ORIGINAL_BYTES = 512 * 1024;
const SHA = /^[a-f0-9]{64}$/;
const equalKeys = (left: ReceizKeyFile, right: ReceizKeyFile) => left.keyId === right.keyId && left.alg === right.alg && left.owner.uid === right.owner.uid && left.crypto.publicKeyRawB64u === right.crypto.publicKeyRawB64u;

async function openOriginal(original: ReceizPortableSealedArtifactV124) {
  if (!original || Object.keys(original).sort().join(",") !== "artifactSha256,exactBytesB64u,filename,mimeType,payloadSha256,schema"
    || original.schema !== "receiz.sealed-artifact-bytes.v124" || !SHA.test(original.artifactSha256) || !SHA.test(original.payloadSha256)
    || typeof original.exactBytesB64u !== "string" || !/^[A-Za-z0-9_-]+$/.test(original.exactBytesB64u) || original.exactBytesB64u.length > Math.ceil(MAX_ORIGINAL_BYTES * 4 / 3)
    || typeof original.filename !== "string" || !original.filename || original.filename.length > 256 || typeof original.mimeType !== "string" || !original.mimeType || original.mimeType.length > 128) throw Error("An exact, bounded Identity Seal Original is required for peer consent.");
  const bytes = receizBase64UrlDecode(original.exactBytesB64u);
  const verification = await verifyReceizArtifact(new File([bytes.slice().buffer], original.filename, { type: original.mimeType }));
  if (verification.status !== "verified-artifact" || verification.artifactDigest.value !== original.artifactSha256 || verification.payloadDigest.value !== original.payloadSha256) throw Error("The Identity Seal Original could not be verified by Receiz.");
  // Sharing a recovery export containing a local plaintext key would expose the signer.
  const identity = await readReceizIdentityArtifact(bytes);
  if (identity.crypto.privateKeyPkcs8B64u) throw Error("This recovery Original contains a private key. Use an encrypted Identity Seal Original for peer consent.");
  return { verification, identity };
}

/** Exact source bytes and the actual SDK identity admission establish the peer,
 * while the signed challenge is consent only. No application-issued verdict is carried. */
export async function verifyWildsWalletStagedTradeIdentityApproval(approval: WildsWalletStagedTradeApproval, plan: WildsWalletStagedTradePlan): Promise<WildsWalletStagedTradeAdmittedIdentity> {
  const identity = await verifyWildsWalletStagedTradeIdentityConsent(approval, plan);
  const raw = approval.evidence as WildsWalletStagedTradeIdentityEvidence;
  if (Object.keys(raw).sort().join(",") !== "approvalWitness,original,proof,schema" || !raw.approvalWitness) throw Error("The exact SDK-root-sealed approval witness is required.");
  const witness = raw.approvalWitness;
  if (witness.schema !== "receiz.sealed-artifact-bytes.v124" || typeof witness.exactBytesB64u !== "string" || witness.exactBytesB64u.length > 2_000_000) throw Error("The exact SDK approval witness is required.");
  const opened = await createReceizClient({ fetchImpl: async () => { throw Error("Trade proof verification cannot request authority from the network."); } }).artifacts.verifyAndOpen(new File([receizBase64UrlDecode(witness.exactBytesB64u).slice().buffer], witness.filename, { type: witness.mimeType }));
  const { approvalWitness: _witness, ...evidence } = raw;
  const exact = new TextEncoder().encode(canonicalPortableCardJson({ ...approval, evidence }));
  const bundle = opened.sealedArtifact.verification.bundle;
  const kai = bundle?.kaiPulseEternal;
  if (opened.legacyCompatibility !== "current-native" || opened.sealedArtifact.artifactSha256 !== witness.artifactSha256 || opened.sealedArtifact.payloadSha256 !== witness.payloadSha256
    || opened.sealedArtifact.continuity.ownerReceizId !== approval.ownerHandle || opened.sealedArtifact.continuity.signatureVersion !== 4
    || typeof kai !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(kai) || opened.verifiedPayload.mimeType !== "application/json"
    || opened.verifiedPayload.bytes.length !== exact.length || opened.verifiedPayload.bytes.some((byte, index) => byte !== exact[index])) throw Error("The native approval witness does not carry this exact device consent.");
  return Object.freeze({ ...identity, approvalKai: kai });
}

/** Identity consent only. The caller must independently qualify a native sealed
 * witness before using this result to advance any trade leg. */
export async function verifyWildsWalletStagedTradeIdentityConsent(approval: WildsWalletStagedTradeApproval, plan: WildsWalletStagedTradePlan): Promise<Omit<WildsWalletStagedTradeAdmittedIdentity, "approvalKai">> {
  const admitted = admitWildsWalletStagedTradeApproval(approval, plan);
  const raw = admitted.evidence as WildsWalletStagedTradeIdentityEvidence;
  if (!raw || !["original,proof,schema", "approvalWitness,original,proof,schema"].includes(Object.keys(raw).sort().join(",")) || raw.schema !== "wildz.wallet.staged-trade-identity-proof.v1") throw Error("The exact Identity Seal consent proof is required.");
  const { verification, identity } = await openOriginal(raw.original);
  if (raw.original.artifactSha256 !== admitted.identityArtifactDigest || identity.keyId !== admitted.keyId || !sameWildzPlayerCoordinate(identity.owner.username ?? "", admitted.ownerHandle)) throw Error("The trade approval belongs to a different Identity Seal.");
  const challenge = wildsWalletStagedTradeApprovalChallenge(plan, admitted);
  const result = await createReceizArtifactAdmissionEngine()(verification, {
    profile: "identity", actorConstraint: identity.owner.uid,
    identityExactChallenge: challenge.exactChallenge, identityProof: raw.proof,
  });
  if (result.verdict !== "canonical-identity" || result.profile !== "identity") throw Error("Receiz denied the peer's exact Identity Seal consent.");
  const binding = await readReceizIdentityPublicBinding(result);
  if (!binding || binding.keyId !== admitted.keyId || binding.actorId !== identity.owner.uid || binding.publicKeyRawB64u !== identity.crypto.publicKeyRawB64u) throw Error("The admitted peer key does not match the consent proof.");
  if (binding.alg !== "Ed25519" && binding.alg !== "P-256") throw Error("The admitted peer key algorithm is unsupported.");
  return Object.freeze({ ownerHandle: admitted.ownerHandle, keyId: admitted.keyId, identityArtifactDigest: admitted.identityArtifactDigest, ownerReceizId: binding.actorId, publicKeyRawB64u: binding.publicKeyRawB64u, alg: binding.alg });
}

/** An encrypted copy of the SAME signing identity; signed account bytes are
 * preserved. The discarded wrapping password never leaves this device. */
export async function createSafeWildsWalletStagedTradeIdentityExport(key: ReceizKeyFile): Promise<ReceizKeyFile> {
  if (await verifyReceizIdentityPortableStateProof(key) !== "verified") throw Error("The signed account state is required for the Identity Seal Original.");
  const account = (key.portableState?.snapshot as { account?: { userId?: unknown; username?: unknown } } | null)?.account;
  if (account?.userId !== key.owner.uid || !sameWildzPlayerCoordinate(String(account.username ?? ""), key.owner.username ?? "")) throw Error("The signed account state does not match this Explorer.");
  const wrapped = await readReceizIdentityArtifact((await createWildzIdentityAuthorizationArtifact(key)).artifact);
  const safe = { ...wrapped, portableState: structuredClone(key.portableState), attestation: structuredClone(key.attestation) };
  if (safe.crypto.privateKeyPkcs8B64u || !equalKeys(safe, key) || await verifyReceizIdentityPortableStateProof(safe) !== "verified"
    || serializeReceizIdentityArtifact(safe).length > MAX_ORIGINAL_BYTES) throw Error("An exact bounded public Identity Seal export is required.");
  return safe;
}

const identitySourceKey = (keyId: string, ownerHandle: string) => `wildz:staged-trade:identity-original:${ownerHandle}:${keyId}`;
const approvalDraftKey = (ownerHandle: string, approvalId: string) => `wildz:staged-trade:approval-draft:${ownerHandle}:${approvalId}`;
const approvalWitnessKey = (ownerHandle: string, approvalId: string) => `wildz:staged-trade:approval-witness:${ownerHandle}:${approvalId}`;
async function retainApproval(key: string, approval: WildsWalletStagedTradeApproval) {
  await defaultContinuityDatabase.transaction(["meta"], "readwrite", tx => tx.put("meta", structuredClone(approval), key));
  const recovered = await defaultContinuityDatabase.read<WildsWalletStagedTradeApproval>("meta", key);
  if (canonicalPortableCardJson(recovered) !== canonicalPortableCardJson(approval)) throw Error("The exact device approval could not be saved. No trade leg was started.");
}
async function prepareSafeHeldIdentityOriginal(keyId: string, ownerHandle: string) {
  const session = await defaultIdentityRepository.active();
  if (!session || session.keyId !== keyId || !sameWildzPlayerCoordinate(session.username ?? "", ownerHandle)) throw Error("Unlock the matching Explorer before approving this trade.");
  return defaultIdentityRepository.withKeyFile(keyId, async key => {
    const safe = await createSafeWildsWalletStagedTradeIdentityExport(key);
    const { createWildzIdentitySealPng } = await import("@/lib/receiz/wildz-identity-seal");
    const { prepareWildzGameImage } = await import("@/lib/receiz/wildz-game-image-export");
    const payload = await createWildzIdentitySealPng(safe, session);
    const sealed = await prepareWildzGameImage({ bytes: payload, filename: `wildz-trade-identity-${keyId}.png`, kind: "identity" });
    const verification = await verifyReceizArtifact(new File([sealed.bytes.slice().buffer], sealed.filename, { type: sealed.mimeType }));
    if (verification.status !== "verified-artifact") throw Error("Receiz could not verify the safely encrypted Identity Seal Original.");
    const challengeText = `WILDZ-STAGED-IDENTITY-SOURCE-V1\n${verification.artifactDigest.value}\n${keyId}\n${ownerHandle}`;
    const proof = await signReceizIdentityLoginProof({ keyFile: key, challengeText });
    const admitted = await createReceizArtifactAdmissionEngine()(verification, { profile: "identity", actorConstraint: key.owner.uid, identityExactChallenge: challengeText, identityProof: proof });
    if (admitted.verdict !== "canonical-identity" || (await readReceizIdentityPublicBinding(admitted)).keyId !== keyId) throw Error("Receiz denied the encrypted Identity Seal's existing account binding.");
    const sources = createWildzProofSourceRepository(defaultContinuityDatabase);
    const retained = await sources.retain({ bytes: sealed.bytes, filename: sealed.filename, mimeType: sealed.mimeType });
    await defaultContinuityDatabase.transaction(["meta"], "readwrite", tx => tx.put("meta", retained.artifactSha256, identitySourceKey(keyId, ownerHandle)));
    const recovered = await sources.read(retained.artifactSha256);
    if (!recovered || !equalKeys((await openOriginal(recovered.artifact)).identity, key)) throw Error("The exact approved Identity Seal could not be saved.");
    return recovered.artifact;
  });
}

/** Select existing root-sealed source bytes, never manufacture a replacement
 * identity from a wallet projection. Called only when the trade is opened. */
export async function readHeldWildsWalletStagedTradeIdentityOriginal(keyId: string, ownerHandle: string): Promise<ReceizPortableSealedArtifactV124> {
  const key = await readWildzIdentityForSigning(keyId);
  if (key.keyId !== keyId || !sameWildzPlayerCoordinate(key.owner.username ?? "", ownerHandle)) throw Error("Unlock the matching Explorer before reviewing this trade.");
  const sources = createWildzProofSourceRepository(defaultContinuityDatabase);
  const retainedSha = await defaultContinuityDatabase.read<string>("meta", identitySourceKey(keyId, ownerHandle));
  if (retainedSha) {
    const retained = await sources.read(retainedSha);
    if (!retained || !equalKeys((await openOriginal(retained.artifact)).identity, key)) throw Error("The saved Identity Seal Original changed. Reopen this trade.");
    return retained.artifact;
  }
  for (const entry of await createWildzArtifactHistory(defaultContinuityDatabase).list()) {
    if (entry.artifactBytes.byteLength > MAX_ORIGINAL_BYTES || !sameWildzPlayerCoordinate(entry.ownerReceizId, ownerHandle)) continue;
    try {
      const original = await sources.read(entry.artifactSha256);
      if (original && equalKeys((await openOriginal(original.artifact)).identity, key)) {
        await defaultContinuityDatabase.transaction(["meta"], "readwrite", tx => tx.put("meta", original.artifact.artifactSha256, identitySourceKey(keyId, ownerHandle)));
        return original.artifact;
      }
    } catch { /* Another kind of held artifact is not an identity source. */ }
  }
  return prepareSafeHeldIdentityOriginal(keyId, ownerHandle);
}

export async function prepareWildsWalletStagedTradeIdentity(input: {
  keyId: string; ownerHandle: string;
  loadOriginal?: () => Promise<ReceizPortableSealedArtifactV124>;
  loadSigningKey?: () => Promise<ReceizKeyFile>;
  passphrase?: string;
  fetcher?: typeof fetch;
}) {
  const ownerHandle = parseWildzPlayerCoordinate(input.ownerHandle)?.profileHandle;
  if (!ownerHandle) throw Error("The verified Explorer identity is required.");
  const original = structuredClone(await (input.loadOriginal?.() ?? readHeldWildsWalletStagedTradeIdentityOriginal(input.keyId, ownerHandle)));
  const { identity } = await openOriginal(original);
  const key = await (input.loadSigningKey?.() ?? readWildzIdentityForSigning(input.keyId));
  if (!equalKeys(identity, key) || key.keyId !== input.keyId || !sameWildzPlayerCoordinate(identity.owner.username ?? "", ownerHandle)) throw Error("The held Identity Seal does not match this Explorer's device key.");
  const binding: WildsWalletStagedTradeBinding = Object.freeze({ ownerHandle, keyId: input.keyId, identityArtifactDigest: original.artifactSha256 });
  return {
    binding,
    async signApproval({ plan, challenge }: { plan: WildsWalletStagedTradePlan; challenge: WildsWalletStagedTradeChallenge }) {
      const sourceHeads = (JSON.parse(challenge.exactChallenge) as { sourceHeads: WildsWalletStagedTradeApproval["sourceHeads"] }).sourceHeads;
      if (wildsWalletStagedTradeApprovalChallenge(plan, { ...binding, sourceHeads }).exactChallenge !== challenge.exactChallenge) throw Error("Review this exact staged agreement before signing.");
      const active = await (input.loadSigningKey?.() ?? readWildzIdentityForSigning(input.keyId));
      if (!equalKeys(identity, active)) throw Error("The verified Explorer identity changed.");
      const witnessKey = approvalWitnessKey(ownerHandle, challenge.approvalId);
      const retainedWitness = await defaultContinuityDatabase.read<WildsWalletStagedTradeApproval>("meta", witnessKey);
      if (retainedWitness) {
        if (wildsWalletStagedTradeApprovalChallenge(plan, retainedWitness).exactChallenge !== challenge.exactChallenge) throw Error("The saved approval belongs to a different exact source.");
        await verifyWildsWalletStagedTradeIdentityApproval(retainedWitness, plan);
        return Object.freeze(retainedWitness);
      }
      const draftKey = approvalDraftKey(ownerHandle, challenge.approvalId);
      let approval = await defaultContinuityDatabase.read<WildsWalletStagedTradeApproval>("meta", draftKey);
      if (!approval) {
        const proof = await signReceizIdentityLoginProof({ keyFile: active, challengeText: challenge.exactChallenge, ...(input.passphrase === undefined ? {} : { passphrase: input.passphrase }) });
        approval = Object.freeze({ schema: "wildz.wallet.staged-trade-approval.v1", tradeId: plan.tradeId, approvalId: challenge.approvalId, ...binding, sourceHeads: structuredClone(sourceHeads), evidence: { schema: "wildz.wallet.staged-trade-identity-proof.v1", original: structuredClone(original), proof } });
        // Persist the exact signature before the SDK creates its witness. A
        // lost seal reply must replay the same ECDSA bytes and idempotency key.
        await retainApproval(draftKey, approval);
      }
      if (wildsWalletStagedTradeApprovalChallenge(plan, approval).exactChallenge !== challenge.exactChallenge) throw Error("The saved approval belongs to a different exact source.");
      await verifyWildsWalletStagedTradeIdentityConsent(approval, plan);
      const response = await (input.fetcher ?? fetch)("/api/wilds/wallet/trade/approval", { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(120_000), body: JSON.stringify({ plan, approval }) });
      const result = await response.json() as { original?: ReceizPortableSealedArtifactV124 };
      if (!response.ok || !result.original) throw Error("The native exact-approval witness could not be saved. No trade leg was started.");
      const witnessed = { ...approval, evidence: { ...(approval.evidence as object), approvalWitness: result.original } };
      await verifyWildsWalletStagedTradeIdentityApproval(witnessed, plan);
      await retainApproval(witnessKey, witnessed);
      return Object.freeze(witnessed);
    },
  };
}
