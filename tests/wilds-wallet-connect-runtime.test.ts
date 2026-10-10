import assert from "node:assert/strict";
import test from "node:test";
import { createReceizClient, createReceizIdentityKeyFile, createReceizProofAuthorityChallenge, digestReceizCanonicalV122, receizKaiNow, receizOidcScopesForRails, serializeReceizIdentityArtifact, signReceizIdentityLoginProof } from "@receiz/sdk";
import { wildsWalletTransferConsentStatementDigest } from "../src/lib/receiz/wilds-wallet-transfer-consent";
import { WILDZ_RECEIZ_APPLICATION_ID } from "../src/lib/receiz/wildz-application";
const modulePath = "../src/lib/receiz/wilds-wallet-connect-runtime.js";
const OWNER = "11111111-1111-4111-8111-111111111111";
const PEER = "22222222-2222-4222-8222-222222222222";
const CONVERSATION = "33333333-3333-4333-8333-333333333333";
const MESSAGE = "44444444-4444-4444-8444-444444444444";
const TRANSFER = "55555555-5555-4555-8555-555555555555";
const SECRET = "connect-runtime-synthetic-fixture-secret-32-bytes";

async function fixture() {
  const { keyFile } = await createReceizIdentityKeyFile({ owner: { uid: "fixture", username: "alice", displayName: "Fixture" }, passphrase: "fixture-only" });
  const artifact = serializeReceizIdentityArtifact(keyFile);
  const authority = { accessToken: "fixture-read", ownerReceizId: OWNER, actorId: "alice", profileHandle: "alice.receiz.id" };
  const session = { schema: "wildz.receiz.chat-session.v1", origin: "https://receiz.example", userId: OWNER, keyId: keyFile.keyId, profileHandle: "alice.receiz.id", cookie: "fixture-upstream-cookie", issuedAt: Date.now() };
  let lostReply = false;
  let corruptMember = false;
  let debitCount = 0;
  let endlessPages=false,pageIndex=0,insufficient=false,now=receizKaiNow().pulse;
  const calls: { path: string; body: any }[] = [];
  const committed = new Map<string, any>();
  const fetchImpl: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ path, body });
    if (path === "/api/chat/conversations") {
      assert.equal(new Headers(init?.headers).get("cookie"), "receiz_session=fixture-upstream-cookie");
      return Response.json({ ok: true, conversation: { id: CONVERSATION, kind: "dm", members: [{ kind: "user", userId: OWNER, username: "alice" }, { kind: "user", userId: PEER, username: corruptMember ? "mallory" : "bob" }] } });
    }
    if (path.endsWith("/messages")) {
      assert.equal(new Headers(init?.headers).get("cookie"), "receiz_session=fixture-upstream-cookie");
      return Response.json({ ok: true, conversation: { id: CONVERSATION }, messages: [...committed.values()], hasMore: endlessPages, nextCursor: endlessPages?new Date(Date.now()-(++pageIndex)*86_400_000).toISOString():null });
    }
    if (path === "/api/connect/wallet/me") return Response.json({ ok: true, wallet: { userId: OWNER, balancePhiMicro: "9007199254740993000000", quote: { usdPerPhiMicrocents: "1000000000000" } } });
    if (path === "/api/sdk/v1/identity/proof-authority/exchange") {
      const challenge = body.challenge;
      const basis = { schema: "receiz.identity.proof-authority.v123", applicationId: WILDZ_RECEIZ_APPLICATION_ID, keyId: keyFile.keyId, artifactDigest: body.artifact.digest, grantedScopes: [...body.scopes].sort(), issuedAtKai: challenge.issuedAtKai, expiresAtKai: challenge.expiresAtKai, nonce: challenge.nonce, revocationHead: "a".repeat(64), tokenType: "Bearer", expiresIn: 300, refreshable: false, authority: { grantIsIdentityAuthority: false, strongerTruth: "receiz-identity-artifact" } };
      return Response.json({ ...basis, authorityDigest: await digestReceizCanonicalV122(basis), accessToken: "fixture-write" });
    }
    if (path === "/api/connect/transfers") {
      if(insufficient)return Response.json({ok:false,error:"wallet_insufficient_funds"},{status:409});
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fixture-write");
      const previous = committed.get(body.clientNonce);
      if (!previous) {
        debitCount += 1;
        const amountPhiMicro = BigInt(body.amountPhi.replace(".", "")).toString();
        const walletTransfer = { kind: "chat_transfer", transferId: TRANSFER, senderUserId: OWNER, recipientUserId: PEER, amountPhiMicro, note: body.note };
        committed.set(body.clientNonce, { id: MESSAGE, conversationId: CONVERSATION, senderUserId: OWNER, walletTransfer, sealedOriginal: { primitive: "receiz.chat.message.original.v1", version: 1, messageId: MESSAGE, conversationId: CONVERSATION, senderUserId: OWNER, walletTransfer: { ...walletTransfer, transferId: null }, receiptDigest: "b".repeat(64), payloadDigest: "c".repeat(64), originDigest: "d".repeat(64) } });
      }
      if (lostReply) { lostReply = false; throw new TypeError("fixture committed reply lost"); }
      return Response.json({ ok: true, transfer: { id: TRANSFER, messageId: MESSAGE, conversationId: CONVERSATION, senderUserId: OWNER, recipientUserId: PEER, amountPhiMicro: committed.get(body.clientNonce).walletTransfer.amountPhiMicro, alreadyProcessed: Boolean(previous) } });
    }
    throw new Error(`unexpected published path ${path}`);
  };
  const clientFor = (accessToken: string) => createReceizClient({ baseUrl: session.origin, accessToken, fetchImpl });
  const createAdapter = (accessToken: string) => {
    const client = clientFor(accessToken);
    return { client, walletSummary: () => client.connect.wallet(), connectTransfer: (body: any, idempotencyKey?: string) => client.connect.transfer(body, { idempotencyKey }), exchangeProofAuthorityV123: (body: any) => client.identity.exchangeProofAuthority(body), introspectAccessToken: async () => ({ active: true, sub: OWNER, scope: "receiz:wallet.read receiz:wallet.transfer", actor_label: keyFile.keyId }) };
  };
  const connectRuntimeModule = await import(modulePath);
  const create = (admittedSession: unknown = session) => connectRuntimeModule.createWildsWalletConnectTransferRuntime({ session: admittedSession, createAdapter, fetchImpl, secret: SECRET, currentKai: () => now });
  const consent = async (attempt: string, scopes = receizOidcScopesForRails("wallet")) => {
    // Use the SDK's exact artifact digest, never the fixture's display account.
    const { sha256ReceizBytes } = await import("@receiz/sdk");
    const signed = createReceizProofAuthorityChallenge({ applicationId: WILDZ_RECEIZ_APPLICATION_ID, artifactDigest: await sha256ReceizBytes(new TextEncoder().encode(artifact)), scopes, consentStatementDigest: await wildsWalletTransferConsentStatementDigest({ attempt, amountPhiMicro: "9007199254740993", rail: "settlement" }), ttlPulses: 60 });
    return { artifact, challenge: { ...signed.challenge, proof: await signReceizIdentityLoginProof({ keyFile, passphrase: "fixture-only", challengeB64Url: signed.challengeB64Url }) } };
  };
  const command = { recipientUsername: "bob", amountPhiMicro: "9007199254740993", rail: "settlement", operationNonce: "88888888-8888-4888-8888-888888888888" };
  return { authority, session, create, command, consent, calls, committed, debitCount: () => debitCount, loseReply: () => { lostReply = true; }, corruptMember: () => { corruptMember = true; },insufficient:()=>{insufficient=true;},clearInsufficient:()=>{insufficient=false;},endlessPages:()=>{endlessPages=true;},setKai:(value:number)=>{now=value;} };
}

