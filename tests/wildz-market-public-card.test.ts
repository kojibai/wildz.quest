import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayState } from "../src/features/play/game-state";
import { resolveSdkPublicWildzCard } from "../src/lib/receiz/wildz-market-public-card";
import { WILDZ_PUBLIC_STATE_SCHEMA } from "../src/lib/receiz/wildz-public-state";

test("public-card authority resolves only a verified exact SDK record", async () => {
  const asset = initialPlayState.inventory[0]!;
  const reader = {
    readAppStateByUrl: async () => ({
      result: {
        record: {
          schema: "receiz.wilds_public_card.v1",
          assetId: asset.id,
          sourceUrl: `https://wildz.quest/cards/${encodeURIComponent(asset.id)}`,
          registeredAt: "2026-07-15T12:00:00.000Z",
          asset
        }
      }
    })
  };

  const resolved = await resolveSdkPublicWildzCard(asset.id, {
    adapter: reader,
    requestOrigin: "https://wildz.quest"
  });
  assert.equal(resolved?.proof.digest, asset.proof.digest);
});

test("public-card authority rejects a mismatched or unverifiable SDK record", async () => {
  const asset = initialPlayState.inventory[0]!;
  const tampered = structuredClone(asset);
  tampered.proof.digest = "sha256:tampered";
  const resolved = await resolveSdkPublicWildzCard(asset.id, {
    adapter: {
      readAppStateByUrl: async () => ({
        schema: "receiz.wilds_public_card.v1",
        assetId: asset.id,
        sourceUrl: "https://wildz.quest/c/card",
        registeredAt: "2026-07-15T12:00:00.000Z",
        asset: tampered
      })
    },
    requestOrigin: "https://wildz.quest"
  });
  assert.equal(resolved, null);
});

test("public-card authority resolves a card from the full Wildz public projection", async () => {
  const asset = initialPlayState.inventory[0]!;
  const resolved = await resolveSdkPublicWildzCard(asset.id, {
    adapter: {
      readAppStateByUrl: async () => ({ ok: false }),
      resolvePublicStore: async () => ({
        data: {
          storeStateRecord: {
            schema: WILDZ_PUBLIC_STATE_SCHEMA,
            revision: 7,
            updatedAt: "2026-07-17T12:00:00.000Z",
            profiles: {},
            cards: { [asset.id]: asset }
          }
        }
      })
    },
    requestOrigin: "https://wildz.quest"
  });

  assert.equal(resolved?.id, asset.id);
  assert.equal(resolved?.proof.digest, asset.proof.digest);
});
