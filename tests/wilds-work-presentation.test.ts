import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectWildsCompanionWorkMotion,
  projectWildsResourceBody,
  projectWildsSourceWorkMotion,
  projectWildsWorkPresentation
} from "../src/features/play/wilds-work-presentation";

describe("living stewardship presentation", () => {
  it("isolates work motion to the exact active source without becoming authority", () => {
    const active = projectWildsWorkPresentation({ sourceId: "source:tree:1", activeSourceId: "source:tree:1", commandPending: true, commandSettled: false, elapsedMs: 640, reducedMotion: false });
    const neighbor = projectWildsWorkPresentation({ sourceId: "source:tree:2", activeSourceId: "source:tree:1", commandPending: true, commandSettled: false, elapsedMs: 640, reducedMotion: false });
    assert.equal(active.phase, "work");
    assert.equal(active.companion.engaged, true);
    assert.ok(active.impact > 0);
    assert.equal(neighbor.phase, "idle");
    assert.equal(neighbor.companion.engaged, false);
    assert.equal(neighbor.impact, 0);
  });

  it("moves through approach, work, and settle without delaying the command", () => {
    const basis = { sourceId: "source:stone:1", activeSourceId: "source:stone:1", reducedMotion: false } as const;
    assert.equal(projectWildsWorkPresentation({ ...basis, commandPending: true, commandSettled: false, elapsedMs: 80 }).phase, "approach");
    assert.equal(projectWildsWorkPresentation({ ...basis, commandPending: true, commandSettled: false, elapsedMs: 480 }).phase, "work");
    assert.equal(projectWildsWorkPresentation({ ...basis, commandPending: false, commandSettled: true, elapsedMs: 920 }).phase, "settle");
    assert.equal(projectWildsWorkPresentation({ ...basis, commandPending: false, commandSettled: false, elapsedMs: 2_000 }).phase, "idle");
  });

  it("turns admitted capacity into bounded visible timber depletion and recovery", () => {
    const full = projectWildsResourceBody({ kind: "timber", capacity: 4, availableCapacity: 4 });
    const worked = projectWildsResourceBody({ kind: "timber", capacity: 4, availableCapacity: 2 });
    const resting = projectWildsResourceBody({ kind: "timber", capacity: 4, availableCapacity: 0 });
    const recovering = projectWildsResourceBody({ kind: "timber", capacity: 4, availableCapacity: 1 });
    assert.equal(full.vitality, 1);
    assert.ok(full.tree.crownScale > worked.tree.crownScale);
    assert.ok(worked.tree.crownScale > resting.tree.crownScale);
    assert.equal(resting.tree.stumpVisible, true);
    assert.ok(resting.tree.trunkScale > 0);
    assert.ok(recovering.tree.crownScale > resting.tree.crownScale);
    assert.ok(recovering.tree.crownScale < full.tree.crownScale);
  });

  it("keeps one ordinary harvest visibly readable without making the source look destroyed", () => {
    const workedTree = projectWildsResourceBody({ kind: "timber", capacity: 20, availableCapacity: 15 });
    const workedStone = projectWildsResourceBody({ kind: "stone", capacity: 20, availableCapacity: 15 });
    assert.ok(workedTree.tree.crownScale <= .95);
    assert.ok(workedTree.tree.crownScale >= .85);
    assert.equal(workedTree.tree.worked, true);
    assert.ok(workedStone.rock.scale <= .95);
    assert.ok(workedStone.rock.scale >= .85);
    assert.equal(workedStone.rock.fractured, true);
  });

  it("leaves exhausted stone visibly fractured and restores it monotonically", () => {
    const exhausted = projectWildsResourceBody({ kind: "stone", capacity: 5, availableCapacity: 0 });
    const half = projectWildsResourceBody({ kind: "stone", capacity: 5, availableCapacity: 3 });
    const full = projectWildsResourceBody({ kind: "stone", capacity: 5, availableCapacity: 5 });
    assert.equal(exhausted.rock.fractured, true);
    assert.ok(exhausted.rock.scale >= .24);
    assert.ok(exhausted.rock.scale < half.rock.scale);
    assert.ok(half.rock.scale < full.rock.scale);
    assert.ok(exhausted.rock.fracture > half.rock.fracture);
    for (const value of [exhausted.vitality, exhausted.ringIntensity, exhausted.rock.scale, exhausted.rock.fracture]) {
      assert.equal(Number.isFinite(value), true);
      assert.ok(value >= 0 && value <= 1);
    }
  });

  it("respects reduced motion while retaining visible state and exact engagement", () => {
    const presentation = projectWildsWorkPresentation({ sourceId: "source:tree:1", activeSourceId: "source:tree:1", commandPending: true, commandSettled: false, elapsedMs: 640, reducedMotion: true });
    assert.equal(presentation.phase, "work");
    assert.equal(presentation.companion.engaged, true);
    assert.equal(presentation.companion.bob, 0);
    assert.equal(presentation.impact, 0);
  });

  it("keeps the companion moving continuously through work and settle", () => {
    const first = projectWildsCompanionWorkMotion({ elapsedMs: 420, settledElapsedMs: null, reducedMotion: false });
    const second = projectWildsCompanionWorkMotion({ elapsedMs: 560, settledElapsedMs: null, reducedMotion: false });
    const settle = projectWildsCompanionWorkMotion({ elapsedMs: 1_400, settledElapsedMs: 180, reducedMotion: false });
    assert.notDeepEqual(first, second);
    assert.ok(Math.abs(first.tangent) + Math.abs(first.radial) + Math.abs(first.lift) > 0);
    assert.ok(Math.abs(settle.tangent) + Math.abs(settle.radial) + Math.abs(settle.lift) > 0);
  });

  it("gives the exact active tree or rock a continuous bounded physical reaction", () => {
    const treeA = projectWildsSourceWorkMotion({ kind: "timber", elapsedMs: 430, active: true, reducedMotion: false });
    const treeB = projectWildsSourceWorkMotion({ kind: "timber", elapsedMs: 560, active: true, reducedMotion: false });
    const rock = projectWildsSourceWorkMotion({ kind: "stone", elapsedMs: 560, active: true, reducedMotion: false });
    assert.notDeepEqual(treeA, treeB);
    assert.ok(Math.abs(treeA.tiltX) + Math.abs(treeA.tiltZ) > 0);
    assert.ok(rock.scale > 0.98 && rock.scale < 1.08);
    assert.deepEqual(projectWildsSourceWorkMotion({ kind: "stone", elapsedMs: 560, active: false, reducedMotion: false }), { tiltX: 0, tiltZ: 0, lift: 0, scale: 1 });
  });
});
