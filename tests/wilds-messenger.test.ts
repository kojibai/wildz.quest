import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import {
  sanitizeWildsDirectMessage,
  mergeWildsGroupRooms,
  wildsGroupRoomId,
  wildsConversationId,
  wildsConversationSummary,
  wildsMessageDeliveryState
} from "../src/features/play/wilds-messenger-core.js";
import {
  admitWildsConversation,
  appendWildsDirectMessage,
  appendWildsGroupMessage,
  addWildsGroupRoomMembers,
  createWildsGroupRoom,
  markWildsConversationRead,
  mergeWildsConversations,
  reactToWildsDirectMessage
} from "../src/features/play/wilds-messenger-ledger.js";
import {
  hydrateWildsConversation,
  publishWildsConversation,
  wildsConversationSourceUrl
} from "../src/lib/receiz/wilds-messenger-server.js";

const kai = { id: "receiz:kai", handle: "kai" };
const nova = { id: "receiz:nova", handle: "nova" };

describe("Wilds Receiz-ID messenger", () => {
  it("uses a stable participant-order independent conversation coordinate", () => {
    assert.equal(wildsConversationId(kai.id, nova.id), wildsConversationId(nova.id, kai.id));
    assert.match(wildsConversationId(kai.id, nova.id), /^conversation:[a-f0-9]{32}$/);
  });

  it("preserves natural multiline messages without allowing control bytes", () => {
    assert.equal(sanitizeWildsDirectMessage("  First line\r\nSecond line\u0000  "), "First line\nSecond line");
    assert.throws(() => sanitizeWildsDirectMessage("  \n "), /wilds_message_empty/);
    assert.throws(() => sanitizeWildsDirectMessage("x".repeat(2_001)), /wilds_message_too_long/);
  });

  it("makes sends idempotent and binds replies to an existing source message", () => {
    const first = appendWildsDirectMessage({ sender: kai, recipient: nova, body: "You made it.", clientMessageId: "kai-1", now: "2026-08-23T20:00:00.000Z" });
    const replay = appendWildsDirectMessage({ sender: kai, recipient: nova, body: "You made it.", clientMessageId: "kai-1", now: "2026-08-23T20:00:01.000Z" });
    assert.equal(replay.message.id, first.message.id);
    assert.equal(replay.conversation.messages.filter((message) => message.clientMessageId === "kai-1").length, 1);
    const reply = appendWildsDirectMessage({ sender: nova, recipient: kai, body: "Always.", clientMessageId: "nova-1", replyToId: first.message.id, now: "2026-08-23T20:00:02.000Z" });
    assert.equal(reply.message.replyToId, first.message.id);
    assert.equal(reply.message.authority.source, "receiz-id-proof-object");
    assert.equal(reply.message.authority.projection, "sync-only");
  });

  it("records a committed Phi proof once and rejects semantic mutation under its message identity", () => {
    const context = {
      kind: "phi-transfer" as const,
      amountPhiMicro: "2500000",
      rail: "settlement" as const,
      status: "committed" as const,
      transferReference: `phi-transfer:${"a".repeat(64)}`
    };
    const first = appendWildsDirectMessage({ sender: kai, recipient: nova, body: "Sent Φ2.5", clientMessageId: `wilds-message:${context.transferReference}`, context, now: "2026-08-23T20:10:00.000Z" });
    const replay = appendWildsDirectMessage({ sender: kai, recipient: nova, body: "Sent Φ2.5", clientMessageId: `wilds-message:${context.transferReference}`, context, now: "2026-08-23T20:10:01.000Z" });
    assert.equal(replay.message.id, first.message.id);
    assert.equal(replay.conversation.messages.filter((message) => message.context?.kind === "phi-transfer").length, 1);
    assert.equal(replay.message.authority.source, "receiz-id-proof-object");
    assert.equal(replay.message.authority.projection, "sync-only");
    assert.throws(() => appendWildsDirectMessage({
      sender: kai,
      recipient: nova,
      body: "Sent Φ99",
      clientMessageId: `wilds-message:${context.transferReference}`,
      context: { ...context, amountPhiMicro: "99000000" }
    }), /wilds_message_idempotency_conflict/);
  });

  it("tracks unread/read state and delivery without making synchronization authoritative", () => {
    const sender = { id: "receiz:kai-read", handle: "kai" };
    const recipient = { id: "receiz:nova-read", handle: "nova" };
    const sent = appendWildsDirectMessage({ sender, recipient, body: "Signal", clientMessageId: "kai-read", now: "2026-08-23T21:00:00.000Z" });
    assert.equal(wildsConversationSummary(sent.conversation, recipient.id).unreadCount, 1);
    assert.equal(wildsMessageDeliveryState(sent.message, sent.conversation, sender.id), "sent");
    const read = markWildsConversationRead({ left: sender, right: recipient, actorId: recipient.id, through: "2026-08-23T21:00:00.000Z", now: "2026-08-23T21:00:01.000Z" });
    assert.equal(wildsConversationSummary(read, recipient.id).unreadCount, 0);
    assert.equal(wildsMessageDeliveryState(sent.message, read, sender.id), "read");
  });

  it("toggles participant reactions and converges forked projections without losing messages", () => {
    const sender = { id: "receiz:kai-react", handle: "kai" };
    const recipient = { id: "receiz:nova-react", handle: "nova" };
    const sent = appendWildsDirectMessage({ sender, recipient, body: "Fire", clientMessageId: "kai-react", now: "2026-08-23T22:00:00.000Z" });
    const reacted = reactToWildsDirectMessage({ left: sender, right: recipient, actorId: recipient.id, messageId: sent.message.id, emoji: "🔥", now: "2026-08-23T22:00:01.000Z" });
    assert.deepEqual(reacted.messages.find((message) => message.id === sent.message.id)?.reactions, [{ emoji: "🔥", actorIds: [recipient.id] }]);
    const removed = reactToWildsDirectMessage({ left: sender, right: recipient, actorId: recipient.id, messageId: sent.message.id, emoji: "🔥", now: "2026-08-23T22:00:02.000Z" });
    assert.deepEqual(removed.messages.find((message) => message.id === sent.message.id)?.reactions, []);

    const fork = {
      ...sent.conversation,
      revision: sent.conversation.revision + 1,
      messages: [...sent.conversation.messages, {
        ...sent.message,
        id: `${sent.message.id}:fork`,
        clientMessageId: "fork",
        body: "Second source append",
        createdAt: "2026-08-23T22:00:03.000Z"
      }],
      updatedAt: "2026-08-23T22:00:03.000Z"
    };
    assert.equal(mergeWildsConversations(reacted, fork).messages.length >= 2, true);
    assert.equal(admitWildsConversation(fork).messages.some((message) => message.clientMessageId === "fork"), true);
  });

  it("keeps private projection explicitly subordinate to the proof-object source", () => {
    const server = readFileSync("src/lib/receiz/wilds-messenger-server.ts", "utf8");
    const sourceRoute = readFileSync("app/api/wilds/messages/source/[conversationId]/route.ts", "utf8");
    const hook = readFileSync("src/features/play/use-wilds-messenger.ts", "utf8");
    assert.match(server, /visibility:\s*"private"/);
    assert.match(server, /sync_pending/);
    assert.match(sourceRoute, /Message content is never served/);
    assert.match(hook, /if \(!open \|\| !input\.selfId\) return/);
    assert.match(hook, /window\.setTimeout\(tick, 4_000\)/);
    assert.doesNotMatch(hook, /20_000|setInterval/);
    assert.doesNotMatch(server, /authorization required|permission required|projection required/i);
  });

  it("publishes one source message globally and admits it from the recipient's Receiz ID", async () => {
    const sender = { id: "receiz:global-kai", handle: "global-kai" };
    const recipient = { id: "receiz:global-nova", handle: "global-nova" };
    const request = new NextRequest("https://wildz.quest/api/wilds/messages/thread");
    const sourceUrl = wildsConversationSourceUrl(request, sender.id, recipient.id);
    const remote = new Map<string, unknown>();
    const accessTokens: string[] = [];
    const adapterFactory = ((options?: { accessToken?: string }) => {
      if (options?.accessToken) accessTokens.push(options.accessToken);
      return {
        readAppStateByUrl: async (url: string) => remote.get(url) ?? null,
        client: { appState: { publish: async (input: { sourceUrl: string; state: unknown }) => {
          remote.set(input.sourceUrl, { result: { appState: input.state } });
          return { ok: true };
        } } }
      } as never;
    }) as never;
    const sent = appendWildsDirectMessage({ sender, recipient, body: "Globally durable signal", clientMessageId: "global-round-trip", now: "2026-08-23T23:30:00.000Z" }).conversation;
    const published = await publishWildsConversation(request, { playerId: sender.id, handle: sender.handle, receizActorId: sender.id, practice: false, accessToken: "sender-token" }, sent, adapterFactory);
    assert.deepEqual(published, { published: true, mode: "receiz_synced" });
    assert.equal(remote.has(sourceUrl), true);

    delete (globalThis as Record<symbol, unknown>)[Symbol.for("receiz.wilds.messenger-ledger.v1")];
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("receiz.wilds.messenger-hydration.v1")];
    const admitted = await hydrateWildsConversation(request, { playerId: recipient.id, handle: recipient.handle, receizActorId: recipient.id, practice: false, accessToken: "recipient-token" }, sender, adapterFactory);
    assert.equal(admitted.messages.at(-1)?.body, "Globally durable signal");
    assert.deepEqual(accessTokens, ["sender-token", "recipient-token"]);

    const newer = appendWildsDirectMessage({ sender: recipient, recipient: sender, body: "Local source reply", clientMessageId: "newer-local", now: "2026-08-23T23:30:01.000Z" }).conversation;
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("receiz.wilds.messenger-hydration.v1")];
    const afterStaleProjection = await hydrateWildsConversation(request, { playerId: recipient.id, handle: recipient.handle, receizActorId: recipient.id, practice: false, accessToken: "recipient-token" }, sender, adapterFactory);
    assert.equal(afterStaleProjection.messages.length, newer.messages.length);
    assert.equal(afterStaleProjection.messages.at(-1)?.body, "Local source reply");
  });

  it("globally syncs the exact committed Phi record to the recipient thread", async () => {
    const sender = { id: "receiz:phi-kai", handle: "phi-kai" };
    const recipient = { id: "receiz:phi-nova", handle: "phi-nova" };
    const request = new NextRequest("https://wildz.quest/api/wilds/messages/thread");
    const remote = new Map<string, unknown>();
    const adapterFactory = ((options?: { accessToken?: string }) => ({
      readAppStateByUrl: async (url: string) => remote.get(url) ?? null,
      client: { appState: { publish: async (input: { sourceUrl: string; state: unknown }) => {
        assert.ok(options?.accessToken);
        remote.set(input.sourceUrl, { result: { appState: input.state } });
        return { ok: true };
      } } }
    })) as never;
    const transferReference = `phi-transfer:${"b".repeat(64)}`;
    const sent = appendWildsDirectMessage({
      sender,
      recipient,
      body: "Sent Φ3.25",
      clientMessageId: `wilds-message:${transferReference}`,
      context: {
        kind: "phi-transfer",
        amountPhiMicro: "3250000",
        rail: "settlement",
        status: "committed",
        transferReference
      },
      now: "2026-08-23T23:45:00.000Z"
    }).conversation;
    assert.deepEqual(
      await publishWildsConversation(request, { playerId: sender.id, handle: sender.handle, receizActorId: sender.id, practice: false, accessToken: "phi-sender-token" }, sent, adapterFactory),
      { published: true, mode: "receiz_synced" }
    );

    delete (globalThis as Record<symbol, unknown>)[Symbol.for("receiz.wilds.messenger-ledger.v1")];
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("receiz.wilds.messenger-hydration.v1")];
    const admitted = await hydrateWildsConversation(request, { playerId: recipient.id, handle: recipient.handle, receizActorId: recipient.id, practice: false, accessToken: "phi-recipient-token" }, sender, adapterFactory);
    const record = admitted.messages.find((message) => message.context?.kind === "phi-transfer");
    assert.equal(record?.context?.kind, "phi-transfer");
    assert.equal(record?.context?.amountPhiMicro, "3250000");
    assert.equal(record?.context?.transferReference, transferReference);
    assert.equal(record?.authority.source, "receiz-id-proof-object");
    assert.equal(record?.authority.projection, "sync-only");
  });

  it("creates multiple member-bound rooms and lets their owner add explorers", () => {
    const first = createWildsGroupRoom({ owner: kai, members: [nova], name: "Expedition crew", clientRoomId: "room-one", now: "2026-08-23T23:00:00.000Z" });
    const second = createWildsGroupRoom({ owner: kai, members: [nova], name: "Night watch", clientRoomId: "room-two", now: "2026-08-23T23:00:00.000Z" });
    assert.notEqual(first.id, second.id);
    assert.equal(first.id, wildsGroupRoomId(kai.id, "room-one"));
    const expanded = addWildsGroupRoomMembers({ roomId: first.id, actorId: kai.id, members: [{ id: "receiz:sol", handle: "sol" }], now: "2026-08-23T23:00:01.000Z" });
    assert.deepEqual(expanded.members.map((member) => member.handle), ["kai", "nova", "sol"]);
    const messaged = appendWildsGroupMessage({ roomId: first.id, sender: nova, body: "Meet at the ridge.", clientMessageId: "group-1", now: "2026-08-23T23:00:02.000Z" });
    assert.equal(messaged.messages.at(-1)?.body, "Meet at the ridge.");
    assert.equal(mergeWildsGroupRooms(messaged, first).messages.at(-1)?.body, "Meet at the ridge.");
    assert.throws(() => addWildsGroupRoomMembers({ roomId: first.id, actorId: nova.id, members: [{ id: "receiz:x", handle: "x" }] }), /owner_required/);
  });

  it("keeps mobile composer focus app-native without Safari tap zoom", () => {
    const css = readFileSync("app/globals.css", "utf8");
    assert.match(css, /\.wilds-messenger-search input \{[^}]*font-size:\s*16px/);
    assert.match(css, /\.wilds-messenger-composer textarea \{[^}]*font-size:\s*16px/);
    assert.match(css, /\.wilds-messenger button, \.wilds-messenger input, \.wilds-messenger textarea \{[^}]*touch-action:\s*manipulation/);
  });

  it("keeps one messaging entry beside the wallet and owns shared-room creation inside Messages", () => {
    const hud = readFileSync("src/features/play/WildsBalancedStatusHud.tsx", "utf8");
    const multiplayer = readFileSync("src/features/play/WildsMultiplayer.tsx", "utf8");
    const messenger = readFileSync("src/features/play/WildsMessenger.tsx", "utf8");
    const css = readFileSync("app/globals.css", "utf8");
    assert.match(hud, /<WildsWalletInstrument[\s\S]*className=\{`wilds-message-instrument/);
    assert.match(css, /\.wilds-left-instrument-home > \.wilds-message-instrument\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;/);
    assert.match(css, /\.wilds-message-instrument\s*\{[^}]*width:\s*44px;[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
    assert.doesNotMatch(multiplayer, /wilds-live-messages|wilds-live-chat-toggle|wilds-live-chat/);
    assert.match(messenger, /wilds-messenger-room-entry/);
    assert.match(messenger, /Everyone currently live in this world room/);
    assert.match(messenger, /wilds-messenger-world-thread/);
    assert.match(css, /\.wilds-messenger-world-thread\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;/);
    assert.match(css, /@media \(max-width: 430px\)[\s\S]*\.wilds-messenger-header\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\) 28px auto;/);
    assert.match(messenger, /roomChat\.onSend\(outgoing\)/);
    assert.match(messenger, /messenger\.rooms\.map/);
    assert.match(messenger, /messenger\.createRoom\(roomName, members\)/);
    assert.match(messenger, /messenger\.addRoomMembers\(members\)/);
    assert.match(messenger, /byClientMessageId\.set\(message\.clientMessageId, message\)/);
    assert.match(messenger, /composerSendingRef\.current/);
    assert.match(messenger, /wilds-messenger-wallet-action/);
    assert.match(messenger, /Committed by source proof object/);
    const campaign = readFileSync("src/features/play/PlayCampaign.tsx", "utf8");
    assert.match(campaign, /messenger\.recordPhiTransfer\(walletMessagePeer/);
    assert.match(campaign, /walletController\.selectTransferRecipient\(peer\.handle\)/);
    assert.match(readFileSync("src/features/play/use-wilds-messenger.ts", "utf8"), /admitConversationState\(current, result\.conversation\)/);
  });
});
