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
  assert.match(source, /Math\.min\(rect\.width, rect\.height\) \* 0\.42/);
  assert.match(source, /window\.setInterval\(\(\) => emitMovement\(\), 45\)/);
  assert.equal(
    source.match(/emitMovement\(/g)?.length,
    1,
    "the 45 ms hold interval must be the sole movement emitter"
  );
  const pointerDownStart = source.indexOf("onPointerDown=");
  const pointerMoveStart = source.indexOf("onPointerMove=", pointerDownStart);
  const pointerUpStart = source.indexOf("onPointerUp=", pointerMoveStart);
  assert.ok(pointerDownStart >= 0 && pointerMoveStart > pointerDownStart && pointerUpStart > pointerMoveStart);
  assert.doesNotMatch(source.slice(pointerDownStart, pointerMoveStart), /emitMovement|input\.current/);
  assert.doesNotMatch(source.slice(pointerMoveStart, pointerUpStart), /emitMovement|input\.current/);
  for (const stop of ["setPointerCapture", "releasePointerCapture", "onLostPointerCapture", "onPointerCancel", "onPointerUp", 'addEventListener("blur"', 'addEventListener("visibilitychange"']) {
    assert.match(source, new RegExp(stop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(source, /useReducer/);
});

test("movement and context controls live inside the bottom play toolbar", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  for (const token of ["wildz-bottom-play-controls", "WildzDpad", "WildzContextButton"]) {
    assert.match(source, new RegExp(token));
  }
});
