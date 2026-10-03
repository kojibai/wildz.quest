import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the app viewport and root touch policy disable native zoom while allowing scrolling", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(layout, /maximumScale: 1/);
  assert.match(layout, /userScalable: false/);
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /html,\s*body\s*\{[^}]*touch-action: pan-x pan-y;/);
});

test("native zoom fallback covers Safari gestures and double taps without stopping app clicks", () => {
  const guard = readFileSync("src/features/pwa/NativeInteractionGuard.tsx", "utf8");
  for (const name of ["dblclick", "gesturestart", "gesturechange"]) {
    assert.ok(guard.includes(`document.addEventListener("${name}", preventNativeZoom, { passive: false })`));
    assert.ok(guard.includes(`document.removeEventListener("${name}", preventNativeZoom)`));
  }
  assert.doesNotMatch(guard, /stopPropagation|touchend|touchstart/);
});
