import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createReceizIdIdentity } from "@receiz/sdk";
import {
  parseWildzPlayerCoordinate,
  sameWildzPlayerCoordinate
} from "../src/lib/receiz/wildz-player-coordinate";

test("Receiz base usernames and canonical handles resolve to one Wildz player coordinate", () => {
  assert.deepEqual(parseWildzPlayerCoordinate("trail__keeper"), {
    actorId: "trail__keeper",
    profileHandle: "trail__keeper.receiz.id"
  });
  assert.deepEqual(parseWildzPlayerCoordinate("@TRAIL__KEEPER.RECEIZ.ID"), {
    actorId: "trail__keeper",
    profileHandle: "trail__keeper.receiz.id"
  });
  assert.equal(sameWildzPlayerCoordinate("trail__keeper", "@TRAIL__KEEPER.RECEIZ.ID"), true);
});

test("player coordinates accept the SDK v104 username normalization maximum", async () => {
  const sdkMaximumUsername = "a".repeat(30);
  const identity = await createReceizIdIdentity({
    username: `${sdkMaximumUsername}extra`,
    displayName: "SDK Bound"
  });

  assert.equal(identity.username, sdkMaximumUsername);
  assert.deepEqual(parseWildzPlayerCoordinate(identity.username), {
    actorId: sdkMaximumUsername,
    profileHandle: `${sdkMaximumUsername}.receiz.id`
  });
  assert.equal(parseWildzPlayerCoordinate("a".repeat(31)), null);
});

test("player coordinates reject dotted aliases, malformed suffixes, and invalid profile lengths", () => {
  for (const value of [
    "ab",
    "a".repeat(31),
    "trail.keeper",
    "trail-keeper",
    "trail__keeper.example",
    "trail__keeper.receiz.id.receiz.id",
    "trail__keeper_receiz_id.receiz.id.extra"
  ]) {
    assert.equal(parseWildzPlayerCoordinate(value), null, value);
  }
  assert.equal(sameWildzPlayerCoordinate("trail__keeper", "other_keeper.receiz.id"), false);
});

test("userinfo handle projection preserves the canonical Receiz coordinate without dot rewriting", () => {
  const source = readFileSync("src/lib/receiz/connect-profile.ts", "utf8");
  assert.match(source, /parseWildzPlayerCoordinate\(value\)\?\.profileHandle/);
  assert.doesNotMatch(source, /handle\.includes\("\."\)/);
  assert.doesNotMatch(source, /replace\(\/\[\^a-z0-9_\]/);
});
