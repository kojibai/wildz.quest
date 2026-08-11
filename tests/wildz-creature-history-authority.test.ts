import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createCreatureHistoryAdmission,
  verifyCreatureHistoryAdmission
} from "../src/features/play/creature-history";
import type {
  CreatureHistoryAuthorityVerifier,
  CreatureHistoryEventDraft,
  CreatureHistoryKaiCoordinate
} from "../src/features/play/creature-history-types";
import {
  admitLegacyCard,
  appendLivingCardHistory,
  compareLivingCardHistoryHeads,
  verifyLivingCard
} from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";

const BORN_AT = "2026-08-11T12:00:00.000Z";
const EVENT_AT = "2026-08-11T12:10:00.000Z";
const RECEIPT = `sha256:${"a".repeat(64)}`;
const REPLAY = `sha256:${"b".repeat(64)}`;
const VERIFICATION = `sha256:${"c".repeat(64)}`;

function kaiAt(uPulse: number): CreatureHistoryKaiCoordinate {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse, authority: "admitted" });
  return { uPulse, pulse: moment.pulse, beat: moment.beat, stepIndex: moment.stepIndex, weekday: moment.weekday, chakra: moment.chakra, coordinate: moment.coordinate };
}

function livingCard(encounterId = "creature-history-authority") {
  return admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "authority_keeper.receiz.id",
    encounterId,
    capturedAt: BORN_AT
  }), BORN_AT);
}

function localDraft(assetId: string, eventId: string, kai: CreatureHistoryKaiCoordinate): CreatureHistoryEventDraft {
  return {
    eventId,
    rulesetVersion: "wildz.progression.v1",
    occurredAt: EVENT_AT,
    kai,
    source: {
      mode: "training",
      activityId: `training:${eventId}`,
      actorId: "authority_keeper.receiz.id",
      authority: "local"
    },
    evidence: {},
    effects: [{ kind: "progress", xpDelta: 10, growthEvents: [] }]
  };
}

function admittedDraft(
  card: ReturnType<typeof livingCard>,
  eventId: string,
  uPulse: number,
  authority: "admitted" | "verified-receipt" | "canonical" = "verified-receipt"
): CreatureHistoryEventDraft {
  const parentKai = card.manifest.history!.events.at(-1)!.kai;
  const draft: CreatureHistoryEventDraft = {
    ...localDraft(card.id, eventId, kaiAt(uPulse)),
    source: {
      ...localDraft(card.id, eventId, parentKai).source,
      authority
    },
    evidence: { receiptDigest: RECEIPT, replayDigest: REPLAY }
  };
  return {
    ...draft,
    evidence: {
      ...draft.evidence,
      admission: createCreatureHistoryAdmission({
        chain: card.manifest.history!,
        event: draft,
        issuerId: "receiz.arena.admission.v1",
        verificationDigest: VERIFICATION
      })
    }
  };
}

