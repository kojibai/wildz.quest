import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizePublicWildzProfile } from "../src/features/profile/public-profile";
import * as publicProfile from "../src/features/profile/public-profile";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";

test("owner publication projection is derived only from the signed-in owner state", () => {
  const project = (publicProfile as Record<string, unknown>).createOwnerPublicWildzProfile as ((input: {
    username: string;
    displayName?: string;
    assets: ReturnType<typeof createOwnerBoundInitialPlayState>["inventory"];
  }) => ReturnType<typeof sanitizePublicWildzProfile>) | undefined;
  assert.equal(typeof project, "function");
  const assets = createOwnerBoundInitialPlayState("signed-in-owner").inventory;
  const profile = project!({ username: "signed-in-owner", displayName: "Signed In", assets });

  assert.equal(profile.username, "@signed-in-owner");
  assert.equal(profile.displayName, "Signed In");
  assert.deepEqual(profile.vault.map((card) => card.id), assets.map((asset) => asset.id));
});

test("public profile projection excludes identity authority and private vault entries", () => {
  const projected = sanitizePublicWildzProfile({
    username: "@fern",
    displayName: "Fern",
    avatarImageUrl: "https://media.receiz.com/profile/fern.png",
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
  assert.equal(projected.avatarImageUrl, "https://media.receiz.com/profile/fern.png");
  assert.deepEqual(projected.vault.map((card) => card.id), ["public-card"]);
  assert.equal(projected.activity.length, 24);
  assert.equal(projected.explorer, null);
});

test("public profile rejects unbounded or executable avatar image references", () => {
  assert.equal(sanitizePublicWildzProfile({ username: "@fern", avatarImageUrl: "javascript:alert(1)" }).avatarImageUrl, null);
  assert.equal(sanitizePublicWildzProfile({ username: "@fern", avatarImageUrl: `data:image/png;base64,${"a".repeat(300_000)}` }).avatarImageUrl, null);
});

test("public profile accepts only complete bounded explorer traits", () => {
  const malformed = sanitizePublicWildzProfile({
    username: "@fern",
    explorer: { gender: "female", digest: "abc", traits: { outfit: { nested: true }, trail: null } }
  });
  assert.equal(malformed.explorer, null);
});
