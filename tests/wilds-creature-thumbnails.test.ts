import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("portable card thumbnails render deterministic Heartbound creature artwork", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");

  assert.match(campaign, /import \{ WildsCreatureThumbnail \}/);
  assert.match(campaign, /<WildsCreatureThumbnail asset=\{card\}/);
});

test("the Slate selector and Vault rows show creature artwork without a circular frame", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const drawer = readFileSync("src/features/play/WildzCreatureDrawer.tsx", "utf8");
  const scene = readFileSync("src/features/play/WildsCardScene.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(campaign, /<WildsCreatureThumbnail asset=\{card\}/);
  assert.match(inventory, /<WildsCreatureThumbnail asset=\{asset\} className="wilds-vault-creature-art"/);
  assert.match(drawer, /<WildsCreatureThumbnail asset=\{entry\.asset\} className="wildz-slate-creature-art"/);
  assert.match(css, /\.wilds-vault-creature-art,\s*\.wildz-slate-creature-art\s*\{[^}]*background:\s*transparent;[^}]*border-radius:\s*0;/s);
  assert.doesNotMatch(inventory, /<WildsCardPreview/);
  assert.doesNotMatch(drawer, /<WildsCardPreview/);
  assert.match(inventory, /<WildsCardScene asset=\{selected\}/);
  assert.match(scene, /wilds-card-flipper/);
  assert.match(scene, /<WildsCard asset=\{asset\} condition=\{condition\}/);
  assert.match(css, /\.wilds-inventory-detail \.wilds-card-scene\s*\{[^}]*width:\s*min\(380px,\s*calc\(100vw - 48px\)\);/s);
  assert.doesNotMatch(campaign, /manifest\.name\.slice\(0, 2\)/);
  assert.doesNotMatch(inventory, /manifest\.name\.slice\(0, 2\)/);
});

test("the in-game Card Vault claims first and owns the atomic merge boundary", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");

  assert.match(inventory, /onRestoreArtifact\(file/);
  assert.match(inventory, /currentPlayState = outcome\.playState/);
  assert.match(inventory, /\.receizvault/);
  assert.match(shell, /"merge-vault"/);
  assert.match(shell, /"activate-identity"/);
  assert.match(shell, /onRestoreArtifact=\{claimAndRestoreVaultArtifact\}/);
  assert.match(shell, /restoreArtifact\(\s*claimedFile,\s*"card-vault"/);
  assert.match(adapter, /restoreWildzArtifactForSurface/);
  assert.match(adapter, /continuityRestoreEpoch/);
  assert.doesNotMatch(inventory, /verifyPortableCardPng|verifyPortableVaultPng|inspectReceizCommerceVault|file\.arrayBuffer/);
});

test("D-pad preserves camera-relative analog movement and visible stick travel", () => {
  const dpad = readFileSync("src/features/play/WildzDpad.tsx", "utf8");
  const controls = readFileSync("src/features/play/WildzWorldControls.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");

  assert.match(dpad, /cameraRelativeMovement/);
  assert.match(dpad, /cameraHeadingRef\.current/);
  assert.match(dpad, /onPointerMove/);
  assert.match(dpad, /setPointerCapture/);
  assert.match(dpad, /onLostPointerCapture/);
  assert.match(dpad, /translate\(\$\{knob\.x\}px, \$\{knob\.y\}px\)/);
  assert.match(dpad, /addEventListener\("blur"/);
  assert.match(controls, /movementMode/);
  assert.match(campaign, /cameraHeadingRef=\{cameraHeadingRef\}/);
  assert.match(campaign, /onInput=\{dispatchWorldInput\}/);
});
