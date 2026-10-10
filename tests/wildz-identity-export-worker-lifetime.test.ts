import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createWildzIdentityPlayerCardBundleOffThread } from "../src/lib/receiz/wildz-identity-export-client";

// The external Worker transport is replaced so the real export client controls
// lifecycle and complete source messages. Binding/proof validity is covered by
// the actual SDK tests; these opaque reply bytes make no validity claim.
async function exportWorkerFixture() {
  const descriptors = new Map(["window", "Worker"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const workers: TestWorker[] = [];
  let rejectPosts = false;
  class TestWorker {
    onmessage: ((event: { data: { id: string; ok: boolean; bytes?: ArrayBuffer; playerPayloadDigest?: string; error?: string } }) => void) | null = null;
    onerror: ((event: { preventDefault(): void }) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    messages: { id: string; assetIds: string[] }[] = [];
    terminations = 0;
    constructor() { workers.push(this); }
    postMessage(message: TestWorker["messages"][number]) {
      if (rejectPosts) throw Error("test_export_post_failed");
      this.messages.push(message);
    }
    terminate() { this.terminations++; }
    reply(index: number, bytes: number[]) {
      this.onmessage?.({ data: { id: this.messages[index]!.id, ok: true, bytes: Uint8Array.from(bytes).buffer,
        playerPayloadDigest: `sha256:${"a".repeat(64)}` } });
    }
  }
  const owner = "export_keeper", identity = await createReceizIdentityKeyFile({ owner: { uid: "export-worker-lifetime", username: owner } });
  const playState = createOwnerBoundInitialPlayState(owner);
  const input: Parameters<typeof createWildzIdentityPlayerCardBundleOffThread>[0] = {
    artwork: Uint8Array.from([1, 2, 3]), assets: playState.inventory, keyFile: identity.keyFile,
    player: { playerId: owner, exportedAt: "2026-10-10T12:00:00.000Z", playState,
      settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [],
      canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] }
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: TestWorker });
  return { workers, input, rejectPosts: () => { rejectPosts = true; },
    restore() {
      workers.at(-1)?.onerror?.({ preventDefault() {} });
      for (const [name, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    } };
}

test("repeated account exports reuse admitted card deltas in one warmed worker", async () => {
  const f = await exportWorkerFixture();
  try {
    const first = createWildzIdentityPlayerCardBundleOffThread(f.input);
    assert.deepEqual(f.workers[0]!.messages[0]!.assetIds, f.input.assets.map(asset => asset.id));
    f.workers[0]!.reply(0, [8, 7, 6]);
    assert.deepEqual((await first)?.bytes, Uint8Array.from([8, 7, 6]));
    assert.equal(f.workers[0]!.terminations, 0, "reopening Vault must preserve the existing delta worker");
    const second = createWildzIdentityPlayerCardBundleOffThread(f.input);
    assert.equal(f.workers.length, 1);
    f.workers[0]!.reply(1, [5, 4, 3]);
    assert.deepEqual((await second)?.bytes, Uint8Array.from([5, 4, 3]));
    assert.equal(f.workers[0]!.terminations, 0);
  } finally { f.restore(); }
});

test("overlapping exports keep their shared complete source until both replies settle", async () => {
  const f = await exportWorkerFixture();
  try {
    const first = createWildzIdentityPlayerCardBundleOffThread(f.input), second = createWildzIdentityPlayerCardBundleOffThread(f.input);
    assert.equal(f.workers.length, 1);
    f.workers[0]!.reply(1, [2]);
    assert.deepEqual((await second)?.bytes, Uint8Array.from([2]));
    assert.equal(f.workers[0]!.terminations, 0);
    f.workers[0]!.reply(0, [1]);
    assert.deepEqual((await first)?.bytes, Uint8Array.from([1]));
    assert.equal(f.workers[0]!.terminations, 0);
  } finally { f.restore(); }
});

test("an export worker failure preserves fallback and releases every pending job", async () => {
  const f = await exportWorkerFixture();
  try {
    const first = createWildzIdentityPlayerCardBundleOffThread(f.input), second = createWildzIdentityPlayerCardBundleOffThread(f.input);
    f.workers[0]!.onerror?.({ preventDefault() {} });
    assert.deepEqual(await Promise.all([first, second]), [null, null]);
    assert.equal(f.workers[0]!.terminations, 1);
  } finally { f.restore(); }
});

test("a late error from a completed export cannot discard a newer export", async () => {
  const f = await exportWorkerFixture();
  try {
    const first = createWildzIdentityPlayerCardBundleOffThread(f.input);
    f.workers[0]!.reply(0, [1]); await first;
    f.workers[0]!.onerror?.({ preventDefault() {} });
    const second = createWildzIdentityPlayerCardBundleOffThread(f.input);
    f.workers[0]!.onerror?.({ preventDefault() {} });
    f.workers[0]!.onmessageerror?.();
    f.workers[1]!.reply(0, [2]);
    assert.deepEqual((await second)?.bytes, Uint8Array.from([2]));
    assert.equal(f.workers[1]!.terminations, 0);
  } finally { f.restore(); }
});

test("undecodable export replies release the shared worker and resolve the existing fallback", async () => {
  const f = await exportWorkerFixture();
  try {
    const first = createWildzIdentityPlayerCardBundleOffThread(f.input), second = createWildzIdentityPlayerCardBundleOffThread(f.input);
    f.workers[0]!.onmessageerror?.();
    assert.equal(f.workers[0]!.terminations, 1, "a decoding failure must not leave exports pending forever");
    assert.deepEqual(await Promise.all([first, second]), [null, null]);
  } finally { f.restore(); }
});

test("an export that cannot cross the transport retains the existing fallback and releases its worker", async () => {
  const f = await exportWorkerFixture();
  try {
    f.rejectPosts();
    assert.equal(await createWildzIdentityPlayerCardBundleOffThread(f.input), null);
    assert.equal(f.workers[0]!.terminations, 1);
  } finally { f.restore(); }
});
