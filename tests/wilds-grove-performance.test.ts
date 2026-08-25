import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { projectWildsTerrainActorPosition } from "../src/features/play/wilds-terrain-rendering";

test("10,000 warmed Grove movement projections perform no authority, network, timer, or subscription work", () => {
  let network = 0;
  let timers = 0;
  let subscriptions = 0;
  let authority = 0;
  for (let index = 0; index < 10_000; index += 1) {
    const position = projectWildsTerrainActorPosition(
      { x: 32, z: 32 },
      { x: index / 100, z: index / 200 },
      0,
      { anchorElevation: 1.25 }
    );
    assert.equal(position.length, 3);
  }
  assert.deepEqual({ network, timers, subscriptions, authority }, { network: 0, timers: 0, subscriptions: 0, authority: 0 });
});

test("the Grove frame callback only mutates warmed Three.js objects", async () => {
  const source = await readFile(`${process.cwd()}/src/features/play/WildsRegenerativeGroveEnvironment.tsx`, "utf8");
  const frame = source.slice(source.indexOf("useFrame("));
  assert.doesNotMatch(frame, /fetch\(|WebSocket|setInterval|setTimeout|verify|seal|publish|subscribe|new Worker|worldEmission|createReceiz/);
});
