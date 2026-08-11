import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("reference HUD exposes the proof-bound explorer, mission, and minimap without companion duplication", () => {
  const source = readFileSync("src/features/play/WildzReferenceHud.tsx", "utf8");
  for (const token of ["wildz-explorer-capsule", "wildz-explorer-portrait", "projectWildsExplorerAppearance", "character.digest", "model.player.level", "model.energy.current", "WildzMinimap"]) {
    assert.match(source, new RegExp(token));
  }
  assert.doesNotMatch(source, /activeCard|WildsCreatureThumbnail|wildz-companion-vitality/);
  assert.doesNotMatch(source, /wildz-status-rail|XP/);
});

test("D-pad maps analog camera-relative travel onto existing movement intents", () => {
  const source = readFileSync("src/features/play/WildzDpad.tsx", "utf8");
  for (const direction of ["north", "east", "south", "west"]) assert.match(source, new RegExp(direction));
  assert.match(source, /onInput/);
  assert.match(source, /move-vector/);
  assert.match(source, /cameraRelativeMovement/);
  assert.match(source, /Math\.min\(rect\.width, rect\.height\) \* 0\.42/);
  assert.match(source, /window\.requestAnimationFrame\(tick\)/);
  assert.match(source, /window\.cancelAnimationFrame\(frame\)/);
  assert.equal(source.match(/emitMovement\(/g)?.length, 2, "movement must emit immediately and then repeat while held");
  const pointerDownStart = source.indexOf("onPointerDown=");
  const pointerMoveStart = source.indexOf("onPointerMove=", pointerDownStart);
  const pointerUpStart = source.indexOf("onPointerUp=", pointerMoveStart);
  assert.ok(pointerDownStart >= 0 && pointerMoveStart > pointerDownStart && pointerUpStart > pointerMoveStart);
  assert.match(source.slice(pointerDownStart, pointerMoveStart), /emitMovement\(next\)/);
  assert.doesNotMatch(source.slice(pointerMoveStart, pointerUpStart), /emitMovement|input\.current/);
  for (const stop of ["setPointerCapture", "releasePointerCapture", "onLostPointerCapture", "onPointerCancel", "onPointerUp", 'addEventListener("blur"', 'addEventListener("visibilitychange"']) {
    assert.match(source, new RegExp(stop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(source, /useReducer/);
});

test("movement and context controls live inside the unified world overlay", () => {
  const source = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  for (const token of ["wildz-world-controls", "WildzDpad", "WildsCompanionCommand"]) {
    assert.match(source, new RegExp(token));
  }
});
