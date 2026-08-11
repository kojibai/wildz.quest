import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceCanonicalArenaSession,
  createCanonicalArenaSession,
  prepareCanonicalArenaSession,
  projectCanonicalArenaResult,
  projectCanonicalArenaState
} from "../src/features/games/mortal-arena/canonical-adapter";
import { createArenaPath, projectCampaignOpponent } from "../src/features/games/mortal-arena/campaign";
import { createMortalArenaSessionProjection } from "../src/features/games/mortal-arena/use-mortal-arena";
import { createArenaMortalCovenantPayload, type ArenaMortalCovenantEnvelope } from "../src/features/play/arena/runtime";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { admitLegacyCard, appendLivingCardHistory, currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";

const roster = [
  sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "adapter:a", capturedAt: "2026-07-16T16:00:00.000Z" }),
  sealCollectedCard({ formId: "voltray-1", ownerReceizId: "player", encounterId: "adapter:b", capturedAt: "2026-07-16T16:00:01.000Z" })
] as const;
const path = createArenaPath("player");
const opponent = projectCampaignOpponent(path);

describe("canonical player-facing Arena adapter", () => {
  it("defaults trainer and campaign play to canonical non-mortal Adventure", () => {
    const session = createCanonicalArenaSession({ roster, path, opponent });
    assert.equal(session.canonical.mode, "adventure");
    assert.equal(projectCanonicalArenaState(session).mortal, false);
  });

  it("keeps Ranked and unsigned Mortal sessions fail-closed", () => {
    assert.throws(() => createCanonicalArenaSession({ roster, path, opponent, mode: "ranked" }), /mortal_arena_ranked_global_session_required/);
    assert.throws(() => createCanonicalArenaSession({ roster, path, opponent, mode: "mortal" }), /mortal_arena_signed_covenant_required/);
  });

  it("admits Mortal only through an exact one-match signed covenant verifier", () => {
    const prepared = prepareCanonicalArenaSession({ roster, path, opponent, mode: "mortal" });
    const payload = createArenaMortalCovenantPayload(prepared.definition, {
      playerId: path.playerId,
      signerId: "device:player",
      expiresUPulse: prepared.definition.kai.uPulse + 1,
      nonce: "match-one"
    });
    const envelope: ArenaMortalCovenantEnvelope = { schema: "receiz.wilds.arena_mortal_covenant.v1", payload, signature: "device-signature" };
    const consumed = new Set<string>();
    const mortalAdmission = {
      envelope,
      verify: (candidate: ArenaMortalCovenantEnvelope, commitment: string) => candidate === envelope && commitment === payload.definitionCommitment,
      consumeOnce: (candidate: ArenaMortalCovenantEnvelope, commitment: string) => {
        const key = `${candidate.payload.nonce}:${commitment}`;
        if (consumed.has(key)) return false;
        consumed.add(key);
        return true;
      }
    };
    const session = createCanonicalArenaSession({
      roster,
      path,
      opponent,
      mode: "mortal",
      mortalAdmission
    });
    assert.equal(session.canonical.mode, "mortal");
    assert.equal(session.canonical.kai.uPulse, payload.admittedUPulse);
    assert.equal(session.definition.mortalCovenant?.payload.fighterPins.length, 3);
    assert.throws(() => createCanonicalArenaSession({ roster, path, opponent, mode: "mortal", mortalAdmission }), /mortal_arena_covenant_already_consumed/);
  });

  it("does not consume a one-match covenant while projecting a React render", () => {
    const prepared = prepareCanonicalArenaSession({ roster, path, opponent, mode: "mortal" });
    const payload = createArenaMortalCovenantPayload(prepared.definition, {
      playerId: path.playerId,
      signerId: "device:render-safe",
      expiresUPulse: prepared.definition.kai.uPulse + 1,
      nonce: "render-safe"
    });
    const envelope: ArenaMortalCovenantEnvelope = { schema: "receiz.wilds.arena_mortal_covenant.v1", payload, signature: "device-signature" };
    let claims = 0;
    const mortalAdmission = {
      envelope,
      verify: () => true,
      consumeOnce: () => { claims += 1; return true; }
    };

    const firstRender = createMortalArenaSessionProjection({ roster, path, opponent, mode: "mortal", mortalAdmission });
    const retriedRender = createMortalArenaSessionProjection({ roster, path, opponent, mode: "mortal", mortalAdmission });
    assert.equal(firstRender.unavailableReason, "mortal_arena_covenant_not_claimed");
    assert.equal(retriedRender.unavailableReason, "mortal_arena_covenant_not_claimed");
    assert.equal(claims, 0);

    const claimed = createMortalArenaSessionProjection(
      { roster, path, opponent, mode: "mortal", mortalAdmission },
      { claimMortalAdmission: true }
    );
    assert.equal(claimed.unavailableReason, null);
    assert.equal(claims, 1);
  });

  it("maps the card's visible named ability to the exact canonical ability", () => {
    let session = createCanonicalArenaSession({ roster, path, opponent });
    session = advanceCanonicalArenaSession(session, { abilitySlot: 0 });
    const fighter = session.canonical.teams[0].fighters[roster[0].id]!;
    assert.equal(fighter.combat.action.kind, "ability");
    assert.equal(fighter.combat.action.abilityName, roster[0].manifest.abilityNames[0]);
  });

  it("admits the exact restored creature-history condition into combat", () => {
    const base = admitLegacyCard(roster[0], "2026-07-16T16:00:00.000Z");
    const trained = appendLivingCardHistory({
      asset: base,
      event: {
        eventId: "arena:exact-history-condition",
        rulesetVersion: "wildz.adventure.v1",
        occurredAt: "2026-07-16T16:02:00.000Z",
        source: { mode: "arena", activityId: "arena:history", actorId: "player", authority: "local" },
        evidence: {},
        effects: [{
          kind: "condition",
          delta: {
            assetId: base.id,
            lifeBefore: "alive",
            lifeAfter: "alive",
            fatigueDelta: 9,
            injuriesAdded: [{ id: "arena:wing-strain", kind: "wing", severity: 2, sourceEventId: "arena:history" }],
            xp: { arena: 21 },
            mastery: { arena: 7 },
            upgradeIdsAdded: ["arena:air-step-i"],
            receiptDigestsAdded: []
          }
        }]
      }
    });

    const prepared = prepareCanonicalArenaSession({ roster: [trained, roster[1]], path, opponent });
    assert.deepEqual(
      prepared.definition.teams[0].fighters[0]?.condition,
      currentCreatureHistoryProjection(trained).condition
    );
    assert.equal(prepared.definition.kai.uPulse, trained.manifest.history?.events.at(-1)?.kai.uPulse);
  });

  it("drives campaign rivals through the observable-state reaction policy", () => {
    let left = createCanonicalArenaSession({ roster, path, opponent });
    let right = createCanonicalArenaSession({ roster, path, opponent });
    assert.equal(left.npc.policy.tier, "learner");
    assert.ok((left.npc.queued?.frame ?? 0) - left.canonical.frame >= 12);
    for (let frame = 0; frame < 12; frame += 1) {
      left = advanceCanonicalArenaSession(left, {});
      right = advanceCanonicalArenaSession(right, {});
    }
    assert.deepEqual(left.canonical, right.canonical);
    assert.equal(left.canonical.teams[1].fighters[left.canonical.teams[1].activeAssetId]!.combat.focus, 18);
  });

  it("exposes dodge, parry, focus, tag, context, and withdraw through atomic frames", () => {
    const create = () => createCanonicalArenaSession({ roster, path, opponent });
    assert.equal(advanceCanonicalArenaSession(create(), { dodge: true }).canonical.teams[0].fighters[roster[0].id]!.combat.action.kind, "dodge");
    assert.equal(advanceCanonicalArenaSession(create(), { parry: true }).canonical.teams[0].fighters[roster[0].id]!.combat.action.kind, "parry");
    assert.equal(advanceCanonicalArenaSession(create(), { focus: true }).canonical.teams[0].fighters[roster[0].id]!.combat.focus, 18);
    assert.equal(advanceCanonicalArenaSession(create(), { swapTo: 1 }).canonical.teams[0].activeAssetId, roster[1].id);
    assert.equal(advanceCanonicalArenaSession(create(), { contextTargetId: "mechanism:gate" }).canonical.stage.activatedMechanismIds[0], "gate");
    assert.equal(advanceCanonicalArenaSession(create(), { withdraw: true }).canonical.terminal?.reason, "withdrawal");
  });

  it("returns a settlement projection for every affected owned card", () => {
    const terminal = advanceCanonicalArenaSession(createCanonicalArenaSession({ roster, path, opponent }), { withdraw: true });
    const result = projectCanonicalArenaResult(terminal);
    assert.ok(result);
    assert.deepEqual(result?.affectedOwnedCards?.map((item) => item.cardId), roster.map((card) => card.id));
    assert.equal(result?.canonical?.kai.uPulse, terminal.canonical.kai.uPulse);
  });
});
