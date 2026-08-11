import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const controlsPath = "src/features/play/WildzWorldControls.tsx";

test("world controls compose every bottom control in one semantic overlay", () => {
  const controls = existsSync(controlsPath) ? readFileSync(controlsPath, "utf8") : "";
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");

  assert.match(campaign, /useWorldOverlayDirector/);
  assert.doesNotMatch(controls, /useWorldOverlayDirector/);
  assert.match(controls, /const panelOpen = exclusiveOwner === "command" && overlayState\.panelKey !== null/);
  assert.match(controls, /className=\{`wildz-world-controls\$\{panelOpen \? " is-panel-open" : ""\}`\}/);
  assert.match(controls, /aria-hidden=\{movementHomeBlocked\} className="wildz-movement-home" inert=\{movementHomeBlocked \? true : undefined\}/);
  assert.match(controls, /aria-hidden=\{toolsHomeBlocked\} className="wildz-tools-home" inert=\{toolsHomeBlocked \? true : undefined\}/);
  assert.match(controls, /aria-hidden=\{companionHomeBlocked\} className="wildz-companion-home" inert=\{companionHomeBlocked \? true : undefined\}/);
  assert.doesNotMatch(controls, /wildz-social-deck/);
});
