import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { applyWildsInput, createOwnerBoundInitialPlayState, selectedAsset } from "../src/features/play/game-state";
import { admitLegacyCard, currentCreatureHistoryProjection } from "../src/features/play/living-card-proof";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { projectWildzHud } from "../src/features/play/wildz-gameplay-hud";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { WildsCard } from "../src/features/play/WildsCard";
import { WildsCardBack } from "../src/features/play/WildsCardBack";

function levelTwoState() {
  const at = "2026-09-24T01:00:00.000Z";
  const card = admitLegacyCard(sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "keeper", encounterId: "level-views", capturedAt: at }), at);
  let state = createOwnerBoundInitialPlayState("keeper", at);
  state = applyWildsInput(state, { type: "import-card", asset: card });
  state = applyWildsInput(state, { type: "select-asset", assetId: card.id });
  for (const time of ["01:15", "01:30", "01:45"]) state = applyWildsInput(state, { type: "train", cardId: card.manifest.familyId, at: `2026-09-24T${time}:00.000Z` });
  return state;
}

test("HUD shows the exact level-two card even when the family cache says level one", () => {
  const state = levelTwoState();
  const card = selectedAsset(state)!;
  assert.ok(isLivingCardAsset(card));
  assert.equal(currentCreatureHistoryProjection(card).level, 2);
  const stale = { ...state, companionProgress: { ...state.companionProgress, [card.manifest.familyId]: { level: 1, xp: 0, bond: 0 } } };
  assert.equal(projectWildzHud(stale, { username: "keeper", displayName: "Keeper" }).companion.level, 2);
});

test("card front and back distinguish earned level two from evolution stage one", () => {
  const asset = selectedAsset(levelTwoState())!;
  const front = renderToStaticMarkup(<WildsCard asset={asset} />);
  const back = renderToStaticMarkup(<WildsCardBack asset={asset} origin="https://wildz.quest" qr="" />);
  assert.match(front, /Lv\. 2/);
  assert.match(front, /STAGE 1/);
  assert.match(back, /Level 2/);
  assert.match(back, /Stage 1/);
});