test("released SDK Connect Send resolves real members and moves exact micro-Phi once across a lost reply and runtime reconstruction", async () => {
  const f = await fixture();
  const staged = await f.create().preview(f.authority, f.command);
  assert.match(staged.attempt, /^v3\./);
  f.loseReply();
  const result = await f.create().execute(f.authority, { attempt: staged.attempt, consent: await f.consent(staged.attempt) });
  assert.equal(result.status, "unknown");
  assert.equal(f.debitCount(), 1);
  const before = f.calls.filter(call => call.path === "/api/connect/transfers").length;
  assert.deepEqual(await f.create().status(f.authority, staged.attempt), { status: "committed", rail: "settlement", amountPhiMicro: "9007199254740993", recipientUsername: "bob" });
  assert.equal(f.calls.filter(call => call.path === "/api/connect/transfers").length, before, "status is strictly read-only");
  await f.create().execute(f.authority, { attempt: staged.attempt, consent: await f.consent(staged.attempt) });
  assert.equal(f.debitCount(), 1);
  const writes = f.calls.filter(call => call.path === "/api/connect/transfers");
  assert.equal(writes[0].body.amountPhi, "9007199254.740993");
  assert.equal(writes[0].body.conversationId, CONVERSATION);
  assert.equal(writes[0].body.recipientUserId, PEER);
  assert.equal(new Set(writes.map(call => call.body.clientNonce)).size, 1);
});
test("actual SDK insufficient rejection yields a bounded retry witness that cannot release before original consent expiry",async()=>{
 const f=await fixture(),staged=await f.create().preview(f.authority,f.command);f.insufficient();
 const outcome=await f.create().execute(f.authority,{attempt:staged.attempt,consent:await f.consent(staged.attempt)});
 assert.equal(outcome.status,"zero-write");assert.match(outcome.noWriteWitness,/^nw1\./);assert.equal(typeof f.create().noWrite,"function");
 const exact={attempt:staged.attempt,senderHandle:"alice.receiz.id",recipientHandle:"bob.receiz.id",amountPhiMicro:f.command.amountPhiMicro,operationNonce:f.command.operationNonce,noWriteWitness:outcome.noWriteWitness};
 const early=await f.create().noWrite(f.authority,exact);assert.equal(early.terminal,false);assert.equal(early.retryAfterKai,staged.expiresAtKai);
 f.setKai(staged.expiresAtKai);assert.equal((await f.create().noWrite(f.authority,exact)).terminal,true);
 await assert.rejects(f.create().noWrite(f.authority,{...exact,amountPhiMicro:"1"}),/binding_invalid/);
 await assert.rejects(f.create().noWrite(f.authority,{...exact,noWriteWitness:outcome.noWriteWitness.slice(0,-2)+"ab"}),/invalid/);
 await assert.rejects(f.create().execute(f.authority,{attempt:staged.attempt,consent:await f.consent(staged.attempt)}),/review_expired/);assert.equal(f.debitCount(),0);
});

