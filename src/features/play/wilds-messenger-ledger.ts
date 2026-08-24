import {
  normalizeWildsMessengerParticipant,
  sanitizeWildsDirectMessage,
  mergeWildsConversations,
  mergeWildsGroupRooms,
  wildsConversationId,
  wildsDirectMessageId,
  wildsGroupRoomId,
  normalizeWildsGroupRoomName,
  type WildsConversation,
  type WildsDirectMessage,
  type WildsGroupRoom,
  type WildsMessengerParticipant
} from "./wilds-messenger-core";
import { verifyAnyWildsCard } from "./portable-card";
import { validateWildsCardTransferOffer } from "@/lib/receiz/wilds-card-transfer";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

const messengerLedgerKey = Symbol.for("receiz.wilds.messenger-ledger.v1");
const groupRoomLedgerKey = Symbol.for("receiz.wilds.group-room-ledger.v1");

function conversations(): Map<string, WildsConversation> {
  const root = globalThis as typeof globalThis & { [messengerLedgerKey]?: Map<string, WildsConversation> };
  return (root[messengerLedgerKey] ??= new Map());
}

function groupRooms(): Map<string, WildsGroupRoom> {
  const root = globalThis as typeof globalThis & { [groupRoomLedgerKey]?: Map<string, WildsGroupRoom> };
  return (root[groupRoomLedgerKey] ??= new Map());
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

export { mergeWildsConversations } from "./wilds-messenger-core";

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
  context?: WildsDirectMessage["context"];
  now?: string;
}) {
  const now = input.now ?? new Date().toISOString();
  const sender = normalizeWildsMessengerParticipant(input.sender);
  const recipient = normalizeWildsMessengerParticipant(input.recipient);
  const conversation = getWildsConversation(sender, recipient, now);
  const clientMessageId = input.clientMessageId.trim().slice(0, 160);
  if (!clientMessageId) throw new Error("wilds_client_message_id_required");
  const body = sanitizeWildsDirectMessage(input.body);
  const context = input.context;
  if (context?.kind === "phi-transfer" && (
    !/^[1-9][0-9]{0,29}$/.test(context.amountPhiMicro)
    || context.rail !== "settlement"
    || context.status !== "committed"
    || !/^phi-transfer:[a-f0-9]{32,64}$/.test(context.transferReference)
  )) throw new Error("wilds_message_phi_transfer_invalid");
  if (context?.kind === "card-offer") {
    try { validateWildsCardTransferOffer(context.offer); }
    catch { throw new Error("wilds_message_card_offer_invalid"); }
    if (!sameWildzPlayerCoordinate(context.offer.targetHandle, recipient.handle)) {
      throw new Error("wilds_message_card_offer_recipient_invalid");
    }
  }
  if (context?.kind === "card-transfer" && (
    context.status !== "claimed"
    || !verifyAnyWildsCard(context.card).ok
    || context.subjectId.length < 16
    || context.transferId.length < 16
    || context.receiptId.length < 16
    || !context.sourceHandle
    || !context.targetHandle
    || !context.priorOwnerReceizId
    || !context.nextOwnerReceizId
  )) throw new Error("wilds_message_card_transfer_invalid");
  const existing = conversation.messages.find((message) => (
    message.senderId === sender.id && message.clientMessageId === clientMessageId
  ));
  if (existing) {
    if (existing.recipientId !== recipient.id || existing.body !== body
      || JSON.stringify(existing.context ?? null) !== JSON.stringify(context ?? null)) {
      throw new Error("wilds_message_idempotency_conflict");
    }
    return { message: existing, conversation };
  }
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
    body,
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    replyToId,
    reactions: [],
    ...(context ? { context } : {}),
    authority: { source: "receiz-id-proof-object", projection: "sync-only" }
  };
  return { message, conversation: save({ ...conversation, messages: [...conversation.messages, message] }, now) };
}

function normalizeGroupMembers(owner: WildsMessengerParticipant, members: readonly WildsMessengerParticipant[]) {
  const byId = new Map<string, WildsMessengerParticipant>();
  for (const member of [owner, ...members]) {
    const normalized = normalizeWildsMessengerParticipant(member);
    byId.set(normalized.id, normalized);
  }
  if (byId.size < 2 || byId.size > 24) throw new Error("wilds_group_room_members_invalid");
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function createWildsGroupRoom(input: { owner: WildsMessengerParticipant; members: readonly WildsMessengerParticipant[]; name: string; clientRoomId: string; now?: string }) {
  const now = input.now ?? new Date().toISOString();
  const owner = normalizeWildsMessengerParticipant(input.owner);
  const id = wildsGroupRoomId(owner.id, input.clientRoomId);
  const existing = groupRooms().get(id);
  if (existing) return existing;
  const room: WildsGroupRoom = { schema: "receiz.wilds_group_room.v1", id, name: normalizeWildsGroupRoomName(input.name), owner, members: normalizeGroupMembers(owner, input.members), revision: 1, messages: [], createdAt: now, updatedAt: now };
  groupRooms().set(id, room);
  return room;
}

export function admitWildsGroupRoom(value: WildsGroupRoom) {
  if (value.schema !== "receiz.wilds_group_room.v1" || !value.id || !Array.isArray(value.members) || !Array.isArray(value.messages)) throw new Error("wilds_group_room_invalid");
  const current = groupRooms().get(value.id);
  groupRooms().set(value.id, current ? mergeWildsGroupRooms(current, value) : value);
  return groupRooms().get(value.id)!;
}

export function getWildsGroupRoom(roomId: string, actorId: string) {
  const room = groupRooms().get(roomId);
  if (!room || !room.members.some((member) => member.id === actorId)) throw new Error("wilds_group_room_required");
  return room;
}

export function appendWildsGroupMessage(input: { roomId: string; sender: WildsMessengerParticipant; body: string; clientMessageId: string; now?: string }) {
  const now = input.now ?? new Date().toISOString();
  const sender = normalizeWildsMessengerParticipant(input.sender);
  const room = getWildsGroupRoom(input.roomId, sender.id);
  const clientMessageId = input.clientMessageId.trim().slice(0, 160);
  if (!clientMessageId) throw new Error("wilds_client_message_id_required");
  if (room.messages.some((message) => message.senderId === sender.id && message.clientMessageId === clientMessageId)) return room;
  const message = { id: `group-message:${sha256PortableBasis(canonicalPortableCardJson({ roomId: room.id, senderId: sender.id, clientMessageId })).slice(7, 39)}`, clientMessageId, senderId: sender.id, senderHandle: sender.handle, body: sanitizeWildsDirectMessage(input.body), createdAt: now };
  const next = { ...room, revision: room.revision + 1, messages: [...room.messages, message].slice(-1_000), updatedAt: now };
  groupRooms().set(room.id, next);
  return next;
}

export function addWildsGroupRoomMembers(input: { roomId: string; actorId: string; members: readonly WildsMessengerParticipant[]; now?: string }) {
  const room = getWildsGroupRoom(input.roomId, input.actorId);
  if (room.owner.id !== input.actorId) throw new Error("wilds_group_room_owner_required");
  const now = input.now ?? new Date().toISOString();
  const next = { ...room, revision: room.revision + 1, members: normalizeGroupMembers(room.owner, [...room.members, ...input.members]), updatedAt: now };
  groupRooms().set(room.id, next);
  return next;
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
