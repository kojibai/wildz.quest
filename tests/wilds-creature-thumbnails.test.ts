import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("portable card thumbnails render deterministic Heartbound creature artwork", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");

  assert.match(campaign, /import \{ WildsCreatureThumbnail \}/);
  assert.match(campaign, /<WildsCreatureThumbnail asset=\{card\}/);
});

test("active deck and vault grids use creature artwork instead of initials", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");

  assert.match(campaign, /<WildsCreatureThumbnail asset=\{card\}/);
  assert.match(inventory, /<WildsCreatureThumbnail asset=\{asset\}/);
  assert.doesNotMatch(campaign, /manifest\.name\.slice\(0, 2\)/);
  assert.doesNotMatch(inventory, /manifest\.name\.slice\(0, 2\)/);
});

test("vault restore keeps verified full-vault import behavior", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const genesis = readFileSync("src/features/identity/WildzGenesis.tsx", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");

  assert.match(inventory, /verifyPortableVaultPng/);
  assert.match(inventory, /assets\.forEach\(\(asset\) => onInput\(\{ type: "import-card", asset \}\)\)/);
  assert.match(genesis, /onRestoreVault\(\[\.\.\.result\.assets\]\)/);
  assert.match(adapter, /catch\s*\{[\s\S]*?const vault = verifyPortableVaultPng\(bytes\)/);
  assert.doesNotMatch(adapter, /identityFailure/);
});

test("D-pad preserves analog camera-relative movement and visible stick travel", () => {
  const dpad = readFileSync("src/features/play/WildzDpad.tsx", "utf8");
  const socialDeck = readFileSync("src/features/play/WildzSocialDeck.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");

  assert.match(dpad, /cameraRelativeMovement/);
  assert.match(dpad, /onPointerMove/);
  assert.match(dpad, /setPointerCapture/);
  assert.match(dpad, /onLostPointerCapture/);
  assert.match(dpad, /translate\(\$\{knob\.x\}px, \$\{knob\.y\}px\)/);
  assert.match(dpad, /addEventListener\("blur"/);
  assert.match(socialDeck, /cameraHeading/);
  assert.match(socialDeck, /movementMode/);
  assert.match(campaign, /cameraHeading=\{cameraHeading\}/);
  assert.match(campaign, /onInput=\{\(input\) => dispatch\(input\)\}/);
});
