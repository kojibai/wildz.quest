import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const controlsPath = "src/features/play/WildzWorldControls.tsx";

test("world controls compose every bottom control in one semantic overlay", () => {
  const controls = existsSync(controlsPath) ? readFileSync(controlsPath, "utf8") : "";

  assert.match(controls, /useWorldOverlayDirector/);
  assert.match(controls, /className="wildz-world-controls"/);
  assert.match(controls, /className="wildz-movement-home"/);
  assert.match(controls, /className="wildz-tools-home"/);
  assert.match(controls, /className="wildz-companion-home"/);
  assert.doesNotMatch(controls, /wildz-social-deck/);
});
