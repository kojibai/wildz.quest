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
    assert.match(canvas, /writeWildsAerialRuntimeStep\(runtime\.current/);
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

    assert.match(controls, /Take flight/);
    assert.match(controls, /Flight energy/);
    assert.match(controls, /Recharge on the ground/);
    assert.match(controls, /Land safely/);
    assert.match(environment, /Open \$\{overlook\.name\} vista/);
    assert.match(environment, /name="overlook-sightglass"/);
    assert.match(canvas, /priorVista\.current = \{ position: camera\.position\.clone\(\), target: orbit\.target\.clone\(\) \}/);
    assert.match(canvas, /camera\.position\.copy\(priorVista\.current\.position\)/);
    assert.match(controls, /Land safely/);
    assert.match(canvas, /runtime\.current\.mode !== "ground"/);
  });

  it("seeds the one vertical authority before a flight or overlook glide enters the frame loop", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    assert.match(campaign, /beginWildsAerialTraversal\([\s\S]*writeWildsVerticalTraversalStep\(verticalTraversalRef\.current/);
  });

  it("wires explicit mobile ascend and descend intents only for swimming or flight", async () => {
    const [campaign, controls, canvas] = await Promise.all([
      readFile("src/features/play/PlayCampaign.tsx", "utf8"),
      readFile("src/features/play/WildzWorldControls.tsx", "utf8"),
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8")
    ]);

    assert.match(campaign, /verticalTraversalRef\s*=\s*useRef/);
    assert.match(controls, /Ascend/);
    assert.match(controls, /Descend/);
    assert.match(controls, /aerialMode === "flight"|aquaticPresentation\?\.mode === "swim"/);
    assert.match(canvas, /writeWildsVerticalTraversalStep/);
    assert.match(canvas, /verticalIntentRef\.current/);
    assert.doesNotMatch(canvas, /useFrame\([\s\S]{0,1200}setVertical/);
  });

  it("threads actual transient clearance into horizontal movement without changing PlayState persistence", async () => {
    const [campaign, gameState] = await Promise.all([
      readFile("src/features/play/PlayCampaign.tsx", "utf8"),
      readFile("src/features/play/game-state.ts", "utf8")
    ]);
    const playStateContract = gameState.slice(gameState.indexOf("export type PlayState"), gameState.indexOf("export const worldBounds"));

    assert.match(campaign, /verticalClearance:\s*verticalTraversalRef\.current\.offset/);
    assert.match(gameState, /verticalClearance\?: number/);
    assert.match(gameState, /resolveWildsGroundMovement\(player, intended, \{ capabilities, aerialMode, verticalClearance \}\)/);
    assert.doesNotMatch(playStateContract, /verticalTraversal|verticalClearance|safeMin|safeMax/);
  });

  it("resets transient height after identity restore and large coordinate discontinuities", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");

    assert.match(campaign, /Math\.hypot\(deltaX, deltaZ\) > 3[\s\S]*resetTransientTraversal/);
    assert.match(campaign, /setState\(restoredPlayState\);[\s\S]*resetTransientTraversal\(restoredPlayState\.player/);
    assert.match(campaign, /type: "apply-rift-grant"[\s\S]*resetTransientTraversal\(result\.grant\.destination/);
  });

  it("orders the allocation-free height writer before the camera and clears every mobile hold lifecycle", async () => {
    const [canvas, controls, css] = await Promise.all([
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
      readFile("src/features/play/WildzWorldControls.tsx", "utf8"),
      readFile("app/globals.css", "utf8")
    ]);

    assert.match(canvas, /writeWildsVerticalTraversalStep\(currentVertical[\s\S]*\}, -2\)/);
    assert.match(canvas, /writeUnderwaterCameraTarget\([\s\S]*clearance\)/);
    assert.match(controls, /onPointerCancel=\{stopVerticalIntent\}/);
    assert.match(controls, /onLostPointerCapture=\{stopVerticalIntent\}/);
    assert.match(controls, /visibilitychange/);
    assert.match(controls, /verticalControlsVisible \? <div/);
    assert.match(css, /\.wildz-vertical-controls[\s\S]*touch-action:\s*none/);
    assert.match(css, /\.wildz-vertical-status/);
  });
});
