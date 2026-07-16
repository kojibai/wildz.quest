import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalWildzProfileUrl,
  copyWildzProfileLink,
  shareWildzProfile
} from "../src/features/profile/profile-sharing";

test("profile Share uses native share and unsupported Share falls back to canonical copy", async () => {
  const writes: string[] = [];
  const url = canonicalWildzProfileUrl("@Fern.Path", "https://wildz.quest");
  assert.equal(url, "https://wildz.quest/u/fern.path");
  assert.deepEqual(await shareWildzProfile({ port: { share: async () => undefined }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "shared", message: "Profile shared." });
  assert.deepEqual(await shareWildzProfile({ port: { clipboard: { writeText: async (value) => { writes.push(value); } } }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "copied", message: "Profile link copied." });
  assert.deepEqual(await copyWildzProfileLink({ port: { clipboard: { writeText: async (value) => { writes.push(value); } } }, username: "@fern.path", origin: "https://wildz.quest" }), { status: "copied", message: "Profile link copied." });
  assert.deepEqual(await shareWildzProfile({ port: { share: async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); } }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "cancelled", message: "Share cancelled." });
  assert.deepEqual(await shareWildzProfile({ port: { share: async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); } }, username: "@fern.path", displayName: "Fern", origin: "https://wildz.quest" }), { status: "denied", message: "Profile sharing was denied." });
  assert.deepEqual(await copyWildzProfileLink({ port: {}, username: "@fern.path", origin: "https://wildz.quest" }), { status: "unavailable", message: "Profile link is unavailable on this device." });
  assert.deepEqual(writes, [url, url]);
});
