"use client";

import { registerMessagePush, supportsMessagePush, readMessagePushConfig, type MessagePushConfig, WILDZ_MESSAGE_PUSH } from "@/features/pwa/message-push-client";
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
import { resourceOfferMessage } from './wilds-resource-messaging';
import { formatWildsPhiExact } from "./wallet/wilds-wallet-format";
import { assertWildsPrivateMessagePublished, wildsMessageRequestFailure } from "./wilds-messenger-delivery";
import { validateWildsWalletTradeMessage, wildsWalletTradeMessageId, type WildsWalletTradeMessage } from "./wallet/wilds-wallet-trade-messaging";
import { validateWildsWalletNativeTradeMessage, wildsWalletNativeTradeMessageId, type WildsWalletNativeTradeMessage } from "./wallet/wilds-wallet-native-trade-context";

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
  if (!response.ok || !result) throw wildsMessageRequestFailure(result);
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
  const [messageAlert, setMessageAlert] = useState<{ peer: WildsMessengerParticipant; body: string } | null>(null);
  const [notificationSupport, setNotificationSupport] = useState(false);
  const [pushConfig, setPushConfig] = useState<MessagePushConfig | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const inboxReadyRef = useRef(false);
  const notifiedIdsRef = useRef(new Set<string>());
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
  const publishedCardOffersRef = useRef(new Set<string>());

  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  useEffect(() => {
    if (!input.selfId || hydratedActorRef.current === input.selfId) return;
    hydratedActorRef.current = input.selfId;
    inboxReadyRef.current = false;
    notifiedIdsRef.current.clear();
    publishedCardOffersRef.current.clear();
    setMessageAlert(null);
    const cache = readCache(input.selfId);
    setPeers(cache.peers);
    setConversations(cache.conversations);
    setRooms(cache.rooms);
  }, [input.selfId]);

  const allPeers = useMemo(() => mergePeers(peers, input.livePeers as WildsMessengerParticipant[]), [input.livePeers, peers]);
  const allPeersRef = useRef(allPeers);
  allPeersRef.current = allPeers;

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
    setPeers((current) => current.some((item) => item.id === peer.id && item.handle === peer.handle)
      ? current : mergePeers(current, [peer]));
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
    if (!input.selfId || document.visibilityState === "hidden") return;
    if (!quiet) setSyncing(true);
    try {
      const encodedPeers = allPeersRef.current.map((peer) => encodeURIComponent(JSON.stringify(peer))).join("|");
      const params = new URLSearchParams({ guestId: input.guestId, peers: encodedPeers });
      const result = await messengerRequest<{ summaries: WildsConversationSummary[]; conversations: WildsConversation[] }>(`/api/wilds/messages/inbox?${params.toString()}`, { cache: "no-store" });
      if (hydratedActorRef.current !== input.selfId) return;
      for (const summary of result.summaries) rememberPeer(summary.peer);
      const known = new Set(conversationsRef.current.flatMap((thread) => thread.messages.map((message) => message.id)));
      const incoming = result.conversations.flatMap((thread) => thread.messages.filter((message) =>
        message.recipientId === input.selfId && !message.deletedAt && !known.has(message.id)
        && !notifiedIdsRef.current.has(message.id)
        && Date.parse(message.createdAt) > Date.parse(thread.readThrough[input.selfId] ?? "1970-01-01")));
      for (const message of incoming) notifiedIdsRef.current.add(message.id);
      if (inboxReadyRef.current && incoming.length) {
        const latest = incoming.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)).at(-1)!;
        setMessageAlert({ peer: { id: latest.senderId, handle: latest.senderHandle }, body: latest.body });
      }
      inboxReadyRef.current = true;
      setConversations((current) => {
        const next = result.conversations.reduce(admitConversationState, current);
        return next.length === current.length && next.every((thread, index) => thread.id === current[index]?.id && JSON.stringify(thread) === JSON.stringify(current[index])) ? current : next;
      });
      void refreshRooms();
      setError("");
    } catch (cause) {
      if (!quiet) setError(cause instanceof Error ? cause.message : "Inbox could not sync");
    } finally {
      if (!quiet) setSyncing(false);
    }
  }, [input.guestId, input.selfId, refreshRooms, rememberPeer]);

  useEffect(() => {
    if (!input.selfId) return;
    let stopped = false;
    let timer: number | null = null;
    let running = false;
    const tick = async () => {
      if (stopped || running) return;
      if (timer !== null) window.clearTimeout(timer);
      running = true;
      try { await refreshInbox(true); } finally { running = false; }
      if (!stopped) timer = window.setTimeout(tick, open ? 4_000 : 15_000);
    };
    const wake = () => { if (document.visibilityState === "visible") void tick(); };
    const push = (event: MessageEvent) => { if (event.data?.type === WILDZ_MESSAGE_PUSH && event.data.recipientId === input.selfId) void tick(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    navigator.serviceWorker?.addEventListener("message", push);
    void tick();
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      navigator.serviceWorker?.removeEventListener("message", push);
    };
  }, [input.selfId, open, refreshInbox]);

  useEffect(() => {
    if (!messageAlert) return;
    const timer = window.setTimeout(() => setMessageAlert(null), 7000);
    return () => window.clearTimeout(timer);
  }, [messageAlert]);

  const enableNotifications = useCallback(async () => {
    setEnablingNotifications(true);
    setNotificationError("");
    try { await registerMessagePush(true, pushConfig ?? undefined); setNotificationsEnabled(true); }
    catch (cause) { setNotificationError(cause instanceof Error ? cause.message : "Could not enable notifications."); }
    finally { setEnablingNotifications(false); }
  }, [pushConfig]);

  useEffect(() => {
    setNotificationsEnabled(false);
    setPushConfig(null);
    setNotificationError("");
    const supported = supportsMessagePush();
    setNotificationSupport(supported);
    if (!input.selfId || input.selfId.startsWith("guest:") || !supported) return;
    let cancelled = false;
    void readMessagePushConfig().then(async (config) => {
      if (cancelled) return;
      setPushConfig(config);
      if (!config.configured || Notification.permission !== "granted") return;
      await registerMessagePush(false, config);
      if (!cancelled) setNotificationsEnabled(true);
    }).catch((cause) => {
      if (!cancelled) setNotificationError(cause instanceof Error ? cause.message : "Message notifications are temporarily unavailable.");
    });
    return () => { cancelled = true; };
  }, [input.selfId]);

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
    setMessageAlert(null);
    setOpen(true);
    if (peer) selectConversation(peer);
    else {
      void refreshInbox();
      void refreshRooms();
    }
  }, [refreshInbox, refreshRooms, selectConversation]);

  useEffect(() => {
    const handleOpen = (data: { type?: string; recipientId?: string; peer?: WildsMessengerParticipant }) => {
      if (data.type === "wildz-message-open" && data.recipientId === input.selfId) openMessenger(data.peer);
    };
    const handler = (event: MessageEvent) => handleOpen(event.data ?? {});
    navigator.serviceWorker?.addEventListener("message", handler);
    const url = new URL(window.location.href);
    if (url.searchParams.get("messages") === "1" && url.searchParams.get("recipientId") === input.selfId) {
      const id = url.searchParams.get("peerId"), handle = url.searchParams.get("peerHandle");
      openMessenger(id && handle ? { id, handle } : undefined);
      for (const key of ["messages", "recipientId", "peerId", "peerHandle"]) url.searchParams.delete(key);
      window.history.replaceState(window.history.state, "", url);
    }
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, [input.selfId, openMessenger]);

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

  const sendResourceClaim = useCallback(async (peer: WildsMessengerParticipant, claimProof: string) => {
    if (!input.selfId) throw Error('Sign in to send resource cards.');
    const context = resourceOfferMessage(claimProof);
    const result = await messengerRequest<{ conversation: WildsConversation; publication?: unknown }>('/api/wilds/messages/thread', {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'resource-offer', guestId: input.guestId, peer, message: context.title, clientMessageId: context.claimId, context })
    });
    rememberPeer(peer);
    setConversations(current => admitConversationState(current, result.conversation));
    assertWildsPrivateMessagePublished(result.publication);
  }, [input.guestId, input.selfId, rememberPeer]);

  const sendTradePackage = useCallback(async (context: WildsWalletTradeMessage) => {
    if (!input.selfId || input.selfId.startsWith("guest:")) throw Error("Sign in to propose a trade.");
    const peer = {id: context.draft.recipientHandle, handle: context.draft.recipientHandle};
    const admitted = validateWildsWalletTradeMessage(context, input.selfHandle, peer.handle);
    const result = await messengerRequest<{conversation: WildsConversation; publication?: unknown}>("/api/wilds/messages/thread", {
      method: "POST", credentials: "same-origin", headers: {"content-type": "application/json"},
      body: JSON.stringify({action: "trade-package", guestId: input.guestId, peer,
        message: admitted.stage === "counteroffer" ? "Trade counteroffer — review the package in Wallet." : "Trade offer — review the package in Wallet.",
        clientMessageId: wildsWalletTradeMessageId(input.selfHandle, admitted), context: admitted})
    });
    assertWildsPrivateMessagePublished(result.publication);
    rememberPeer(peer); setConversations(current => admitConversationState(current, result.conversation));
    return admitted.draft.attemptId;
  }, [input.guestId, input.selfHandle, input.selfId, rememberPeer]);

  const sendNativeTradeMessage = useCallback(async (recipientHandle: string, context: WildsWalletNativeTradeMessage) => {
    if (!input.selfId || input.selfId.startsWith("guest:")) throw Error("Sign in to exchange a trade approval.");
    const peer = {id: recipientHandle, handle: recipientHandle};
    const admitted = validateWildsWalletNativeTradeMessage(context, input.selfHandle, recipientHandle);
    const result = await messengerRequest<{conversation: WildsConversation; publication?: unknown}>("/api/wilds/messages/thread", {
      method: "POST", credentials: "same-origin", headers: {"content-type": "application/json"},
      body: JSON.stringify({action: "trade-native", guestId: input.guestId, peer,
        message: admitted.agreement.purpose === "gift"
          ? admitted.phase === "receipt" ? "Gift accepted — recovering its receipt in Wallet." : admitted.phase === "approval" ? "Gift acceptance — check the gift in Wallet." : `Gift from @${input.selfHandle.replace(/^@/, "").replace(/\.receiz\.id$/, "")} — receive it in Wallet.`
          : admitted.phase === "receipt" ? "Exchange settled — recovering the complete receipt in Wallet." : admitted.phase === "approval" ? "Trade approval — check the exchange in Wallet." : "Trade package prepared — review the exchange in Wallet.",
        clientMessageId: wildsWalletNativeTradeMessageId(input.selfHandle, admitted), context: admitted})
    });
    assertWildsPrivateMessagePublished(result.publication);
    rememberPeer(peer); setConversations(current => admitConversationState(current, result.conversation));
    return wildsWalletNativeTradeMessageId(input.selfHandle, admitted);
  }, [input.guestId, input.selfHandle, input.selfId, rememberPeer]);

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
    const result = await messengerRequest<{ offer: WildsCardTransferOffer; conversation: WildsConversation; publication?: unknown }>("/api/wilds/cards/transfers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "issue", card, targetHandle })
    });
    const peer = { id: result.offer.targetHandle, handle: result.offer.targetHandle };
    rememberPeer(peer);
    setConversations((current) => admitConversationState(current, result.conversation));
    assertWildsPrivateMessagePublished(result.publication);
    publishedCardOffersRef.current.add(JSON.stringify([card.id, result.offer.targetHandle]));
    return result.offer;
  }, [rememberPeer]);

  const hasPublishedCardOffer = useCallback((assetId: string, targetHandle: string) => publishedCardOffersRef.current.has(JSON.stringify([assetId, targetHandle])), []);

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
    if (!open || document.visibilityState !== "visible" || !selectedPeer || !conversation || !conversation.messages.length) return;
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
  }, [conversation, input.guestId, input.selfId, open, selectedPeer]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void markRead(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

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
    messageAlert,
    dismissMessageAlert: () => setMessageAlert(null),
    notificationSupport,
    notificationsAvailable: pushConfig?.configured === true,
    checkingNotifications: notificationSupport && !input.selfId.startsWith("guest:") && !pushConfig && !notificationError,
    notificationsEnabled,
    notificationError,
    enablingNotifications,
    enableNotifications,
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
    hasPublishedCardOffer,
    sendResourceClaim,
    sendTradePackage,
    sendNativeTradeMessage,
    claimCardOffer,
    markRead,
    react,
    refreshInbox
  };
}

export type WildsMessengerController = ReturnType<typeof useWildsMessenger>;
