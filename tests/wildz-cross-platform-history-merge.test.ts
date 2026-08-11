import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealRetirement } from "../src/features/games/lifecycle/creature-retirement";
import { createCreatureHistoryAdmission } from "../src/features/play/creature-history";
import type { CreatureHistoryAuthorityVerifier, CreatureHistoryEventDraft, CreatureRetirementAuthorityVerifier } from "../src/features/play/creature-history-types";
import {
  admitLegacyCard,
  appendLivingCardHistory,
  currentRevision
} from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { extractVerifiedWildzCards } from "../src/lib/receiz/wildz-cross-platform-cards";
import { deriveKaiKlokMomentFromUPulse } from "../src/features/play/kai-klok-moment";

const BORN_AT = "2026-08-11T14:00:00.000Z";
const EVENT_AT = "2026-08-11T14:10:00.000Z";

function kaiAt(uPulse: number) {
  const moment = deriveKaiKlokMomentFromUPulse({ uPulse, authority: "admitted" });
  return { uPulse, pulse: moment.pulse, beat: moment.beat, stepIndex: moment.stepIndex, weekday: moment.weekday, chakra: moment.chakra, coordinate: moment.coordinate };
}

function card() {
  return admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "portable_merge.receiz.id",
    encounterId: "portable-history-merge",
    capturedAt: BORN_AT
  }), BORN_AT);
}

function draft(assetId: string, eventId: string, uPulse: number): CreatureHistoryEventDraft {
  const parentKai = card().manifest.history!.events.at(-1)!.kai;
  return {
    eventId,
    rulesetVersion: "wildz.progression.v1",
    occurredAt: EVENT_AT,
    kai: kaiAt(uPulse),
    source: {
      mode: "training",
      activityId: `training:${eventId}`,
      actorId: "portable_merge.receiz.id",
      authority: "local"
    },
    evidence: {},
    effects: [{ kind: "progress", xpDelta: 10, growthEvents: [] }]
  };
}

function admitted(base: ReturnType<typeof card>, eventId: string, uPulse: number) {
  const event: CreatureHistoryEventDraft = {
    ...draft(base.id, eventId, uPulse),
    source: { ...draft(base.id, eventId, uPulse).source, authority: "verified-receipt" },
    evidence: {
      receiptDigest: `sha256:${"a".repeat(64)}`,
      replayDigest: `sha256:${"b".repeat(64)}`
    }
  };
  return {
    ...event,
    evidence: {
      ...event.evidence,
      admission: createCreatureHistoryAdmission({
        chain: base.manifest.history!,
        event,
        issuerId: "receiz.portable.admission.v1",
        verificationDigest: `sha256:${"c".repeat(64)}`
      })
    }
  } satisfies CreatureHistoryEventDraft;
}

function extract(
  assets: unknown[],
  historyAuthorityVerifier?: CreatureHistoryAuthorityVerifier,
  retirementAuthorityVerifier?: CreatureRetirementAuthorityVerifier
) {
  return extractVerifiedWildzCards({
    pngBasis: null,
    verifiedPortableSnapshot: assets,
    restoredVaultFiles: [],
    historyAuthorityVerifier,
    retirementAuthorityVerifier
  }).assets;
}

