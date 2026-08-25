import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { NextRequest } from "next/server";
import { emptyHearttreeCondition, projectHearttreeCard } from "../src/features/play/hearttree/card-capability";
import { generateHearttreeExpedition } from "../src/features/play/hearttree/expedition-director";
import { createHearttreeRuntime, stepHearttreeRuntime } from "../src/features/play/hearttree/runtime";
import { hearttreeTranscript } from "../src/features/play/hearttree/transcript";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { executeHearttreeAdmission, resetHearttreeAdmissionForTests, type HearttreeAdmissionDependencies } from "../src/lib/receiz/wilds-hearttree-server";

function submitted() {
  const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player.one", encounterId: "server", capturedAt: "2026-07-16T18:00:00.000Z" });
  const condition = emptyHearttreeCondition(card.id);
  const capability = projectHearttreeCard(card, condition);
  const definition = generateHearttreeExpedition({ seed: "server:hearttree", squad: [capability], history: [], mortal: false });
  let state = createHearttreeRuntime(definition, [capability]);
  state = stepHearttreeRuntime(state, { sequence: 1, tick: 1, kind: "dodge", vector: { x: 1, z: 0 }, timingOffsetMs: 0 });
  state = stepHearttreeRuntime(state, { sequence: 2, tick: 2, kind: "extract" });
  return { idempotencyKey: "hearttree-request-0001", cards: [card], priorConditions: { [card.id]: condition }, definition, transcript: hearttreeTranscript(state), mortalConsent: null };
}

function dependencies(options: { practice?: boolean; publish?: boolean; audit?: boolean } = {}) {
  const calls: string[] = [];
  const deps: HearttreeAdmissionDependencies = {
    resolveActor: async () => ({ playerId: "player.one", receizActorId: "player.one", handle: "player.one", practice: options.practice ?? false, accessToken: "token" }),
    publish: async () => { calls.push("publish"); return options.publish === false ? false : true; },
    audit: async () => { calls.push("audit"); return options.audit === false ? false : true; },
    now: () => "2026-07-16T18:10:00.000Z"
  };
  return { deps, calls };
}

const request = {} as NextRequest;

describe("Receiz Hearttree replay admission", () => {
  it("replays and atomically publishes a canonical receipt", async () => {
    resetHearttreeAdmissionForTests();
    const { deps, calls } = dependencies();
    const result = await executeHearttreeAdmission(request, submitted(), deps);
    assert.equal(result.publication.published, true);
    assert.equal(result.publication.mode, "receiz_live");
    assert.equal(result.publication.revision, 1);
    assert.equal(result.receipt?.actorId, "player.one");
    assert.deepEqual(calls, ["publish", "audit"]);
  });

  it("keeps practice outcomes noncanonical", async () => {
    resetHearttreeAdmissionForTests();
    const { deps, calls } = dependencies({ practice: true });
    const result = await executeHearttreeAdmission(request, { ...submitted(), guestId: "guest-00000001" }, deps);
    assert.equal(result.receipt, null);
    assert.equal(result.publication.mode, "local_practice");
    assert.equal(result.preview.cards[Object.keys(result.preview.cards)[0]!]!.xp > 0, true);
    assert.deepEqual(calls, []);
  });

  it("rejects ownership, changed proof pins, and tampered replay", async () => {
    resetHearttreeAdmissionForTests();
    const base = submitted();
    const wrongOwner = dependencies();
    wrongOwner.deps.resolveActor = async () => ({ playerId: "other", receizActorId: "other", handle: "other", practice: false, accessToken: "token" });
    await assert.rejects(() => executeHearttreeAdmission(request, base, wrongOwner.deps), /hearttree_card_owner_invalid/);
    await assert.rejects(() => executeHearttreeAdmission(request, { ...base, definition: { ...base.definition, squadPins: [{ ...base.definition.squadPins[0]!, proofDigest: "sha256:changed" }] } }, dependencies().deps), /hearttree/);
    await assert.rejects(() => executeHearttreeAdmission(request, { ...base, transcript: { ...base.transcript, finalStateDigest: "sha256:changed" } }, dependencies().deps), /hearttree_transcript_digest_invalid/);
  });

  it("returns the same committed result for a duplicate idempotency key", async () => {
    resetHearttreeAdmissionForTests();
    const { deps, calls } = dependencies();
    const body = submitted();
    const first = await executeHearttreeAdmission(request, body, deps);
    const second = await executeHearttreeAdmission(request, body, deps);
    assert.deepEqual(second, first);
    assert.deepEqual(calls, ["publish", "audit"]);
  });

  it("keeps a source-authoritative receipt when publication or audit is unavailable", async () => {
    resetHearttreeAdmissionForTests();
    const body = submitted();
    const afterPublishFailure = await executeHearttreeAdmission(request, body, dependencies({ publish: false }).deps);
    assert.equal(afterPublishFailure.receipt?.actorId, "player.one");
    assert.equal(afterPublishFailure.projection?.revision, 1);
    assert.equal(afterPublishFailure.publication.published, false);

    resetHearttreeAdmissionForTests();
    const afterAuditFailure = await executeHearttreeAdmission(request, body, dependencies({ audit: false }).deps);
    assert.equal(afterAuditFailure.receipt?.actorId, "player.one");
    assert.equal(afterAuditFailure.projection?.revision, 1);
    assert.equal(afterAuditFailure.publication.published, true);
    assert.equal(afterAuditFailure.publication.mode, "receiz_recovery_pending");
  });
});
