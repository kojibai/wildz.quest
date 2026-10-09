import assert from "node:assert/strict";
import { test } from "node:test";

type Reply = { keyId: string; ok: boolean; result?: null; error?: string; fallbackSafe?: boolean };
function worker() {
  const posted: unknown[] = [];
  let terminated = 0;
  return { posted, get terminated() { return terminated; },
    onmessage: null as ((event: { data: Reply }) => void) | null,
    onerror: null as ((event: { preventDefault(): void }) => void) | null,
    onmessageerror: null as (() => void) | null,
    postMessage(value: unknown) { posted.push(value); }, terminate() { terminated++; } };
}
async function project() {
  const projectionRuntime = await import(new URL("../src/features/play/wallet/wilds-wallet-source-client.js", import.meta.url).href);
  return projectionRuntime.projectWildsWalletSourceAuthority as (keyId: string, options: {
    createWorker?: () => unknown; projectLocally: (keyId: string) => Promise<null>
  }) => Promise<null>;
}

test("wallet projection sends only the identity coordinate and admits the worker's completed local result", async () => {
  const read = await project(), w = worker(); let fallbackReads = 0;
  const pending = read("exact-key", { createWorker: () => w, projectLocally: async () => { fallbackReads++; return null; } });
  assert.deepEqual(w.posted, [{ keyId: "exact-key" }]);
  w.onmessage!({data:{keyId:"exact-key",ok:true,result:null}});
  assert.equal(await pending, null);
  assert.equal(fallbackReads, 0, "no private archive is read or cloned on the gameplay thread");
  assert.equal(w.terminated, 1);
});

test("unsupported workers keep the exact local projection path", async () => {
  const read = await project(); const keys: string[] = [];
  assert.equal(await read("exact-key", { createWorker: () => { throw Error("unsupported"); },
    projectLocally: async key => { keys.push(key); return null; } }), null);
  assert.deepEqual(keys, ["exact-key"]);
});

test("worker transport failure falls back once, but a source rejection cannot grant authority", async () => {
  const read = await project(), broken = worker(); let fallbackReads = 0;
  const local = async () => { fallbackReads++; return null; };
  const fallback = read("key", { createWorker: () => broken, projectLocally: local });
  broken.onerror!({preventDefault(){}});
  assert.equal(await fallback, null); assert.equal(fallbackReads, 1);
  const rejected = worker();
  const failure = read("key", { createWorker: () => rejected, projectLocally: local });
  rejected.onmessage!({data:{keyId:"key",ok:false,error:"wildz_identity_decryption_failed"}});
  await assert.rejects(failure,/wildz_identity_decryption_failed/);
  assert.equal(fallbackReads, 1);
});

test("a crossed worker reply cannot admit another identity's result", async () => {
  const read = await project(), w = worker(); let fallbackReads = 0;
  const pending = read("current", {createWorker:()=>w,projectLocally:async()=>{fallbackReads++;return null;}});
  w.onmessage!({data:{keyId:"other",ok:true,result:null}});
  await assert.rejects(pending,/wilds_wallet_source_worker_reply_invalid/);
  assert.equal(fallbackReads, 0); assert.equal(w.terminated, 1);
});