describe("cross-platform card history reconciliation", () => {
  it("selects a divergent card only by its latest admitted uPulse", () => {
    const base = card();
    const start = base.manifest.history!.events.at(-1)!.kai.uPulse;
    const lower = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:lower", start + 1) });
    const higher = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:higher", start + 2) });
    const localSuffix = appendLivingCardHistory({
      asset: lower,
      event: draft(base.id, "branch:local-suffix", start + 10_000)
    });
    assert.throws(() => extract([localSuffix, higher]), /wildz_restore_duplicate_card_conflict/);
    const trusted = new Set([lower, higher].map((value) => value.manifest.history!.events.at(-1)!.evidence.admission!.digest));
    const restored = extract([localSuffix, higher], {
      verifyAdmission: ({ envelope }) => trusted.has(envelope.digest)
    });
    assert.equal(restored.length, 1);
    assert.equal(restored[0]!.proof.digest, higher.proof.digest);
  });

  it("keeps causal descendants and fails same-slot or wholly local siblings closed", () => {
    const base = card();
    const start = base.manifest.history!.events.at(-1)!.kai.uPulse;
    const parent = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:parent", start + 1) });
    const descendant = appendLivingCardHistory({ asset: parent, event: draft(base.id, "branch:child", start + 2) });
    assert.equal(extract([descendant, parent])[0]!.proof.digest, descendant.proof.digest);

    const claimedDescendant = appendLivingCardHistory({
      asset: descendant,
      event: admitted(descendant, "branch:claimed-descendant", start + 3)
    });
    assert.throws(() => extract([parent, claimedDescendant]), /wildz_restore_duplicate_card_conflict/);
    const trustedDescendantDigest = claimedDescendant.manifest.history!.events.at(-1)!.evidence.admission!.digest;
    assert.equal(extract([parent, claimedDescendant], {
      verifyAdmission: ({ envelope }) => envelope.digest === trustedDescendantDigest
    })[0]!.proof.digest, claimedDescendant.proof.digest);

    const legacyBase = sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "portable_merge.receiz.id",
      encounterId: "portable-history-merge",
      capturedAt: BORN_AT
    });
    assert.throws(() => extract([legacyBase, claimedDescendant]), /wildz_restore_duplicate_card_conflict/);
    const trustedLegacySuffix = new Set(claimedDescendant.manifest.history!.events
      .map((event) => event.evidence.admission?.digest)
      .filter((digest): digest is string => Boolean(digest)));
    assert.equal(extract([legacyBase, claimedDescendant], {
      verifyAdmission: ({ envelope }) => trustedLegacySuffix.has(envelope.digest)
    })[0]!.proof.digest, claimedDescendant.proof.digest);

    const sameSlot = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:conflict", start + 1) });
    assert.throws(() => extract([parent, sameSlot]), /wildz_restore_duplicate_card_conflict/);

    const localOne = appendLivingCardHistory({ asset: base, event: draft(base.id, "local:one", start + 1) });
    const localTwo = appendLivingCardHistory({ asset: base, event: draft(base.id, "local:two", start + 2) });
    assert.throws(() => extract([localOne, localTwo]), /wildz_restore_duplicate_card_conflict/);
  });

  it("never lets a divergent living import undo a verified retired card", () => {
    const base = card();
    const start = base.manifest.history!.events.at(-1)!.kai.uPulse;
    const retired = sealRetirement(base, {
      creatureId: base.id,
      previousRevisionDigest: currentRevision(base).digest,
      matchReceiptDigest: `sha256:${"d".repeat(64)}`,
      finalVitality: 0,
      teamOutcome: "defeat",
      retiredAt: "2026-08-11T14:30:00.000Z"
    }, { verified: true, mortalOptIn: true }).card;
    const living = appendLivingCardHistory({ asset: base, event: admitted(base, "branch:living-later", start + 99) });
    assert.throws(() => extract([retired]), /wildz_restore_retirement_authority_untrusted/);
    assert.throws(() => extract([base, retired]), /wildz_restore_retirement_authority_untrusted/);
    assert.throws(() => extract([living, retired]), /wildz_restore_retirement_authority_untrusted/);
    const retirementSeal = currentRevision(retired).growth.life!.retirement!.sealDigest;
    const retirementVerifier: CreatureRetirementAuthorityVerifier = {
      verifyRetirement: (evidence) => evidence.retirementSealDigest === retirementSeal
    };
    assert.equal(extract([retired], undefined, retirementVerifier)[0]!.proof.digest, retired.proof.digest);
    assert.equal(extract([living, retired], undefined, retirementVerifier)[0]!.proof.digest, retired.proof.digest);
    assert.equal(extract([base, retired], undefined, retirementVerifier)[0]!.proof.digest, retired.proof.digest);
  });
});