describe("creature-history admitted authority", () => {
  it("rejects promotion by digest shape and requires an exact content-addressed admission", () => {
    const card = livingCard();
    const parentKai = card.manifest.history!.events.at(-1)!.kai;
    const promoted: CreatureHistoryEventDraft = {
      ...localDraft(card.id, "arena:forged-promotion", parentKai),
      source: {
        ...localDraft(card.id, "arena:forged-promotion", parentKai).source,
        authority: "verified-receipt"
      },
      evidence: { receiptDigest: RECEIPT, replayDigest: REPLAY }
    };
    assert.throws(() => appendLivingCardHistory({ asset: card, event: promoted }), /creature_history_authority_admission_required/);

    const admitted = admittedDraft(card, "arena:admitted", parentKai.uPulse + 1);
    assert.equal(verifyCreatureHistoryAdmission(card.manifest.history!, admitted), true);
    assert.equal(verifyLivingCard(appendLivingCardHistory({ asset: card, event: admitted })).ok, true);
  });

  it("binds admission to asset, parent, Kai root, exact effects/projection, receipt, and replay", () => {
    const card = livingCard();
    const parentKai = card.manifest.history!.events.at(-1)!.kai;
    const admitted = admittedDraft(card, "arena:bound", parentKai.uPulse + 1);
    const changedEffects = {
      ...admitted,
      effects: [{ kind: "progress" as const, xpDelta: 11, growthEvents: [] }]
    };
    assert.equal(verifyCreatureHistoryAdmission(card.manifest.history!, changedEffects), false);
    assert.throws(() => appendLivingCardHistory({ asset: card, event: changedEffects }), /creature_history_authority_admission_invalid/);

    const other = livingCard("creature-history-authority-other");
    const copied = { ...admitted, eventId: "arena:copied-to-other-parent" };
    assert.equal(verifyCreatureHistoryAdmission(other.manifest.history!, copied), false);
  });

  it("orders divergent branches by their latest admitted uPulse and never by a local suffix", () => {
    const card = livingCard();
    const parentUPulse = card.manifest.history!.events.at(-1)!.kai.uPulse;
    const lower = appendLivingCardHistory({
      asset: card,
      event: admittedDraft(card, "arena:lower", parentUPulse + 1)
    });
    const higher = appendLivingCardHistory({
      asset: card,
      event: admittedDraft(card, "arena:higher", parentUPulse + 2)
    });
    const localSuffix = appendLivingCardHistory({
      asset: lower,
      event: localDraft(card.id, "local:future-looking", {
        ...kaiAt(parentUPulse + 10_000)
      })
    });
    // A content-valid envelope is deliberately self-constructible for portable
    // local history. It is not an authority grant and cannot resolve a fork.
    assert.throws(
      () => compareLivingCardHistoryHeads(localSuffix, higher),
      /creature_history_authority_untrusted/
    );

    const admittedDigests = new Set([
      lower.manifest.history!.events.at(-1)!.evidence.admission!.digest,
      higher.manifest.history!.events.at(-1)!.evidence.admission!.digest
    ]);
    const verifier: CreatureHistoryAuthorityVerifier = {
      verifyAdmission: ({ envelope }) => admittedDigests.has(envelope.digest)
    };
    assert.equal(compareLivingCardHistoryHeads(localSuffix, higher, verifier), "right");

    const sameSlot = appendLivingCardHistory({
      asset: card,
      event: admittedDraft(card, "arena:same-slot", parentUPulse + 2)
    });
    admittedDigests.add(sameSlot.manifest.history!.events.at(-1)!.evidence.admission!.digest);
    assert.throws(() => compareLivingCardHistoryHeads(higher, sameSlot, verifier), /creature_history_authority_slot_conflict/);
  });

  it("does not let a caller self-mint a higher-uPulse authority grant", () => {
    const card = livingCard("creature-history-self-mint");
    const parentUPulse = card.manifest.history!.events.at(-1)!.kai.uPulse;
    const honest = appendLivingCardHistory({
      asset: card,
      event: admittedDraft(card, "arena:honest", parentUPulse + 1)
    });
    const forged = appendLivingCardHistory({
      asset: card,
      event: admittedDraft(card, "arena:self-minted", parentUPulse + 1_000_000, "canonical")
    });

    assert.throws(
      () => compareLivingCardHistoryHeads(honest, forged),
      /creature_history_authority_untrusted/
    );
    const verifier: CreatureHistoryAuthorityVerifier = {
      verifyAdmission: ({ envelope }) => envelope.digest === honest.manifest.history!.events.at(-1)!.evidence.admission!.digest
    };
    assert.throws(
      () => compareLivingCardHistoryHeads(honest, forged, verifier),
      /creature_history_authority_untrusted/
    );
  });

  it("requires trust for admitted events in a causal descendant suffix", () => {
    const card = livingCard("creature-history-descendant-self-mint");
    const start = card.manifest.history!.events.at(-1)!.kai.uPulse;
    const localChild = appendLivingCardHistory({
      asset: card,
      event: localDraft(card.id, "local:causal-child", kaiAt(start + 1))
    });
    assert.equal(compareLivingCardHistoryHeads(card, localChild), "right");

    const claimedChild = appendLivingCardHistory({
      asset: localChild,
      event: admittedDraft(localChild, "arena:claimed-descendant", start + 2, "canonical")
    });
    assert.throws(
      () => compareLivingCardHistoryHeads(localChild, claimedChild),
      /creature_history_authority_untrusted/
    );
    const trustedDigest = claimedChild.manifest.history!.events.at(-1)!.evidence.admission!.digest;
    assert.equal(compareLivingCardHistoryHeads(localChild, claimedChild, {
      verifyAdmission: ({ envelope }) => envelope.digest === trustedDigest
    }), "right");
  });

  it("rejects a uPulse paired with a forged derived Kai coordinate", () => {
    const card = livingCard("creature-history-kai-forgery");
    const parentKai = card.manifest.history!.events.at(-1)!.kai;
    assert.throws(() => appendLivingCardHistory({
      asset: card,
      event: localDraft(card.id, "local:forged-kai", { ...parentKai, uPulse: parentKai.uPulse + 1_000_000 })
    }), /creature_history_kai_invalid/);
  });
});
