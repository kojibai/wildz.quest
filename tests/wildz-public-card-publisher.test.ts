import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import * as vaultAdmission from "../src/lib/receiz/wildz-vault-card-admission.js";
import {
  publicCardPublicationCandidates,
  publicCardPublicationQueue,
  publicCardPublicationQueueCooperatively
} from "../src/features/play/use-public-card-publisher.js";

test("verified card publication is not gated by stale upload bookkeeping", () => {
  const uploaded = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "publisher",
    encounterId: "publisher-uploaded",
    capturedAt: "2026-07-17T14:00:00.000Z"
  });
  const caught = sealCollectedCard({
    formId: "mintcub-1",
    ownerReceizId: "publisher",
    encounterId: "publisher-caught",
    capturedAt: "2026-07-17T15:00:00.000Z"
  });
  const inactive = sealCollectedCard({
    formId: "voltray-1",
    ownerReceizId: "publisher",
    encounterId: "publisher-inactive",
    capturedAt: "2026-07-17T16:00:00.000Z"
  });

  assert.deepEqual(
    publicCardPublicationCandidates(
      [uploaded, caught, inactive],
      new Set([uploaded.id, caught.id]),
      new Set([`${uploaded.id}:${uploaded.proof.digest}`])
    ).map((asset) => asset.id),
    [caught.id]
  );
});

test("the shell owns automatic publication without mounting a second gameplay publisher", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.doesNotMatch(campaign, /usePublicCardPublisher/);
  assert.match(shell, /publishCurrentWildzProfile\(localPublicProfile, publishableOwnerAssets/);
  assert.match(shell, /proofObjects:\s*admittedProofObjects/);
});

test("Vault restore clears verified upload ids before committing publisher state", () => {
  const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
  const restore = campaign.slice(campaign.indexOf("onRestoreArtifact={async"), campaign.indexOf("/>\n", campaign.indexOf("onRestoreArtifact={async")));

  assert.match(restore, /const verifiedAssetIds = new Set\(outcome\.verifiedAssetIds\)/);
  assert.match(restore, /pendingSyncAssetIds: outcome\.playState\.pendingSyncAssetIds\.filter\(\(assetId\) => !verifiedAssetIds\.has\(assetId\)\)/);
  assert.ok(restore.indexOf("pendingSyncAssetIds:") < restore.indexOf("setState(restoredPlayState)"));
});

test("public card publisher queues every verified proof once in stable order", () => {
  const later = sealCollectedCard({ formId: "voltray-1", ownerReceizId: "publisher", encounterId: "publisher-z", capturedAt: "2026-07-17T16:00:00.000Z" });
  const earlier = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "publisher", encounterId: "publisher-a", capturedAt: "2026-07-17T15:00:00.000Z" });
  const invalid = structuredClone(later);
  invalid.proof.digest = `sha256:${"0".repeat(64)}`;
  const published = new Set([`${earlier.id}:${earlier.proof.digest}`]);

  assert.deepEqual(publicCardPublicationQueue([later, invalid, earlier], published).map((asset) => asset.id), [later.id]);
  assert.deepEqual(
    publicCardPublicationQueue([later, earlier], new Set()).map((asset) => asset.id),
    [earlier, later].sort((left, right) => left.id.localeCompare(right.id)).map((asset) => asset.id)
  );
});

test("large Vault publication yields between bounded proof-verification batches", async () => {
  const cards = Array.from({ length: 25 }, (_, index) => sealCollectedCard({
    formId: index % 2 ? "voltray-1" : "mintcub-1",
    ownerReceizId: "publisher",
    encounterId: `publisher-large-${index}`,
    capturedAt: new Date(Date.parse("2026-07-17T15:00:00.000Z") + index * 1_000).toISOString()
  }));
  let yields = 0;
  const queue = await publicCardPublicationQueueCooperatively(cards, new Set(), {
    batchSize: 8,
    yieldControl: async () => { yields += 1; }
  });
  assert.equal(queue.length, cards.length);
  assert.equal(yields, 3);
});

test("default background publication yields after every card proof", async () => {
  const cards = Array.from({ length: 4 }, (_, index) => sealCollectedCard({
    formId: index % 2 ? "voltray-1" : "mintcub-1",
    ownerReceizId: "publisher",
    encounterId: `publisher-frame-safe-${index}`,
    capturedAt: new Date(Date.parse("2026-08-20T20:00:00.000Z") + index * 1_000).toISOString()
  }));
  let yields = 0;

  const queue = await publicCardPublicationQueueCooperatively(cards, new Set(), {
    yieldControl: async () => { yields += 1; }
  });

  assert.equal(queue.length, 4);
  assert.equal(yields, 3);
});

test("background publication reuses admitted Proof Objects without verifying every card again", async () => {
  const cards = [
    sealCollectedCard({
      formId: "voltray-1",
      ownerReceizId: "publisher",
      encounterId: "publisher-admitted-first",
      capturedAt: "2026-08-20T20:00:00.000Z"
    }),
    sealCollectedCard({
      formId: "mintcub-1",
      ownerReceizId: "publisher",
      encounterId: "publisher-admitted-second",
      capturedAt: "2026-08-20T20:01:00.000Z"
    })
  ];
  const admit = (vaultAdmission as Record<string, unknown>).admitWildzVaultProofObjects as ((input: {
    cards: typeof cards;
    playerHandle: string;
  }) => { proofObjects: unknown }) | undefined;
  assert.equal(typeof admit, "function");
  const { proofObjects } = admit!({ cards, playerHandle: "publisher" });
  let verifications = 0;

  const queue = await publicCardPublicationQueueCooperatively(cards, new Set(), {
    proofObjects,
    verifyCard: () => {
      verifications += 1;
      return false;
    }
  } as never);

  assert.deepEqual(queue.map((asset) => asset.id).sort(), cards.map((asset) => asset.id).sort());
  assert.equal(verifications, 0);
});
