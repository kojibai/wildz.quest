import { canonicalPortableCardJson, sha256PortableBasis } from "./portable-card";

export const WILDS_DIRECT_MESSAGE_MAX_LENGTH = 2_000;
export const WILDS_DIRECT_MESSAGE_PAGE_SIZE = 60;
export const WILDS_DIRECT_MESSAGE_REACTIONS = ["❤️", "✨", "😂", "🔥", "👍", "🙏"] as const;

export type WildsMessengerParticipant = {
  id: string;
  handle: string;
};

export type WildsDirectMessageReaction = {
  emoji: string;
  actorIds: string[];
};

export type WildsDirectMessage = {
  schema: "receiz.wilds_direct_message.v1";
  id: string;
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  senderHandle: string;
  recipientId: string;
  recipientHandle: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToId: string | null;
  reactions: WildsDirectMessageReaction[];
  context?: {
    kind: "group-invite";
    roomId: string;
    roomName: string;
  };
  authority: {
    source: "receiz-id-proof-object";
    projection: "sync-only";
  };
};

export type WildsGroupMessage = {
  id: string;
  clientMessageId: string;
  senderId: string;
  senderHandle: string;
  body: string;
  createdAt: string;
};

export type WildsGroupRoom = {
  schema: "receiz.wilds_group_room.v1";
  id: string;
  name: string;
  owner: WildsMessengerParticipant;
  members: WildsMessengerParticipant[];
  revision: number;
  messages: WildsGroupMessage[];
  createdAt: string;
  updatedAt: string;
};

export function normalizeWildsGroupRoomName(value: string) {
  const name = value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (!name || name.length > 48) throw new Error("wilds_group_room_name_invalid");
  return name;
}

export function wildsGroupRoomId(ownerId: string, clientRoomId: string) {
  if (!ownerId.trim() || !clientRoomId.trim()) throw new Error("wilds_group_room_id_invalid");
  return `group-room:${sha256PortableBasis(canonicalPortableCardJson({ ownerId: ownerId.trim(), clientRoomId: clientRoomId.trim() })).slice(7, 39)}`;
}

export type WildsConversation = {
  schema: "receiz.wilds_conversation.v1";
  id: string;
  revision: number;
  participants: [WildsMessengerParticipant, WildsMessengerParticipant];
  messages: WildsDirectMessage[];
  readThrough: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type WildsConversationSummary = {
  id: string;
  peer: WildsMessengerParticipant;
  latestMessage: WildsDirectMessage | null;
  unreadCount: number;
  updatedAt: string;
};

export function normalizeWildsMessengerParticipant(input: WildsMessengerParticipant) {
  const id = input.id.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const handle = input.handle.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!id || id.length > 240) throw new Error("wilds_message_participant_invalid");
  if (!handle || handle.length > 80) throw new Error("wilds_message_handle_invalid");
  return { id, handle };
}

export function sanitizeWildsDirectMessage(input: string) {
  const body = input
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!body) throw new Error("wilds_message_empty");
  if (body.length > WILDS_DIRECT_MESSAGE_MAX_LENGTH) throw new Error("wilds_message_too_long");
  return body;
}

export function wildsConversationId(leftId: string, rightId: string) {
  const participants = [leftId.trim(), rightId.trim()].sort();
  if (!participants[0] || !participants[1] || participants[0] === participants[1]) {
    throw new Error("wilds_message_participants_invalid");
  }
  return `conversation:${sha256PortableBasis(canonicalPortableCardJson({ participants })).slice(7, 39)}`;
}

export function wildsDirectMessageId(input: {
  conversationId: string;
  senderId: string;
  recipientId: string;
  clientMessageId: string;
}) {
  return `direct-message:${sha256PortableBasis(canonicalPortableCardJson(input)).slice(7, 39)}`;
}

export function wildsConversationSummary(conversation: WildsConversation, actorId: string): WildsConversationSummary {
  const peer = conversation.participants.find((participant) => participant.id !== actorId);
  if (!peer) throw new Error("wilds_message_participant_required");
  const readAt = Date.parse(conversation.readThrough[actorId] ?? "1970-01-01T00:00:00.000Z");
  return {
    id: conversation.id,
    peer,
    latestMessage: conversation.messages.at(-1) ?? null,
    unreadCount: conversation.messages.filter((message) => (
      message.recipientId === actorId && !message.deletedAt && Date.parse(message.createdAt) > readAt
    )).length,
    updatedAt: conversation.updatedAt
  };
}

export function wildsMessageDeliveryState(
  message: WildsDirectMessage,
  conversation: WildsConversation,
  actorId: string
): "sending" | "sent" | "read" {
  if (message.senderId !== actorId) return "sent";
  const recipientReadAt = Date.parse(conversation.readThrough[message.recipientId] ?? "1970-01-01T00:00:00.000Z");
  return recipientReadAt >= Date.parse(message.createdAt) ? "read" : "sent";
}
