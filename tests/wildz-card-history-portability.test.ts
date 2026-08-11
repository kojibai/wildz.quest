import assert from "node:assert/strict";
import { test } from "node:test";
import {
  embedPortableCardInPng,
  embedPortableVaultInPng,
  verifyPortableCardPng,
  verifyPortableVaultPng
} from "../src/features/play/card-export";
import {
  appendLivingCardHistory,
  currentCreatureHistoryProjection
} from "../src/features/play/living-card-proof";
import { admitLegacyCard } from "../src/features/play/living-card-proof";
import {
  canonicalPortableCardJson,
  portableCardBaseProofAsset,
  sealCollectedCard
} from "../src/features/play/portable-card";
import { isLivingCardAsset } from "../src/features/play/living-card-types";
import { extractVerifiedWildzCards } from "../src/lib/receiz/wildz-cross-platform-cards";

const BASE_PNG = Uint8Array.from(Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
));

function trainedCard() {
  const capturedAt = "2026-08-11T13:00:00.000Z";
  const birth = admitLegacyCard(sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "portable_history_keeper",
    encounterId: "portable-history",
    capturedAt
  }), capturedAt);
  return appendLivingCardHistory({
    asset: birth,
    event: {
      eventId: "portable:training:one",
      rulesetVersion: "wildz.progression.v1",
      occurredAt: "2026-08-11T13:10:00.000Z",
      source: {
        mode: "training",
        activityId: "portable:training",
        actorId: "portable_history_keeper",
        authority: "local"
      },
      evidence: {},
      effects: [{
        kind: "progress",
        xpDelta: 45,
        growthEvents: [{
          eventId: "portable:bond:one",
          kind: "bond_moment",
          path: "bond",
          amount: 4,
          occurredAt: "2026-08-11T13:10:00.000Z"
        }]
      }]
    }
  });
}

test("standalone card and full Vault restore the complete history without changing the base proof", () => {
  const card = trainedCard();
  const expectedBase = portableCardBaseProofAsset(card);
  const expectedHistory = canonicalPortableCardJson(card.manifest.history);

  const cardPng = embedPortableCardInPng(BASE_PNG, card);
  const portableBase = verifyPortableCardPng(cardPng);
  assert.equal(portableBase.ok, true);
  assert.equal(portableBase.asset?.proof.digest, expectedBase.proof.digest);
  const cardRestore = extractVerifiedWildzCards({
    pngBasis: cardPng,
    verifiedPortableSnapshot: null,
    restoredVaultFiles: []
  });
  assert.equal(cardRestore.assets.length, 1);
  const restoredCard = cardRestore.assets[0]!;
  assert.equal(isLivingCardAsset(restoredCard), true);
  if (!isLivingCardAsset(restoredCard)) return;
  assert.equal(canonicalPortableCardJson("history" in restoredCard.manifest ? restoredCard.manifest.history : null), expectedHistory);
  assert.deepEqual(currentCreatureHistoryProjection(restoredCard), currentCreatureHistoryProjection(card));

  const vaultPng = embedPortableVaultInPng(BASE_PNG, [card]);
  const portableVault = verifyPortableVaultPng(vaultPng);
  assert.equal(portableVault.ok, true);
  assert.equal(portableVault.assets[0]?.proof.digest, expectedBase.proof.digest);
  const vaultRestore = extractVerifiedWildzCards({
    pngBasis: vaultPng,
    verifiedPortableSnapshot: null,
    restoredVaultFiles: []
  });
  assert.equal(vaultRestore.assets.length, 1);
  assert.equal(canonicalPortableCardJson("history" in vaultRestore.assets[0]!.manifest ? vaultRestore.assets[0]!.manifest.history : null), expectedHistory);
});