test("Connect preview refuses a mismatched canonical recipient without a financial write", async () => {
  const f = await fixture(); f.corruptMember();
  await assert.rejects(f.create().preview(f.authority, f.command), /recipient_unavailable/);
  assert.equal(f.debitCount(), 0);
});

test("Connect Send denies changed account, old rail consent and absent upstream cookie before any debit", async () => {
  const f = await fixture();
  const staged = await f.create().preview(f.authority, f.command);
  await assert.rejects(f.create().execute({ ...f.authority, ownerReceizId: PEER }, { attempt: staged.attempt, consent: await f.consent(staged.attempt) }), /identity_mismatch/);
  await assert.rejects(f.create().execute(f.authority, { attempt: staged.attempt, consent: await f.consent(staged.attempt, receizOidcScopesForRails("settlement")) }), /PROOF|consent|scope/i);
  await assert.rejects(f.create(null).preview(f.authority, f.command), /session_required/);
  assert.equal(f.debitCount(), 0);
});

test("an unexecuted exact attempt stays unknown on read-only recovery", async () => {
  const f = await fixture(); const staged = await f.create().preview(f.authority, f.command);
  assert.equal((await f.create().status(f.authority, staged.attempt)).status, "unknown");
  assert.equal(f.debitCount(), 0);
});

test("forged receipt recipient or amount is never accepted as a committed send", async () => {
  const f = await fixture(); const staged = await f.create().preview(f.authority, f.command);
  await f.create().execute(f.authority, { attempt: staged.attempt, consent: await f.consent(staged.attempt) });
  const message = [...f.committed.values()][0];
  message.sealedOriginal.walletTransfer.recipientUserId = OWNER;
  assert.equal((await f.create().status(f.authority, staged.attempt)).status, "unknown");
});

