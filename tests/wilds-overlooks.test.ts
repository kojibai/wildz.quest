import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WILDS_FLAGSHIP_LANDMARKS } from "../src/features/play/wilds-landmarks";
import { beginWildsVista, exitWildsVista, projectWildsOverlooks, wildsOverlookAt } from "../src/features/play/wilds-overlooks";
import { sampleWildsTerrain } from "../src/features/play/wilds-terrain-authority";
import { WILDS_AUTHORED_OVERLOOKS } from "../src/features/play/wilds-world-geography";

describe("Wildz authored overlooks", () => {
  it("gives every deterministic overlook a level walkable approach", () => {
    assert.equal(new Set(WILDS_AUTHORED_OVERLOOKS.map((overlook) => overlook.id)).size, WILDS_AUTHORED_OVERLOOKS.length);
    for (const overlook of WILDS_AUTHORED_OVERLOOKS) {
      const center = sampleWildsTerrain(overlook.position.x, overlook.position.z);
      const approach = sampleWildsTerrain(overlook.approach.x, overlook.approach.z);
      assert.equal(approach.elevation, center.elevation, overlook.id);
      assert.deepEqual(approach.traversal, [], overlook.id);
      assert.ok(center.slope < 0.08, overlook.id);
    }
  });

  it("projects only nearby overlooks and detects a stable platform", () => {
    const overlook = WILDS_AUTHORED_OVERLOOKS[0];
    assert.deepEqual(projectWildsOverlooks(overlook.position, 1).map((item) => item.id), [overlook.id]);
    assert.equal(wildsOverlookAt(overlook.position)?.id, overlook.id);
  });

  it("reveals existing landmarks and restores the exact prior camera on exit", () => {
    const known = new Set(WILDS_FLAGSHIP_LANDMARKS.map((landmark) => landmark.id));
    const priorCamera = { azimuth: 1.2, polar: 0.8, distance: 7.4 };
    const vista = beginWildsVista("prism-watch", priorCamera);
    const exited = exitWildsVista(vista);

    assert.ok(vista.revealedLandmarkIds.length > 0);
    assert.ok(vista.revealedLandmarkIds.every((id) => known.has(id)));
    assert.equal(exited.state.active, false);
    assert.deepEqual(exited.restoredCamera, priorCamera);
  });
});
