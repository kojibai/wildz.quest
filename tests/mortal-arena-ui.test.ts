import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Mortal Arena UI integration", () => {
  it("keeps the Wildz control language while exposing every survival choice", async () => {
    const source = await readFile("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
    for (const action of ["Strike", "Guard", "Dodge", "Parry", "Focus", "Tag", "Use", "Withdraw"]) assert.match(source, new RegExp(action));
    assert.match(source, /MortalArenaTrackpad/);
    assert.match(source, /MortalArenaCovenant/);
    assert.doesNotMatch(source, /@dimforge|cannon-es|socket\.io/);
  });

  it("renders an actual Three.js Arena instead of the former CSS duel", async () => {
    const source = await readFile("src/features/games/mortal-arena/MortalArenaScene.tsx", "utf8");
    assert.match(source, /<Canvas/);
    assert.match(source, /WildsCreatureActor/);
    assert.match(source, /MortalArenaState/);
    assert.match(source, /ArenaImpactVfx/);
    assert.match(source, /mortalArenaCameraDistance/);
    assert.match(source, /mortalArenaRivalCreature/);
    assert.match(source, /anatomy=\{appearance\?\.anatomy\}/);
    assert.match(source, /cadenceMs=\{appearance\?\.cadenceMs\}/);
    assert.match(source, /identityToken=\{appearance\?\.fingerprint \?\? opponent\?\.id \?\? card\.id\}/);
    assert.match(source, /morphology=\{appearance\?\.morphology\}/);
    assert.match(source, /<mesh receiveShadow>\s*<cylinderGeometry/s);
    assert.doesNotMatch(source, /<mesh receiveShadow rotation=.*?>\s*<cylinderGeometry/s);
  });

  it("does not advance the match clock before mode admission", async () => {
    const source = await readFile("src/features/games/mortal-arena/use-mortal-arena.ts", "utf8");
    assert.match(source, /active: boolean/);
    assert.match(source, /if \(!playable/);
    assert.match(source, /mortal_arena_ranked_global_session_required/);
    assert.match(source, /mortal_arena_signed_covenant_required/);
  });

  it("captures the covenant hold without selecting text or cancelling on tiny pointer drift", async () => {
    const source = await readFile("src/features/games/mortal-arena/MortalArenaCovenant.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");
    assert.match(source, /setPointerCapture/);
    assert.match(source, /event\?\.preventDefault\(\)/);
    assert.doesNotMatch(source, /onPointerLeave=\{stop\}/);
    assert.match(css, /\.mortal-arena-covenant-hold\s*\{[^}]*touch-action:\s*none[^}]*user-select:\s*none/s);
  });

  it("does not turn every movement release into an accidental jump", async () => {
    const source = await readFile("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
    assert.match(source, /movedRef/);
    assert.match(source, /if \(!movedRef\.current\) onJump\(\)/);
  });

  it("settles every affected owned card from the canonical result", async () => {
    const source = await readFile("src/features/games/mortal-arena/use-mortal-arena.ts", "utf8");
    assert.match(source, /projectCanonicalArenaResult/);
    assert.match(source, /createArenaSettlement\(\{ cards: roster, result/);
  });

  it("shows the one-match covenant only for Mortal and never persists global consent", async () => {
    const experience = await readFile("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
    const covenant = await readFile("src/features/games/mortal-arena/MortalArenaCovenant.tsx", "utf8");
    assert.match(experience, /requiresCovenant = mode === "mortal"/);
    assert.match(experience, /mode = "adventure"/);
    assert.doesNotMatch(covenant, /localStorage/);
    assert.match(covenant, /one exact match/);
  });
});
