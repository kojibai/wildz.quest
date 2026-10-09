import assert from "node:assert/strict";
import { test } from "node:test";
import { createReceizIdIdentity, serializeReceizIdentityArtifact } from "@receiz/sdk";

test("signing reads send only a key coordinate and return no account archive", async () => {
  const runtime = await import(new URL("../src/lib/receiz/wildz-identity-signing-read.js", import.meta.url).href);
  const identity = await createReceizIdIdentity({displayName:"Synthetic signing test"});
  let posted: unknown, stopped = false, localReads = 0;
  const worker = { onmessage: null as ((event: {data:unknown})=>void)|null, onerror:null, onmessageerror:null,
    postMessage(value:unknown){posted=value;},terminate(){stopped=true;} };
  const pending=runtime.readWildzIdentityForSigning(identity.keyFile.keyId,undefined,{createWorker:()=>worker,readLocally:async()=>{localReads++;return identity.keyFile;}});
  assert.deepEqual(posted,{command:"signing-key",keyId:identity.keyFile.keyId});
  worker.onmessage!({data:{ok:true,text:serializeReceizIdentityArtifact({...identity.keyFile,portableState:null})}});
  const result=await pending;
  assert.equal(result.keyId,identity.keyFile.keyId);assert.equal(result.portableState,null);
  assert.equal(localReads,0);assert.equal(stopped,true);
});

test("signing read rejects a different key or a failed local source without falling back", async () => {
  const runtime = await import(new URL("../src/lib/receiz/wildz-identity-signing-read.js", import.meta.url).href);
  const other = await createReceizIdIdentity({ displayName: "Different synthetic key" });
  for (const reply of [
    { ok: true, text: serializeReceizIdentityArtifact({ ...other.keyFile, portableState: null }) },
    { ok: false, error: "wildz_identity_not_found" }
  ]) {
    let stopped = false, localReads = 0;
    const worker = { onmessage: null as ((event: { data: unknown }) => void) | null, onerror: null, onmessageerror: null,
      postMessage() {}, terminate() { stopped = true; } };
    const pending = runtime.readWildzIdentityForSigning("expected-key", undefined, {
      createWorker: () => worker, readLocally: async () => { localReads++; return other.keyFile; }
    });
    worker.onmessage!({ data: reply });
    await assert.rejects(pending);
    assert.equal(localReads, 0);
    assert.equal(stopped, true);
  }
});

test("signing read cancellation terminates its worker and cannot start a fallback", async () => {
  const runtime = await import(new URL("../src/lib/receiz/wildz-identity-signing-read.js", import.meta.url).href);
  let stopped = false, localReads = 0;
  const worker = { onmessage: null, onerror: null, onmessageerror: null, postMessage() {}, terminate() { stopped = true; } };
  const controller = new AbortController();
  const pending = runtime.readWildzIdentityForSigning("expected-key", controller.signal, {
    createWorker: () => worker, readLocally: async () => { localReads++; throw new Error("must not read"); }
  });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(localReads, 0);
  assert.equal(stopped, true);
});

test("an unavailable signing worker retains the original local signing portion", async () => {
  const runtime = await import(new URL("../src/lib/receiz/wildz-identity-signing-read.js", import.meta.url).href);
  const identity = await createReceizIdIdentity({ displayName: "Fallback synthetic key" });
  let localReads = 0;
  const result = await runtime.readWildzIdentityForSigning(identity.keyFile.keyId, undefined, {
    createWorker: () => { throw new Error("worker unavailable"); },
    readLocally: async (keyId: string) => { assert.equal(keyId, identity.keyFile.keyId); localReads++; return identity.keyFile; }
  });
  assert.deepEqual(result, { ...identity.keyFile, portableState: null });
  assert.equal(localReads, 1);
});
