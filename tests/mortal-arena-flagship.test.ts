import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { advanceArenaPath, createArenaPath, projectCampaignOpponent } from "../src/features/games/mortal-arena/campaign";
import { createArenaNpc, stepArenaNpc } from "../src/features/games/mortal-arena/npc-controller";
import { createArenaSettlement, recoverArenaSettlement, recoverArenaSettlementJournalEntry } from "../src/features/games/mortal-arena/settlement";
import { MORTAL_ARENA_MODULE } from "../src/features/games/mortal-arena/module";
import type { MortalArenaSetup } from "../src/features/games/mortal-arena/types";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { currentRevision } from "../src/features/play/living-card-proof";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { advanceCanonicalArenaSession, createCanonicalArenaSession, prepareCanonicalArenaSession, projectCanonicalArenaResult } from "../src/features/games/mortal-arena/canonical-adapter";
import { createArenaMortalCovenantPayload, type ArenaMortalCovenantEnvelope } from "../src/features/play/arena/runtime";
import { createArenaTranscript } from "../src/features/play/arena/transcript";
import { sealArenaReceipt } from "../src/features/play/arena/receipt";

const setup: MortalArenaSetup = {
  matchId: "match:flagship",
  seed: 81,
  mortal: true,
  sides: [
    { actorId: "player", fighters: [{ creatureId: "player-card", affinity: "Grove", vitality: 1_000, power: 118, guard: 90, speed: 105 }] },
    { actorId: "rival", fighters: [{ creatureId: "rival-card", affinity: "Ember", vitality: 1_000, power: 112, guard: 92, speed: 98 }] }
  ]
};

