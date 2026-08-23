import {
  normalizeWildsMessengerParticipant,
  sanitizeWildsDirectMessage,
  wildsConversationId,
  wildsDirectMessageId,
  type WildsConversation,
  type WildsDirectMessage,
  type WildsMessengerParticipant
} from "./wilds-messenger-core";

const messengerLedgerKey = Symbol.for("receiz.wilds.messenger-ledger.v1");

function conversations(): Map<string, WildsConversation> {
  const root = globalThis as typeof globalThis & { [messengerLedgerKey]?: Map<string, WildsConversation> };
  return (root[messengerLedgerKey] ??= new Map());
}

function emptyConversation(
  left: WildsMessengerParticipant,
  right: WildsMessengerParticipant,
  now: string
): WildsConversation {
  const participants = [
    normalizeWildsMessengerParticipant(left),
    normalizeWildsMessengerParticipant(right)
  ].sort((a, b) => a.id.localeCompare(b.id)) as [WildsMessengerParticipant, WildsMessengerParticipant];
  return {
    schema: "receiz.wilds_conversation.v1",
    id: wildsConversationId(participants[0].id, participants[1].id),
    revision: 0,
    participants,
    messages: [],
    readThrough: {},
    createdAt: now,
    updatedAt: now
  };
}

function laterIso(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

export function mergeWildsConversations(left: WildsConversation, right: WildsConversation): WildsConversation {
  if (left.id !== right.id) throw new Error("wilds_conversation_mismatch");
  const byId = new Map<string, WildsDirectMessage>();
  for (const message of [...left.messages, ...right.messages]) {
    const current = byId.get(message.id);
    if (!current || Date.parse(message.editedAt ?? message.createdAt) >= Date.parse(current.editedAt ?? current.createdAt)) {
      byId.set(message.id, message);
    }
  }
  const readThrough: Record<string, string> = {};
  for (const actorId of new Set([...Object.keys(left.readThrough), ...Object.keys(right.readThrough)])) {
    const value = laterIso(left.readThrough[actorId], right.readThrough[actorId]);
    if (value) readThrough[actorId] = value;
  }
  const newest = left.revision >= right.revision ? left : right;
  return {
    ...newest,
    revision: Math.max(left.revision, right.revision),
    messages: [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).slice(-1_000),
    readThrough,
    createdAt: laterIso(left.createdAt, right.createdAt) === left.createdAt ? right.createdAt : left.createdAt,
    updatedAt: laterIso(left.updatedAt, right.updatedAt)!
  };
}

export function admitWildsConversation(value: WildsConversation) {
  if (value.schema !== "receiz.wilds_conversation.v1" || !value.id || !Array.isArray(value.messages)) {
    throw new Error("wilds_conversation_invalid");
  }
  const current = conversations().get(value.id);
  const admitted = current ? mergeWildsConversations(current, value) : value;
  conversations().set(value.id, admitted);
  return admitted;
}

export function getWildsConversation(
  left: WildsMessengerParticipant,
  right: WildsMessengerParticipant,
  now = new Date().toISOString()
): WildsConversation {
  const id = wildsConversationId(left.id, right.id);
  const current = conversations().get(id) ?? emptyConversation(left, right, now);
  conversations().set(id, current);
  return current;
}

export function getWildsConversationsForActor(actorId: string) {
  return [...conversations().values()].filter((conversation) => (
    conversation.participants.some((participant) => participant.id === actorId)
  ));
}

function save(conversation: WildsConversation, now: string): WildsConversation {
  const next = { ...conversation, revision: conversation.revision + 1, updatedAt: now };
  conversations().set(next.id, next);
  return next;
}

function assertParticipant(conversation: WildsConversation, actorId: string) {
  if (!conversation.participants.some((participant) => participant.id === actorId)) {
    throw new Error("wilds_message_participant_required");
  }
}

export function appendWildsDirectMessage(input: {
  sender: WildsMessengerParticipant;
  recipient: WildsMessengerParticipant;
  body: string;
  clientMessageId: string;
  replyToId?: string | null;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const sender = normalizeWildsMessengerParticipant(input.sender);
  const recipient = normalizeWildsMessengerParticipant(input.recipient);
  const conversation = getWildsConversation(sender, recipient, now);
  const clientMessageId = input.clientMessageId.trim().slice(0, 160);
  if (!clientMessageId) throw new Error("wilds_client_message_id_required");
  const existing = conversation.messages.find((message) => (
    message.senderId === sender.id && message.clientMessageId === clientMessageId
  ));
  if (existing) return { message: existing, conversation };
  const recent = conversation.messages.filter((message) => (
    message.senderId === sender.id && Date.parse(now) - Date.parse(message.createdAt) <= 10_000
  ));
  if (recent.length >= 8) throw new Error("wilds_message_rate_limited");
  const replyToId = input.replyToId && conversation.messages.some((message) => message.id === input.replyToId)
    ? input.replyToId
    : null;
  const message: WildsDirectMessage = {
    schema: "receiz.wilds_direct_message.v1",
    id: wildsDirectMessageId({ conversationId: conversation.id, senderId: sender.id, recipientId: recipient.id, clientMessageId }),
    clientMessageId,
    conversationId: conversation.id,
    senderId: sender.id,
    senderHandle: sender.handle,
    recipientId: recipient.id,
    recipientHandle: recipient.handle,
    body: sanitizeWildsDirectMessage(input.body),
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    replyToId,
    reactions: [],
    authority: { source: "receiz-id-proof-object", projection: "sync-only" }
  };
  return { message, conversation: save({ ...conversation, messages: [...conversation.messages, message] }, now) };
}

export function markWildsConversationRead(input: {
  left: WildsMessengerParticipant;
  right: WildsMessengerParticipant;
  actorId: string;
  through?: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const conversation = getWildsConversation(input.left, input.right, now);
  assertParticipant(conversation, input.actorId);
  const requested = input.through && Number.isFinite(Date.parse(input.through)) ? input.through : now;
  const latestMessageAt = conversation.messages.at(-1)?.createdAt ?? now;
  const through = new Date(Math.min(Date.parse(requested), Date.parse(now), Date.parse(latestMessageAt))).toISOString();
  const current = conversation.readThrough[input.actorId];
  if (current && Date.parse(current) >= Date.parse(through)) return conversation;
  return save({ ...conversation, readThrough: { ...conversation.readThrough, [input.actorId]: through } }, now);
}

export function reactToWildsDirectMessage(input: {
  left: WildsMessengerParticipant;
  right: WildsMessengerParticipant;
  actorId: string;
  messageId: string;
  emoji: string;
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const conversation = getWildsConversation(input.left, input.right, now);
  assertParticipant(conversation, input.actorId);
  const allowed = ["❤️", "✨", "😂", "🔥", "👍", "🙏"];
  if (!allowed.includes(input.emoji)) throw new Error("wilds_message_reaction_invalid");
  let found = false;
  const messages = conversation.messages.map((message) => {
    if (message.id !== input.messageId) return message;
    found = true;
    const current = message.reactions.find((reaction) => reaction.emoji === input.emoji);
    const active = current?.actorIds.includes(input.actorId) ?? false;
    const actorIds = active
      ? current!.actorIds.filter((id) => id !== input.actorId)
      : [...(current?.actorIds ?? []), input.actorId];
    const reactions = [
      ...message.reactions.filter((reaction) => reaction.emoji !== input.emoji),
      ...(actorIds.length ? [{ emoji: input.emoji, actorIds }] : [])
    ];
    return { ...message, reactions };
  });
  if (!found) throw new Error("wilds_message_not_found");
  return save({ ...conversation, messages }, now);
}
