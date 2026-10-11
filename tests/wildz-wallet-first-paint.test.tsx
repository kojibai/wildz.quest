import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createReceizIdIdentity } from "@receiz/sdk";
import { createMemoryWildzContinuityDatabase } from "./support/memory-wildz-continuity-database";
import { createWildzIdentityRepository } from "../src/lib/receiz/wildz-identity-repository";
import { createWildzWalletObservationStore, walletObservationRecordKey } from "../src/lib/receiz/wildz-wallet-observation";
import { loadWildzWalletPresentation, createWildzWalletObservationPort } from "../src/lib/receiz/wildz-wallet-presentation";
import { createWildsWalletControllerDriver, wildsWalletSharedSessionCache } from "../src/features/play/wallet/wilds-wallet-controller-driver";
import { createWildsWalletSessionCache } from "../src/features/play/wallet/wilds-wallet-controller";
import { useWildsWalletController } from "../src/features/play/wallet/useWildsWalletController";
import { WildsWalletOverview } from "../src/features/play/wallet/WildsWalletOverview";
import { projectWildsWalletCapabilities, projectWildsWalletSummary } from "../src/lib/receiz/wilds-wallet-projections";
const summary = (amount = "1234567") => projectWildsWalletSummary({ok: true, balancePhiMicro: amount, balanceUsdCents: "987", transferableResourceCount: 3, transferableCardCount: 2, reservedCardCount: 0, pendingCount: 0});
const data = (amount: string) => ({summary: summary(amount), capabilities: projectWildsWalletCapabilities(), ledger: null});
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => {resolve = done;}); return {promise, resolve}; };
async function fixture() { const db = createMemoryWildzContinuityDatabase(); const repo = createWildzIdentityRepository({database: db}); const session = await repo.bootstrap(); return {db, repo, session, store: createWildzWalletObservationStore(db)}; }

test("complete local restart: repository bootstrap and INITIAL hook HTML/driver carry exact fractional balance before any request or projection", async () => {
  const f = await fixture();
  await f.store.observe(f.session, summary(), "live");
  // Fresh repository, store, handoff, driver and cleared module cache model JS recreation.
  const restarted = await createWildzIdentityRepository({database: f.db}).bootstrap();
  const started = performance.now();
  const presentation = await loadWildzWalletPresentation(f.db, restarted);
  const elapsed = performance.now() - started;
  wildsWalletSharedSessionCache.clear();
  let requests = 0, projections = 0;
  const options = {sourceKey: restarted.keyId, incarnation: restarted.walletObservationEpoch, observation: presentation.observation};
  const driver = createWildsWalletControllerDriver({identityKey: restarted.actorId, authorityGeneration: "renewed", ...options,
    cache: createWildsWalletSessionCache(4), publish() {}, fetcher: async () => { requests++; return new Promise(() => {}); }});
  assert.equal(driver.state.summary?.admittedPhiMicro, "1234567");
  assert.equal(driver.state.summary?.displayUsdCents, "987");
  assert.equal(driver.state.summary?.transferableResourceCount, 3);
  assert.equal(driver.state.sourceAuthorityVerified, false);
  assert.equal(driver.state.capabilities?.send.available, false);
  assert.equal(driver.state.balanceBasis, "observed");
  function FirstPaint() {
    const state = useWildsWalletController(restarted.actorId, "renewed", {...options, authorization: {authorize: async () => {throw Error("must not sign");}}, backgroundReady: false,
      readAuthorization: {authorize: async () => {requests++; return false;}, projectSource: async () => {projections++; return new Promise(() => {});}}});
    assert.equal(state.capabilities?.send.available, false);
    assert.equal(state.sourceAuthorityVerified, false);
    return <WildsWalletOverview state={state} onNavigate={() => {}} />;
  }
  const html = renderToStaticMarkup(<FirstPaint />);
  assert.match(html, /1\.234567/); assert.match(html, /9\.87/); assert.match(html, /LAST KNOWN PHI/);
  assert.match(html, /Resource units<\/dt><dd>3/); assert.equal(requests, 0); assert.equal(projections, 0);
  const record = await f.db.read("meta", walletObservationRecordKey(restarted));
  const bytes = Buffer.byteLength(JSON.stringify(record)); assert.ok(bytes < 6000);
  console.log(JSON.stringify({compactHydrationMs: elapsed, observationBytes: bytes, network: requests, sourceProjections: projections}));
  driver.dispose();
});

