import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  sanitizeWildsDirectMessage,
  wildsConversationId,
  wildsConversationSummary,
  wildsMessageDeliveryState
} from "../src/features/play/wilds-messenger-core.js";
import {
  admitWildsConversation,
  appendWildsDirectMessage,
  markWildsConversationRead,
  mergeWildsConversations,
  reactToWildsDirectMessage
} from "../src/features/play/wilds-messenger-ledger.js";

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
    assert.match(hook, /if \(!open \|\| !input\.selfId \|\| !allPeers\.length\) return/);
    assert.doesNotMatch(hook, /20_000|setInterval/);
    assert.doesNotMatch(server, /authorization required|permission required|projection required/i);
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
    assert.match(messenger, /Create a chat room for everyone live with you/);
    assert.match(messenger, /roomChat\.onSend\(outgoing\)/);
  });
});
