import assert from "node:assert/strict";
import test from "node:test";
import { prepareWildzProfilePublication } from "../src/lib/receiz/wildz-profile-signing-client";
import type { WildzProfileSigningInput } from "../src/lib/receiz/wildz-profile-signing";

class FakeWorker {
  terminated = false;
  posted: unknown;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { preventDefault(): void }) => void;
  postMessage(value: unknown) { this.posted = value; }
  terminate() { this.terminated = true; }
}

test("profile worker receives proof input without inline signing and terminates on completion or cancellation", async () => {
  const oldWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    const input = { profile: { username: "@worker" } } as WildzProfileSigningInput;
    const worker = new FakeWorker();
    const pending = prepareWildzProfilePublication(input, undefined, () => worker as unknown as Worker);
    assert.deepEqual(worker.posted, { input, admittedCards: false });
    const result = { profile: input.profile, body: "signed in worker" };
    worker.onmessage!({ data: { ok: true, result } });
    assert.equal(await pending, result);
    assert.equal(worker.terminated, true);
    const cancelled = new FakeWorker();
    const controller = new AbortController();
    const aborting = prepareWildzProfilePublication(input, controller.signal, () => cancelled as unknown as Worker);
    controller.abort(new Error("profile revision retired"));
    await assert.rejects(aborting, /profile revision retired/);
    assert.equal(cancelled.terminated, true);
    const failed = new FakeWorker();
    const failing = prepareWildzProfilePublication(input, undefined, () => failed as unknown as Worker);
    failed.onmessage!({ data: { ok: false, error: "wildz_public_profile_card_unverified" } });
    await assert.rejects(failing, /card_unverified/);
    assert.equal(failed.terminated, true);
  } finally { globalThis.Worker = oldWorker; }
});
