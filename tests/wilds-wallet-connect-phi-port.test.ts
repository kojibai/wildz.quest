import assert from "node:assert/strict";
import test from "node:test";
import { createWildsWalletConnectPhiPort } from "../src/features/play/wallet/wilds-wallet-connect-phi-port";
const leg = { kind: "phi" as const, legId: "staged:fixture:0", attemptId: "staged:fixture:0", senderHandle: "alice.receiz.id", recipientHandle: "bob.receiz.id", amountPhiMicro: "9007199254740993" };
const keyId = "a".repeat(64), attempt = "v3.AAAAAAAAAAAAAAAA.AA.BBBBBBBBBBBBBBBBBBBBBB";

function fixture() {
  let saved: unknown = null; let writes = 0, executes = 0, observations = 0, authorizations = 0;
  let status = "unknown"; let corruptRead = false, quota = false;
  let lane = Promise.resolve();
  const store = { load: () => corruptRead ? null : structuredClone(saved), write: (_owner: string, value: unknown) => { if (quota) throw Error("quota"); saved = structuredClone(value); writes++; }, withLock: async <T>(_owner: string, action: () => Promise<T>) => { const previous = lane; let release!: () => void; lane = new Promise(resolve => { release = resolve; }); await previous; try { return await action(); } finally { release(); } } };
  const calls: { path: string; init: any }[] = [];
  const fetcher = async (path: string, init: any) => {
    calls.push({ path, init });
    if (path.endsWith("/preview")) return Response.json({ status: "staged", rail: "settlement", amountPhiMicro: leg.amountPhiMicro, quotedUsdCents: "1", attempt, expiresAtKai: 100 });
    if (path.endsWith("/execute")) { executes++; status = "committed"; throw new TypeError("reply lost after commit"); }
    if (path.includes("/observe?")) { observations++; return Response.json({ status, rail: "settlement", amountPhiMicro: leg.amountPhiMicro, recipientUsername: "bob" }, { status: status === "unknown" ? 202 : 200 }); }
    throw Error("unexpected endpoint");
  };
  const input = { keyId, ownerHandle: leg.senderHandle, store, fetcher, authorization: { authorize: async () => { authorizations++; return { artifact: "synthetic encrypted artifact", challenge: {} }; } } };
  return { input, calls, saved: () => saved, executes: () => executes, writes: () => writes, observations: () => observations, authorizations: () => authorizations, corrupt: () => { corruptRead = true; }, quota: () => { quota = true; }, seed:(value:unknown)=>{saved=structuredClone(value);}, status:(value:string)=>{status=value;} };
}

test("staged Phi durably binds the exact Connect attempt and reconstruction only observes a lost response", async () => {
  const f = fixture(); const port = createWildsWalletConnectPhiPort(f.input);
  const result = await port.sendPhi(leg);
  assert.equal(result.status, "pending"); assert.ok(result.receipt);
  assert.equal(f.executes(), 1); assert.equal(f.writes(), 2);
  assert.equal(JSON.stringify(f.saved()).includes("synthetic encrypted artifact"), false);
  const restored = createWildsWalletConnectPhiPort(f.input);
  const recovered = await restored.sendPhi(leg);
  assert.equal(recovered.status, "committed"); assert.equal(f.executes(), 1); assert.equal(f.authorizations(), 1);
  await restored.verifyPhiReceipt(leg, recovered);
  assert.equal(f.observations(), 2, "verified settlement is independently read again");
  const preview = JSON.parse(f.calls.find(call => call.path.endsWith("/preview"))!.init.body);
  assert.match(preview.operationNonce, /^[a-f0-9]{64}$/);
  assert.equal(preview.amountPhiMicro, leg.amountPhiMicro);
  await assert.rejects(restored.verifyPhiReceipt({ ...leg, amountPhiMicro: "1" }, recovered), /receipt|binding|match/);
});

