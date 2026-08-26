import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Card Vault export seals the complete live V3 player payload, not cards alone", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");
  const localVerifier = readFileSync("src/lib/receiz/wildz-downloaded-proof-verifier.ts", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const binding = readFileSync("src/lib/receiz/wildz-identity-vault-binding.ts", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");

  assert.match(campaign, /createWildsPlayerVault/);
  assert.match(campaign, /playerVault=\{\(\) => createWildsPlayerVault/);
  assert.match(campaign, /playState:\s*state/);
  assert.match(campaign, /avatarStyle/);
  assert.match(campaign, /movementMode/);
  assert.match(campaign, /presentation\.audioSettings/);
  assert.match(inventory, /playerVault:\s*\(\) => WildsPlayerVaultPayload/);
  assert.match(inventory, /const player = playerVault\(\)/);
  assert.doesNotMatch(inventory, /ensureActiveWildzProofSession|\/api\/auth\/receiz\/start/);
  assert.match(inventory, /onExportVault\(state\.inventory, player\)/);
  assert.match(exporter, /portableVaultPngBlob\(assets: PortableCardAsset\[\], player\?: WildsPlayerVaultPayload\)/);
  assert.match(exporter, /embedPortableVaultInPng\([^;]+assets, player\)/s);
  assert.match(exporter, /verifyProofObject\?: WildzDownloadedProofObjectVerifier/);
  assert.doesNotMatch(exporter, /wildz-downloaded-proof-verifier/);
  assert.match(localVerifier, /verifyReceizArtifact/);
  assert.match(localVerifier, /verified\.status !== "verified-artifact"/);
  assert.doesNotMatch(exporter, /\.wildz-card\.png/);
  assert.match(adapter, /downloadWildzIdentityPlayerVault/);
  assert.match(adapter, /withKeyFile/);
  assert.match(binding, /appendWildzIdentitySealAuthority/);
  assert.match(binding, /createWildzIdentityBinding/);
  assert.match(binding, /appendWildzIdentityBindingTrailer/);
  assert.match(shell, /downloadWildzIdentityPlayerCard/);
  const profile = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  assert.doesNotMatch(campaign, /onExportIdentityCard/);
  assert.doesNotMatch(inventory, /aria-label="Save Receiz ID Card"/);
  assert.match(profile, /aria-label="Upload Identity Seal or Record"/);
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
  assert.match(inventory, /createPreparedCardArtifactCache/);
  assert.match(inventory, /preparePortableCardArtifact/);
  assert.match(inventory, /preparedCardArtifacts\.prepare\(selected\)/);
  assert.doesNotMatch(inventory, /createReceizProofObjectArtifact|portableCardPngBlob/);
  assert.doesNotMatch(inventory, /ensureActiveWildzProofSession/);
  assert.doesNotMatch(inventory, /ensureWildzNativeProofSession|\/api\/auth\/receiz\/start/);
  assert.match(inventory, /navigator\.share/);
  assert.match(inventory, /mailto:/);
});

test("Save verified card prewarms its exact proof and resolves with premium accessible feedback", () => {
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");
  const css = readFileSync("app/globals.css", "utf8");

  assert.match(inventory, /onPrepareCard\(selectedCard, playerVaultRef\.current\(\)\)/);
  assert.match(inventory, /preparedIdentityCard\.current/);
  assert.match(inventory, /onExportCard\(asset, playerVault\(\), prepared\)/);
  assert.match(inventory, /Preparing verified card…/);
  assert.match(campaign, /onExportCard=\{onExportCard\}/);
  assert.match(campaign, /onPrepareCard=\{onPrepareCard\}/);
  assert.match(shell, /onPrepareCard=\{\(asset, player\) => prepareWildzIdentityOwnedCard\(identity, asset, player, \{ allowPrompt: false \}\)\}/);
  assert.match(shell, /savePreparedWildzIdentityOwnedCard\(prepared\)/);
  assert.match(adapter, /export async function downloadWildzIdentityOwnedCard/);
  assert.match(adapter, /export async function prepareWildzIdentityOwnedCard/);
  assert.match(adapter, /export async function savePreparedWildzIdentityOwnedCard/);
  assert.match(adapter, /await savePreparedWildzIdentityOwnedCard\(prepared\)/);
  assert.match(adapter, /portableCardPngBlobForIdentityOwnership\(asset\)/);
  assert.match(exporter, /export async function portableCardPngBlobForIdentityOwnership/);
  const identityOwnedRenderer = exporter.match(
    /export async function portableCardPngBlobForIdentityOwnership[\s\S]*?\n\}/
  )?.[0] ?? "";
  assert.doesNotMatch(identityOwnedRenderer, /requireGloballyAvailablePublicWildsCard/);
  assert.match(adapter, /embedPortableVaultInPng\([^;]+,\s*\[asset\],\s*activePlayer\s*\)/s);
  assert.match(adapter, /createWildzIdentityBoundPlayerVault/);
  assert.match(adapter, /playerId:\s*session\.username \?\? session\.actorId/);
  assert.match(inventory, /cardSavePresentation/);
  assert.match(inventory, /triggerCardHaptic\("press"\)/);
  assert.match(inventory, /triggerCardHaptic\("success"\)/);
  assert.match(inventory, /triggerCardHaptic\("error"\)/);
  assert.match(inventory, /data-state=\{cardSaveState\}/);
  assert.match(inventory, /aria-live="polite"/);
  assert.match(inventory, /wilds-card-save-celebration/);
  assert.match(css, /\.wilds-save-card-button\[data-state="success"\]/);
  assert.match(css, /\.wilds-save-card-button\s*\{[^}]*color:\s*#fff8cb;/s);
  assert.match(css, /\.wilds-card-save-celebration/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.wilds-card-save-celebration/s);
});

test("Vault export keeps the exact SDK-verified Receiz artifact as the downloadable artifact", () => {
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");
  const localVerifier = readFileSync("src/lib/receiz/wildz-downloaded-proof-verifier.ts", "utf8");

  assert.doesNotMatch(exporter, /verifyDownloadedWildzProofObjectLocally/);
  assert.match(localVerifier, /verifyReceizArtifact/);
  assert.match(localVerifier, /verified\.artifactDigest\.value !== await sha256\(artifactBytes\)/);
  assert.match(localVerifier, /verified\.payloadDigest\.value !== await sha256\(expectedPayloadBytes\)/);
  assert.doesNotMatch(exporter, /remoteProof \?\? portable|downloadBlob\(portable/);
});

test("v103 native proof responses are downloaded byte-exact without a legacy rzPo wrapper", () => {
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");

  assert.doesNotMatch(exporter, /remoteProof\s*\?\s*await embedReceizProofObjectInPng/);
  assert.doesNotMatch(exporter, /remoteProof \?\? portableBytes/);
});
