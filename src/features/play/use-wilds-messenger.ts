"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  wildsConversationId,
  wildsDirectMessageId,
  wildsConversationSummary,
  mergeWildsConversations,
  mergeWildsGroupRooms,
  type WildsConversation,
  type WildsConversationSummary,
  type WildsDirectMessage,
  type WildsGroupRoom,
  type WildsMessengerParticipant
} from "./wilds-messenger-core";
import type { PortableCardAsset } from "./portable-card";
import type {
  WildsCardTransferAdmission,
  WildsCardTransferOffer
} from "@/lib/receiz/wilds-card-transfer";
import { formatWildsPhiExact } from "./wallet/wilds-wallet-format";

type MessengerCache = {
  peers: WildsMessengerParticipant[];
  conversations: WildsConversation[];
  rooms: WildsGroupRoom[];
};

type PendingMessage = {
  message: WildsDirectMessage;
  state: "sending" | "failed";
};

function messengerStorageKey(actorId: string) {
  return `receiz:wilds:messenger:v1:${actorId}`;
}

function readCache(actorId: string): MessengerCache {
  if (!actorId) return { peers: [], conversations: [], rooms: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(messengerStorageKey(actorId)) ?? "null") as MessengerCache | null;
    return parsed && Array.isArray(parsed.peers) && Array.isArray(parsed.conversations) ? { ...parsed, rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [] } : { peers: [], conversations: [], rooms: [] };
  } catch {
    return { peers: [], conversations: [], rooms: [] };
  }
}

function writeCache(actorId: string, peers: WildsMessengerParticipant[], conversations: WildsConversation[], rooms: WildsGroupRoom[]) {
  if (!actorId) return;
  try {
    window.localStorage.setItem(messengerStorageKey(actorId), JSON.stringify({
      peers: peers.slice(0, 80),
      conversations: conversations.map((conversation) => ({ ...conversation, messages: conversation.messages.slice(-120) })).slice(0, 80),
      rooms: rooms.map((room) => ({ ...room, messages: room.messages.slice(-120) })).slice(0, 40)
    }));
  } catch {
    // The source proof and Receiz sync remain authoritative if the cache is full.
  }
}

async function messengerRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok || !result) throw new Error(result?.error ?? "wilds_message_request_failed");
  return result;
}

function mergePeers(...lists: readonly WildsMessengerParticipant[][]) {
  const byId = new Map<string, WildsMessengerParticipant>();
  for (const list of lists) for (const peer of list) if (peer.id && peer.handle) byId.set(peer.id, peer);
  return [...byId.values()];
}

function admitConversationState(current: WildsConversation[], incoming: WildsConversation) {
  const existing = current.find((conversation) => conversation.id === incoming.id);
  const admitted = existing ? mergeWildsConversations(existing, incoming) : incoming;
  return [...current.filter((conversation) => conversation.id !== incoming.id), admitted];
}

function admitRoomState(current: WildsGroupRoom[], incoming: WildsGroupRoom) {
  const existing = current.find((room) => room.id === incoming.id);
  const admitted = existing ? mergeWildsGroupRooms(existing, incoming) : incoming;
  return [admitted, ...current.filter((room) => room.id !== incoming.id)];
}