test("committed new local zero survives restart; imported and legacy missing funds stay unknown; losing creation cannot zero existing winner", async () => {
  const f = await fixture(); assert.equal((await f.store.load(f.session))?.summary.admittedPhiMicro, "0");
  assert.equal((await f.store.load(await f.repo.bootstrap()))?.origin, "new-local");
  const imported = await createReceizIdIdentity({username: "imported_observer"});
  const prepared = await f.repo.prepare(imported.keyFile);
  await f.db.transaction(["identities", "meta"], "readwrite", tx => f.repo.writePrepared(tx, prepared, true));
  assert.equal(await f.store.load(prepared.session), null);
  const candidate = await createReceizIdIdentity({username: "losing_candidate"});
  const winner = await createReceizIdIdentity({username: "winning_import"});
  const db = createMemoryWildzContinuityDatabase(), gate = deferred(), entered = deferred();
  const repo = createWildzIdentityRepository({database: db, createIdentity: async () => {entered.resolve(); await gate.promise; return candidate;}});
  const boot = repo.bootstrap(); await entered.promise;
  const existing = await repo.prepare(winner.keyFile);
  await db.transaction(["identities", "meta"], "readwrite", tx => repo.writePrepared(tx, existing, true));
  gate.resolve(); assert.equal((await boot).keyId, existing.session.keyId);
  assert.equal(await createWildzWalletObservationStore(db).load(existing.session), null);
  assert.equal(db.dump().meta.filter(([key]) => String(key).startsWith("wildz.wallet.observation.v1:")).length, 0);
});

test("late Seal cannot regress persisted live fractional or zero; different key/actor/incarnation and corrupt envelope fail closed", async () => {
  const f = await fixture();
  await f.store.observe(f.session, summary("9000001"), "seal");
  await f.store.observe(f.session, summary("0"), "live");
  await f.store.observe(f.session, summary("9000001"), "seal");
  assert.equal((await f.store.load(f.session))?.summary.admittedPhiMicro, "0");
  for (const session of [{...f.session, keyId: "other"}, {...f.session, actorId: "other"}, {...f.session, walletObservationEpoch: "other"}]) assert.equal(await f.store.load(session), null);
  const key = walletObservationRecordKey(f.session), raw = await f.db.read<{iv: string; ciphertext: string}>("meta", key);
  await f.db.transaction(["meta"], "readwrite", tx => tx.put("meta", {...raw, ciphertext: raw!.ciphertext.slice(0, -8) + "AAAAAAAA"}, key));
  assert.equal(await f.store.load(f.session), null);
  await f.store.observe(f.session, summary(), "live");
  await f.db.transaction(["wrappingKeys"], "readwrite", tx => tx.delete("wrappingKeys", "wildz.wallet.observation-key.v1"));
  assert.equal(await f.store.load(f.session), null);
});

