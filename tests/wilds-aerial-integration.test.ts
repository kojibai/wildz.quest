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
    assert.doesNotMatch(gameState, /admittedAirborne[\s\S]{0,180}"swim" as const, "climb" as const/);
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

  it("publishes a changing measured altitude and a visible clear-air climb state", async () => {
    const [canvas, controls] = await Promise.all([
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
      readFile("src/features/play/WildzWorldControls.tsx", "utf8")
    ]);

    assert.match(canvas, /readoutValue[\s\S]*currentVertical\.offset/);
    assert.match(canvas, /Math\.round\(readoutValue \* 4\)/);
    assert.match(canvas, /onVerticalReadoutChange\(layer, readoutValue/);
    assert.match(controls, /clear-air climb/);
    assert.match(controls, /WILDS_POWERED_FLIGHT_CRUISE_CLEARANCE/);
  });

  it("keeps the selected creature in the same flight frame with an aerial pose", async () => {
    const canvas = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const frame = canvas.slice(canvas.indexOf("<AerialPlayerFrame"), canvas.indexOf("</AerialPlayerFrame>") + "</AerialPlayerFrame>".length);
    assert.match(frame, /<WildsExplorer/);
    assert.match(frame, /<ActiveCompanion/);
    assert.match(frame, /aerialStateRef\.current\.mode !== "ground" \? "air"/);
  });

  it("turns a physical upper-mountain refusal into a clear HUD explanation", async () => {
    const [gameState, runtime] = await Promise.all([
      readFile("src/features/play/game-state.ts", "utf8"),
      readFile("src/features/play/wilds-site-runtime.ts", "utf8")
    ]);
    assert.match(runtime, /blockedByClimb/);
    assert.match(gameState, /siteMovement\?\.blockedByClimb/);
    assert.match(gameState, /Mountain slope too steep\. Lead with a creature built to climb higher\./);
  });

  it("threads actual transient clearance into horizontal movement without changing PlayState persistence", async () => {
    const [campaign, gameState] = await Promise.all([
      readFile("src/features/play/PlayCampaign.tsx", "utf8"),
      readFile("src/features/play/game-state.ts", "utf8")
    ]);
    const playStateContract = gameState.slice(gameState.indexOf("export type PlayState"), gameState.indexOf("export const worldBounds"));

    assert.match(campaign, /verticalClearance:\s*verticalTraversalRef\.current\.offset/);
    assert.match(campaign, /verticalWorldY:\s*verticalTraversalRef\.current\.worldY/);
    assert.match(gameState, /verticalClearance\?: number/);
    assert.match(gameState, /resolveWildsGroundMovement\(player, intended, \{ capabilities, aerialMode, verticalClearance, verticalWorldY \}\)/);
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
    assert.match(controls, /startVerticalIntent\(1\);[\s\S]{0,180}try \{ event\.currentTarget\.setPointerCapture/);
    assert.match(controls, /visibilitychange/);
    assert.match(controls, /\[gestureCancelSignal[^\]]*stopVerticalIntent|\[stopVerticalIntent[^\]]*gestureCancelSignal/);
    assert.match(controls, /verticalControlsVisible \? <div/);
    assert.match(css, /\.wildz-vertical-controls[\s\S]*touch-action:\s*none/);
    assert.match(css, /\.wildz-vertical-status/);
  });

  it("rejects movement during pending landing and consumes one deterministic landing authority", async () => {
    const [campaign, canvas, aerial] = await Promise.all([
      readFile("src/features/play/PlayCampaign.tsx", "utf8"),
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
      readFile("src/features/play/wilds-aerial-traversal.ts", "utf8")
    ]);

    assert.match(campaign, /if \(!horizontalAllowedRef\.current\) return;/);
    assert.match(campaign, /resolveWildsRequiredLandingPosition[\s\S]*safeAnchor/);
    assert.match(campaign, /projectWildsRenderedLivingObstacles\(livingWorld\.snapshot\)/);
    assert.match(campaign, /resolveWildsRequiredLandingPosition\([\s\S]*obstacles:\s*livingPhysicalObstacles/);
    assert.match(campaign, /livingPhysicalObstacles=\{livingPhysicalObstacles\}/);
    assert.doesNotMatch(campaign, /\?\?\s*anchor/);
    assert.match(campaign, /completeWildsAerialLanding/);
    assert.doesNotMatch(campaign, /advanceWildsAerialTraversal/);
    assert.match(canvas, /landingRequired[\s\S]*onLandingRequired/);
    assert.doesNotMatch(aerial, /export function advanceWildsAerialTraversal/);
  });

  it("feeds live physical ceiling and protected-airspace samples into the same frame authority", async () => {
    const [canvas, bosses, settlement] = await Promise.all([
      readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
      readFile("src/features/play/WildsBossEnvironment.tsx", "utf8"),
      readFile("src/features/play/WildsSettlementEnvironment.tsx", "utf8")
    ]);

    assert.match(canvas, /writeWildsAerialCollisionSample/);
    assert.match(canvas, /aerialInput\.protectedAirspace = collisionSample\.protectedAirspace/);
    assert.match(canvas, /verticalInput\.ceilingY = collisionSample\.ceilingY/);
    assert.match(canvas, /verticalInput\.obstacleTopY = collisionSample\.obstacleTopY/);
    assert.match(canvas, /runtime\.current\.altitude = currentVertical\.worldY/);
    assert.match(canvas, /projectWildsAerialObstacleNeighborhood/);
    assert.match(canvas, /useMemo\([\s\S]*terrainTileX[\s\S]*terrainTileZ/);
    assert.match(canvas, /writeWildsAerialCollisionSample\([\s\S]*livingPhysicalObstacles/);
    assert.match(canvas, /livingPhysicalObstacles[\s\S]*terrainObstacleNeighborhood\.obstacles/);
    assert.match(bosses, /wildsBossPhysicalEnvelope\(familyId, boss\.phase\)/);
    assert.match(bosses, /physicalRadius:\s*physicalEnvelope\.radius/);
    assert.match(settlement, /WILDS_SETTLEMENT_PHYSICAL_DIMENSIONS\.timberHall/);
  });
});
