import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { getWildsConversationsForActor } from "../src/features/play/wilds-messenger-ledger";
import { createWildsWalletTradeDraft } from "../src/features/play/wallet/wilds-wallet-trade";
import { projectWildsWalletTradeInbox, wildsWalletTradeMessageId } from "../src/features/play/wallet/wilds-wallet-trade-messaging";
import type { WildsWalletTradeMessage } from "../src/features/play/wallet/wilds-wallet-trade-messaging";
import { publishWildsConversation } from "../src/lib/receiz/wilds-messenger-server";
import { hydrateWildzPrivateTrades, sendWildzPrivateTrade } from "../src/lib/receiz/wilds-private-trade-messenger";
import { createWildzReceizIdProofSession, packWildzProofSession, WILDZ_PROOF_SESSION_COOKIE } from "../src/lib/receiz/wildz-proof-session";
import { retainWildzReceizChatSession, WILDZ_RECEIZ_CHAT_SESSION_COOKIE } from "../src/lib/receiz/wildz-receiz-chat-session";

const secret = "wildz-private-trade-qualification-state-secret";
const origin = "https://receiz.example";
const conversation = {
  id: "33333333-3333-4333-8333-333333333333", kind: "dm",
  members: [
    { userId: "11111111-1111-4111-8111-111111111111", username: "trade_seller" },
    { userId: "22222222-2222-4222-8222-222222222222", username: "trade_buyer" },
  ],
};
const freshLedger = () => { delete (globalThis as Record<symbol, unknown>)[Symbol.for("receiz.wilds.messenger-ledger.v1")]; };

