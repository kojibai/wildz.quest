import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("Profile mounts real published card artwork and only one complete selected card scene", () => {
  const profile = readFileSync("src/features/profile/WildzProfileSheet.tsx", "utf8");
  const gallery = readFileSync("src/features/profile/WildzProfileVaultGallery.tsx", "utf8");
  assert.match(profile, /<WildzProfileVaultGallery cards=\{profile\.vault\} ownerAssets=\{vaultAssets\}/);
  assert.match(gallery, /profileVaultCardImageUrl\(card\.id\)/);
  assert.match(gallery, /<WildsCardScene[\s\S]*asset=\{selectedAsset\}[\s\S]*tapToFlip/);
  assert.equal((gallery.match(/<WildsCardScene/g) ?? []).length, 1);
});

test("the complete card viewer cancels stale recovery and restores its exact gallery origin", () => {
  const gallery = readFileSync("src/features/profile/WildzProfileVaultGallery.tsx", "utf8");
  for (const token of ["AbortController", "requestRef.current?.abort()", "originRef", "canRestoreFocus", "aria-modal=\"true\"", "inert"])
    assert.ok(gallery.includes(token), `missing ${token}`);
  assert.match(gallery, /stopImmediatePropagation/);
  assert.match(gallery, /restoreFrameRef\.current = window\.requestAnimationFrame\(\(\) => \{[\s\S]*restoreFrameRef\.current = window\.requestAnimationFrame/);
  assert.match(gallery, /originRef\.current\.focus\(\{ preventScroll: true \}\)/);
});

test("the complete Profile card scene adds opt-in tap flipping without changing standalone defaults", () => {
  const scene = readFileSync("src/features/play/WildsCardScene.tsx", "utf8");
  assert.match(scene, /tapToFlip\s*=\s*false/);
  assert.match(scene, /tapToFlip[\s\S]*Math\.hypot/);
  assert.match(scene, /closest\("button, a, input, select, textarea, summary, \[role='button'\]"\)/);
});

test("only the owner Profile receives admitted local Vault assets", () => {
  const shell = readFileSync("src/features/shell/WildzApp.tsx", "utf8");
  assert.match(shell, /vaultAssets=\{viewingOwnProfile \? ownerPlayState\.inventory : undefined\}/);
  assert.match(shell, /data-profile-card-viewer/);
});

test("Profile cards are responsive real images with native vertical scrolling", () => {
  const css = readFileSync("app/globals.css", "utf8");
  assert.match(css, /\.wildz-profile-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.wildz-profile-card-tile\s*\{[^}]*min-height:\s*44px[^}]*touch-action:\s*pan-y/s);
  assert.match(css, /\.wildz-profile-card-tile img\s*\{[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.wildz-profile-sheet\s*\{[^}]*touch-action:\s*pan-y[^}]*-webkit-overflow-scrolling:\s*touch/s);
});

test("a selected Profile card stays compact when the published gallery is long", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const viewerRule = css.match(/\.wildz-profile-card-viewer\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(viewerRule, /position:\s*fixed/);
  assert.match(viewerRule, /height:\s*min\(/);
  assert.match(viewerRule, /max-height:\s*calc\(100dvh/);
  assert.doesNotMatch(viewerRule, /min-height:\s*min\(76dvh,\s*700px\)/);
});

test("game browser zoom is suppressed without changing custom world-map zoom", () => {
  const css = readFileSync("app/globals.css", "utf8");
  const layout = readFileSync("app/layout.tsx", "utf8");
  assert.match(css, /\.wildz-app\s*\{[^}]*touch-action:\s*none/s);
  assert.match(css, /\.wildz-shell-overlay\s*\{[^}]*touch-action:\s*pan-y/s);
  assert.match(css, /\.wilds-atlas-canvas canvas\s*\{[^}]*touch-action:\s*none/s);
  assert.doesNotMatch(layout, /maximumScale|max(?:imum)?-scale|userScalable:\s*false/);
});
