import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialWorldOverlayState, reduceWorldOverlay } from "../src/features/play/world-overlay-state";

describe("living-world overlay authority", () => {
  it("keeps only one bottom expansion open", () => {
    const roster = reduceWorldOverlay(initialWorldOverlayState, { type: "drawer", snap: "preview" });
    const tools = reduceWorldOverlay(roster, { type: "tools", open: true });
    assert.equal(tools.drawerSnap, "closed");
    assert.equal(tools.toolsOpen, true);
  });

  it("dismisses every expansion for trainer, map, and combat ownership", () => {
    const open = reduceWorldOverlay(initialWorldOverlayState, { type: "drawer", snap: "expanded" });
    const blocked = reduceWorldOverlay(open, { type: "exclusive", owner: "combat" });
    assert.deepEqual(blocked, { drawerSnap: "closed", toolsOpen: false, panelKey: null, exclusiveOwner: "combat" });
  });

  it("cancels ambiguous state on viewport changes without changing data", () => {
    const open = reduceWorldOverlay(initialWorldOverlayState, { type: "tools", open: true });
    assert.deepEqual(reduceWorldOverlay(open, { type: "viewport-change" }), initialWorldOverlayState);
  });
});