test("unverified persistence and quota failures stop staged Phi before execution", async () => {
  for (const mode of ["corrupt", "quota"] as const) {
    const f = fixture(); f[mode]();
    assert.equal((await createWildsWalletConnectPhiPort(f.input).sendPhi(leg)).status, "failed");
    assert.equal(f.executes(), 0); assert.equal(f.authorizations(), 0);
  }
});

test("two reconstructed staged Phi ports serialize the same exact send and never duplicate dispatch", async () => {
  const f = fixture();
  const results = await Promise.all([createWildsWalletConnectPhiPort(f.input).sendPhi(leg), createWildsWalletConnectPhiPort(f.input).sendPhi(leg)]);
  assert.equal(f.executes(), 1); assert.equal(results[0].status, "pending"); assert.equal(results[1].status, "committed");
});

test("peer settlement receipt is only a locator and must be independently observed for exact terms", async () => {
  const f = fixture(); const sent = await createWildsWalletConnectPhiPort(f.input).sendPhi(leg);
  const peer = createWildsWalletConnectPhiPort({ ...f.input, ownerHandle: leg.recipientHandle, keyId: "b".repeat(64) });
  assert.equal((await peer.observePhi(leg)).status, "none");
  assert.equal((await peer.observePhi(leg, sent.receipt)).status, "committed");
  const request = f.calls.filter(call => call.path.includes("/observe?")).at(-1)!;
  const query = new URL(request.path, "https://wildz.test").searchParams;
  assert.equal(query.get("senderHandle"), leg.senderHandle);
  assert.equal(query.get("recipientHandle"), leg.recipientHandle);
  assert.equal(query.get("amountPhiMicro"), leg.amountPhiMicro);
  assert.equal(f.executes(), 1);
});

test("purchase preflight rejection after exact device consent keeps payment prepared and dispatches no debit", async () => {
  const f = fixture();
  const port = createWildsWalletConnectPhiPort({ ...f.input, beforeSubmit: async () => { throw Error("The USD quote changed. Review the exact purchase again."); } });
  const result = await port.sendPhi(leg);
  assert.equal(result.status, "failed"); assert.equal(f.authorizations(), 1); assert.equal(f.executes(), 0);
  assert.equal((f.saved() as {entries:Array<{phase:string}>}).entries[0]?.phase, "prepared");
});

