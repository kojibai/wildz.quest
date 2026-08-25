import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectWildsResourceBody, projectWildsWorkPresentation } from "../src/features/play/wilds-work-presentation";

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
});