test("late encryptions cannot resurrect an older observation or retired/restored identity", async () => {
  const f = await fixture(), gate = deferred(), entered = deferred();
  let hold = true;
  const crypto = {getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto), randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
    subtle: new Proxy(globalThis.crypto.subtle, {get(target, prop) {const value = Reflect.get(target, prop); if (prop === "encrypt") return async (...args: Parameters<SubtleCrypto["encrypt"]>) => {if (hold) {hold = false; entered.resolve(); await gate.promise;} return target.encrypt(...args);}; return typeof value === "function" ? value.bind(target) : value;}})} as Crypto;
  const slow = createWildzWalletObservationStore(f.db, crypto);
  const old = slow.observe(f.session, summary("11"), "live"); await entered.promise;
  await f.store.observe(f.session, summary("22"), "live"); gate.resolve(); await old;
  assert.equal((await f.store.load(f.session))?.summary.admittedPhiMicro, "22");
  const prepared = await f.repo.withKeyFile(f.session.keyId, file => f.repo.prepare(file));
  await f.db.transaction(["identities", "meta"], "readwrite", tx => f.repo.writePrepared(tx, prepared, true));
  await slow.observe(f.session, summary("33"), "live");
  assert.equal(await f.store.load(f.session), null); assert.equal(await f.store.load(prepared.session), null);
  await f.store.observe(prepared.session, summary("44"), "live"); await f.repo.logout();
  assert.equal(await f.store.load(prepared.session), null);
  await slow.observe(prepared.session, summary("55"), "live");
  assert.equal(await f.db.read("meta", walletObservationRecordKey(prepared.session)), null);
});

test("pending boundary survives immediate offline restart without subtraction and exact later live refresh persists", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live");
  const port = createWildzWalletObservationPort(f.db, f.session);
  const initial = await f.store.load(f.session);
  const driver = createWildsWalletControllerDriver({identityKey: f.session.actorId, authorityGeneration: "token", sourceKey: f.session.keyId,
    incarnation: f.session.walletObservationEpoch, observation: initial, observationPort: port, cache: createWildsWalletSessionCache(4), publish() {}, fetcher: async () => {throw Error("offline");}});
  await driver.markObservationPending(); driver.dispose();
  const restored = await loadWildzWalletPresentation(f.db, await f.repo.bootstrap());
  assert.equal(restored.observation?.freshness, "pending"); assert.equal(restored.observation?.summary.admittedPhiMicro, "1234567");
  const next = createWildsWalletControllerDriver({identityKey: f.session.actorId, authorityGeneration: "new-token", sourceKey: f.session.keyId,
    incarnation: f.session.walletObservationEpoch, observation: restored.observation, observationPort: port, cache: createWildsWalletSessionCache(4), publish() {}, fetcher: async path => ({ok: true, status: 200, json: async () => path.endsWith("summary") ? summary("765432") : path.endsWith("capabilities") ? projectWildsWalletCapabilities() : null})});
  assert.equal(next.state.observationPending, true); assert.equal(next.state.balanceBasis, "observed");
  await next.projectSourceAuthority(async () => data("999")); assert.equal(next.state.summary?.admittedPhiMicro, "1234567");
  await next.refresh();
  // Let the explicitly asynchronous compact observation write complete.
  for (let i = 0; i < 50 && (await f.store.load(f.session))?.summary.admittedPhiMicro !== "765432"; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal((await f.store.load(f.session))?.summary.admittedPhiMicro, "765432");
  assert.equal((await f.store.load(f.session))?.freshness, "observed"); next.dispose();
});


