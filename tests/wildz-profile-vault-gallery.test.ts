import assert from "node:assert/strict";
import { test } from "node:test";
import { createPublicWildsCardRecord } from "../src/features/play/public-card-registry";
import { sealCollectedCard } from "../src/features/play/portable-card";
import {
  ownerProfileVaultAssets,
  parseProfileVaultPublicAsset,
  profileVaultCardImageUrl
} from "../src/features/profile/profile-vault-card";

const publicAsset = sealCollectedCard({
  capturedAt: "2026-08-11T12:00:00.000Z",
  encounterId: "profile-gallery-public",
  formId: "mintcub-1",
  ownerReceizId: "receiz:profile-owner"
});
const privateAsset = sealCollectedCard({
  capturedAt: "2026-08-11T12:01:00.000Z",
  encounterId: "profile-gallery-private",
  formId: "voltray-1",
  ownerReceizId: "receiz:profile-owner"
});
const publicCard = {
  id: publicAsset.id,
  name: publicAsset.manifest.name,
  proofDigest: publicAsset.proof.digest,
  visibility: "public" as const
};

test("owner Profile admits only exact assets present in its public Vault index", () => {
  const result = ownerProfileVaultAssets([publicCard], [publicAsset, privateAsset]);
  assert.deepEqual([...result.keys()], [publicAsset.id]);
});

test("remote Profile accepts only an exact verified published record", () => {
  const validRecord = createPublicWildsCardRecord(
    publicAsset,
    "https://wildz.quest/cards/test",
    "2026-08-11T12:02:00.000Z"
  );
  assert.equal(parseProfileVaultPublicAsset(publicCard, { record: validRecord })?.id, publicCard.id);
  assert.equal(parseProfileVaultPublicAsset(publicCard, { record: { ...validRecord, assetId: privateAsset.id } }), null);
  assert.equal(parseProfileVaultPublicAsset(publicCard, { record: {} }), null);
});

test("profile card image URLs encode the exact public asset ID", () => {
  assert.equal(profileVaultCardImageUrl("wilds:a/b"), "/api/cards/wilds%3Aa%2Fb/image");
});
