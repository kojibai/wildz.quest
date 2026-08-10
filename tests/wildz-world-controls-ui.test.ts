import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const controlsPath = "src/features/play/WildzWorldControls.tsx";

test("world controls compose every bottom control in one semantic overlay", () => {
  const controls = existsSync(controlsPath) ? readFileSync(controlsPath, "utf8") : "";

  assert.match(controls, /useWorldOverlayDirector/);
  assert.match(controls, /const panelOpen = controlsEnabled && state\.panelKey !== null/);
  assert.match(controls, /className=\{`wildz-world-controls\$\{panelOpen \? " is-panel-open" : ""\}`\}/);
  assert.match(controls, /aria-hidden=\{panelOpen\} className="wildz-movement-home" inert=\{panelOpen \? true : undefined\}/);
  assert.match(controls, /className="wildz-tools-home"/);
  assert.match(controls, /aria-hidden=\{panelOpen\} className="wildz-companion-home" inert=\{panelOpen \? true : undefined\}/);
  assert.doesNotMatch(controls, /wildz-social-deck/);
});
