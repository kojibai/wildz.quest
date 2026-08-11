import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  projectWildsAuthoredDarkness,
  projectWildsReadabilityProfile
} from "../src/features/play/wilds-night-readability";

test("authored cave darkness only applies once the explorer enters the encounter", () => {
  const outside = projectWildsAuthoredDarkness({
    encounter: { phase: "hint", cover: "cave" },
    player: { x: 0, z: 0 },
    ecologySites: []
  });
  const inside = projectWildsAuthoredDarkness({
    encounter: { phase: "player_turn", cover: "cave" },
    player: { x: 0, z: 0 },
    ecologySites: []
  });

  assert.deepEqual(outside, { amount: 0, source: "none" });
  assert.deepEqual(inside, { amount: 0.82, source: "cave" });
});

test("storm darkness fades by authored site radius and ignores inactive storms", () => {
  const active = projectWildsAuthoredDarkness({
    encounter: { phase: "idle" },
    player: { x: 5, z: 0 },
    ecologySites: [{ familyId: "stormfront", phase: "emerged", position: { x: 0, z: 0 }, radius: 6 }]
  });
  const fringe = projectWildsAuthoredDarkness({
    encounter: { phase: "idle" },
    player: { x: 11, z: 0 },
    ecologySites: [{ familyId: "stormfront", phase: "emerged", position: { x: 0, z: 0 }, radius: 6 }]
  });
  const historical = projectWildsAuthoredDarkness({
    encounter: { phase: "idle" },
    player: { x: 0, z: 0 },
    ecologySites: [{ familyId: "stormfront", phase: "historical", position: { x: 0, z: 0 }, radius: 6 }]
  });

  assert.deepEqual(active, { amount: 0.68, source: "storm" });
  assert.equal(fringe.source, "storm");
  assert.ok(fringe.amount > 0 && fringe.amount < active.amount);
  assert.deepEqual(historical, { amount: 0, source: "none" });
});

test("readability raises only gameplay signals while preserving dark world values", () => {
  const day = projectWildsReadabilityProfile({
    authoredDarkness: 0,
    characterFill: 0.24,
    nightAmount: 0,
    reducedMotion: false,
    rim: 0.2
  });
  const night = projectWildsReadabilityProfile({
    authoredDarkness: 0.82,
    characterFill: 0.4,
    nightAmount: 0.96,
    reducedMotion: true,
    rim: 0.5
  });

  assert.equal(day.pathEmissive, 0);
  assert.ok(night.actorEmissive > day.actorEmissive);
  assert.ok(night.pathEmissive > day.pathEmissive);
  assert.ok(night.threatEmissive > night.pathEmissive);
  assert.equal(night.motionScale, 0);
  assert.equal(night.darkness, 0.96);
});

test("world actors, routes, atmosphere, and Kai geometry consume one readability profile", async () => {
  const [world, actor, explorer, environment, atmosphere, geometry, quality] = await Promise.all([
    readFile("src/features/play/WildsWorldCanvas.tsx", "utf8"),
    readFile("src/features/play/WildsCreatureActor.tsx", "utf8"),
    readFile("src/features/play/WildsExplorer.tsx", "utf8"),
    readFile("src/features/play/WildsEnvironment.tsx", "utf8"),
    readFile("src/features/play/WildsAtmosphere.tsx", "utf8"),
    readFile("src/features/play/WildsKaiAtmosphereGeometry.tsx", "utf8"),
    readFile("src/features/play/wilds-quality-profile.ts", "utf8")
  ]);

  assert.match(world, /projectWildsAuthoredDarkness/);
  assert.match(world, /authoredDarkness: darkness\.amount/);
  assert.match(world, /WildsReadabilityProvider/);
  assert.match(world, /darkness\.amount \* 0\.72/);
  assert.match(world, /authoredDarkness: darkness\.amount/);
  assert.match(world, /darknessSource: darkness\.source/);
  assert.match(world, /reducedMotion: qualityProfile\.reducedMotion/);
  assert.match(world, /speed=\{qualityProfile\.reducedMotion \? 0 : kaiExpression\.particleSpeed\}/);
  assert.match(actor, /useWildsReadability/);
  assert.match(actor, /readability\.actorEmissive/);
  assert.match(explorer, /useWildsReadability/);
  assert.match(environment, /readability\.pathEmissive/);
  assert.match(atmosphere, /readability\.darkness/);
  assert.match(atmosphere, /readability\.motionScale/);
  assert.match(geometry, /qualityProfile\.reducedMotion/);
  assert.match(quality, /reducedMotion: boolean/);
});
