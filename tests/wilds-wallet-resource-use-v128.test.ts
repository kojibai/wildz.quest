import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalPortableCardJson } from "../src/features/play/portable-card";
import { createWildsWalletResourceUsePortV128 } from "../src/features/play/wallet/wilds-wallet-resource-use-v128";
import type { WildsResourceGameplayCommandV128 } from "../src/lib/receiz/wilds-resource-gameplay-v128";
import type { WildsResourceExchangeBrowserRuntimeV128 } from "../src/features/play/wallet/wilds-wallet-resource-source-controller-v128";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";

// The external SDK-qualified current-source CAS is an explicit test boundary.
// This exercises real durable checkpoints, real cross-call locking and identity
// guards. Actual native admission denial is covered by source/projection tests.
function fixture(t: { after(action: () => void): void }) {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "locks"), tails = new Map<string, Promise<unknown>>();
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request<T>(name: string, action: () => Promise<T>) {
    const run = (tails.get(name) ?? Promise.resolve()).catch(() => undefined).then(action);
    tails.set(name, run); return run;
  } } });
  t.after(() => { if (descriptor) Object.defineProperty(navigator, "locks", descriptor); else Reflect.deleteProperty(navigator, "locks"); });
  const database = createMemoryWildzContinuityDatabase(), keyId = "a".repeat(64), ownerHandle = "bob.receiz.id";
  let binding = { keyId, ownerHandle }, opens = 0, calls = 0, lostResponse = false, extraEffect = false, denied = false, crossed = false;
  const accepted = new Map<string, { command: WildsResourceGameplayCommandV128; receipt: { appendId: string; head: string; sealKai: string } }>();
  const command = { kind: "food.consume" as const, commandId: "food:use:fixture", itemId: "wildz:food:fixture", kaiUPulse: 100_000_000, reserveMicroBreaths: 100 };
  const request = { attemptId: "wildz:use:fixture", memberIds: [command.itemId], command };
  const runtime = () => ({ database, keyId: crossed ? "b".repeat(64) : keyId, ownerReceizId: crossed ? "charlie.receiz.id" : ownerHandle, exchange: { async use(input: { attemptId: string; command: WildsResourceGameplayCommandV128 }) {
    calls++; if (denied) throw Error("actual SDK current source denied stale or foreign imported custody");
    const prior = accepted.get(input.attemptId);
    if (prior && canonicalPortableCardJson(prior.command) !== canonicalPortableCardJson(input.command)) throw Error("actual source attempt conflict");
    const outcome = prior ?? { command: structuredClone(input.command), receipt: { appendId: "source:accepted:fixture", head: "c".repeat(64), sealKai: "101" } };
    accepted.set(input.attemptId, outcome);
    if (lostResponse) { lostResponse = false; throw Error("accepted reply lost"); }
    const usedMemberIds = [command.itemId, ...(extraEffect ? ["unexpected:second:source-member"] : [])];
    return { command: outcome.command, state: { spentMembers: Object.fromEntries(usedMemberIds.map(id => [id, "exact-command-digest"])) }, usedMemberIds, receipt: outcome.receipt };
  }, async observeUse(attemptId: string) {
    const outcome = accepted.get(attemptId);
    return outcome ? { command: outcome.command, state: { spentMembers: { [command.itemId]: "exact-command-digest" } }, usedMemberIds: [command.itemId], receipt: outcome.receipt } : null;
  } } }) as unknown as WildsResourceExchangeBrowserRuntimeV128;
  const port = () => createWildsWalletResourceUsePortV128({ keyId, ownerHandle, currentIdentity: () => binding, openRuntime: async () => { opens++; return runtime(); } });
  return { database, port, request, counts: () => ({ opens, calls, accepted: accepted.size }), loseReply: () => { lostResponse = true; }, deny: () => { denied = true; }, crossedRuntime: () => { crossed = true; }, changeOwner: () => { binding = { ...binding, ownerHandle: "charlie.receiz.id" }; }, extra: () => { extraEffect = true; } };
}

test("constructing the resource use port performs no source or storage work", t => {
  const f = fixture(t); f.port(); assert.deepEqual(f.counts(), { opens: 0, calls: 0, accepted: 0 }); assert.equal(f.database.dump().meta.length, 0);
});

test("quota failure stops before the actual source spend", async t => {
  const f = fixture(t); f.database.failNextTransactionAfterPuts(1);
  await assert.rejects(f.port().use(f.request), /transaction_failed_after_put/);
  assert.equal(f.counts().accepted, 0); assert.equal(f.counts().calls, 0); assert.equal(f.database.dump().meta.length, 0);
});

