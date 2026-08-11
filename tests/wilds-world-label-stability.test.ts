import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

test("moving world-space signs use stable non-blurred surfaces", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const world = readFileSync("src/features/play/WildsWorldCanvas.tsx", "utf8");
  const environment = readFileSync("src/features/play/WildsEnvironment.tsx", "utf8");

  for (const selector of [
    ".wilds-world-label span",
    ".wilds-remote-nameplate",
    ".wilds-landmark-wayfinder"
  ]) {
    const declaration = rule(css, selector);
    assert.ok(declaration, `${selector} must have an authored surface`);
    assert.doesNotMatch(declaration, /(?:-webkit-)?backdrop-filter\s*:/, `${selector} must not live-blur while moving in 3D`);
  }

  assert.match(world, /className="wilds-remote-nameplate"[\s\S]*?occlude=\{false\}/);
  assert.match(environment, /<Html center distanceFactor=\{9\} occlude=\{false\} position=\{\[0, 6\.15, 0\]\}/);
});
