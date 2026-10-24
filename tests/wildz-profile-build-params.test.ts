import assert from "node:assert/strict";
import { test } from "node:test";
import * as reader from "../src/lib/receiz/wildz-profile-reader";

test("known public profiles are discovered once for preparation before the first visitor", async () => {
  const discover = (reader as Record<string, unknown>).publicWildzProfileBuildParams as (read: (namespace: string) => Promise<unknown>) => Promise<{ handle: string }[]>;
  assert.equal(typeof discover, "function");
  const row = (handle: string) => ({ appNamespace: "wildz.market-collection.v1", appProjectionState: "published", sourceUrl: `https://wildz.quest/receiz/market-collection/${handle}`, externalCreatorId: `${handle}.receiz.id` });
  let reads = 0;
  assert.deepEqual(await discover(async namespace => {
    reads++; assert.equal(namespace, "wildz.market-collection.v1");
    return { ok: true, records: [row("fern"), row("alex"), row("fern"), { ...row("wrong"), externalCreatorId: "fern.receiz.id" }, { ...row("hidden"), appProjectionState: "draft" }, { ...row("foreign"), sourceUrl: "https://other.example/receiz/market-collection/foreign" }, { ...row("other"), appNamespace: "other" }] };
  }), [{ handle: "alex" }, { handle: "fern" }]);
  assert.equal(reads, 1);
  assert.deepEqual(await discover(async () => { throw Error("directory unavailable"); }), [], "unavailable discovery must preserve on-demand profile routing");
  assert.deepEqual(await discover(async () => ({ ok: true, records: Array(5001).fill(row("fern")) })), []);
});
