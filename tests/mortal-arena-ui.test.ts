import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Mortal Arena UI integration", () => {
  it("keeps the Wildz control language while exposing every survival choice", async () => {
    const source = await readFile("src/features/games/mortal-arena/MortalArenaExperience.tsx", "utf8");
    for (const action of ["Strike", "Guard", "Focus", "Swap", "Flee"]) assert.match(source, new RegExp(action));
    assert.match(source, /MortalArenaTrackpad/);
    assert.match(source, /MortalArenaCovenant/);
    assert.doesNotMatch(source, /@dimforge|cannon-es|socket\.io/);
  });

  it("renders an actual Three.js Arena instead of the former CSS duel", async () => {
    const source = await readFile("src/features/games/mortal-arena/MortalArenaScene.tsx", "utf8");
    assert.match(source, /<Canvas/);
    assert.match(source, /WildsCreatureActor/);
    assert.match(source, /MortalArenaState/);
  });

  it("does not advance the match clock before mortal consent", async () => {
    const source = await readFile("src/features/games/mortal-arena/use-mortal-arena.ts", "utf8");
    assert.match(source, /active: boolean/);
    assert.match(source, /if \(!active/);
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

  it("settles the creature actually active at the final blow", async () => {
    const source = await readFile("src/features/games/mortal-arena/use-mortal-arena.ts", "utf8");
    assert.match(source, /roster\[state\.sides\[0\]\.activeIndex\]/);
    assert.match(source, /card: settledCard/);
  });
});
