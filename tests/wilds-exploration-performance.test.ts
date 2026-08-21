import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { applyWildsInput, initialPlayState } from "../src/features/play/game-state";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { wildsHotspotProjectionDiagnostics } from "../src/features/play/hidden-hotspots";
import { wildsTraversalProjectionDiagnostics } from "../src/features/play/wilds-traversal-capabilities";

test("ten thousand post-upload movement steps reuse exploration and perform no background hotspot or traversal projection work", () => {
  const uploaded = sealCollectedCard({
    formId: "ledgerfox-1",
    ownerReceizId: "atlas-performance-player",
    encounterId: "atlas-performance-upload",
    capturedAt: "2026-08-21T14:00:00.000Z"
  });
  let state = applyWildsInput({ ...structuredClone(initialPlayState), player: { x: 1, z: 1 } }, {
    type: "import-card",
    asset: uploaded
  });
  state = applyWildsInput(state, { type: "move-vector", x: 1, z: 0 });
  const exploration = state.explorationAtlas;
  const hotspots = wildsHotspotProjectionDiagnostics();
  const traversal = wildsTraversalProjectionDiagnostics();

  for (let index = 0; index < 10_000; index += 1) {
    state = applyWildsInput(state, { type: "move-vector", x: index % 2 === 0 ? -1 : 1, z: 0 });
  }

  assert.equal(state.explorationAtlas, exploration);
  assert.deepEqual(wildsHotspotProjectionDiagnostics(), hotspots);
  assert.deepEqual(wildsTraversalProjectionDiagnostics(), traversal);
});

test("exploration, movement, and atlas rendering contain no verification or background work", async () => {
  const exploration = await readFile("src/features/play/wilds-exploration-atlas.ts", "utf8");
  const canvas = await readFile("src/features/play/WildsAtlasCanvas.tsx", "utf8");
  const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
  const gameState = await readFile("src/features/play/game-state.ts", "utf8");
  for (const source of [exploration, canvas]) {
    assert.doesNotMatch(source, /verifyAnyWildsCard|verifyPortableCard|setInterval|setTimeout|requestIdleCallback|fetch\(/);
  }
  assert.doesNotMatch(exploration, /nearbyHiddenHotspots|hotspotsForRegion|sampleWildsTerrain/);
  const movement = gameState.slice(
    gameState.indexOf('if (input.type === "move" || input.type === "move-vector")'),
    gameState.indexOf('if (input.type === "rest")')
  );
  assert.ok(movement.length > 1_000);
  assert.doesNotMatch(movement, /verifyAnyWildsCard|verifyPortableCard|nearbyHiddenHotspots|hotspotsForRegion|serializePlayState|fetch\(/);
  assert.match(campaign, /\{exclusiveOwner === "map" && mapOpen \? <WildsWorldMap/);
});
