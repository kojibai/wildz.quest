import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialWorldOverlayState, reduceWorldOverlay, shouldSuspendWildsWorld } from "../src/features/play/world-overlay-state";
import { restorePlayModalFocusOnRelease } from "../src/features/play/use-play-modal-lifecycle";

describe("living-world overlay authority", () => {
  it("pauses drawing behind Vault and resumes it for the visible world and creation tools", () => {
    assert.equal(shouldSuspendWildsWorld("command", "vault", false), true);
    assert.equal(shouldSuspendWildsWorld("none", null, false), false);
    assert.equal(shouldSuspendWildsWorld("creation", null, false), false);
    assert.equal(shouldSuspendWildsWorld("command", "construction", false), false);
    assert.equal(shouldSuspendWildsWorld("command", "satchel", false), false);
    assert.equal(shouldSuspendWildsWorld("market", null, false), true);
    assert.equal(shouldSuspendWildsWorld("dream", null, false), true);
    assert.equal(shouldSuspendWildsWorld("map", null, true), true);
    assert.equal(shouldSuspendWildsWorld("map", null, false), false);
  });

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

  it("makes wallet one exact exclusive owner", () => {
    const open = reduceWorldOverlay(initialWorldOverlayState, { type: "drawer", snap: "expanded" });
    const owned = reduceWorldOverlay(open, { type: "exclusive", owner: "wallet" });
    assert.deepEqual(owned, { drawerSnap: "closed", toolsOpen: false, panelKey: null, exclusiveOwner: "wallet" });
    assert.equal(reduceWorldOverlay(owned, { type: "tools", open: true }), owned);
  });

  it("restores the wallet origin exactly once after a takeover releases", () => {
    let focusCalls = 0;
    const origin = {} as HTMLElement;
    assert.equal(restorePlayModalFocusOnRelease("wallet", "profile", origin, () => { focusCalls += 1; return true; }), false);
    assert.equal(restorePlayModalFocusOnRelease("profile", "none", origin, () => { focusCalls += 1; return true; }), true);
    assert.equal(focusCalls, 1);
  });

  it("cancels ambiguous state on viewport changes without changing data", () => {
    const open = reduceWorldOverlay(initialWorldOverlayState, { type: "tools", open: true });
    assert.deepEqual(reduceWorldOverlay(open, { type: "viewport-change" }), initialWorldOverlayState);
  });
});
