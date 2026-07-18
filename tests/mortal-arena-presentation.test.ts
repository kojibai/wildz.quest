import assert from "node:assert/strict";
import { test } from "node:test";
import { mortalArenaCameraDistance, mortalArenaRivalCreature } from "../src/features/games/mortal-arena/presentation";

test("Mortal Arena camera fits wide combat on narrow mobile viewports", () => {
  const portrait = mortalArenaCameraDistance({ separationX: 18, separationZ: 0, aspect: 390 / 700, verticalFovDegrees: 43 });
  const landscape = mortalArenaCameraDistance({ separationX: 18, separationZ: 0, aspect: 16 / 9, verticalFovDegrees: 43 });
  assert.ok(portrait > landscape);
  assert.ok(portrait >= 22);
  assert.ok(Number.isFinite(mortalArenaCameraDistance({ separationX: 0, separationZ: 0, aspect: 0, verticalFovDegrees: 43 })));
});

test("trainer rivals use affinity-specific creature silhouettes", () => {
  assert.deepEqual(mortalArenaRivalCreature("Grove"), { familyId: "mintcub", formId: "mintcub-3" });
  assert.deepEqual(mortalArenaRivalCreature("Spark"), { familyId: "voltray", formId: "voltray-3" });
  assert.deepEqual(mortalArenaRivalCreature("Tide"), { familyId: "ledgerfox", formId: "ledgerfox-3" });
  assert.deepEqual(mortalArenaRivalCreature("Prism"), { familyId: "titanseal", formId: "titanseal-3" });
});
