import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Receiz continuity preserves identity, original Wildz vault, and Commerce vault paths", () => {
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const codec = readFileSync("src/lib/receiz/wildz-artifact-codec.ts", "utf8");
  const commerce = readFileSync("src/lib/receiz/receiz-commerce-vault.ts", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");

  assert.match(adapter, /inspectReceizCommerceVault/);
  assert.match(adapter, /restoreWildzArtifactForSurface/);
  assert.match(codec, /readReceizIdentityArtifact\(bytes\)/);
  assert.match(codec, /extractVerifiedWildzCards/);
  assert.match(codec, /commerceVaultReader\.inspect/);
  assert.match(commerce, /restoreVerifiedReceizVaultPackage/);
  assert.match(commerce, /receiz\.signal_vault_card_manifest/);
  assert.match(commerce, /receiz\.sports_arena\.vault_card_manifest/);
  assert.match(commerce, /receiz_vault_archive_hash_mismatch/);
  assert.match(inventory, /onRestoreArtifact\(file/);
  assert.doesNotMatch(inventory, /verifyPortableCardPng|verifyPortableVaultPng|inspectReceizCommerceVault/);
});

test("live minimap projects world routes and landmarks around player movement heading", () => {
  const minimap = readFileSync("src/features/play/WildzMinimap.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");

  assert.match(minimap, /WILDS_MAJOR_ROUTES/);
  assert.match(minimap, /WILDS_FLAGSHIP_LANDMARKS/);
  assert.match(minimap, /mapPoint\(point\.x, point\.z, x, z, size\)/);
  assert.match(minimap, /rotate\(\$\{heading\}rad\)/);
  assert.match(campaign, /Math\.atan2\(deltaX, -deltaZ\)/);
  assert.match(campaign, /heading=\{playerHeading\}/);
});

test("standalone card route and dark PWA chrome are production-defined", () => {
  const cardPage = readFileSync("app/cards/[assetId]/page.tsx", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  const product = readFileSync("src/lib/wildz/product.ts", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(cardPage, /WildsCardPage/);
  assert.match(cardPage, /assetId/);
  assert.match(layout, /themeColor: WILDZ_PRODUCT\.themeColor/);
  assert.match(product, /themeColor: "#09110d"/);
  assert.match(css, /color-scheme:\s*dark/);
  for (const key of ["fieldGuide", "satchel", "deck", "vault"]) assert.match(css, new RegExp(`\\.wilds-command-sheet-${key}`));
});