test("two separate players reopen the same private Trade offer and counteroffer after a lost reply", async (t) => {
  const previous = { ...process.env };
  process.env.RECEIZ_OAUTH_STATE_SECRET = secret;
  process.env.RECEIZ_BASE_URL = origin;

  const members = conversation.members.map(({ userId, username }, index) => {
    const keyId = String(index + 1).repeat(64);
    const proof = createWildzReceizIdProofSession({ keyId, username, displayName: null }, secret);
    const signedProof = packWildzProofSession(proof, secret);
    const upstreamCookie = `verified-user-${index}`;
    const chat = retainWildzReceizChatSession({
      response: new Response(null, { headers: { "set-cookie": `receiz_session=${upstreamCookie}; Secure; HttpOnly` } }),
      baseUrl: origin, userId, keyId, profileHandle: proof.profileHandle,
    }, secret);
    assert.ok(chat);
    const request = new NextRequest("https://wildz.quest/api/wilds/messages/thread", { headers: {
      cookie: `${WILDZ_PROOF_SESSION_COOKIE}=${signedProof}; ${WILDZ_RECEIZ_CHAT_SESSION_COOKIE}=${chat}`,
    } });
    return { userId, upstreamCookie, request, actor: { id: proof.profileHandle, handle: proof.profileHandle } };
  });
  const [seller, buyer] = members;
  assert.ok(seller && buyer);
  const known = new Map<string, { thread: typeof conversation; original: Record<string, unknown>; receipt: Record<string, unknown> }>();
  const operations: string[] = [];
  let loseFirstReply = true;

  t.mock.method(globalThis, "fetch", async (input: URL, init: RequestInit) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    const viewer = members.find(member => headers.get("cookie") === `receiz_session=${member.upstreamCookie}`);
    assert.ok(viewer, "native Chat uses the matching proof-bound upstream session");
    assert.equal(headers.has("authorization"), false);
    assert.equal(url.origin, origin);
    operations.push(url.pathname);
    if (url.pathname === "/api/chat/conversations" && !url.search) {
      assert.equal(init.method, "POST");
      return Response.json({ ok: true, conversation });
    }
    assert.equal(url.searchParams.get("appMessage"), "wildz-trade");
    if (url.pathname === "/api/chat/conversations") {
      const only = url.searchParams.get("conversationId");
      if (only) assert.equal(only, conversation.id);
      return Response.json({ ok: true, viewerId: viewer.userId, results: [...known.values()].reverse(), nextCursor: null });
    }
    assert.equal(url.pathname, `/api/chat/conversations/${conversation.id}/messages`);
    const sent = JSON.parse(String(init.body));
    assert.equal(sent.appMessage.recipientUserId, members.find(member => member !== viewer)?.userId);
    const key = `${viewer.userId}/${sent.appMessage.clientMessageId}`;
    const prior = known.get(key);
    if (prior) return Response.json({ ok: true, ...prior });
    const messageId = known.size === 0 ? "44444444-4444-4444-8444-444444444444" : "55555555-5555-4555-8555-555555555555";
    const receipt = {
      kind: "message", scopeId: messageId, receizedBy: viewer.userId,
      digest: "a".repeat(64), payloadDigest: "b".repeat(64), originDigest: "c".repeat(64),
    };
    const row = { thread: conversation, receipt, original: {
      version: 1, primitive: "receiz.chat.message.original.v1", messageId,
      conversationId: conversation.id, senderKind: "user", senderUserId: viewer.userId,
      createdAt: `2026-11-26T20:00:0${known.size}.000Z`, body: sent.body, walletTransfer: sent.appMessage,
      receiptDigest: receipt.digest, payloadDigest: receipt.payloadDigest, originDigest: receipt.originDigest,
    } };
    known.set(key, row);
    if (loseFirstReply) {
      loseFirstReply = false;
      throw Error("fixture lost the accepted response");
    }
    return Response.json({ ok: true, ...row }, { status: 201 });
  });
  t.after(() => {
    freshLedger();
    for (const key of ["RECEIZ_OAUTH_STATE_SECRET", "RECEIZ_BASE_URL"]) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  const makeDraft = (from: typeof seller, to: typeof buyer, id: string) => createWildsWalletTradeDraft({
    selfHandle: from.actor.handle, recipient: to.actor.handle, attemptId: id,
    phiMicro: "1", requestedPhiMicro: "1", requestNote: "Review exact package", selections: [],
  });
  const send = (from: typeof seller, to: typeof buyer, context: WildsWalletTradeMessage) => sendWildzPrivateTrade(from.request, {
    sender: from.actor, recipient: to.actor, body: "Review the exact trade in Wallet.",
    clientMessageId: wildsWalletTradeMessageId(from.actor.handle, context), context,
  });
  const offer = { kind: "trade-package", stage: "offer", draft: makeDraft(seller, buyer, "reviewed:offer") } as const;
  await assert.rejects(send(seller, buyer, offer));
  const recovered = await send(seller, buyer, offer);
  assert.ok(recovered.message.nativeOriginal);
  assert.equal(known.size, 1);
  freshLedger();

  await hydrateWildzPrivateTrades(buyer.request);
  const incoming = projectWildsWalletTradeInbox(getWildsConversationsForActor(buyer.actor.id), buyer.actor.handle);
  assert.deepEqual(incoming.map(item => item.message), [offer]);
  const counteroffer = {
    kind: "trade-package", stage: "counteroffer", draft: makeDraft(buyer, seller, "reviewed:counter"),
    inReplyTo: { senderHandle: seller.actor.handle, draft: offer.draft },
  } as const;
  await send(buyer, seller, counteroffer);
  freshLedger();
  await hydrateWildzPrivateTrades(seller.request);
  assert.deepEqual(projectWildsWalletTradeInbox(getWildsConversationsForActor(seller.actor.id), seller.actor.handle).map(item => item.message), [counteroffer]);
  assert.equal(known.size, 2);
  assert.ok(operations.every(path => path.startsWith("/api/chat/conversations")));

  const retained = getWildsConversationsForActor(seller.actor.id)[0]!;
  let exportedMessages = -1;
  const publicAdapter = (() => ({
    client: { appState: { publish: async (input: { state: typeof retained }) => {
      exportedMessages = input.state.messages.length;
      return { ok: true };
    } } },
  })) as never;
  await publishWildsConversation(seller.request, {
    playerId: seller.actor.id, handle: seller.actor.handle, receizActorId: seller.userId, practice: false,
  }, retained, publicAdapter);
  assert.equal(exportedMessages, 0, "private trade messages cannot enter the Public Proof relay");
  assert.equal(retained.messages.length, 2, "only the public projection is filtered");

});
