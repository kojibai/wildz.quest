import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the player card rail renders every restored card and offers Vault sorting", () => {
  const source = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");

  assert.doesNotMatch(source, /nearbyCards\.slice\(0,\s*4\)/);
  assert.match(source, /sortWildzCards\(nearbyCards,\s*cardOrder\)/);
  assert.match(source, /aria-label="Sort card rail"/);
  assert.match(source, /<option value="rarity">Rarity<\/option>/);
  assert.match(source, /<option value="newest">Newest<\/option>/);
  assert.match(source, /<option value="oldest">Oldest<\/option>/);
  assert.match(source, /sortedCards\.map\(\(card\)/);
});

test("creature XP flows above the name and its verification check sits beside the name", () => {
  const social = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const thumbnail = readFileSync("src/features/play/WildsCreatureThumbnail.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.ok(social.indexOf("wildz-nearby-xp") < social.indexOf("wilds-creature-name"));
  assert.match(social, /<WildsVerifiedBadge\s*\/>/);
  assert.match(inventory, /wilds-inventory-card-xp/);
  assert.match(inventory, /<WildsVerifiedBadge\s*\/>/);
  assert.doesNotMatch(thumbnail, /wilds-creature-verified|Icons\.check/);
  assert.match(css, /\.wilds-creature-verified\s*\{[^}]*position:\s*static/s);
});

test("inventory applies the same rarity, newest, and oldest owner preference without hiding pages", () => {
  const source = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(source, /sortWildzCards\([^,]+,\s*cardOrder\)/s);
  assert.match(source, /aria-label="Sort card vault"/);
  assert.match(source, /<option value="rarity">Rarity<\/option>/);
  assert.match(source, /<option value="newest">Newest<\/option>/);
  assert.match(source, /cardOrder/);
  assert.match(source, /onCardOrderChange/);
  assert.match(source, /<option value="oldest">Oldest<\/option>/);
  assert.match(css, /\.wildz-nearby-cards article\s*\{[^}]*content-visibility:\s*auto/s);
});
