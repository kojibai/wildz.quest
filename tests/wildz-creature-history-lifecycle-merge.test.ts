import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeCreatureBranches, sealRetirement } from "../src/features/games/lifecycle/creature-retirement";
import { createCreatureHistoryAdmission } from "../src/features/play/creature-history";
import type { CreatureHistoryAuthorityVerifier, CreatureHistoryEventDraft, CreatureRetirementAuthorityVerifier } from "../src/features/play/creature-history-types";
import {
  admitLegacyCard,
  appendLivingCardHistory,
  currentRevision
} from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";

const BORN_AT = "2026-08-11T15:00:00.000Z";

function kaiAt(uPulse: number) {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse, authority: "admitted" });
  return { uPulse, pulse: moment.pulse, beat: moment.beat, stepIndex: moment.stepIndex, weekday: moment.weekday, chakra: moment.chakra, coordinate: moment.coordinate };
}

function card() {
  return admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "lifecycle_merge.receiz.id",
    encounterId: "lifecycle-history-merge",
    capturedAt: BORN_AT
  }), BORN_AT);
}

function admitted(base: ReturnType<typeof card>, eventId: string, uPulse: number): CreatureHistoryEventDraft {
  const parentKai = base.manifest.history!.events.at(-1)!.kai;
  const event: CreatureHistoryEventDraft = {
    eventId,
    rulesetVersion: "wildz.progression.v1",
    occurredAt: "2026-08-11T15:10:00.000Z",
    kai: kaiAt(uPulse),
    source: {
      mode: "training",
      activityId: `training:${eventId}`,
      actorId: "lifecycle_merge.receiz.id",
      authority: "verified-receipt"
    },
    evidence: {
      receiptDigest: `sha256:${"a".repeat(64)}`,
      replayDigest: `sha256:${"b".repeat(64)}`
    },
    effects: [{ kind: "progress", xpDelta: 10, growthEvents: [] }]
  };
  return {
    ...event,
    evidence: {
      ...event.evidence,
      admission: createCreatureHistoryAdmission({
        chain: base.manifest.history!,
        event,
        issuerId: "receiz.lifecycle.admission.v1",
        verificationDigest: `sha256:${"c".repeat(64)}`
      })
    }
  };
}

describe("creature lifecycle branch reconciliation", () => {
  it("selects causal ancestry first, then the greatest admitted uPulse", () => {
    const base = card();
    const start = base.manifest.history!.events.at(-1)!.kai.uPulse;
    const lower = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:lower", start + 1) });
    const higher = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:higher", start + 2) });
    const trusted = new Set([lower, higher].map((value) => value.manifest.history!.events.at(-1)!.evidence.admission!.digest));
    const verifier: CreatureHistoryAuthorityVerifier = { verifyAdmission: ({ envelope }) => trusted.has(envelope.digest) };
    assert.throws(() => mergeCreatureBranches(lower, higher), /creature_history_authority_untrusted/);
    assert.equal(mergeCreatureBranches(lower, higher, { historyAuthorityVerifier: verifier }).card.proof.digest, higher.proof.digest);

    const child = appendLivingCardHistory({
      asset: lower,
      event: {
        eventId: "branch:local-child",
        rulesetVersion: "wildz.progression.v1",
        occurredAt: "2026-08-11T15:20:00.000Z",
        kai: kaiAt(start + 10_000),
        source: { mode: "training", activityId: "training:child", actorId: "lifecycle_merge.receiz.id", authority: "local" },
        evidence: {},
        effects: [{ kind: "progress", xpDelta: 1, growthEvents: [] }]
      }
    });
    assert.equal(mergeCreatureBranches(lower, child).card.proof.digest, child.proof.digest);
    assert.equal(mergeCreatureBranches(child, higher, { historyAuthorityVerifier: verifier }).card.proof.digest, higher.proof.digest);

    const claimedChild = appendLivingCardHistory({
      asset: child,
      event: admitted(child, "branch:claimed-child", start + 10_001)
    });
    assert.throws(() => mergeCreatureBranches(child, claimedChild), /creature_history_authority_untrusted/);
    trusted.add(claimedChild.manifest.history!.events.at(-1)!.evidence.admission!.digest);
    assert.equal(
      mergeCreatureBranches(child, claimedChild, { historyAuthorityVerifier: verifier }).card.proof.digest,
      claimedChild.proof.digest
    );
  });

  it("fails a same-slot sibling conflict closed and never lets a living branch undo mortality", () => {
    const base = card();
    const start = base.manifest.history!.events.at(-1)!.kai.uPulse;
    const one = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:one", start + 1) });
    const conflict = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:conflict", start + 1) });
    const trusted = new Set([one, conflict].map((value) => value.manifest.history!.events.at(-1)!.evidence.admission!.digest));
    const verifier: CreatureHistoryAuthorityVerifier = { verifyAdmission: ({ envelope }) => trusted.has(envelope.digest) };
    assert.throws(() => mergeCreatureBranches(one, conflict, { historyAuthorityVerifier: verifier }), /creature_history_authority_slot_conflict/);

    const retired = sealRetirement(base, {
      creatureId: base.id,
      previousRevisionDigest: currentRevision(base).digest,
      matchReceiptDigest: `sha256:${"d".repeat(64)}`,
      finalVitality: 0,
      teamOutcome: "defeat",
      retiredAt: "2026-08-11T15:30:00.000Z"
    }, { verified: true, mortalOptIn: true }).card;
    const retirementSeal = currentRevision(retired).growth.life!.retirement!.sealDigest;
    const retirementVerifier: CreatureRetirementAuthorityVerifier = {
      verifyRetirement: (evidence) => evidence.retirementSealDigest === retirementSeal
    };
    const living = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:living-later", start + 99) });
    assert.throws(() => mergeCreatureBranches(living, retired), /creature_retirement_authority_untrusted/);
    assert.throws(() => mergeCreatureBranches(base, retired), /creature_retirement_authority_untrusted/);
    const merged = mergeCreatureBranches(living, retired, { retirementAuthorityVerifier: retirementVerifier });
    assert.equal(merged.status, "retired");
    assert.equal(merged.card.proof.digest, retired.proof.digest);
    assert.equal(
      mergeCreatureBranches(base, retired, { retirementAuthorityVerifier: retirementVerifier }).card.proof.digest,
      retired.proof.digest
    );
  });
});
