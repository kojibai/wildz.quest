import assert from "node:assert/strict";
import { test } from "node:test";
import { sealCollectedCard } from "../src/features/play/portable-card.js";
import { publicCardPublicationQueue } from "../src/features/play/use-public-card-publisher.js";

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