test("actual execute marks pending before dispatch; unknown attempt survives fresh driver without subtraction", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live");
  let recovery: unknown, executes = 0;
  const recoveryStore = {load: () => recovery, write: (_key: string, value: unknown) => {recovery = value;}, delete: () => {recovery = undefined;}};
  const options = {identityKey: f.session.actorId, authorityGeneration: "token", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch,
    observationPort: createWildzWalletObservationPort(f.db, f.session), recoveryStore, publish() {}};
  const driver = createWildsWalletControllerDriver({...options, observation: await f.store.load(f.session), cache: createWildsWalletSessionCache(4), fetcher: async path => {
    if (path.endsWith("preview")) return {ok: true, status: 200, json: async () => ({status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1", attempt: "v1.exact", expiresAtKai: 100})};
    if (path.endsWith("execute")) { executes++; assert.equal(driver.state.observationPending, true); assert.ok(recovery, "exact recovery is durable before dispatch"); throw Error("committed reply lost"); }
    throw Error("offline");
  }});
  driver.open(); driver.selectTransferRecipient("friend"); driver.reviewTransferAmount("settlement", "25", "nonce-exact");
  await driver.stageTransfer(); driver.authorizationPointerStart(8); await driver.authorizeTransfer(8, {artifact: "fixture", challenge: {}});
  assert.equal(executes, 1); assert.equal(driver.state.transfer.phase, "unknown"); driver.dispose();
  const restarted = createWildsWalletControllerDriver({...options, authorityGeneration: "renewed", observation: (await loadWildzWalletPresentation(f.db, await f.repo.bootstrap())).observation,
    cache: createWildsWalletSessionCache(4), fetcher: async () => {throw Error("offline");}});
  assert.equal(restarted.state.transfer.attempt, "v1.exact"); assert.equal(restarted.state.transfer.phase, "unknown");
  assert.equal(restarted.state.observationPending, true); assert.equal(restarted.state.summary?.admittedPhiMicro, "1234567");
  await restarted.refresh(); assert.equal(restarted.state.summary?.admittedPhiMicro, "1234567"); restarted.dispose();
});

test("pending reservation fences interrupted encryption and a late pre-submission refresh", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live");
  const crypto = {getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto), randomUUID: globalThis.crypto.randomUUID.bind(globalThis.crypto),
    subtle: new Proxy(globalThis.crypto.subtle, {get(target, prop) {const value = Reflect.get(target, prop); if (prop === "encrypt") return async () => {throw Error("storage interrupted");}; return typeof value === "function" ? value.bind(target) : value;}})} as Crypto;
  await assert.rejects(createWildzWalletObservationStore(f.db, crypto).observe(f.session, summary(), "live", "pending"), /interrupted/);
  assert.equal((await f.store.load(f.session))?.freshness, "pending");
  assert.equal((await f.store.load(f.session))?.summary.admittedPhiMicro, "1234567");
  const gate = deferred();
  const driver = createWildsWalletControllerDriver({identityKey: f.session.actorId, authorityGeneration: "same", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch,
    observation: await f.store.load(f.session), observationPort: createWildzWalletObservationPort(f.db, f.session), cache: createWildsWalletSessionCache(4), publish() {},
    fetcher: async path => {await gate.promise; return {ok: true, status: 200, json: async () => path.endsWith("summary") ? summary("777") : path.endsWith("capabilities") ? projectWildsWalletCapabilities() : null};}});
  const refresh = driver.refresh(); await driver.markObservationPending(); gate.resolve(); await refresh;
  assert.equal(driver.state.summary?.admittedPhiMicro, "1234567"); assert.equal((await f.store.load(f.session))?.freshness, "pending"); driver.dispose();
});

test("revocation retires late Seal and bootstrap seed remount; same-key renewal resets authority while retaining observation", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live"); const observation = await f.store.load(f.session), cache = createWildsWalletSessionCache(4), gate = deferred();
  const options = {identityKey: f.session.actorId, authorityGeneration: "old", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch, observation,
    observationPort: createWildzWalletObservationPort(f.db, f.session), cache, publish() {}, fetcher: async () => ({ok: false, status: 403, json: async () => ({error: "receiz_wallet_authority_revoked"})})};
  const driver = createWildsWalletControllerDriver(options);
  driver.setAuthority(f.session.actorId, "renewed", f.session.keyId, f.session.walletObservationEpoch, observation, options.observationPort);
  assert.equal(driver.state.summary?.admittedPhiMicro, "1234567"); assert.equal(driver.state.sourceAuthorityVerified, false); assert.equal(driver.state.capabilities?.send.available, false);
  const oldSeal = driver.projectSourceAuthority(async () => {await gate.promise; return data("9");});
  await driver.refresh(); gate.resolve(); await oldSeal; assert.equal(driver.state.summary, null); assert.equal(driver.state.sourceAuthorityVerified, false);
  const remount = createWildsWalletControllerDriver({...options, authorityGeneration: "renewed"}); assert.equal(remount.state.summary, null);
  driver.dispose(); remount.dispose();
});


