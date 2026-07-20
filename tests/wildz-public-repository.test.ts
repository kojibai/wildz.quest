import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyWildzPublicState } from "../src/lib/receiz/wildz-public-state";
import { createReceizWildzPublicRepository } from "../src/lib/receiz/wildz-public-repository";

test("a second repository instance restores the published projection", async () => {
  let durableState = emptyWildzPublicState();
  let durableHead = { appendAnchorId: "anchor:0", afterKaiUpulse: "pulse:0" };
  let publishedEnvelope: Record<string, unknown> | null = null;
  const adapter = {
    restoreLatestPublicStore: async () => ({ state: durableState, knownHead: durableHead }),
    publishPublicStore: async (input: { state: typeof durableState } & Record<string, unknown>) => {
      publishedEnvelope = input;
      durableState = input.state;
      durableHead = {
        appendAnchorId: `anchor:${durableState.revision}`,
        afterKaiUpulse: `pulse:${durableState.revision}`
      };
      return { ok: true, knownHead: durableHead };
    }
  };
  const first = createReceizWildzPublicRepository({ adapter: adapter as never });
  const loaded = await first.load();
  await first.publish({ ...loaded.state, revision: 1 }, {
    expectedHead: loaded.head,
    idempotencyKey: "profile:@fern:1",
    merchantReceizId: "usr_fern"
  });
  const second = createReceizWildzPublicRepository({ adapter: adapter as never });
  assert.equal((await second.load()).state.revision, 1);
  const envelope = publishedEnvelope as unknown as Record<string, unknown>;
  assert.equal(envelope.schema, undefined);
  assert.equal((envelope.state as { schema?: string }).schema, "receiz.wildz_public_projection.v1");
});

test("repository rejects a stale local expected head before publication", async () => {
  const state = { ...emptyWildzPublicState(), revision: 2 };
  let publishCalls = 0;
  const repository = createReceizWildzPublicRepository({
    adapter: {
      restoreLatestPublicStore: async () => ({ state, knownHead: { appendAnchorId: "anchor:2", afterKaiUpulse: "pulse:2" } }),
      publishPublicStore: async () => { publishCalls += 1; return { ok: true }; }
    } as never
  });
  await assert.rejects(() => repository.publish({ ...state, revision: 3 }, {
    expectedHead: { revision: 1, stateDigest: "sha256:stale", appendAnchorId: "anchor:1", afterKaiUpulse: "pulse:1" },
    idempotencyKey: "profile:@fern:3",
    merchantReceizId: "usr_fern"
  }), /wildz_public_projection_conflict/);
  assert.equal(publishCalls, 0);
});

test("repository does not turn a remote recovery outage into an empty writable head", async () => {
  const repository = createReceizWildzPublicRepository({
    adapter: {
      restoreLatestPublicStore: async () => { throw new Error("offline"); },
      publishPublicStore: async () => ({ ok: true })
    } as never
  });
  await assert.rejects(() => repository.load(), /offline/);
});
