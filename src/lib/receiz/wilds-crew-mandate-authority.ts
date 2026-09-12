import { digestReceizCanonicalV122, type ReceizClient, type ReceizIdentityLoginProof } from "@receiz/sdk";
import { openWildsCrewSourceAuthority, type WildsCrewSourceInput } from "./wilds-crew-source-authority";
import type { WildsCrewPreparedMandate } from "./wilds-crew-mandate";

export type WildsCrewMandateAppend = Readonly<{
  appendDigest: string;
  acceptedRevocationHead: string;
  acceptedAtKai: string;
}>;
const digest = (value: string) => /^[a-f0-9]{64}$/.test(value);
const zero = (code: string) => ({ ok: false as const, code, writes: 0 as const });

/** SDK transport boundary. Responses remain unverified distribution results; neither a
 * successful issue response nor STATE rows authorize a world transaction. An ambiguous
 * mutation must be recovered through STATE/history, never automatically resubmitted. */
export function createWildsCrewMandateAuthority(client: Pick<ReceizClient, "subjectMandates">) {
  return Object.freeze({
    async state(mandateId: string) {
      if (!mandateId.startsWith("receiz:mandate:")) throw new Error("crew_mandate_id_invalid");
      return Object.freeze({ authority: "unverified-index" as const,
        response: await client.subjectMandates.state({ mandateId }) });
    },
    async issue(input: Readonly<{
      sources: WildsCrewSourceInput;
      prepared: WildsCrewPreparedMandate;
      holderProof: ReceizIdentityLoginProof;
      append: WildsCrewMandateAppend;
    }>) {
      let body: Readonly<Record<string, unknown>>;
      try {
        const candidate = structuredClone(input);
        const { mandate, maximumActions, confirmationDigest } = candidate.prepared;
        const { mandateDigest, ...basis } = mandate;
        if (await digestReceizCanonicalV122(basis) !== mandateDigest
          || !/^[1-9]\d*$/.test(maximumActions)
          || await digestReceizCanonicalV122({ schema: "wildz.crew.mandate-confirmation.v1", mandateDigest, maximumActions }) !== confirmationDigest)
          return zero("crew_confirmation_digest_mismatch");
        if (!digest(candidate.append.appendDigest) || !digest(candidate.append.acceptedRevocationHead)
          || !/^(0|[1-9]\d*)$/.test(candidate.append.acceptedAtKai)) return zero("crew_mandate_append_invalid");
        const source = await openWildsCrewSourceAuthority(candidate.sources);
        const bound = source.bindings(candidate.append.acceptedAtKai);
        if (bound.ownerSubjectId !== mandate.ownerSubjectId || bound.workerSubjectId !== mandate.workerSubjectId
          || bound.ownerHead !== mandate.expectedOwnerHead || bound.workerHead !== mandate.expectedWorkerHead)
          return zero("crew_mandate_source_head_mismatch");
        if (BigInt(bound.currentKai) >= BigInt(mandate.expiresAtKai)) return zero("mandate_expired");
        if (!await source.verifyConfirmation(confirmationDigest, candidate.holderProof)) return zero("crew_owner_confirmation_required");
        body = Object.freeze({ mandate, ...candidate.append, confirmationDigest, maximumActions,
          ownerConfirmationProof: candidate.holderProof, sourceFamily: candidate.sources.family });
      } catch { return zero("crew_mandate_source_verification_failed"); }
      try {
        return Object.freeze({ ok: true as const, status: "submitted-unverified" as const,
          response: await client.subjectMandates.issue(body) });
      } catch { return { ok: false as const, code: "crew_mandate_issue_unknown", writes: "unknown" as const, recoveryRequired: true as const }; }
    },
    /** The revocation request is separately signed: an old issue confirmation cannot
     * revoke a different mandate or replace the currently expected revocation head. */
    async revoke(input: Readonly<{
      sources: WildsCrewSourceInput;
      mandateId: string;
      expectedRevocationHead: string;
      append: WildsCrewMandateAppend;
      holderProof: ReceizIdentityLoginProof;
    }>) {
      let body: Readonly<Record<string, unknown>> & { mandateId: string };
      try {
        const candidate = structuredClone(input);
        if (!candidate.mandateId.startsWith("receiz:mandate:") || !digest(candidate.expectedRevocationHead)
          || !digest(candidate.append.appendDigest) || !digest(candidate.append.acceptedRevocationHead)) return zero("crew_mandate_append_invalid");
        const source = await openWildsCrewSourceAuthority(candidate.sources);
        const bound = source.bindings(candidate.append.acceptedAtKai);
        const request = { schema: "wildz.crew.mandate-revocation.v1", mandateId: candidate.mandateId,
          ownerSubjectId: bound.ownerSubjectId, workerSubjectId: bound.workerSubjectId,
          expectedOwnerHead: bound.ownerHead, expectedWorkerHead: bound.workerHead,
          expectedRevocationHead: candidate.expectedRevocationHead, ...candidate.append };
        const confirmationDigest = await digestReceizCanonicalV122(request);
        if (!await source.verifyConfirmation(confirmationDigest, candidate.holderProof)) return zero("crew_owner_confirmation_required");
        body = { ...request, confirmationDigest, ownerConfirmationProof: candidate.holderProof, sourceFamily: candidate.sources.family };
      } catch { return zero("crew_mandate_source_verification_failed"); }
      try {
        return Object.freeze({ ok: true as const, status: "submitted-unverified" as const,
          response: await client.subjectMandates.revoke(body) });
      } catch { return { ok: false as const, code: "crew_mandate_revoke_unknown", writes: "unknown" as const, recoveryRequired: true as const }; }
    }
  });
}
