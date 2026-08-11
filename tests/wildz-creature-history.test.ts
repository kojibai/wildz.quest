import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAdventureCondition } from "../src/features/play/adventure/card-condition";
import { createCreatureHistoryAdmission } from "../src/features/play/creature-history";
import type { CreatureHistoryAuthorityVerifier, CreatureHistoryEventDraft } from "../src/features/play/creature-history-types";
import { projectLivingCardDossier } from "../src/features/play/living-card-dossier";
import {
  appendLivingCardHistory,
  compareLivingCardHistoryHeads,
  currentCreatureHistoryProjection,
  isLivingCardHistoryDescendant,
  verifyLivingCard
} from "../src/features/play/living-card-proof";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import { canonicalPortableCardJson, sealCollectedCard, sha256PortableBasis } from "../src/features/play/portable-card";

const BORN_AT = "2026-08-11T12:00:00.000Z";
const TRAINED_AT = "2026-08-11T12:10:00.000Z";
const RECEIPT_DIGEST = `sha256:${"a".repeat(64)}`;
const REPLAY_DIGEST = `sha256:${"b".repeat(64)}`;
const VERIFICATION_DIGEST = `sha256:${"c".repeat(64)}`;

function livingCard() {
  return admitLegacyCard(sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "history_keeper.receiz.id",
    encounterId: "creature-history-core",
    capturedAt: BORN_AT
  }), BORN_AT);
}

function trainingEvent(assetId: string) {
  return {
    eventId: `training:${assetId}:one`,
    rulesetVersion: "wildz.progression.v1",
    occurredAt: TRAINED_AT,
    source: {
      mode: "training" as const,
      activityId: "training:grove:one",
      actorId: "history_keeper.receiz.id",
      authority: "local" as const
    },
    evidence: {},
    effects: [{
      kind: "progress" as const,
      xpDelta: 120,
      growthEvents: [{
        eventId: `bond_moment:${assetId}:one`,
        kind: "bond_moment" as const,
        path: "bond" as const,
        amount: 3,
        occurredAt: TRAINED_AT
      }]
    }]
  };
}

function admittedEvent(card: ReturnType<typeof livingCard>, draft: CreatureHistoryEventDraft): CreatureHistoryEventDraft {
  const event: CreatureHistoryEventDraft = {
    ...draft,
    kai: draft.kai ?? card.manifest.history!.events.at(-1)!.kai,
    source: { ...draft.source, authority: "verified-receipt" },
    evidence: { ...draft.evidence, receiptDigest: RECEIPT_DIGEST, replayDigest: REPLAY_DIGEST }
  };
  return {
    ...event,
    evidence: {
      ...event.evidence,
      admission: createCreatureHistoryAdmission({
        chain: card.manifest.history!,
        event,
        issuerId: "receiz.arena.admission.v1",
        verificationDigest: VERIFICATION_DIGEST
      })
    }
  };
}

