import assert from "node:assert/strict";
import test from "node:test";
import { createReceizIdIdentity } from "@receiz/sdk";
import { prepareWildzCardPublication } from "../src/lib/receiz/wildz-card-signing-client";
import { signWildzCardPublication, type WildzCardSigningInput } from "../src/lib/receiz/wildz-card-signing";
import { sealCollectedCard } from "../src/features/play/portable-card";
import { createPublicWildsCardRecord } from "../src/features/play/public-card-registry";
import { parseSignedWildzCardPublication } from "../src/lib/receiz/wildz-card-publication-envelope";

class FakeWorker {
  terminated = false;
  posted?: WildzCardSigningInput;
  onmessage?: (event: { data: unknown }) => void;
  onerror?: (event: { preventDefault(): void }) => void;
  postMessage(value: WildzCardSigningInput) { this.posted = value; }
  terminate() { this.terminated = true; }
}

test("card publication uses a cancellable worker without cloning the private account archive", async () => {
  const identity = await createReceizIdIdentity({ username: "worker_card", displayName: "Keeper" });
  const asset = sealCollectedCard({ formId: "mintcub-1", ownerReceizId: "worker_card", encounterId: "worker-card-test", capturedAt: "2026-09-14T12:00:00.000Z" });
  const input = { record: createPublicWildsCardRecord(asset, "https://wildz.quest", "2026-09-14T12:00:00.000Z"), merchantReceizId: "worker_card.receiz.id", keyFile: identity.keyFile };
  const oldWorker = globalThis.Worker;
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  try {
    const worker = new FakeWorker();
    const pending = prepareWildzCardPublication(input, undefined, () => worker as unknown as Worker);
    assert.equal(worker.posted!.keyFile.portableState, null);
    assert.equal(worker.posted!.record, input.record);
    const body = await signWildzCardPublication(worker.posted!);
    const admitted = parseSignedWildzCardPublication(JSON.parse(body).signedPublication, asset);
    assert.equal(admitted.record.asset.proof.digest, asset.proof.digest);
    assert.doesNotMatch(body, /privateKeyPkcs8|passphrase|keyFile/);
    worker.onmessage!({ data: { ok: true, body } });
    assert.equal(await pending, body);
    assert.equal(worker.terminated, true);
    const cancelled = new FakeWorker();
    const controller = new AbortController();
    const aborting = prepareWildzCardPublication(input, controller.signal, () => cancelled as unknown as Worker);
    controller.abort(new Error("retired card revision"));
    await assert.rejects(aborting, /retired card revision/);
    assert.equal(cancelled.terminated, true);
  } finally { globalThis.Worker = oldWorker; }
});
