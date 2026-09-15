import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdentityKeyFile } from "@receiz/sdk";
import { createOwnerBoundInitialPlayState } from "../src/features/play/game-state";
import { createVaultWorkerDeltaWriter } from "../src/lib/receiz/wildz-vault-worker-state";
import { requireWildzIdentityBindingFromEnvelope } from "../src/lib/receiz/wildz-identity-binding";
import { splitWildzPngEnvelope } from "../src/lib/receiz/wildz-png-envelope";
import { readWildzPlayerVaultAppendFromPng, verifyPortableVaultPng } from "../src/features/play/card-export";

test("retained export worker signs current movement and card removals into a valid complete seal", async () => {
  let receive: (event: { data: unknown }) => void = () => { throw new Error("worker_not_loaded"); };
  let reply: (value: { ok: boolean; bytes: ArrayBuffer; error?: string }) => void = () => {};
  const prior = Object.getOwnPropertyDescriptor(globalThis, "self");
  Object.defineProperty(globalThis, "self", { configurable: true, value: {
    addEventListener: (_kind: string, handler: typeof receive) => { receive = handler; },
    postMessage: (value: Parameters<typeof reply>[0]) => reply(value)
  } });
  try {
    await import("../src/lib/receiz/wildz-identity-export.worker.js");
    const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "worker-test", username: "keeper" } });
    const write = createVaultWorkerDeltaWriter();
    let state = createOwnerBoundInitialPlayState("keeper", "2026-09-15T00:00:00.000Z");
    const artwork = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    for (let turn = 0; turn < 2; turn++) {
      if (turn) state = { ...state, player: { x: 17, z: 21 }, inventory: state.inventory.slice(0, 1) };
      const result = await new Promise<Parameters<typeof reply>[0]>(resolve => {
        reply = resolve;
        receive({ data: structuredClone({ id: String(turn), artwork: artwork.buffer, keyFile,
          assetIds: state.inventory.map(card => card.id), delta: write(state),
          player: { playerId: "keeper", exportedAt: "2026-09-15T00:00:00.000Z", settings: { avatarStyle: null, movementMode: "walk", audio: {} }, personalEvents: [], canonicalCursor: { worldId: "wilds:global:v3", revision: 0, eventId: null }, receipts: [] }
        }) });
      });
      assert.equal(result.ok, true, result.error);
      const bytes = new Uint8Array(result.bytes);
      assert.equal((await requireWildzIdentityBindingFromEnvelope(bytes)).keyId, keyFile.keyId);
      const { pngBasis } = splitWildzPngEnvelope(bytes);
      assert.equal(verifyPortableVaultPng(pngBasis).ok, true);
      const restored = readWildzPlayerVaultAppendFromPng(pngBasis).player.playState;
      assert.deepEqual(restored.player, state.player);
      assert.deepEqual(restored.inventory.map(card => card.id), state.inventory.map(card => card.id));
    }
  } finally {
    if (prior) Object.defineProperty(globalThis, "self", prior);
    else Reflect.deleteProperty(globalThis, "self");
  }
});
