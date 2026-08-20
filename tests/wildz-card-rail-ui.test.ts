import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const drawerPath = "src/features/play/WildzCreatureDrawer.tsx";

function drawerSource() {
  return readFileSync(drawerPath, "utf8");
}

test("the active creature selector uses a bounded memoized drawer with roster sorting", () => {
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const drawer = drawerSource();

  assert.match(controls, /<WildzCreatureDrawer/);
  assert.match(drawer, /memo\(function WildzCreatureDrawer/);
  assert.match(drawer, /sortWildzCards\(entries\.map\(\(entry\) => entry\.asset\), cardOrder\)/);
  assert.match(drawer, /sortedEntries\.slice\(range\.start, range\.end\)/);
  assert.doesNotMatch(drawer, /nearbyCards/);
  assert.match(drawer, /aria-label="Sort creature selector"/);
  assert.match(drawer, /<option value="rarity">Rarity<\/option>/);
  assert.match(drawer, /<option value="newest">Newest<\/option>/);
  assert.match(drawer, /<option value="oldest">Oldest<\/option>/);
});

test("creature XP flows above the exact Vault name and its verification check sits beside the name", () => {
  const drawer = drawerSource();
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const thumbnail = readFileSync("src/features/play/WildsCreatureThumbnail.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.ok(drawer.indexOf("entry.xp") >= 0);
  assert.ok(drawer.indexOf("entry.xp") < drawer.indexOf("wilds-creature-name"));
  assert.match(drawer, /<WildsVerifiedBadge\s*\/>/);
  assert.match(inventory, /wilds-inventory-card-xp/);
  assert.match(inventory, /<WildsVerifiedBadge\s*\/>/);
  assert.doesNotMatch(thumbnail, /wilds-creature-verified|Icons\.check/);
  assert.match(css, /\.wilds-creature-verified\s*\{[^}]*position:\s*static/s);
});

test("the fully opened Slate keeps complete living-roster details as its one-row cards", () => {
  const drawer = drawerSource();
  const css = readFileSync("app/globals.css", "utf8");

  for (const stat of ["entry.level", "entry.xp", "entry.name", "entry.bond", "entry.conditionLabel", "entry.element", "entry.species"]) {
    assert.ok(drawer.includes(stat), `missing ${stat}`);
  }
  assert.doesNotMatch(css, /\.wildz-creature-spread \.wildz-creature-choice-copy\s*\{[^}]*display:\s*none/s);
  assert.doesNotMatch(css, /\.wildz-creature-spread \.wildz-creature-choice\s*\{[^}]*grid-template-columns:/s);
});

test("automatic scrolling replaces manual creature page controls", () => {
  const drawer = drawerSource();

  assert.match(drawer, /onScroll=/);
  assert.match(drawer, /creatureBookWindow/);
  assert.match(drawer, /scrollLeft/);
  assert.match(drawer, /mode === "preview"/);
  assert.match(drawer, /mode === "expanded"/);
  assert.match(drawer, /aria-posinset=\{logicalPosition\}/);
  assert.match(drawer, /aria-setsize=\{total\}/);
  assert.doesNotMatch(drawer, /Previous card rail page|Next card rail page/);
});

test("the drawer boundary receives no movement camera or player-position state", () => {
  const drawer = drawerSource();

  for (const forbidden of ["cameraHeading", "movementMode", "playerPosition", "WildsInput"]) {
    assert.doesNotMatch(drawer, new RegExp(forbidden));
  }
});

test("a 100-entry fixture exposes a bounded drawer render window and living roster spreads", () => {
  const drawer = drawerSource();

  assert.match(drawer, /setRange\(\{ start: 0, end: 8 \}\)/);
  assert.match(drawer, /bookWindow\.pageSize/);
  assert.match(drawer, /sortedEntries\.slice\(start, start \+ bookWindow\.pageSize\)/);
  assert.doesNotMatch(drawer, /nearbyCards\.map\(|sortedCards\.map\(/);
});

test("loaded 100-card preview rail coalesces scroll updates without render feedback", () => {
  const drawer = drawerSource();
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(drawer, /railFrameRef/);
  assert.match(drawer, /window\.requestAnimationFrame/);
  assert.match(drawer, /previous\.start === start && previous\.end === end \? previous/);
  assert.doesNotMatch(drawer, /beginRailScrollGuard|guardRailHorizontalScroll|railGesture/);
  assert.doesNotMatch(drawer, /onPointerDown=\{beginRailScrollGuard\}|onPointerMove=\{guardRailHorizontalScroll\}/);
  assert.match(drawer, /window\.cancelAnimationFrame/);
  assert.match(css, /\.wildz-creature-window\s*\{[^}]*overflow-anchor:\s*none/s);
  assert.match(css, /\.wildz-creature-window\s*\{[^}]*touch-action:\s*pan-x/s);
});

test("the single-row rail is scroll-ready before opening and clears the final creature", () => {
  const drawer = drawerSource();
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(drawer, /const windowStyle = mode !== "expanded"/);
  assert.match(drawer, /creatureRailVirtualPadding\(sortedEntries\.length, range\.start, range\.end, RAIL_CARD_EXTENT, 0\)/);
  assert.match(drawer, /className="wildz-creature-window-end"/);
  assert.match(css, /\.wildz-creature-window-end\s*\{[^}]*flex:\s*0 0 40px/s);
});

test("Vault selection chrome changes in the same paint as the selected card", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-inventory-grid\s*>\s*button\s*\{[^}]*transition:\s*none;/s);
});

test("preview height keeps the full stat card below the accessible sort control", () => {
  const metrics = readFileSync("src/features/play/creature-drawer.ts", "utf8");

  assert.match(metrics, /preview: Math\.min\(184, available\)/);
});

test("inventory retains complete rarity newest and oldest owner preference", () => {
  const source = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(source, /sortWildzCards\([^,]+,\s*cardOrder\)/s);
  assert.match(source, /aria-label="Sort card vault"/);
  assert.match(source, /<option value="rarity">Rarity<\/option>/);
  assert.match(source, /<option value="newest">Newest<\/option>/);
  assert.match(source, /<option value="oldest">Oldest<\/option>/);
  assert.doesNotMatch(css, /\.wildz-nearby-cards article\s*\{[^}]*content-visibility:/s);
});
