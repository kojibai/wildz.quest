import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARENA_MODE_POLICIES,
  arenaModePolicy,
  assertArenaAuthority,
  type ArenaMode,
} from "../src/features/play/arena/mode";

describe("Arena mode policy", () => {
  it("keeps Practice, Adventure, Ranked, and Mortal consequences isolated", () => {
    assert.deepEqual(Object.keys(ARENA_MODE_POLICIES).sort(), ["adventure", "mortal", "practice", "ranked"]);
    assert.deepEqual(arenaModePolicy("practice"), {
      id: "wilds.arena.mode.practice.v1",
      mortality: "knockout",
      progression: "none",
      authority: "local",
      covenantRequired: false,
      aiOpponentAllowed: true,
      timeScale: "configurable",
    });
    assert.equal(arenaModePolicy("adventure").mortality, "knockout");
    assert.equal(arenaModePolicy("adventure").progression, "living-card");
    assert.equal(arenaModePolicy("ranked").progression, "rating-only");
    assert.equal(arenaModePolicy("ranked").mortality, "knockout");
    assert.equal(arenaModePolicy("mortal").mortality, "retirement");
    assert.equal(arenaModePolicy("mortal").covenantRequired, true);
  });

  it("fails Ranked closed without global authority", () => {
    assert.throws(() => assertArenaAuthority("ranked", "local"), /arena_mode_global_authority_required/);
    assert.throws(() => assertArenaAuthority("ranked", "offline-pending"), /arena_mode_global_authority_required/);
    assert.doesNotThrow(() => assertArenaAuthority("ranked", "global"));
  });

  it("does not allow an AI opponent to impersonate a Ranked human", () => {
    assert.equal(arenaModePolicy("ranked").aiOpponentAllowed, false);
    for (const mode of ["practice", "adventure", "mortal"] satisfies ArenaMode[]) {
      assert.equal(arenaModePolicy(mode).aiOpponentAllowed, true);
    }
  });
});