describe("append-only creature history", () => {
  it("creates a verified birth-rooted history and projects exact level, XP, and bond", () => {
    const birth = livingCard();
    assert.equal(birth.manifest.history?.completeness, "complete");
    assert.equal(birth.manifest.history?.events.length, 1);
    assert.equal(verifyLivingCard(birth).ok, true);

    const trained = appendLivingCardHistory({ asset: birth, event: trainingEvent(birth.id) });
    const projection = currentCreatureHistoryProjection(trained);

    assert.deepEqual({ level: projection.level, xp: projection.xp, bond: projection.bond }, {
      level: 2,
      xp: 20,
      bond: birth.manifest.revisions[0]!.growth.bond + 3
    });
    assert.equal(trained.manifest.history?.events.length, 2);
    assert.equal(verifyLivingCard(trained).ok, true);
  });

  it("treats an exact replay as idempotent and rejects an event-id splice", () => {
    const birth = livingCard();
    const event = trainingEvent(birth.id);
    const trained = appendLivingCardHistory({ asset: birth, event });
    const replayed = appendLivingCardHistory({ asset: trained, event });
    assert.equal(replayed.proof.digest, trained.proof.digest);
    assert.equal(replayed.manifest.history?.events.length, trained.manifest.history?.events.length);

    assert.throws(() => appendLivingCardHistory({
      asset: trained,
      event: {
        ...event,
        effects: [{ ...event.effects[0]!, xpDelta: 121 }]
      }
    }), /creature_history_event_conflict/);
  });

  it("rejects digest tampering and recognizes only structural prefix descendants", () => {
    const birth = livingCard();
    const trained = appendLivingCardHistory({ asset: birth, event: trainingEvent(birth.id) });
    assert.equal(isLivingCardHistoryDescendant(birth, trained), true);
    assert.equal(isLivingCardHistoryDescendant(trained, birth), false);

    const tampered = structuredClone(trained);
    const history = tampered.manifest.history!;
    tampered.manifest.history = {
      ...history,
      events: history.events.map((event, index) => index === 1
        ? { ...event, resultingProjectionDigest: `sha256:${"0".repeat(64)}` }
        : event)
    };
    assert.equal(verifyLivingCard(tampered).ok, false);
  });

  it("makes verified mortality irreversible", () => {
    const birth = livingCard();
    const deathAt = "2026-08-11T12:20:00.000Z";
    const deadCondition = {
      ...emptyAdventureCondition(birth.id),
      life: "dead" as const,
      retiredAt: deathAt,
      retirementCauseEventId: "arena:receipt:zero"
    };
    const retired = appendLivingCardHistory({
      asset: birth,
      event: admittedEvent(birth, {
        eventId: "arena:settlement:zero",
        rulesetVersion: "wildz.arena.v1",
        occurredAt: deathAt,
        source: {
          mode: "arena",
          activityId: "arena:match:zero",
          actorId: "history_keeper.receiz.id",
          authority: "local"
        },
        evidence: {},
        effects: [{ kind: "legacy-checkpoint", projection: {
          ...currentCreatureHistoryProjection(birth),
          condition: deadCondition
        } }]
      })
    });
    assert.equal(currentCreatureHistoryProjection(retired).condition.life, "dead");

    assert.throws(() => appendLivingCardHistory({
      asset: retired,
      event: {
        eventId: "camp:illegal-revival",
        rulesetVersion: "wildz.recovery.v1",
        occurredAt: "2026-08-11T12:30:00.000Z",
        source: {
          mode: "recovery",
          activityId: "camp:one",
          actorId: "history_keeper.receiz.id",
          authority: "local"
        },
        evidence: {},
        effects: [{ kind: "legacy-checkpoint", projection: {
          ...currentCreatureHistoryProjection(retired),
          condition: emptyAdventureCondition(retired.id)
        } }]
      }
    }), /creature_history_mortality_irreversible/);
  });

  it("orders competing admitted heads only by integer Kai uPulse and fails a shared authority slot closed", () => {
    const birth = livingCard();
    const parentKai = birth.manifest.history!.events.at(-1)!.kai;
    const base = trainingEvent(birth.id);
    const lower = appendLivingCardHistory({
      asset: birth,
      event: admittedEvent(birth, {
        ...base,
        eventId: "branch:lower-upulse",
        occurredAt: "2030-01-01T00:00:00.000Z",
        kai: { ...parentKai, uPulse: parentKai.uPulse + 1 }
      })
    });
    const higher = appendLivingCardHistory({
      asset: birth,
      event: admittedEvent(birth, {
        ...base,
        eventId: "branch:higher-upulse",
        occurredAt: "2020-01-01T00:00:00.000Z",
        kai: { ...parentKai, uPulse: parentKai.uPulse + 2 }
      })
    });
    const trusted = new Set([lower, higher].map((value) => value.manifest.history!.events.at(-1)!.evidence.admission!.digest));
    const verifier: CreatureHistoryAuthorityVerifier = { verifyAdmission: ({ envelope }) => trusted.has(envelope.digest) };
    assert.equal(compareLivingCardHistoryHeads(lower, higher, verifier), "right");
    assert.equal(compareLivingCardHistoryHeads(higher, lower, verifier), "left");

    const conflict = appendLivingCardHistory({
      asset: birth,
      event: admittedEvent(birth, {
        ...base,
        eventId: "branch:same-authority-slot",
        kai: { ...parentKai, uPulse: parentKai.uPulse + 1 }
      })
    });
    trusted.add(conflict.manifest.history!.events.at(-1)!.evidence.admission!.digest);
    assert.throws(() => compareLivingCardHistoryHeads(lower, conflict, verifier), /creature_history_authority_slot_conflict/);
  });

  it("projects sealed history facts into the individual card dossier", () => {
    const birth = livingCard();
    const trained = appendLivingCardHistory({ asset: birth, event: trainingEvent(birth.id) });
    const dossier = projectLivingCardDossier(trained, "https://wildz.quest");
    assert.deepEqual({
      level: dossier.gameplay.level,
      xp: dossier.gameplay.xp,
      bond: dossier.gameplay.bond,
      historyEvents: dossier.gameplay.historyEvents,
      historyHead: dossier.gameplay.historyHead
    }, {
      level: 2,
      xp: 20,
      bond: birth.manifest.revisions[0]!.growth.bond + 3,
      historyEvents: 2,
      historyHead: trained.manifest.history!.headDigest
    });
    assert.equal(dossier.verification.checks.some((check) => check.label === "Creature history" && check.status === "pass"), true);
  });

  it("requires a receipt digest before an event can claim verified-receipt authority", () => {
    const birth = livingCard();
    const event = trainingEvent(birth.id);
    assert.throws(() => appendLivingCardHistory({
      asset: birth,
      event: {
        ...event,
        source: { ...event.source, authority: "verified-receipt" }
      }
    }), /creature_history_authority_evidence_required/);
  });

  it("extends a historical living card through an explicit legacy checkpoint", () => {
    const historical = structuredClone(livingCard());
    delete historical.manifest.history;
    historical.proof.digest = sha256PortableBasis(canonicalPortableCardJson(historical.manifest));
    assert.equal(verifyLivingCard(historical).ok, true);

    const extended = appendLivingCardHistory({ asset: historical, event: trainingEvent(historical.id) });
    assert.equal(extended.manifest.history?.completeness, "legacy-checkpoint");
    assert.equal(extended.manifest.history?.events[0]?.source.authority, "legacy-migration");
    assert.equal(extended.manifest.history?.events.length, 2);
    assert.equal(verifyLivingCard(extended).ok, true);
  });
});