test("dropped accepted reply recovers the exact saved command without another source effect", async t => {
  const f = fixture(t); f.loseReply(); await assert.rejects(f.port().use(f.request), /reply lost/);
  assert.equal(f.counts().accepted, 1);
  const recovered = await f.port().use(structuredClone(f.request)); assert.deepEqual(recovered.command, f.request.command);
  assert.equal(recovered.receipt.appendId, "source:accepted:fixture"); assert.equal(f.counts().accepted, 1);
  const saved = f.database.dump().meta[0]![1] as { command: WildsResourceGameplayCommandV128 };
  assert.deepEqual(saved.command, f.request.command);
});

test("concurrent same-original use remains one actual source effect", async t => {
  const f = fixture(t); const outcomes = await Promise.all([f.port().use(f.request), f.port().use(f.request)]);
  assert.equal(f.counts().accepted, 1); assert.deepEqual(outcomes[0]!.receipt, outcomes[1]!.receipt);
});

test("explicit recovery avoids a newly observed Kai or body and submits the original saved command", async t => {
  const f = fixture(t); f.loseReply(); await assert.rejects(f.port().use(f.request), /reply lost/);
  await assert.rejects(f.port().use({ ...f.request, command: { ...f.request.command, kaiUPulse: 101_000_000, reserveMicroBreaths: 999 } }), /changed command/);
  const recovered = (await f.port().recover({ attemptId: f.request.attemptId, memberIds: f.request.memberIds }))!;
  assert.deepEqual(recovered.command, f.request.command); assert.equal(f.counts().accepted, 1);
});

test("checking an absent original use remains read-only and returns no invented receipt", async t => {
  const f = fixture(t); assert.equal(await f.port().recover({ attemptId: f.request.attemptId, memberIds: f.request.memberIds }), null);
  assert.equal(f.counts().accepted, 0); assert.equal(f.counts().calls, 0); assert.equal(f.database.dump().meta.length, 0);
});

test("same attempt cannot substitute economic command fields or selected members", async t => {
  const f = fixture(t); await f.port().use(f.request); const before = f.counts().calls;
  await assert.rejects(f.port().use({ ...f.request, command: { ...f.request.command, reserveMicroBreaths: 999 } }), /different|changed|conflict|command/i);
  assert.equal(f.counts().calls, before);
  await assert.rejects(async () => f.port().use({ ...f.request, memberIds: ["different:portion"] }), /different|changed|conflict|command|portion/i);
  assert.equal(f.counts().accepted, 1);
});

test("crossed source runtime or changed Explorer never dispatches source use", async t => {
  const f = fixture(t); f.crossedRuntime(); await assert.rejects(f.port().use(f.request), /Explorer|identity|session|source.*belong/i);
  assert.equal(f.counts().calls, 0); assert.equal(f.database.dump().meta.length, 0);
  f.changeOwner(); await assert.rejects(async () => f.port().use(f.request), /Explorer changed/); assert.equal(f.counts().calls, 0);
});

test("food request must match its exact selected portion before retaining a pending command", async t => {
  const f = fixture(t); await assert.rejects(async () => f.port().use({ ...f.request, memberIds: ["different:portion"] }), /portion|member|food/i);
  assert.equal(f.database.dump().meta.length, 0); assert.equal(f.counts().calls, 0);
});

test("actual source denial remains a pending original and never local-only success", async t => {
  const f = fixture(t); f.deny(); await assert.rejects(f.port().use(f.request), /SDK current source denied/);
  assert.equal(f.counts().accepted, 0); assert.equal(f.database.dump().meta.length, 1);
});

test("extra source effects cannot be represented as the approved exact member use", async t => {
  const f = fixture(t); f.extra(); await assert.rejects(f.port().use(f.request), /exact.*(source|resource)|effects|members/i);
});

test("read-only observation rejects a changed saved body or Kai instead of relabeling canonical acceptance", async t => {
  const f = fixture(t); await f.port().use(f.request);
  const before = f.counts().calls;
  const recovered = await f.port().observe({ attemptId: f.request.attemptId, memberIds: f.request.memberIds });
  assert.deepEqual(recovered?.command, f.request.command);
  const [key, original] = f.database.dump().meta[0]!;
  const saved = original as { command: typeof f.request.command };
  for (const field of [{ reserveMicroBreaths: 999 }, { kaiUPulse: 101_000_000 }]) {
    await f.database.transaction(["meta"], "readwrite", tx => tx.put("meta", { ...saved, command: { ...saved.command, ...field } }, key));
    await assert.rejects(f.port().observe({ attemptId: f.request.attemptId, memberIds: f.request.memberIds }), /canonical|changed|command/i);
  }
  assert.equal(f.counts().calls, before, "observing never resubmits a source action");
  assert.equal(f.counts().accepted, 1);
});
