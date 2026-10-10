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
  return { input, calls, saved: () => saved, executes: () => executes, writes: () => writes, observations: () => observations, authorizations: () => authorizations, corrupt: () => { corruptRead = true; }, quota: () => { quota = true; } };
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
