import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { wildsStoreProduct } from "../src/features/play/wilds-store-product.js";

describe("Wilds storefront products", () => {
  const card = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "merchant.receiz.id",
    encounterId: "shop-voltray",
    capturedAt: "2026-07-14T12:00:00.000Z"
  });

  it("turns a verified card into a one-of-one active shop product", () => {
    const product = wildsStoreProduct(card, "$48.00");

    assert.equal(product.type, "receized_asset");
    assert.equal(product.status, "active");
    assert.equal(product.inventoryLabel, "1 of 1");
    assert.equal(product.sealed, true);
    assert.equal(product.priceLabel, "$48.00");
    assert.equal(product.wildsAsset?.assetId, card.id);
    assert.equal(product.wildsAsset?.proofDigest, card.proof.digest);
    assert.equal(product.wildsAsset?.ownerReceizId, "merchant.receiz.id");
    assert.equal(product.imageUrl, `/api/cards/${encodeURIComponent(card.id)}/image`);
    assert.match(product.description ?? "", /Health \d+ · Power \d+ · Guard \d+ · Speed \d+ · Bond \d+/);
    assert.match(product.description ?? "", new RegExp(card.manifest.abilityNames[0]));
    assert.match(product.description ?? "", new RegExp(card.manifest.variant.traits.visualFingerprint));
    assert.match(product.description ?? "", /Offline proof:/);
  });

  it("assigns verified bearer custody to the uploading merchant without rewriting provenance", () => {
    const transferred = sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "original.collector.receiz.id",
      encounterId: "offline-transfer",
      capturedAt: "2026-07-14T12:05:00.000Z"
    });
    const product = wildsStoreProduct(transferred, "$64.00", "recipient.store.receiz.id");

    assert.equal(product.wildsAsset?.ownerReceizId, "recipient.store.receiz.id");
    assert.match(product.description ?? "", /Original sealed owner: original\.collector\.receiz\.id/);
    assert.match(product.description ?? "", /Verified bearer custody: recipient\.store\.receiz\.id/);
    assert.equal(transferred.manifest.ownerReceizId, "original.collector.receiz.id");
  });

  it("rejects invalid prices and tampered cards", () => {
    assert.throws(() => wildsStoreProduct(card, "$0.00"), /wilds_product_price_invalid/);
    assert.throws(
      () => wildsStoreProduct({ ...card, proof: { ...card.proof, digest: "sha256:tampered" } }, "$10.00"),
      /wilds_product_card_invalid/
    );
  });
});
