import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Wildz aerial and vista integration", () => {
  it("keeps aerial state transient and frame-local", async () => {
    const [campaign, canvas, gameState] = await Promise.all([
      readFile("src/features/play/PlayCampaign.tsx", "utf8"),
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
      readFile("src/features/play/game-state.ts", "utf8")
    ]);
    const playStateContract = gameState.slice(gameState.indexOf("export type PlayState"), gameState.indexOf("export const worldBounds"));

    assert.match(campaign, /aerialStateRef\s*=\s*useRef/);
    assert.match(canvas, /function AerialPlayerFrame/);
    assert.match(canvas, /advanceWildsAerialTraversal\(runtime\.current/);
    assert.doesNotMatch(playStateContract, /altitude|aerialMode|WildsAerial/);
  });

  it("requires selected-card flight before an aerial movement hint can cross terrain gates", async () => {
    const gameState = await readFile("src/features/play/game-state.ts", "utf8");
    assert.match(gameState, /input\.aerialMode === "flight"[\s\S]*traversalCapabilities\.includes\("flight"\)/);
    assert.match(gameState, /admittedAirborne[\s\S]*movementCapabilities/);
  });

  it("offers explicit takeoff, landing, overlook entry, and exact camera restoration", async () => {
    const [controls, environment, canvas] = await Promise.all([
      readFile("src/features/play/WildzWorldControls.tsx", "utf8"),
      readFile("src/features/play/WildsEnvironment.tsx", "utf8"),
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8")
    ]);

    assert.match(controls, /"Take flight"/);
    assert.match(controls, /"Land safely"/);
    assert.match(environment, /Open \$\{overlook\.name\} vista/);
    assert.match(canvas, /priorVista\.current = \{ position: camera\.position\.clone\(\), target: orbit\.target\.clone\(\) \}/);
    assert.match(canvas, /camera\.position\.copy\(priorVista\.current\.position\)/);
  });
});
