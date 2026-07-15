import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("reference HUD exposes player status minimap and mission clusters", () => {
  const source = readFileSync("src/features/play/WildzReferenceHud.tsx", "utf8");
  for (const token of ["wildz-player-capsule", "wildz-status-rail", "WildzMinimap"]) {
    assert.match(source, new RegExp(token));
  }
});

test("D-pad maps analog camera-relative travel onto existing movement intents", () => {
  const source = readFileSync("src/features/play/WildzDpad.tsx", "utf8");
  for (const direction of ["north", "east", "south", "west"]) assert.match(source, new RegExp(direction));
  assert.match(source, /onInput/);
  assert.match(source, /move-vector/);
  assert.match(source, /cameraRelativeMovement/);
  assert.doesNotMatch(source, /useReducer/);
});

test("movement and context controls live inside the bottom play toolbar", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  for (const token of ["wildz-bottom-play-controls", "WildzDpad", "WildzContextButton"]) {
    assert.match(source, new RegExp(token));
  }
});