test("Connect consent challenges use the actual configured application and wallet scopes from the closed attempt", async () => {
  const f = await fixture(); const staged = await f.create().preview(f.authority, f.command);
  const envelope = await f.create().consentChallenge(f.authority, { attempt: staged.attempt, artifactDigest: "e".repeat(64) });
  assert.equal(envelope.applicationId, WILDZ_RECEIZ_APPLICATION_ID);
  assert.deepEqual(envelope.scopes, ["receiz:wallet.read", "receiz:wallet.transfer"]);
  assert.equal(envelope.unsigned.audience, envelope.applicationId);
  assert.equal(envelope.unsigned.consent.statementDigest, await wildsWalletTransferConsentStatementDigest({ attempt: staged.attempt, amountPhiMicro: f.command.amountPhiMicro, rail: "settlement" }));
  assert.equal(f.debitCount(), 0);
});

test("a recipient independently observes only the exact sealed Connect leg without sender credentials or another write", async () => {
  const f = await fixture(); const staged = await f.create().preview(f.authority, f.command);
  await f.create().execute(f.authority, { attempt: staged.attempt, consent: await f.consent(staged.attempt) });
  const peerAuthority = { ...f.authority, ownerReceizId: PEER, actorId: "bob", profileHandle: "bob.receiz.id" };
  const peerSession = { ...f.session, userId: PEER, keyId: "f".repeat(64), profileHandle: "bob.receiz.id" };
  const reader = f.create(peerSession);
  assert.equal(typeof reader.observe, "function", "the exact peer observation port is available");
  const leg = { attempt: staged.attempt, senderHandle: "alice.receiz.id", recipientHandle: "bob.receiz.id", amountPhiMicro: f.command.amountPhiMicro, operationNonce: f.command.operationNonce };
  const before = f.calls.filter(call => call.path === "/api/connect/transfers").length;
  assert.equal((await reader.observe(peerAuthority, leg)).status, "committed");
  await assert.rejects(reader.observe(peerAuthority, { ...leg, amountPhiMicro: "1" }), /binding_invalid/);
  await assert.rejects(reader.observe(peerAuthority, { ...leg, senderHandle: "mallory.receiz.id" }), /binding_invalid/);
  await assert.rejects(reader.observe(peerAuthority, { ...leg, operationNonce: "different-nonce" }), /binding_invalid/);
  await assert.rejects(f.create({ ...peerSession, userId: "66666666-6666-4666-8666-666666666666" }).observe({ ...peerAuthority, ownerReceizId: "66666666-6666-4666-8666-666666666666" }, leg), /identity_mismatch/);
  assert.equal(f.calls.filter(call => call.path === "/api/connect/transfers").length, before);
  assert.equal(f.debitCount(), 1);
});

test("a known rejection witness never overrides an actual later canonical commitment of the same native nonce",async()=>{
 const f=await fixture(),staged=await f.create().preview(f.authority,f.command);f.insufficient();
 const rejected=await f.create().execute(f.authority,{attempt:staged.attempt,consent:await f.consent(staged.attempt)});assert.equal(rejected.status,"zero-write");
 f.clearInsufficient();const actual=await f.create().execute(f.authority,{attempt:staged.attempt,consent:await f.consent(staged.attempt)});assert.equal(actual.status,"committed");f.setKai(staged.expiresAtKai);
 await assert.rejects(f.create().noWrite(f.authority,{attempt:staged.attempt,senderHandle:"alice.receiz.id",recipientHandle:"bob.receiz.id",amountPhiMicro:f.command.amountPhiMicro,operationNonce:f.command.operationNonce,noWriteWitness:rejected.noWriteWitness}),/committed_since_rejection/);assert.equal(f.debitCount(),1);
});

test("truncated canonical history remains unknown and cannot qualify rejected-payment closure",async()=>{
 const f=await fixture(),staged=await f.create().preview(f.authority,f.command);f.insufficient();const rejected=await f.create().execute(f.authority,{attempt:staged.attempt,consent:await f.consent(staged.attempt)});f.setKai(staged.expiresAtKai);f.endlessPages();
 await assert.rejects(f.create().noWrite(f.authority,{attempt:staged.attempt,senderHandle:"alice.receiz.id",recipientHandle:"bob.receiz.id",amountPhiMicro:f.command.amountPhiMicro,operationNonce:f.command.operationNonce,noWriteWitness:rejected.noWriteWitness}),/receipt_unavailable/);assert.equal(f.debitCount(),0);
});
