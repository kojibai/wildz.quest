import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizePublicWildzProfile } from "../src/features/profile/public-profile";

test("public profile projection excludes identity authority and private vault entries", () => {
  const projected = sanitizePublicWildzProfile({
    username: "@fern",
    displayName: "Fern",
    identitySeal: "secret",
    privateKey: "secret",
    explorer: { gender: "female", traits: { outfit: "trailweaver" }, digest: "abc" },
    vault: [
      { id: "public-card", name: "Mossling", proofDigest: "sha256:one", visibility: "public" },
      { id: "private-card", name: "Hidden", proofDigest: "sha256:two", visibility: "private" }
    ],
    achievements: ["first-step"],
    activity: new Array(80).fill(null).map((_, index) => ({ id: String(index), label: "Discovery", at: "2026-07-15T00:00:00.000Z" }))
  });

  assert.equal("identitySeal" in projected, false);
  assert.equal("privateKey" in projected, false);
  assert.deepEqual(projected.vault.map((card) => card.id), ["public-card"]);
  assert.equal(projected.activity.length, 24);
  assert.equal(projected.explorer, null);
});

test("public profile accepts only complete bounded explorer traits", () => {
  const malformed = sanitizePublicWildzProfile({
    username: "@fern",
    explorer: { gender: "female", digest: "abc", traits: { outfit: { nested: true }, trail: null } }
  });
  assert.equal(malformed.explorer, null);
});
