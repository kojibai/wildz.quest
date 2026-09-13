import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { CreatureContinuityPanel } from "../src/features/play/CreatureContinuityPanel";
import { sealCollectedCard } from "../src/features/play/portable-card";

const asset = sealCollectedCard({ formId: "ledgerfox-1", ownerReceizId: "memory-owner", encounterId: "continuity-memory-card", capturedAt: "2026-09-13T12:00:00.000Z" });

test("Vault continuity keeps original life-away controls and exposes shared travel memory without crew movement buttons", () => {
  let reads = 0;
  const html = renderToStaticMarkup(<CreatureContinuityPanel asset={asset} beans={12} onInput={() => {}}
    readCrewHistory={async () => { reads++; return { observations: [], nextCursor: null, battles: [] }; }} />);
  assert.match(html, /Life while away/);
  assert.match(html, /Awaken life while away/);
  assert.match(html, /Continuity memory/);
  assert.match(html, /Travel journal/);
  assert.doesNotMatch(html, />Follow(?: me)?</i);
  assert.doesNotMatch(html, />Roam(?: freely)?</i);
  assert.doesNotMatch(html, /wilds-crew-creature-controls/);
  assert.equal(reads, 0, "History stays lazy until the existing journal is opened");
});

test("Vault forwards the shared history reader to continuity without mounting HUD action controls", () => {
  const source = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  assert.doesNotMatch(source, /WildsCrewCreatureControls/);
  assert.match(source, /<CreatureContinuityPanel[^>]*readCrewHistory=\{readCrewHistory\}/);
  const panel = readFileSync("src/features/play/CreatureContinuityPanel.tsx", "utf8");
  assert.match(panel, /<WildsCrewTravelJournal key=\{asset.id\} assetId=\{asset.id\} name=\{asset.manifest.name\} readHistory=\{readCrewHistory\}/);
});
