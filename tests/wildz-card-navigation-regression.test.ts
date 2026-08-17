import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { resolveInventoryDetailSelection } from "../src/features/play/inventory-detail-selection";
import {
  recallStandaloneWildzCard,
  rememberStandaloneWildzCard
} from "../src/features/play/standalone-card-handoff";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); }
  };
}

test("proof and roaming updates preserve the card a player is viewing", () => {
  const ids = ["first", "viewing", "third"];
  assert.equal(resolveInventoryDetailSelection({
    selectedId: "viewing",
    focusedAssetId: "first",
    previousFocusedAssetId: "first",
    inventoryIds: ids
  }), "viewing");
  assert.equal(resolveInventoryDetailSelection({
    selectedId: "viewing",
    focusedAssetId: "third",
    previousFocusedAssetId: "first",
    inventoryIds: ids
  }), "third");
  assert.equal(resolveInventoryDetailSelection({
    selectedId: "removed",
    focusedAssetId: "first",
    previousFocusedAssetId: "first",
    inventoryIds: ids
  }), "first");
});

test("standalone navigation hands off the exact verified card immediately", () => {
  const storage = memoryStorage();
  const asset = structuredClone(initialPlayState.inventory[0]!);
  assert.equal(rememberStandaloneWildzCard(asset, storage), true);
  const restored = recallStandaloneWildzCard(asset.id, storage);
  assert.deepEqual(restored, asset);
  assert.notEqual(restored, asset);

  const tampered = structuredClone(asset);
  tampered.proof.digest = `sha256:${"0".repeat(64)}`;
  assert.equal(rememberStandaloneWildzCard(tampered, storage), false);
});

test("standalone and send controls retain local truth and mobile focus", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const cardPage = readFileSync("src/features/play/WildsCardPage.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const consciousness = readFileSync("src/features/play/CreatureConsciousnessPanel.tsx", "utf8");
  assert.match(inventory, /rememberStandaloneWildzCard\(selected\)/);
  assert.match(cardPage, /stronger and fresher/);
  assert.match(inventory, /document\.activeElement instanceof HTMLElement/);
  assert.match(consciousness, /enterKeyHint="send"/);
  assert.match(consciousness, /event\.currentTarget\.blur\(\)/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*?\.wilds-creature-consciousness textarea,[\s\S]*?\.wilds-card-send-control input \{ font-size: 16px; \}/);
});