test("same-key renewal cannot regress newer live funds to the original bootstrap zero seed", async () => {
  const f = await fixture(), originalZero = await f.store.load(f.session);
  const driver = createWildsWalletControllerDriver({identityKey: f.session.actorId, authorityGeneration: "one", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch,
    observation: originalZero, cache: createWildsWalletSessionCache(4), publish() {}, fetcher: async path => ({ok: true, status: 200, json: async () => path.endsWith("summary") ? summary("7654321") : path.endsWith("capabilities") ? {...projectWildsWalletCapabilities(), send: {available: true}} : null})});
  await driver.refresh(); assert.equal(driver.state.capabilities?.send.available, true); driver.setAuthority(f.session.actorId, "two", f.session.keyId, f.session.walletObservationEpoch, originalZero);
  assert.equal(driver.state.summary?.admittedPhiMicro, "7654321"); assert.equal(driver.state.capabilities?.send.available, false); assert.equal(driver.state.sourceAuthorityVerified, false); driver.dispose();
});


test("failed optional observation persistence never blocks exact transfer; retained attempt restores pending freshness", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live"); let recovery: unknown, executes = 0;
  const recoveryStore = {load: () => recovery, write: (_key: string, value: unknown) => {recovery = value;}, delete: () => {recovery = undefined;}};
  const options = {identityKey: f.session.actorId, authorityGeneration: "token", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch, recoveryStore, publish() {},
    observation: await f.store.load(f.session), observationPort: {observe: async () => {throw Error("quota");}, retire: async () => {}}};
  const driver = createWildsWalletControllerDriver({...options, cache: createWildsWalletSessionCache(4), fetcher: async path => {
    if (path.endsWith("preview")) return {ok: true, status: 200, json: async () => ({status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1", attempt: "v1.quota", expiresAtKai: 100})};
    if (path.endsWith("execute")) {executes++; throw Error("lost response");} throw Error("offline");
  }});
  driver.open(); driver.selectTransferRecipient("friend"); driver.reviewTransferAmount("settlement", "25", "nonce-quota"); await driver.stageTransfer();
  driver.authorizationPointerStart(8); await driver.authorizeTransfer(8, {artifact: "fixture", challenge: {}});
  assert.equal(executes, 1); assert.equal(driver.state.transfer.phase, "unknown"); driver.dispose();
  assert.equal((await f.store.load(f.session))?.freshness, "observed", "failed cache write cannot fabricate success");
  const restarted = createWildsWalletControllerDriver({...options, authorityGeneration: "renewed", cache: createWildsWalletSessionCache(4), fetcher: async () => {throw Error("offline");}});
  assert.equal(restarted.state.transfer.attempt, "v1.quota"); assert.equal(restarted.state.observationPending, true);
  assert.equal(restarted.state.balanceBasis, "observed"); assert.equal(restarted.state.summary?.admittedPhiMicro, "1234567"); restarted.dispose();
});


test("normal, failed and indefinitely pending observation I/O cannot delay financial dispatch", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live");
  for (const mode of ["normal", "failed", "hung"] as const) {
    let recovery: unknown, executes = 0, elapsed = -1, start = 0;
    const driver = createWildsWalletControllerDriver({identityKey: f.session.actorId, authorityGeneration: "token", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch,
      observation: await f.store.load(f.session), cache: createWildsWalletSessionCache(4), publish() {},
      observationPort: {observe: mode === "normal" ? () => f.store.observe(f.session, summary(), "live", "pending") : mode === "failed" ? async () => {throw Error("quota");} : () => new Promise(() => {}), retire: async () => {}},
      recoveryStore: {load: () => recovery, write: (_key, value) => {recovery = value;}, delete: () => {}},
      fetcher: async path => {
        if (path.endsWith("preview")) return {ok: true, status: 200, json: async () => ({status: "staged", rail: "settlement", amountPhiMicro: "25", quotedUsdCents: "1", attempt: "v1.latency", expiresAtKai: 100})};
        if (path.endsWith("execute")) {executes++; elapsed = performance.now() - start; throw Error("reply lost");} throw Error("offline");
      }});
    driver.open(); driver.selectTransferRecipient("friend"); driver.reviewTransferAmount("settlement", "25", "nonce-latency"); await driver.stageTransfer(); driver.authorizationPointerStart(1);
    start = performance.now(); const execution = driver.authorizeTransfer(1, {artifact: "fixture", challenge: {}});
    assert.equal(executes, 1, "dispatch occurs synchronously before observation I/O settles"); await execution;
    console.log(JSON.stringify({observationMode: mode, submissionDispatchMs: elapsed, executes})); driver.dispose();
  }
});


test("retained index I/O cannot delay initial authenticated observation or known zero", async () => {
  for (const amount of ["1234567", "0"]) {
    const f = await fixture(); await f.store.observe(f.session, summary(amount), "live");
    const entered = deferred(), release = deferred();
    const database = {...f.db, transaction: (async (stores, mode, action) => f.db.transaction(stores, mode, tx => action({...tx,
      get: async (store, key) => { if (String(key).includes("resource-projection-index")) { entered.resolve(); await release.promise; } return tx.get(store, key); }
    }))) as typeof f.db.transaction};
    const loading = loadWildzWalletPresentation(database, f.session);
    const first = await Promise.race([loading.then(value => ({value})), entered.promise.then(() => null)]);
    release.resolve();
    assert.ok(first, "observation handoff must finish before starting bulk index I/O");
    assert.equal(first.value.observation?.summary.admittedPhiMicro, amount);
    assert.equal(first.value.observation?.summary.transferableResourceCount, 3);
    await loading;
  }
});


test("pending resource counts remain last known objects; settled mixed quantities and newer live counts render distinctly", async () => {
  const f = await fixture(); await f.store.observe(f.session, summary(), "live");
  const presentation = await loadWildzWalletPresentation(f.db, f.session);
  assert.deepEqual(structuredClone(presentation), presentation, "continuity handoff remains cloneable and serializable");
  assert.deepEqual(JSON.parse(JSON.stringify(presentation)), presentation);
  const driver = createWildsWalletControllerDriver({identityKey: f.session.actorId, authorityGeneration: "one", sourceKey: f.session.keyId, incarnation: f.session.walletObservationEpoch,
    observation: presentation.observation, cache: createWildsWalletSessionCache(4), publish() {}, fetcher: async path => ({ok: true, status: 200, json: async () => path.endsWith("summary") ? {...summary("5"), transferableResourceCount: 7} : path.endsWith("capabilities") ? projectWildsWalletCapabilities() : null})});
  const render = (pending: boolean) => renderToStaticMarkup(<WildsWalletOverview state={driver.state} inventoryCounts={{resourceUnits: 19, creatureCards: 2, resourceUnitsPending: pending}} onNavigate={() => {}}/>);
  assert.match(render(true), /Last known resources<\/dt><dd>3/);
  assert.doesNotMatch(render(true), /Resource units<\/dt><dd>19/);
  await driver.refresh(); assert.match(render(true), /Last known resources<\/dt><dd>7/);
  assert.match(render(false), /Resource units<\/dt><dd>19/);
  const unknown = {...driver.state, summary: {...driver.state.summary!, assetCountsStatus: "unknown" as const, transferableResourceCount: null, transferableCardCount: null, reservedCardCount: null, pendingCount: null}};
  assert.match(renderToStaticMarkup(<WildsWalletOverview state={unknown} inventoryCounts={{resourceUnits: 0, creatureCards: 2, resourceUnitsPending: true}} onNavigate={() => {}}/>), /Last known resources<\/dt><dd>—/);
  driver.dispose();
});