test("an insufficient rejection survives cold reconstruction and cannot become a second financial send",async()=>{
 const f=fixture();let terminal=false,executions=0;
 const input={...f.input,fetcher:async(path:string,init:any)=>{
  if(path.endsWith("/execute")){executions++;return Response.json({status:"zero-write",rail:"settlement",code:"INSUFFICIENT_VALUE",noWriteWitness:"nw1.exact-actual-rejection"});}
  if(path.endsWith("/no-write"))return Response.json({status:"zero-write",rail:"settlement",code:"INSUFFICIENT_VALUE",terminal,retryAfterKai:200});
  return f.input.fetcher(path,init);
 }};
 const sent=await createWildsWalletConnectPhiPort(input).sendPhi(leg);assert.equal(sent.status,"failed");assert.equal((f.saved() as any).entries[0].phase,"rejected");
 const restored=createWildsWalletConnectPhiPort(input);assert.equal((await restored.sendPhi(leg)).status,"failed");assert.equal(executions,1);
 await assert.rejects(restored.verifyPhiZeroWrite(leg,sent.receipt),/authorization window/);terminal=true;await restored.verifyPhiZeroWrite(leg,sent.receipt);
 f.status("committed");assert.equal((await restored.observePhi(leg,sent.receipt)).status,"committed","a historical rejection never overrides actual native settlement");
 await assert.rejects(restored.verifyPhiZeroWrite(leg,sent.receipt));assert.equal(executions,1);
});
test("a full Phi queue archives a canonical committed original before eviction and old retry observes only its archived nonce",async()=>{
 const f=fixture();
 const entries=Array.from({length:128},(_,index)=>({leg:{attemptId:`archived:${index}`,senderHandle:leg.senderHandle,recipientHandle:leg.recipientHandle,amountPhiMicro:leg.amountPhiMicro},attempt:`v3.original-${index}`,phase:"submitted"}));
 f.seed({schema:"wildz.wallet.connect-phi-recovery.v1",ownerHandle:leg.senderHandle,keyId,entries});f.status("committed");
 const retained=new Map<string,any>();const archive={read:async(_binding:unknown,leg:any)=>structuredClone(retained.get(leg.attemptId)??null),retain:async(_binding:unknown,entry:any)=>{retained.set(entry.leg.attemptId,structuredClone(entry));return structuredClone(entry);}};
 const port=createWildsWalletConnectPhiPort({...f.input,archiveStore:archive});assert.equal((await port.sendPhi(leg)).status,"pending");assert.equal((f.saved() as any).entries.length,128);assert.equal(retained.size,1);
 const archived=[...retained.values()][0];assert.ok(archived);const before=f.executes();const previews=f.calls.filter(call=>call.path.endsWith("/preview")).length;
 assert.equal((await createWildsWalletConnectPhiPort({...f.input,archiveStore:archive}).sendPhi(archived.leg)).status,"committed");assert.equal(f.executes(),before);assert.equal(f.calls.filter(call=>call.path.endsWith("/preview")).length,previews);
});
test("full uncertain Phi queues perform bounded reads and archive failures preserve all active originals before preview",async()=>{
 for(const committed of [false,true]){
  const f=fixture();const entries=Array.from({length:128},(_,index)=>({leg:{attemptId:`protected:${index}`,senderHandle:leg.senderHandle,recipientHandle:leg.recipientHandle,amountPhiMicro:leg.amountPhiMicro},attempt:`v3.protected-${index}`,phase:"submitted"}));const record={schema:"wildz.wallet.connect-phi-recovery.v1",ownerHandle:leg.senderHandle,keyId,entries};f.seed(record);if(committed)f.status("committed");
  const archive={read:async()=>null,retain:async()=>{throw Error("archive quota");}};
  assert.equal((await createWildsWalletConnectPhiPort({...f.input,archiveStore:archive}).sendPhi(leg)).status,"failed");assert.deepEqual((f.saved() as any).entries,record.entries);assert.equal(f.executes(),0);assert.equal(f.calls.some(call=>call.path.endsWith("/preview")),false);assert.equal(f.observations(),3);
 }
});

test("bounded archive checks advance past uncertain originals without evicting them or starving verified completed history",async()=>{
 const f=fixture(),entries=Array.from({length:128},(_,index)=>({leg:{attemptId:`mixed:${index}`,senderHandle:leg.senderHandle,recipientHandle:leg.recipientHandle,amountPhiMicro:leg.amountPhiMicro},attempt:`v3.mixed-${index}`,phase:"submitted"}));f.seed({schema:"wildz.wallet.connect-phi-recovery.v1",ownerHandle:leg.senderHandle,keyId,entries});f.status("committed");
 const retained=new Map<string,any>(),archive={read:async(_binding:unknown,leg:any)=>structuredClone(retained.get(leg.attemptId)??null),retain:async(_binding:unknown,entry:any)=>{retained.set(entry.leg.attemptId,structuredClone(entry));return structuredClone(entry);}};
 const input={...f.input,archiveStore:archive,fetcher:async(path:string,init:any)=>{if(path.includes("/observe?")){const attempt=new URL(path,"https://wildz.test").searchParams.get("attempt");if(["v3.mixed-0","v3.mixed-1","v3.mixed-2"].includes(attempt??""))return Response.json({status:"unknown"});}return f.input.fetcher(path,init);}};
 assert.equal((await createWildsWalletConnectPhiPort(input).sendPhi(leg)).status,"failed");assert.equal(retained.size,0);assert.equal((await createWildsWalletConnectPhiPort(input).sendPhi(leg)).status,"pending");assert.equal(retained.size,1);assert.equal(f.executes(),1);
 assert.deepEqual((f.saved() as any).entries.slice(0,3),entries.slice(0,3),"uncertain original bytes remain active");
});
