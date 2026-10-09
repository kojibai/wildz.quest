import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  projectWildsCompanionWorkMotion,
  projectWildsResourceBody,
  projectWildsSourceWorkMotion,
  projectWildsWorkPresentation,
  projectWildsHarvestWorkPhase,
  completeWildsWorkPresentation,
  writeWildsWorkApproachAnchor
} from "../src/features/play/wilds-work-presentation";

describe("living stewardship presentation", () => {
  it("finishes travel and a visible work cycle even when the harvest saves before arrival", () => {
    for (const kind of ["timber", "stone", "hay"] as const) {
      let completions = 0;
      const source = { sourceId: kind, kind, position: { x: 3, y: 0, z: 0 }, startedAtMs: 100,
        settledAtMs: 110, arrival: { atMs: null as number | null, completed: false }, onComplete: () => completions++ };
      assert.equal(projectWildsHarvestWorkPhase(source, 800), "approach");
      assert.equal(completeWildsWorkPresentation(source, 800), false);
      source.arrival.atMs = 900;
      assert.equal(projectWildsHarvestWorkPhase(source, 900), "work");
      assert.equal(projectWildsHarvestWorkPhase(source, 1799), "work");
      assert.equal(projectWildsHarvestWorkPhase(source, 1800), "settle");
      assert.equal(projectWildsHarvestWorkPhase(source, 2149), "settle");
      assert.equal(completeWildsWorkPresentation(source, 2150), true);
      for (let frame = 0; frame < 120; frame++) assert.equal(completeWildsWorkPresentation(source, 2150 + frame), false);
      assert.equal(completions, 1);
      assert.equal(source.settledAtMs, 110, "animation never rewrites durable admission");
    }
  });

  it("does not invent settlement when admission is slow or fails", () => {
    const source = { sourceId: "tree", kind: "timber" as const, position: { x: 3, y: 0, z: 0 }, startedAtMs: 100,
      settledAtMs: null as number | null, arrival: { atMs: 800, completed: false } };
    assert.equal(projectWildsHarvestWorkPhase(source, 5000), "work");
    assert.equal(completeWildsWorkPresentation(source, 5000), false);
    source.settledAtMs = 5100;
    assert.equal(projectWildsHarvestWorkPhase(source, 5100), "settle");
    assert.equal(projectWildsHarvestWorkPhase(source, 5449), "settle");
    assert.equal(projectWildsHarvestWorkPhase(source, 5450), "complete");
  });
  it("holds the harvesting destination while the explorer walks and resets for new work", () => {
    const anchor = { sourceId: "", startedAtMs: NaN, x: 0, z: 0 };
    const source = { sourceId: "tree", kind: "timber" as const, position: { x: 3, y: 0, z: 0 }, startedAtMs: 1, settledAtMs: null };
    writeWildsWorkApproachAnchor(anchor, source, { x: 0, z: 0 });
    const destination = { ...anchor };
    for (let frame = 0; frame < 600; frame++) writeWildsWorkApproachAnchor(anchor, source, { x: frame / 10, z: frame / 20 });
    assert.deepEqual(anchor, destination);
    assert.equal(anchor.x, 3 - 1.6);
    writeWildsWorkApproachAnchor(anchor, { ...source, startedAtMs: 2 }, { x: 6, z: 0 });
    assert.equal(anchor.x, 3 + 1.6);
  });
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
    assert.equal(resting.tree.crownScale, 0);
    assert.ok(resting.tree.trunkScale <= .2);
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