export function useWildsMessenger(input: {
  guestId: string;
  selfId: string;
  selfHandle: string;
  livePeers: readonly WildsMessengerParticipant[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedPeer, setSelectedPeer] = useState<WildsMessengerParticipant | null>(null);
  const [peers, setPeers] = useState<WildsMessengerParticipant[]>([]);
  const [conversations, setConversations] = useState<WildsConversation[]>([]);
  const [rooms, setRooms] = useState<WildsGroupRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<WildsGroupRoom | null>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const hydratedActorRef = useRef("");
  const conversationsRef = useRef<WildsConversation[]>([]);
  const roomsRef = useRef<WildsGroupRoom[]>([]);
  const sendingClientIdsRef = useRef(new Set<string>());

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  useEffect(() => {
    if (!input.selfId || hydratedActorRef.current === input.selfId) return;
    hydratedActorRef.current = input.selfId;
    const cache = readCache(input.selfId);
    setPeers(cache.peers);
    setConversations(cache.conversations);
    setRooms(cache.rooms);
  }, [input.selfId]);

  const allPeers = useMemo(() => mergePeers(peers, input.livePeers as WildsMessengerParticipant[]), [input.livePeers, peers]);
  const selectedRoomId = selectedRoom?.id ?? null;

  useEffect(() => {
    writeCache(input.selfId, allPeers, conversations, rooms);
  }, [allPeers, conversations, input.selfId, rooms]);

  const refreshRooms = useCallback(async (roomIds?: readonly string[]) => {
    if (!input.selfId || document.visibilityState === "hidden") return;
    const inviteIds = conversationsRef.current.flatMap((conversation) => conversation.messages.flatMap((message) => message.context?.kind === "group-invite" ? [message.context.roomId] : []));
    const ids = [...new Set([...(roomIds ?? roomsRef.current.map((room) => room.id)), ...inviteIds])].slice(0, 40);
    if (!ids.length) return;
    try {
      const params = new URLSearchParams({ guestId: input.guestId, ids: ids.join(",") });
      const result = await messengerRequest<{ rooms: WildsGroupRoom[] }>(`/api/wilds/messages/rooms?${params.toString()}`, { cache: "no-store" });
      setRooms((current) => {
        const byId = new Map(current.map((room) => [room.id, room]));
        for (const room of result.rooms) {
          const existing = byId.get(room.id);
          byId.set(room.id, existing ? mergeWildsGroupRooms(existing, room) : room);
        }
        const next = [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
        return next.length === current.length && next.every((room, index) => room.id === current[index]?.id && room.revision === current[index]?.revision) ? current : next;
      });
      setSelectedRoom((current) => {
        if (!current) return null;
        const next = result.rooms.find((room) => room.id === current.id);
        return next ? mergeWildsGroupRooms(current, next) : current;
      });
    } catch { /* cached rooms remain available */ }
  }, [input.guestId, input.selfId]);

  const rememberPeer = useCallback((peer: WildsMessengerParticipant) => {
    setPeers((current) => mergePeers(current, [peer]));
  }, []);

  const refreshThread = useCallback(async (peer: WildsMessengerParticipant, quiet = false) => {
    if (!input.selfId) return null;
    if (!quiet) setSyncing(true);
    try {
      const params = new URLSearchParams({ guestId: input.guestId, peerId: peer.id, peerHandle: peer.handle });
      const result = await messengerRequest<{ conversation: WildsConversation }>(`/api/wilds/messages/thread?${params.toString()}`, { cache: "no-store" });
      setConversations((current) => admitConversationState(current, result.conversation));
      setPending((current) => current.filter((item) => !result.conversation.messages.some((message) => message.clientMessageId === item.message.clientMessageId)));
      setError("");
      return result.conversation;
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Messages could not sync");
      return null;
    } finally {
      if (!quiet) setSyncing(false);
    }
  }, [input.guestId, input.selfId]);

  const refreshInbox = useCallback(async (quiet = false) => {
    if (!input.selfId || !allPeers.length || document.visibilityState === "hidden") return;
    if (!quiet) setSyncing(true);
    try {
      const encodedPeers = allPeers.map((peer) => encodeURIComponent(JSON.stringify(peer))).join("|");
      const params = new URLSearchParams({ guestId: input.guestId, peers: encodedPeers });
      const result = await messengerRequest<{ summaries: WildsConversationSummary[] }>(`/api/wilds/messages/inbox?${params.toString()}`, { cache: "no-store" });
      for (const summary of result.summaries) rememberPeer(summary.peer);
      await Promise.all(result.summaries.map((summary) => refreshThread(summary.peer, true)));
      void refreshRooms();
      setError("");
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Inbox could not sync");
    } finally {
      if (!quiet) setSyncing(false);
    }
  }, [allPeers, input.guestId, input.selfId, refreshRooms, refreshThread, rememberPeer]);

  useEffect(() => {
    // Gameplay remains allocation- and network-free while the messenger is
    // closed. A foreground thread can poll cheaply without touching the world
    // frame loop; background delivery should graduate to push, never walking-time polling.
    if (!open || !input.selfId) return;
    let stopped = false;
    let timer: number | null = null;
    const tick = async () => {
      if (stopped) return;
      if (selectedRoomId) await refreshRooms([selectedRoomId]);
      else if (selectedPeer) await refreshThread(selectedPeer, true);
      else await refreshInbox(true);
      if (!stopped) timer = window.setTimeout(tick, 4_000);
    };
    void tick();
    return () => { stopped = true; if (timer !== null) window.clearTimeout(timer); };
  }, [input.selfId, open, refreshInbox, refreshRooms, refreshThread, selectedPeer, selectedRoomId]);

  const conversation = selectedPeer
    ? conversations.find((item) => item.id === wildsConversationId(input.selfId, selectedPeer.id)) ?? null
    : null;
  const summaries = useMemo(() => conversations.map((item) => wildsConversationSummary(item, input.selfId))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)), [conversations, input.selfId]);
  const unreadCount = summaries.reduce((total, summary) => total + summary.unreadCount, 0);

  const selectConversation = useCallback((peer: WildsMessengerParticipant | null) => {
    setSelectedRoom(null);
    setSelectedPeer(peer);
    if (peer) { rememberPeer(peer); void refreshThread(peer); }
  }, [refreshThread, rememberPeer]);

  const openMessenger = useCallback((peer?: WildsMessengerParticipant) => {
    setOpen(true);
    if (peer) selectConversation(peer);
    else {
      void refreshInbox();
      void refreshRooms();
    }
  }, [refreshInbox, refreshRooms, selectConversation]);

  const closeMessenger = useCallback(() => {
    setOpen(false);
    setSelectedPeer(null);
    setSelectedRoom(null);
    setError("");
  }, []);

  const createRoom = useCallback(async (name: string, members: WildsMessengerParticipant[]) => {
    const result = await messengerRequest<{ room: WildsGroupRoom }>("/api/wilds/messages/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", guestId: input.guestId, name, members, clientRoomId: crypto.randomUUID() }) });
    setRooms((current) => admitRoomState(current, result.room));
    setSelectedPeer(null); setSelectedRoom(result.room); return result.room;
  }, [input.guestId]);

  const selectRoom = useCallback((room: WildsGroupRoom | null) => { setSelectedPeer(null); setSelectedRoom(room); if (room) void refreshRooms([room.id]); }, [refreshRooms]);

  const sendRoom = useCallback(async (body: string) => {
    if (!selectedRoom) return;
    const result = await messengerRequest<{ room: WildsGroupRoom }>("/api/wilds/messages/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "send", guestId: input.guestId, roomId: selectedRoom.id, message: body, clientMessageId: `wilds-group-message:${crypto.randomUUID()}` }) });
    setRooms((current) => admitRoomState(current, result.room)); setSelectedRoom((current) => current ? mergeWildsGroupRooms(current, result.room) : result.room);
  }, [input.guestId, selectedRoom]);

  const addRoomMembers = useCallback(async (members: WildsMessengerParticipant[]) => {
    if (!selectedRoom) return;
    const result = await messengerRequest<{ room: WildsGroupRoom }>("/api/wilds/messages/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add-members", guestId: input.guestId, roomId: selectedRoom.id, members }) });
    setRooms((current) => admitRoomState(current, result.room)); setSelectedRoom((current) => current ? mergeWildsGroupRooms(current, result.room) : result.room);
  }, [input.guestId, selectedRoom]);

  const send = useCallback(async (body: string, replyToId?: string | null, retryClientMessageId?: string) => {
    if (!selectedPeer || !input.selfId) return;
    const now = new Date().toISOString();
    const clientMessageId = retryClientMessageId ?? `wilds-message:${crypto.randomUUID()}`;
    if (sendingClientIdsRef.current.has(clientMessageId)) return;
    sendingClientIdsRef.current.add(clientMessageId);
    const conversationId = wildsConversationId(input.selfId, selectedPeer.id);
    const optimistic: WildsDirectMessage = {
      schema: "receiz.wilds_direct_message.v1",
      id: wildsDirectMessageId({ conversationId, senderId: input.selfId, recipientId: selectedPeer.id, clientMessageId }),
      clientMessageId,
      conversationId,
      senderId: input.selfId,
      senderHandle: input.selfHandle,
      recipientId: selectedPeer.id,
      recipientHandle: selectedPeer.handle,
      body: body.trim(),
      createdAt: now,
      editedAt: null,
      deletedAt: null,
      replyToId: replyToId ?? null,
      reactions: [],
      authority: { source: "receiz-id-proof-object", projection: "sync-only" }
    };
    setPending((current) => [...current.filter((item) => item.message.clientMessageId !== clientMessageId), { message: optimistic, state: "sending" }]);
    setError("");
    try {
      const result = await messengerRequest<{ conversation: WildsConversation }>("/api/wilds/messages/thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send", guestId: input.guestId, peer: selectedPeer, message: body, clientMessageId, replyToId })
      });
      setConversations((current) => admitConversationState(current, result.conversation));
      setPending((current) => current.filter((item) => item.message.clientMessageId !== clientMessageId));
    } catch (cause) {
      setPending((current) => current.map((item) => item.message.clientMessageId === clientMessageId ? { ...item, state: "failed" } : item));
      setError(cause instanceof Error ? cause.message : "Message not sent");
    } finally {
      sendingClientIdsRef.current.delete(clientMessageId);
    }
  }, [input.guestId, input.selfHandle, input.selfId, selectedPeer]);

  const recordPhiTransfer = useCallback(async (
    peer: WildsMessengerParticipant,
    amountPhiMicro: string,
    transferReference: string
  ) => {
    if (!input.selfId) throw new Error("wilds_message_participant_required");
    const clientMessageId = `wilds-message:${transferReference}`;
    const result = await messengerRequest<{ conversation: WildsConversation }>("/api/wilds/messages/thread", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "phi-transfer",
        guestId: input.guestId,
        peer,
        message: `Sent Φ${formatWildsPhiExact(amountPhiMicro)}`,
        clientMessageId,
        context: { kind: "phi-transfer", amountPhiMicro, rail: "settlement", status: "committed", transferReference }
      })
    });
    rememberPeer(peer);
    setConversations((current) => admitConversationState(current, result.conversation));
    return result.conversation;
  }, [input.guestId, input.selfId, rememberPeer]);

  const sendCardOffer = useCallback(async (card: PortableCardAsset, targetHandle: string) => {
    const result = await messengerRequest<{ offer: WildsCardTransferOffer; conversation: WildsConversation }>("/api/wilds/cards/transfers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "issue", card, targetHandle })
    });
    const peer = { id: result.offer.targetHandle, handle: result.offer.targetHandle };
    rememberPeer(peer);
    setConversations((current) => admitConversationState(current, result.conversation));
    return result.offer;
  }, [rememberPeer]);

  const claimCardOffer = useCallback(async (offer: WildsCardTransferOffer) => {
    const result = await messengerRequest<{ admission: WildsCardTransferAdmission; conversation: WildsConversation }>("/api/wilds/cards/transfers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "claim", offer })
    });
    setConversations((current) => admitConversationState(current, result.conversation));
    return result.admission;
  }, []);

  const markRead = useCallback(async () => {
    if (!selectedPeer || !conversation || !conversation.messages.length) return;
    const through = conversation.messages.at(-1)!.createdAt;
    if (Date.parse(conversation.readThrough[input.selfId] ?? "1970-01-01") >= Date.parse(through)) return;
    try {
      const result = await messengerRequest<{ conversation: WildsConversation }>("/api/wilds/messages/thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "read", guestId: input.guestId, peer: selectedPeer, through })
      });
      setConversations((current) => admitConversationState(current, result.conversation));
    } catch { /* the next poll retries the read receipt */ }
  }, [conversation, input.guestId, input.selfId, selectedPeer]);

  const react = useCallback(async (messageId: string, emoji: string) => {
    if (!selectedPeer) return;
    try {
      const result = await messengerRequest<{ conversation: WildsConversation }>("/api/wilds/messages/thread", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "react", guestId: input.guestId, peer: selectedPeer, messageId, emoji })
      });
      setConversations((current) => admitConversationState(current, result.conversation));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reaction not sent");
    }
  }, [input.guestId, selectedPeer]);

  return {
    open,
    selectedPeer,
    selectedRoom,
    rooms,
    allPeers,
    conversation,
    conversations,
    summaries,
    unreadCount,
    pending: selectedPeer ? pending.filter((item) => item.message.recipientId === selectedPeer.id) : [],
    syncing,
    error,
    openMessenger,
    closeMessenger,
    selectConversation,
    selectRoom,
    createRoom,
    sendRoom,
    addRoomMembers,
    send,
    recordPhiTransfer,
    sendCardOffer,
    claimCardOffer,
    markRead,
    react,
    refreshInbox
  };
}

export type WildsMessengerController = ReturnType<typeof useWildsMessenger>;
