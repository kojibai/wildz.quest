import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectArenaFighter } from "../src/features/play/arena/card-fighter";
import { initialArenaKinematicState, stepArenaMovement, type ArenaStageDefinition } from "../src/features/play/arena/movement";
import { canonicalPortableCardJson, sha256PortableBasis } from "../src/features/play/portable-card";
import { arenaFixtureCard, arenaFixtureRevision } from "./support/arena-fixtures";

const stage: ArenaStageDefinition = {
  id: "arena:test", groundY: 0, fallY: -6, spawn: { x: 0, y: 0, z: 0 },
  bounds: { minX: -10, maxX: 10, minZ: -8, maxZ: 8 },
  obstacles: [{ id: "pillar", min: { x: 2, y: 0, z: -1 }, max: { x: 3, y: 3, z: 1 } }],
  ramps: [{ id: "west-ramp", minX: -6, maxX: -2, minZ: -2, maxZ: 2, lowY: 0, highY: 2, axis: "x" }],
};

function fighter(formId: string) {
  const card = arenaFixtureCard(formId, `movement-${formId}`);
  return projectArenaFighter(card, arenaFixtureRevision(card));
}

describe("deterministic Arena movement", () => {
  it("normalizes diagonal ground movement and respects stage bounds", () => {
    const actor = fighter("mintcub-1");
    let state = initialArenaKinematicState(stage.spawn);
    for (let frame = 0; frame < 600; frame += 1) state = stepArenaMovement(actor, stage, state, { moveX: 1, moveZ: 1, jumpPressed: false, sprint: true }).state;
    assert.ok(state.position.x <= stage.bounds.maxX - actor.collision.radius);
    assert.ok(state.position.z <= stage.bounds.maxZ - actor.collision.radius);
    assert.ok(Math.abs(state.velocity.x - state.velocity.z) <= 0.001);
  });

  it("jumps once, applies gravity, and lands on the analytic ground", () => {
    const actor = fighter("ledgerfox-1");
    let state = stepArenaMovement(actor, stage, initialArenaKinematicState(stage.spawn), { moveX: 0, moveZ: 0, jumpPressed: true, sprint: false }).state;
    assert.ok(state.velocity.y > 0);
    for (let frame = 0; frame < 180; frame += 1) state = stepArenaMovement(actor, stage, state, { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false }).state;
    assert.equal(state.grounded, true);
    assert.equal(state.position.y, stage.groundY);
  });

  it("gives a healthy winged card more aerial recovery than a heavy card", () => {
    const winged = fighter("voltray-1");
    const heavy = fighter("titanseal-1");
    const falling = { ...initialArenaKinematicState({ x: 0, y: -2, z: 0 }), grounded: false, velocity: { x: 0, y: -3, z: 0 }, recoveryCharges: 1 };
    const recovered = stepArenaMovement(winged, stage, falling, { moveX: 1, moveZ: 0, jumpPressed: true, sprint: false }).state;
    const dropped = stepArenaMovement(heavy, stage, falling, { moveX: 1, moveZ: 0, jumpPressed: true, sprint: false }).state;
    assert.ok(recovered.velocity.y > dropped.velocity.y);
    assert.ok(recovered.velocity.x > dropped.velocity.x);
  });

  it("collides with analytic obstacles and emits deterministic fall damage", () => {
    const actor = fighter("mintcub-1");
    let state = initialArenaKinematicState({ x: 1, y: 0, z: 0 });
    for (let frame = 0; frame < 120; frame += 1) state = stepArenaMovement(actor, stage, state, { moveX: 1, moveZ: 0, jumpPressed: false, sprint: false }).state;
    assert.ok(state.position.x <= 2 - actor.collision.radius + 0.002);
    const fallen = stepArenaMovement(actor, stage, { ...state, position: { x: 0, y: -7, z: 0 }, grounded: false }, { moveX: 0, moveZ: 0, jumpPressed: false, sprint: false });
    assert.equal(fallen.events[0]?.kind, "fall-damage");
    assert.deepEqual(fallen.state.position, stage.spawn);
  });

  it("follows a sealed analytic ramp without rendered-mesh collision", () => {
    const actor = fighter("ledgerfox-1");
    let state = { ...initialArenaKinematicState({ x: -5.5, y: 0.25, z: 0 }), grounded: true };
    for (let frame = 0; frame < 25; frame += 1) state = stepArenaMovement(actor, stage, state, { moveX: 1, moveZ: 0, jumpPressed: false, sprint: false }).state;
    assert.ok(state.position.y > 0.25);
    assert.equal(state.grounded, true);
  });

  it("replays 3,600 frames byte-identically with finite quantized state", () => {
    const actor = fighter("voltray-1");
    const run = () => {
      let state = initialArenaKinematicState(stage.spawn);
      for (let frame = 0; frame < 3_600; frame += 1) {
        state = stepArenaMovement(actor, stage, state, { moveX: Math.sin(frame / 40), moveZ: Math.cos(frame / 55), jumpPressed: frame % 180 === 0, sprint: frame % 120 < 40 }).state;
      }
      return sha256PortableBasis(canonicalPortableCardJson(state));
    };
    assert.equal(run(), run());
  });

  it("rejects non-finite and out-of-range input", () => {
    const actor = fighter("mintcub-1");
    assert.throws(() => stepArenaMovement(actor, stage, initialArenaKinematicState(stage.spawn), { moveX: Number.NaN, moveZ: 0, jumpPressed: false, sprint: false }), /arena_movement_input_invalid/);
    assert.throws(() => stepArenaMovement(actor, stage, initialArenaKinematicState(stage.spawn), { moveX: 2, moveZ: 0, jumpPressed: false, sprint: false }), /arena_movement_input_invalid/);
  });
});
