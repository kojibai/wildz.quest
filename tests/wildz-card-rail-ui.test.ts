import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { clampInventoryPage, inventoryPageSize } from "../src/features/play/inventory-pagination";

const railPath = "src/features/play/WildzPagedCardRail.tsx";

function railSource() {
  return existsSync(railPath) ? readFileSync(railPath, "utf8") : "";
}

test("the player card rail mounts only the active Commerce page and offers Vault sorting", () => {
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const rail = railSource();

  assert.match(social, /<WildzPagedCardRail/);
  assert.match(rail, /memo\(function WildzPagedCardRail/);
  assert.match(rail, /sortWildzCards\(nearbyCards,\s*cardOrder\)/);
  assert.match(rail, /inventoryPageSize\(compact\)/);
  assert.match(rail, /clampInventoryPage\(page,\s*sortedCards\.length,\s*pageSize\)/);
  assert.match(rail, /sortedCards\.slice\(safePage \* pageSize,\s*safePage \* pageSize \+ pageSize\)/);
  assert.doesNotMatch(rail, /sortedCards\.map\(/);
  assert.match(rail, /matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(rail, /aria-label="Sort card rail"/);
  assert.match(rail, /<option value="rarity">Rarity<\/option>/);
  assert.match(rail, /<option value="newest">Newest<\/option>/);
  assert.match(rail, /<option value="oldest">Oldest<\/option>/);
});

test("creature XP flows above the name and its verification check sits beside the name", () => {
  const rail = railSource();
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const thumbnail = readFileSync("src/features/play/WildsCreatureThumbnail.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.ok(rail.indexOf("wildz-nearby-xp") >= 0);
  assert.ok(rail.indexOf("wildz-nearby-xp") < rail.indexOf("wilds-creature-name"));
  assert.match(rail, /<WildsVerifiedBadge\s*\/>/);
  assert.match(inventory, /wilds-inventory-card-xp/);
  assert.match(inventory, /<WildsVerifiedBadge\s*\/>/);
  assert.doesNotMatch(thumbnail, /wilds-creature-verified|Icons\.check/);
  assert.match(css, /\.wilds-creature-verified\s*\{[^}]*position:\s*static/s);
});

test("rail sorting resets to page one and every page remains reachable by buttons and swipe", () => {
  const rail = railSource();

  assert.match(rail, /setPage\(0\);[\s\S]*?onCardOrderChange\(/);
  assert.match(rail, /aria-label="Previous card rail page"/);
  assert.match(rail, /aria-label="Next card rail page"/);
  assert.match(rail, /aria-live="polite"/);
  assert.match(rail, /onPointerDown=/);
  assert.match(rail, /onPointerMove=/);
  assert.match(rail, /onPointerUp=/);
  assert.match(rail, /onPointerCancel=/);
  assert.match(rail, /onLostPointerCapture=/);
  assert.match(rail, /aria-posinset=\{logicalPosition\}/);
  assert.match(rail, /aria-setsize=\{sortedCards\.length\}/);
});

test("a completed swipe suppresses only its synthetic click turn", () => {
  const rail = railSource();

  assert.match(rail, /const suppressCardClickReset = useRef<number \| null>\(null\)/);
  assert.match(
    rail,
    /suppressCardClick\.current = true;[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?suppressCardClick\.current = false;[\s\S]*?\}, 0\)/
  );
  assert.match(rail, /window\.clearTimeout\(suppressCardClickReset\.current\)/);
});

test("compact and wide page-size changes rebase from the first visible card", () => {
  const rail = railSource();

  assert.match(rail, /const previousPageSize = useRef\(pageSize\)/);
  assert.match(
    rail,
    /rebaseInventoryPage\(current, previousPageSize\.current, pageSize, sortedCards\.length\)/
  );
});

test("the memoized page boundary receives no movement, camera, or player-position state", () => {
  const rail = railSource();

  for (const forbidden of ["cameraHeading", "movementMode", "playerPosition", "WildsInput", "ResizeObserver", "overscan", "spacer"]) {
    assert.doesNotMatch(rail, new RegExp(forbidden));
  }
});

test("a 100-card fixture exposes only the active eight-card wide page to the render loop", () => {
  assert.ok(existsSync(railPath), "the isolated paged rail must exist");
  const cards = Array.from({ length: 100 }, (_, index) => `card-${index + 1}`);
  const pageSize = inventoryPageSize(false);
  const safePage = clampInventoryPage(0, cards.length, pageSize);
  const visibleCards = cards.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const rail = railSource();

  assert.equal(visibleCards.length, 8);
  assert.deepEqual(visibleCards, cards.slice(0, 8));
  assert.equal(Math.ceil(cards.length / pageSize), 13);
  assert.match(rail, /visibleCards\.map\(\(card, index\)/);
  assert.doesNotMatch(rail, /nearbyCards\.map\(|sortedCards\.map\(/);
});

test("inventory applies the same rarity, newest, and oldest owner preference without viewport virtualization", () => {
  const source = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(source, /sortWildzCards\([^,]+,\s*cardOrder\)/s);
  assert.match(source, /aria-label="Sort card vault"/);
  assert.match(source, /<option value="rarity">Rarity<\/option>/);
  assert.match(source, /<option value="newest">Newest<\/option>/);
  assert.match(source, /cardOrder/);
  assert.match(source, /onCardOrderChange/);
  assert.match(source, /<option value="oldest">Oldest<\/option>/);
  assert.doesNotMatch(css, /\.wildz-nearby-cards article\s*\{[^}]*content-visibility:/s);
});
