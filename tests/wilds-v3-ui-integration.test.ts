import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("Wilds V3 living-world UI integration", () => {
  it("uses one revision-safe semantic world client without sending raw combat totals", async () => {
    const source = await readFile("src/features/play/use-wilds-world.ts", "utf8");

    assert.match(source, /acceptWildsWorldSnapshot/);
    assert.match(source, /candidate\.revision < current\.revision/);
    assert.match(source, /buildWildsWorldCommandBody/);
    assert.match(source, /type: "ecology\.discover"/);
    assert.match(source, /type: "raid\.enter"/);
    assert.match(source, /type: "raid\.act"/);
    assert.match(source, /type: "raid\.retreat"/);
    assert.match(source, /AbortController/);
    assert.doesNotMatch(source, /type:\s*"raid\.act"[^\n]*(?:damage|support):/);
  });

  it("makes settlements, ecology, bosses, and raids reachable from the accepted campaign", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const statusHud = await readFile("src/features/play/WildsBalancedStatusHud.tsx", "utf8");
    const canvas = await readFile("src/features/play/WildsWorldCanvas.tsx", "utf8");
    const environment = await readFile("src/features/play/WildsEnvironment.tsx", "utf8");
    const map = await readFile("src/features/play/WildsWorldMap.tsx", "utf8");

    assert.match(campaign, /useWildsWorld/);
    assert.match(campaign, /<WildsBalancedStatusHud/);
    assert.match(statusHud, /<WildsLivingWorldHud/);
    assert.match(campaign, /<WildsSettlementExperience/);
    assert.match(campaign, /<WildsEcologyExperience/);
    assert.match(campaign, /<WildsRaidExperience/);
    assert.match(campaign, /record-civic-event/);
    assert.match(campaign, /record-ecology-event/);
    assert.match(campaign, /record-raid-event/);
    assert.match(canvas, /<WildsEcologyEnvironment/);
    assert.match(canvas, /<WildsBossEnvironment/);
    assert.match(environment, /<WildsSettlementEnvironment/);
    assert.match(map, /ecologyKnowledge/);
    assert.match(map, /bossKnowledge/);
  });

  it("keeps the standalone identity, export, social, and compact mobile contracts intact", async () => {
    const campaign = await readFile("src/features/play/PlayCampaign.tsx", "utf8");
    const settlement = await readFile("src/features/play/WildsSettlementExperience.tsx", "utf8");
    const ecology = await readFile("src/features/play/WildsEcologyExperience.tsx", "utf8");
    const raid = await readFile("src/features/play/WildsRaidExperience.tsx", "utf8");
    const css = await readFile("app/globals.css", "utf8");

    assert.match(campaign, /initialPlayerContinuity/);
    assert.match(campaign, /onExportVault/);
    assert.match(campaign, /onRestoreArtifact/);
    assert.match(campaign, /<WildzWorldControls/);
    assert.doesNotMatch(campaign, /<WildzSocialDeck|<WildsCommandDock/);
    assert.doesNotMatch(campaign, /key: "social"/);
    assert.match(campaign, /Trail Pack/);
    assert.match(campaign, /Wilds Heartbeat/);
    assert.match(campaign, /Pack synergy/);
    assert.match(campaign, /mood/i);
    assert.match(campaign, /memory/i);
    assert.match(campaign, /whisper/i);
    assert.match(campaign, /supportCards=\{trailSupportCards\}/);
    for (const source of [settlement, ecology, raid]) {
      assert.match(source, /role="dialog"/);
      assert.match(source, /aria-modal="true"/);
      assert.match(source, /createPortal/);
      assert.match(source, /event\.key === "Escape"/);
      assert.match(source, /previousFocus/);
    }
    assert.match(css, /\.wilds-settlement-experience\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.wilds-ecology-experience\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.wilds-raid-experience\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.wilds-ecology-action\s*\{[^}]*min-height:\s*44px/s);
    assert.match(css, /\.wilds-raid-action\s*\{[^}]*min-height:\s*44px/s);
  });
});
