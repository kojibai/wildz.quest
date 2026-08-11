import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advanceArenaFrame,
  arenaDefinitionCommitment,
  createArenaMatch,
  createArenaMortalCovenantPayload,
  type ArenaAdmissionVerification,
  type ArenaFrameIntent,
  type ArenaMatchDefinition
} from "../src/features/play/arena/runtime";
import { ARENA_RULESET_DIGEST, ARENA_RULESET_ID } from "../src/features/play/arena/rules";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import { arenaFixtureDefinition } from "./support/arena-fixtures";

const signed = (value: unknown) => `fixture-signature:${sha256PortableBasis(canonicalPortableCardJson(value))}`;
const verification: ArenaAdmissionVerification = {
  verifyGlobalAdmission: (envelope, commitment) => envelope.signature === signed({ payload: envelope.payload, commitment }),
  verifyMortalCovenant: (envelope, commitment) => envelope.signature === signed({ payload: envelope.payload, commitment }),
  verifyFighterAdmission: () => true
};

function rankedDefinition() {
  const base = arenaFixtureDefinition("practice", 1);
  const draft = { ...base, mode: "ranked" as const, authority: "global" as const };
  const commitment = arenaDefinitionCommitment(draft);
  const payload = {
    schema: "receiz.wilds.arena_global_admission_payload.v1" as const,
    definitionCommitment: commitment,
    rulesetId: ARENA_RULESET_ID,
    rulesetDigest: ARENA_RULESET_DIGEST,
    admittedUPulse: draft.kai.uPulse,
    expiresUPulse: draft.kai.uPulse + 1_000,
    issuerId: "global:arena-authority"
  };
  return { ...draft, globalAdmission: { schema: "receiz.wilds.arena_global_admission.v1" as const, payload, signature: signed({ payload, commitment }) } };
}

function mortalDefinition() {
  const base = arenaFixtureDefinition("practice", 1);
  const draft = { ...base, mode: "mortal" as const, authority: "offline-pending" as const };
  const commitment = arenaDefinitionCommitment(draft);
  const payload = createArenaMortalCovenantPayload(draft, {
    playerId: draft.teams[0].id,
    signerId: "device:one",
    expiresUPulse: draft.kai.uPulse + 1_000,
    nonce: "match-consent:one"
  });
  return { ...draft, mortalCovenant: { schema: "receiz.wilds.arena_mortal_covenant.v1" as const, payload, signature: signed({ payload, commitment }) } };
}

const neutral = { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false } as const;
const intent = (actorId: string, value: Partial<ArenaFrameIntent> = {}): ArenaFrameIntent => ({ actorId, movement: neutral, combat: null, tagAssetId: null, contextTargetId: null, withdraw: false, ...value });

describe("Arena authority admission", () => {
  it("keeps Ranked unavailable without a verified signed global envelope", () => {
    const definition = rankedDefinition();
    assert.throws(() => createArenaMatch(definition), /arena_ranked_global_admission_unavailable/);
    assert.throws(() => createArenaMatch({ ...definition, globalAdmission: { ...definition.globalAdmission, signature: "locally-minted" } }, verification), /arena_ranked_global_admission_invalid/);
    assert.equal(createArenaMatch(definition, verification).mode, "ranked");
  });

  it("requires a verified one-match Mortal covenant bound to pins, player, ruleset, and uPulse", () => {
    const definition = mortalDefinition();
    assert.throws(() => createArenaMatch({ ...definition, mortalCovenant: undefined, covenantDigest: `sha256:${"c".repeat(64)}` } as ArenaMatchDefinition, verification), /arena_mortal_covenant_required/);
    assert.throws(() => createArenaMatch(definition), /arena_mortal_covenant_verifier_required/);
    assert.equal(createArenaMatch(definition, verification).mode, "mortal");
    const expired = { ...definition, mortalCovenant: { ...definition.mortalCovenant, payload: { ...definition.mortalCovenant.payload, expiresUPulse: definition.kai.uPulse - 1 } } };
    assert.throws(() => createArenaMatch(expired, verification), /arena_mortal_covenant_invalid/);
    const changedRevision = { ...definition, teams: [{ ...definition.teams[0], fighters: [{ ...definition.teams[0].fighters[0]!, revisionDigest: `sha256:${"4".repeat(64)}` }] }, definition.teams[1]] } as typeof definition;
    assert.throws(() => createArenaMatch(changedRevision, verification), /arena_mortal_covenant_invalid/);
  });

  it("rejects caller-shaped fighter and unbounded stage definitions", () => {
    const base = arenaFixtureDefinition("practice", 1);
    const shaped = { ...base, teams: [{ ...base.teams[0], fighters: [{ ...base.teams[0].fighters[0]!, maxVitality: 999_999 }] }, base.teams[1]] } as ArenaMatchDefinition;
    assert.throws(() => createArenaMatch(shaped), /arena_fighter_projection_invalid/);
    assert.throws(() => createArenaMatch({ ...base, stage: { ...base.stage, bounds: { ...base.stage.bounds, maxX: 1_000_000 } } }), /arena_stage_invalid/);
    assert.throws(() => createArenaMatch({ ...base, hazards: [{ id: "world-kill", damage: 999_999, radius: 999_999, position: { x: 0, y: 0, z: 0 } }] }), /arena_stage_invalid/);
  });

  it("resolves an already-active hit against the outgoing fighter before a same-frame tag", () => {
    const base = arenaFixtureDefinition("practice", 2);
    let state = createArenaMatch(base);
    const outgoingId = state.teams[0].activeAssetId;
    const reserveId = state.teams[0].order[1]!;
    const attackerId = state.teams[1].activeAssetId;
    state = advanceArenaFrame(state, { frame: 1, intents: [
      intent(outgoingId),
      intent(attackerId, { combat: { kind: "heavy", direction: { x: -1, y: 0, z: 0 } } })
    ] });
    for (let frame = 2; frame < 12; frame += 1) state = advanceArenaFrame(state, { frame, intents: [intent(outgoingId), intent(attackerId)] });
    const beforeOutgoing = state.teams[0].fighters[outgoingId]!.combat.vitality;
    const beforeReserve = state.teams[0].fighters[reserveId]!.combat.vitality;
    state = advanceArenaFrame(state, { frame: 12, intents: [intent(outgoingId, { tagAssetId: reserveId }), intent(attackerId)] });
    assert.ok(state.teams[0].fighters[outgoingId]!.combat.vitality < beforeOutgoing);
    assert.equal(state.teams[0].fighters[reserveId]!.combat.vitality, beforeReserve);
    assert.equal(state.teams[0].activeAssetId, reserveId);
    const hitIndex = state.events.findIndex((event) => event.kind === "fighter.hit" && event.targetId === outgoingId);
    const tagIndex = state.events.findIndex((event) => event.kind === "fighter.tagged" && event.targetId === reserveId);
    assert.ok(hitIndex >= 0 && tagIndex > hitIndex);
  });
});
