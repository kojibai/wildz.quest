import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { RECEIZ_V123_REGISTRY_DIGEST, digestReceizCanonicalV122, type ReceizSubjectStateV122 } from "@receiz/sdk";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { admitWildsCreatureSubjectV122, projectWildsCreatureSubjectAdmissionV122 } from "../src/lib/receiz/wilds-v122-subjects";

function card() {
  return admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "builder",
    encounterId: "v122-subject",
    capturedAt: "2026-08-21T12:00:00.000Z"
  }), "2026-08-21T12:00:01.000Z");
}

async function stateFor(projected: Awaited<ReturnType<typeof projectWildsCreatureSubjectAdmissionV122>>) {
  const receiptBasis = {
    schema: "receiz.subject.admission-receipt.v122" as const,
    subjectId: projected.subjectId,
    proofObjectId: "proof:wildz-card",
    admittedProofDigest: projected.admittedProofDigest,
    immutableProofVersion: "wildz.card.v1",
    ownerReceizId: "receiz:builder",
    ownerProofDigest: "1".repeat(64),
    genesisHead: "2".repeat(64),
    registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
    reducerDigest: "3".repeat(64),
    kai: 1,
    idempotencyIdentityDigest: "4".repeat(64),
    authority: { receiptIsProofAuthority: false as const, strongerTruth: "sealed-receiz-proof-object" as const }
  };
  const admissionReceipt = Object.freeze({ ...receiptBasis, receiptDigest: await digestReceizCanonicalV122(receiptBasis) });
  return Object.freeze({
    schema: "receiz.subject.state.v122" as const,
    subjectId: projected.subjectId,
    proofObjectId: admissionReceipt.proofObjectId,
    admittedProofDigest: projected.admittedProofDigest,
    immutableProofVersion: admissionReceipt.immutableProofVersion,
    subjectType: "wildz.creature",
    opaqueNamespaces: [],
    genesisHead: admissionReceipt.genesisHead,
    head: admissionReceipt.genesisHead,
    ownerReceizId: admissionReceipt.ownerReceizId,
    ownershipHead: "5".repeat(64),
    ownerProofDigest: admissionReceipt.ownerProofDigest,
    registryDigest: RECEIZ_V123_REGISTRY_DIGEST,
    reducerDigest: admissionReceipt.reducerDigest,
    admissionReceipt,
    causalParents: [],
    accessKeyHead: null,
    replay: { appendCursor: "genesis", eventCursor: "genesis" },
    authority: { stateIsProofAuthority: false as const, strongerTruth: "sealed-receiz-proof-object" as const },
    stateDigest: "6".repeat(64)
  }) satisfies ReceizSubjectStateV122;
}

describe("Wildz durable v122 creature subjects", () => {
  it("exposes admission only through the authenticated server route and never gameplay frames", () => {
    const route = readFileSync("app/api/wilds/excavation/route.ts", "utf8");
    const play = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
    assert.match(route, /action === "admit-creature-subject"/);
    assert.match(route, /admitWildsCreatureSubjectForRequestV122/);
    assert.doesNotMatch(play, /admitWildsCreatureSubjectV122|admit-creature-subject/);
  });

  it("derives the same subject and semantic idempotency key from exact card bytes", async () => {
    const first = await projectWildsCreatureSubjectAdmissionV122(card(), "receiz:builder");
    const second = await projectWildsCreatureSubjectAdmissionV122(card(), "receiz:builder");
    assert.equal(first.subjectId, second.subjectId);
    assert.equal(first.admittedProofDigest, second.admittedProofDigest);
    assert.equal(first.input.idempotencyKey, second.input.idempotencyKey);
    assert.equal(first.input.expectedAbsent, true);
  });

  it("reuses an exact admitted subject without another write", async () => {
    const projected = await projectWildsCreatureSubjectAdmissionV122(card(), "receiz:builder");
    const state = await stateFor(projected);
    let admissions = 0;
    const resolved = await admitWildsCreatureSubjectV122({
      card: card(), ownerReceizId: "receiz:builder",
      rail: {
        subjectStateV122: async () => state,
        admitSubjectV122: async () => { admissions += 1; throw new Error("must not admit"); }
      }
    });
    assert.equal(resolved, state);
    assert.equal(admissions, 0);
  });

  it("admits once after verified absence and rejects foreign state", async () => {
    const projected = await projectWildsCreatureSubjectAdmissionV122(card(), "receiz:builder");
    const state = await stateFor(projected);
    let reads = 0;
    let writes = 0;
    const resolved = await admitWildsCreatureSubjectV122({
      card: card(), ownerReceizId: "receiz:builder",
      rail: {
        subjectStateV122: async () => {
          reads += 1;
          if (reads === 1) throw Object.assign(new Error("subject not found"), { status: 404 });
          return state;
        },
        admitSubjectV122: async () => {
          writes += 1;
          return {
            ok: true as const,
            subjectId: state.subjectId,
            head: state.head,
            proofDigest: state.admittedProofDigest,
            registryDigest: state.registryDigest,
            reducerDigest: state.reducerDigest,
            receipt: state.admissionReceipt
          };
        }
      }
    });
    assert.equal(resolved, state);
    assert.equal(writes, 1);
    await assert.rejects(admitWildsCreatureSubjectV122({
      card: card(), ownerReceizId: "receiz:foreign",
      rail: { subjectStateV122: async () => state, admitSubjectV122: async () => { throw new Error("unused"); } }
    }), /subject_binding_invalid/);
  });
});