describe("Mortal Arena flagship loop", () => {
  it("gives an NPC only deterministic delayed legal inputs", () => {
    const state = MORTAL_ARENA_MODULE.create(setup);
    const npc = createArenaNpc({ actorId: "rival", tier: "scout", seed: 91 });
    const left = stepArenaNpc(npc, state);
    const right = stepArenaNpc(npc, structuredClone(state));
    assert.deepEqual(left, right);
    assert.ok(left.atTick >= state.tick + npc.reactionTicks);
    assert.equal(left.actorId, "rival");
    assert.ok(Math.abs(left.input.moveX ?? 0) <= 1_000);
    assert.ok(Math.abs(left.input.moveZ ?? 0) <= 1_000);
    assert.equal(Boolean(left.input.light && left.input.heavy), false);
  });

  it("escalates saved campaign stages into declared bosses", () => {
    let path = createArenaPath("player");
    path = advanceArenaPath(path, { matchId: "m1", outcome: "victory", retiredCreatureIds: [] });
    path = advanceArenaPath(path, { matchId: "m2", outcome: "victory", retiredCreatureIds: [] });
    const opponent = projectCampaignOpponent(path);
    assert.equal(path.stage, 3);
    assert.equal(opponent.kind, "boss");
    assert.ok(opponent.phases.length >= 3);
  });

  it("journals a result before applying it and recovers idempotently", () => {
    const card = sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "player",
      encounterId: "encounter:arena-test",
      capturedAt: "2026-07-16T16:00:00.000Z"
    });
    const pending = createArenaSettlement({
      card,
      result: { matchId: "m1", winnerSide: 0, outcome: "victory", mortal: false, finalVitality: [760, 0], retiredCreatureIds: [] },
      playerSide: 0,
      completedAt: "2026-07-16T16:05:00.000Z"
    });
    assert.equal(pending.status, "pending");
    const committed = recoverArenaSettlement(pending);
    assert.equal(committed.status, "committed");
    assert.equal(committed.card.id, card.id);
    assert.deepEqual(recoverArenaSettlement(committed), committed);
    assert.deepEqual(recoverArenaSettlementJournalEntry(JSON.stringify(committed)), committed);
    assert.equal(recoverArenaSettlementJournalEntry("not-json"), null);
  });

  it("keeps legacy multi-card result compatibility non-settling", () => {
    const cards = [
      sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "encounter:team-a", capturedAt: "2026-07-16T16:00:00.000Z" }),
      sealCollectedCard({ formId: "voltray-1", ownerReceizId: "player", encounterId: "encounter:team-b", capturedAt: "2026-07-16T16:00:01.000Z" })
    ];
    const pending = createArenaSettlement({
      cards,
      result: {
        matchId: "m:team",
        winnerSide: 0,
        outcome: "victory",
        mortal: false,
        finalVitality: [760, 0],
        retiredCreatureIds: [],
        affectedOwnedCards: [
          { cardId: cards[0]!.id, finalVitality: 760, maxVitality: 1_000, status: "active" },
          { cardId: cards[1]!.id, finalVitality: 910, maxVitality: 1_000, status: "ready" }
        ]
      },
      playerSide: 0,
      completedAt: "2026-07-16T16:05:00.000Z"
    });
    const committed = recoverArenaSettlement(pending);
    assert.deepEqual(committed.cards.map((card) => card.id), cards.map((card) => card.id));
    assert.deepEqual(committed.cards.map((card) => card.proof.digest), cards.map((card) => card.proof.digest));
  });

  it("rejects caller-shaped Mortal retirement without a canonical replay receipt", () => {
    const card = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "encounter:final", capturedAt: "2026-07-16T17:00:00.000Z" });
    assert.throws(() => createArenaSettlement({
      card,
      result: { matchId: "m:final", winnerSide: 1, outcome: "defeat", mortal: true, finalVitality: [0, 420], retiredCreatureIds: [card.id] },
      playerSide: 0,
      completedAt: "2026-07-16T17:02:00.000Z"
    }), /arena_settlement_canonical_receipt_required/);
  });

  it("settles an admitted Mortal terminal only after replay and covenant revalidation", () => {
    const cards = [sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "encounter:verified", capturedAt: "2026-07-16T17:00:00.000Z" })];
    const path = createArenaPath("player");
    const opponent = projectCampaignOpponent(path);
    const prepared = prepareCanonicalArenaSession({ roster: cards, path, opponent, mode: "mortal" });
    const payload = createArenaMortalCovenantPayload(prepared.definition, { playerId: "player", signerId: "device:player", expiresUPulse: prepared.definition.kai.uPulse + 1, nonce: "settlement-one" });
    const envelope: ArenaMortalCovenantEnvelope = { schema: "receiz.wilds.arena_mortal_covenant.v1", payload, signature: "device-signature" };
    const verifyMortalCovenant = (candidate: ArenaMortalCovenantEnvelope, commitment: string) => candidate === envelope && commitment === payload.definitionCommitment;
    let session = createCanonicalArenaSession({ roster: cards, path, opponent, mode: "mortal", mortalAdmission: { envelope, verify: verifyMortalCovenant, consumeOnce: () => true } });
    session = advanceCanonicalArenaSession(session, { withdraw: true });
    const result = projectCanonicalArenaResult(session)!;
    const completedAt = "2026-07-16T17:02:00.000Z";
    const canonicalReceipt = sealArenaReceipt({
      definition: session.definition,
      transcript: createArenaTranscript(session.definition, session.canonical, session.verification),
      priorConditions: Object.fromEntries(session.definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.condition]))),
      encounterId: opponent.id,
      checkpointId: "arena:path:test",
      actorId: "player",
      authority: { kind: "offline-pending", deviceId: "device:player" },
      publication: { state: "pending", revision: 0 },
      createdAt: completedAt
    }, session.verification);
    const pending = createArenaSettlement({ cards, result, playerSide: 0, completedAt, canonicalReceipt, verification: session.verification });
    assert.throws(() => recoverArenaSettlement(pending, { ...session.verification, verifyMortalCovenant: () => false }), /arena_settlement_receipt_invalid/);
    assert.throws(() => recoverArenaSettlement({ ...pending, result: { ...result, outcome: "victory" } }, session.verification), /arena_settlement_result_invalid/);
    const committed = recoverArenaSettlement(pending, session.verification);
    assert.equal(committed.canonicalReceipt?.digest, canonicalReceipt.digest);
    assert.equal(committed.kai?.uPulse, canonicalReceipt.kai.uPulse);
    assert.equal(isLivingCardAsset(committed.card), true);
    if (!isLivingCardAsset(committed.card)) throw new Error("expected living card");
    assert.equal(currentRevision(committed.card).kaiPulse, String(canonicalReceipt.kai.uPulse));
    assert.equal(committed.card.manifest.history?.events.at(-1)?.kai.uPulse, canonicalReceipt.kai.uPulse);
  });

  it("keeps canonical Practice terminal receipts non-persistent", () => {
    const cards = [sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "encounter:practice", capturedAt: "2026-07-16T18:00:00.000Z" })];
    const path = createArenaPath("player");
    const opponent = projectCampaignOpponent(path);
    let session = createCanonicalArenaSession({ roster: cards, path, opponent, mode: "practice" });
    session = advanceCanonicalArenaSession(session, { withdraw: true });
    const result = projectCanonicalArenaResult(session)!;
    const completedAt = "2026-07-16T18:02:00.000Z";
    assert.throws(() => createArenaSettlement({ cards, result, playerSide: 0, completedAt }), /arena_settlement_canonical_receipt_required/);
    const canonicalReceipt = sealArenaReceipt({
      definition: session.definition,
      transcript: createArenaTranscript(session.definition, session.canonical, session.verification),
      priorConditions: Object.fromEntries(session.definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.condition]))),
      encounterId: opponent.id,
      checkpointId: "arena:path:practice",
      actorId: "player",
      authority: { kind: "offline-pending", deviceId: "device:player" },
      publication: { state: "pending", revision: 0 },
      createdAt: completedAt
    }, session.verification);
    const committed = recoverArenaSettlement(createArenaSettlement({ cards, result, playerSide: 0, completedAt, canonicalReceipt, verification: session.verification }), session.verification);
    assert.equal(committed.card.proof.digest, cards[0]!.proof.digest);
  });

  it("recovers a serialized canonical Adventure journal with reconstructed fighter admission", () => {
    const cards = [sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "player", encounterId: "encounter:journal-adventure", capturedAt: "2026-07-16T19:00:00.000Z" })];
    const path = createArenaPath("player");
    const opponent = projectCampaignOpponent(path);
    let session = createCanonicalArenaSession({ roster: cards, path, opponent, mode: "adventure" });
    session = advanceCanonicalArenaSession(session, { withdraw: true });
    const result = projectCanonicalArenaResult(session)!;
    const completedAt = "2026-07-16T19:02:00.000Z";
    const canonicalReceipt = sealArenaReceipt({
      definition: session.definition,
      transcript: createArenaTranscript(session.definition, session.canonical, session.verification),
      priorConditions: Object.fromEntries(session.definition.teams.flatMap((team) => team.fighters.map((fighter) => [fighter.assetId, fighter.condition]))),
      encounterId: opponent.id,
      checkpointId: "arena:path:journal-adventure",
      actorId: "player",
      authority: { kind: "offline-pending", deviceId: "device:player" },
      publication: { state: "pending", revision: 0 },
      createdAt: completedAt
    }, session.verification);
    const committed = recoverArenaSettlement(
      createArenaSettlement({ cards, result, playerSide: 0, completedAt, canonicalReceipt, verification: session.verification }),
      session.verification
    );

    assert.deepEqual(recoverArenaSettlementJournalEntry(JSON.stringify(committed)), committed);
  });
});
