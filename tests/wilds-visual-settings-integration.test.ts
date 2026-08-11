import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildsPlayerVault, verifyWildsPlayerVault } from "../src/features/play/wilds-player-vault";

function player(visual?: { lanternEnabled: boolean; nightVisibility: "cinematic" | "balanced" | "high" }) {
  return createWildsPlayerVault({
    playerId: "night_keeper",
    exportedAt: "2026-08-11T21:00:00.000Z",
    playState: createOwnerBoundInitialPlayState("night_keeper", "2026-08-11T20:00:00.000Z"),
    character: null,
    settings: { avatarStyle: null, movementMode: "walk", audio: {}, cardOrder: "rarity", ...(visual ? { visual } : {}) },
    personalEvents: [],
    canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: []
  });
}

test("Wilds visual settings travel in the player Vault without invalidating legacy settings", () => {
  const current = player({ lanternEnabled: false, nightVisibility: "high" });
  assert.equal(verifyWildsPlayerVault(current).ok, true);
  assert.deepEqual(current.settings.visual, { lanternEnabled: false, nightVisibility: "high" });

  const legacy = player();
  assert.equal(verifyWildsPlayerVault(legacy).ok, true);
  assert.equal(legacy.settings.visual, undefined);

  assert.throws(() => player({ lanternEnabled: "yes" as never, nightVisibility: "unknown" as never }), /wilds_player_vault_visual_invalid/);
});

test("the world exposes a persistent accessible lantern control", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(campaign, /visualSettings={visualSettings}/);
  assert.match(campaign, /visual:\s*visualSettings/);
  assert.match(campaign, /const handleLanternToggle = useCallback/);
  assert.match(campaign, /onLanternToggle={handleLanternToggle}/);
  assert.match(controls, /aria-pressed=\{visualSettings\.lanternEnabled\}/);
  assert.match(controls, /Turn Wilds Lantern (?:on|off)/);
  assert.match(controls, /Icons\.lantern/);
  assert.match(controls, /onClick=\{handleLanternToggle\}/);
  assert.match(css, /\.wildz-quick-utilities\s*\{[^}]*grid-template-columns:\s*repeat\(3, 44px\)/s);
  assert.match(css, /\.wildz-quick-utilities > button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/s);
});
