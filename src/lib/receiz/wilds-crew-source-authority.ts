import {
  openReceizSubjectSourceFamilyV125,
  readReceizSubjectSourceFamilyMemberV125,
  readReceizTemporalSubjectSourceV125,
  receizBase64UrlDecode,
  type ReceizSubjectSourceFamilyV125,
  type ReceizIdentityLoginProof
} from "@receiz/sdk";
import type { WildsCrewProofObjects, WildsCrewSubjectBindings } from "./wilds-crew-mandate";

/** These hashes select exact carried sources; they do not assert identity or ownership. */
export type WildsCrewSourceSelection = Readonly<{
  currentArtifactSha256: string;
  subjectArtifactSha256: string;
}>;
export type WildsCrewSourceInput = Readonly<{
  family: ReceizSubjectSourceFamilyV125;
  owner: WildsCrewSourceSelection;
  worker: WildsCrewSourceSelection;
}>;

/** Canonical SDK verification of every exact artifact and complete carried predecessor
 * chain. Reads subject identity, ownership and heads from sealed temporal sources.
 * This establishes carried heads, not global currentness: admission must still perform
 * atomic expected-head and revocation checks, including other devices' descendants. */
export async function openWildsCrewSourceAuthority(input: WildsCrewSourceInput) {
  const candidate = structuredClone(input);
  const opened = await openReceizSubjectSourceFamilyV125({ family: candidate.family });
  async function subject(selection: WildsCrewSourceSelection) {
    if (!opened.family.bindings.some(binding => binding.currentArtifactSha256 === selection.currentArtifactSha256
      && binding.subjectArtifactSha256 === selection.subjectArtifactSha256)) throw new Error("crew_source_selection_invalid");
    const member = readReceizSubjectSourceFamilyMemberV125(opened, selection.currentArtifactSha256);
    const sourceMember = readReceizSubjectSourceFamilyMemberV125(opened, selection.subjectArtifactSha256);
    const temporal = await readReceizTemporalSubjectSourceV125(sourceMember.artifact);
    const state = temporal.source.subjectState;
    if (member.verification.continuity.state !== "verified"
      || member.verification.continuity.ownerReceizId !== state.ownerReceizId) throw new Error("crew_source_owner_invalid");
    return { member, temporal, state };
  }
  const owner = await subject(candidate.owner);
  const worker = await subject(candidate.worker);
  if (owner.state.subjectId === worker.state.subjectId || owner.state.ownerReceizId !== worker.state.ownerReceizId)
    throw new Error("crew_worker_ownership_mismatch");
  const file = (member: typeof owner.member) => new File([
    new Uint8Array(receizBase64UrlDecode(member.artifact.exactBytesB64u)).buffer
  ], member.artifact.filename, { type: member.artifact.mimeType });
  const proofs: WildsCrewProofObjects = Object.freeze({ ownerProofObject: file(owner.member), workerProofObject: file(worker.member) });
  return Object.freeze({
    proofs,
    ownerReceizId: owner.state.ownerReceizId,
    /** Kai must be supplied by the admitted current execution coordinate, never Date.now. */
    bindings(currentKai: string): WildsCrewSubjectBindings {
      if (!/^(0|[1-9]\d*)$/.test(currentKai)) throw new Error("crew_current_kai_invalid");
      return Object.freeze({ ownerSubjectId: owner.state.subjectId, workerSubjectId: worker.state.subjectId,
        ownerHead: owner.state.head, workerHead: worker.state.head,
        currentOwnerSubjectId: owner.state.subjectId, currentKai });
    },
    /** A UI boolean is insufficient. The Identity signature signs the exact confirmation
     * digest and SDK source custody proves that signer controls both current sources. */
    async verifyConfirmation(confirmationDigest: string, holderProof: ReceizIdentityLoginProof) {
      if (!/^[a-f0-9]{64}$/.test(confirmationDigest)) return false;
      const proof = structuredClone(holderProof);
      for (const value of [owner, worker]) {
        const history = value.member.verification.verification.bundle.pbiAuthorshipHistory;
        if (!Array.isArray(history) || !history.length || !await opened.verifyPbiAuthorship({
          history, holderReceizId: owner.state.ownerReceizId,
          proofObjectId: value.state.proofObjectId, acceptedHead: value.temporal.head,
          holderProof: proof, challengeDigest: confirmationDigest
        })) return false;
      }
      return true;
    }
  });
}
