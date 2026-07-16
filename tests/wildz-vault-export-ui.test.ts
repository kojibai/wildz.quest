import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Card Vault export seals the complete live V3 player payload, not cards alone", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const inventory = readFileSync("src/features/play/WildsInventory.tsx", "utf8");
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");
  const adapter = readFileSync("src/lib/receiz/wildz-identity-adapter.ts", "utf8");

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
  assert.match(exporter, /if \(player && !remoteProof\)/);
  assert.match(exporter, /receiz_proof_object_unavailable/);
  assert.match(adapter, /downloadWildzIdentityPlayerVault/);
  assert.match(adapter, /withKeyFile/);
  assert.match(adapter, /appendWildzIdentitySealAuthority/);
  assert.match(adapter, /createWildzIdentityBinding/);
  assert.match(adapter, /appendWildzIdentityBindingTrailer/);
});

test("v103 native proof responses are downloaded byte-exact without a legacy rzPo wrapper", () => {
  const exporter = readFileSync("src/features/play/card-export.ts", "utf8");

  assert.doesNotMatch(exporter, /remoteProof\s*\?\s*await embedReceizProofObjectInPng/);
  assert.equal(exporter.match(/const exported = remoteProof \?\? portableBytes;/g)?.length, 2);
});
