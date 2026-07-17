import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Card Vault export seals the complete live V3 player payload, not cards alone", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");

  assert.match(campaign, /createWildsPlayerVault/);
  assert.match(campaign, /playerVault=\{\(\) => createWildsPlayerVault/);
  assert.match(campaign, /playState:\s*state/);
  assert.match(campaign, /avatarStyle/);
  assert.match(campaign, /movementMode/);
  assert.match(campaign, /presentation\.audioSettings/);
  assert.match(inventory, /playerVault:\s*\(\) => WildsPlayerVaultPayload/);
  assert.match(inventory, /onExportVault\(state\.inventory, playerVault\(\)\)/);
  assert.match(exporter, /portableVaultPngBlob\(assets: PortableCardAsset\[\], player\?: WildsPlayerVaultPayload\)/);
  assert.match(exporter, /embedPortableVaultInPng\([^;]+assets, player\)/s);
  assert.match(exporter, /if \(!remoteProof\) throw new Error\("receiz_proof_object_unavailable"\)/);
  assert.match(adapter, /downloadWildzIdentityPlayerVault/);
  assert.match(adapter, /withKeyFile/);
  assert.match(adapter, /appendWildzIdentitySealAuthority/);
  assert.match(adapter, /createWildzIdentityBinding/);
  assert.match(adapter, /appendWildzIdentityBindingTrailer/);
  assert.match(shell, /downloadWildzIdentityPlayerCard/);
  const profile = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  assert.doesNotMatch(campaign, /onExportIdentityCard/);
  assert.doesNotMatch(inventory, /aria-label="Save Receiz ID Card"/);
  assert.match(profile, /aria-label="Upload Identity Seal"/);
  assert.match(profile, /aria-label="Save Identity Seal"/);
  assert.match(profile, /full Wildz account continuity/);
  assert.match(profile, /Anyone who has it can authenticate this account/);
  assert.match(profile, /aria-busy=\{identitySealSaving\}/);
  assert.match(inventory, /wilds-action-feedback/);
});

test("Vault actions remain one perfectly aligned row after ID Card moves to Profile", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wilds-command-sheet-content \.wilds-vault-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*40px\)/s);
});

test("Vault card detail can send a saved card to a Receiz username or email", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");

  assert.match(inventory, /aria-label="Receiz username or email to send this card"/);
  assert.match(inventory, /sendPortableCardToTarget/);
  assert.match(inventory, /createWildsCardSendDraft/);
  assert.match(inventory, /navigator\.share/);
  assert.match(inventory, /mailto:/);
});

test("Vault export keeps the SDK native Record/Seal artifact as the downloadable artifact", () => {
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");

  assert.equal(exporter.match(/if \(!remoteProof\) throw new Error\("receiz_proof_object_unavailable"\);/g)?.length, 2);
  assert.doesNotMatch(exporter, /verifyPortableVaultPng\(remoteProof\)\.ok/);
});

test("v103 native proof responses are downloaded byte-exact without a legacy rzPo wrapper", () => {
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");

  assert.doesNotMatch(exporter, /remoteProof\s*\?\s*await embedReceizProofObjectInPng/);
  assert.doesNotMatch(exporter, /remoteProof \?\? portableBytes/);
});
