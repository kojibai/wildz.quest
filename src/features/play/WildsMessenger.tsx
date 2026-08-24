"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import type { WildsRoomMessage } from "./multiplayer-core";
import {
  WILDS_DIRECT_MESSAGE_MAX_LENGTH,
  WILDS_DIRECT_MESSAGE_REACTIONS,
  wildsMessageDeliveryState,
  type WildsDirectMessage
} from "./wilds-messenger-core";
import type { WildsMessengerController } from "./use-wilds-messenger";
import { PhiNetworkAmount } from "./wallet/PhiNetworkMark";
import { formatWildsPhiExact } from "./wallet/wilds-wallet-format";
import { WildsCardScene } from "./WildsCardScene";
import type { WildsCardTransferOffer } from "@/lib/receiz/wilds-card-transfer";

function shortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: date.getFullYear() === today.getFullYear() ? undefined : "numeric" }).format(date);
}

function avatarLetters(handle: string) {
  return handle.replace(/^@/, "").split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "W";
}

export function WildsMessenger({
  messenger,
  roomChat,
  selfId,
  onSendPhi,
  onClaimCard
}: {
  messenger: WildsMessengerController;
  roomChat: { messages: readonly WildsRoomMessage[]; onSend: (message: string) => Promise<unknown> };
  selfId: string;
  onSendPhi?: (peer: { id: string; handle: string }) => void;
  onClaimCard?: (offer: WildsCardTransferOffer) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");
  const [roomDraft, setRoomDraft] = useState("");
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomEditor, setRoomEditor] = useState<"create" | "add" | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomMemberIds, setRoomMemberIds] = useState<string[]>([]);
  const [roomError, setRoomError] = useState("");
  const [query, setQuery] = useState("");
  const [replyTo, setReplyTo] = useState<WildsDirectMessage | null>(null);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [claimingTransferId, setClaimingTransferId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const composerSendingRef = useRef(false);
  const selectedPeerId = messenger.selectedPeer?.id ?? null;
  const closeMessenger = messenger.closeMessenger;
  const selectConversation = messenger.selectConversation;
  const selectRoom = messenger.selectRoom;
  const selectedPeer = messenger.selectedPeer;
  const selectedRoom = messenger.selectedRoom;
  const messages = useMemo(() => {
    const byClientMessageId = new Map<string, WildsDirectMessage>();
    for (const item of messenger.pending) byClientMessageId.set(item.message.clientMessageId, item.message);
    // An admitted source message replaces its optimistic projection. This
    // prevents a response/poll race from rendering the same send twice.
    for (const message of messenger.conversation?.messages ?? []) byClientMessageId.set(message.clientMessageId, message);
    return [...byClientMessageId.values()].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  }, [messenger.conversation?.messages, messenger.pending]);
  const visiblePeers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const summaryIds = new Set(messenger.summaries.map((summary) => summary.peer.id));
    const ordered = [
      ...messenger.summaries.map((summary) => summary.peer),
      ...messenger.allPeers.filter((peer) => !summaryIds.has(peer.id))
    ];
    return normalized ? ordered.filter((peer) => peer.handle.toLowerCase().includes(normalized)) : ordered;
  }, [messenger.allPeers, messenger.summaries, query]);

  const markRead = messenger.markRead;
  useEffect(() => {
    if (!messenger.open || !selectedPeerId) return;
    void markRead();
  }, [markRead, messages.length, messenger.open, selectedPeerId]);

  useEffect(() => {
    if (!messenger.open) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') ?? []);
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (selectedPeer) selectConversation(null);
        else if (roomEditor) setRoomEditor(null);
        else if (selectedRoom) selectRoom(null);
        else if (roomOpen) setRoomOpen(false);
        else closeMessenger();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!;
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = priorOverflow;
    };
  }, [closeMessenger, messenger.open, roomEditor, roomOpen, selectConversation, selectedPeer, selectedRoom, selectRoom]);

  useEffect(() => {
    if (messenger.open) return;
    setRoomOpen(false);
    setRoomEditor(null);
    setRoomDraft("");
    setRoomError("");
  }, [messenger.open]);

  useEffect(() => {
    if (!selectedPeerId) return;
    setDraft("");
    setReplyTo(null);
    setReactionFor(null);
  }, [selectedPeerId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || (!selectedPeerId && !roomOpen && !messenger.selectedRoom)) return;
    const frame = requestAnimationFrame(() => list.scrollTo({ top: list.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [messages.length, messenger.selectedRoom, roomChat.messages.length, roomOpen, selectedPeerId]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(132, Math.max(44, textarea.scrollHeight))}px`;
  }, [draft]);

  if (!messenger.open || typeof document === "undefined") return null;
  const conversation = messenger.conversation;

  return createPortal((
    <section aria-label="Wildz messages" aria-modal="true" className="wilds-messenger" ref={dialogRef} role="dialog">
      <header className="wilds-messenger-header">
        {messenger.selectedPeer || messenger.selectedRoom || roomOpen || roomEditor ? <button aria-label="Back to conversations" className="wilds-messenger-back" onClick={() => { messenger.selectConversation(null); messenger.selectRoom(null); setRoomOpen(false); setRoomEditor(null); }} type="button"><Icons.chevronLeft size={20} /></button> : <span className="wilds-messenger-mark"><Icons.send size={18} /></span>}
        <div><small>{messenger.selectedRoom ? `${messenger.selectedRoom.members.length} members` : roomOpen ? "Shared live connection" : messenger.selectedPeer ? "Private connection" : roomEditor ? "New private room" : "Receiz ID messenger"}</small><strong>{messenger.selectedRoom?.name ?? (roomOpen ? "World room" : messenger.selectedPeer?.handle ?? (roomEditor ? "Create room" : "Messages"))}</strong></div>
        <span className={`wilds-messenger-sync${messenger.syncing ? " is-syncing" : ""}`} title={messenger.syncing ? "Synchronizing" : "Source verified"}><i />{messenger.syncing ? "Syncing" : "Verified"}</span>
        <button aria-label="Close messages" className="wilds-messenger-close" onClick={messenger.closeMessenger} type="button"><Icons.close size={20} /></button>
      </header>

      {!messenger.selectedPeer && !messenger.selectedRoom && !roomOpen && !roomEditor ? <div className="wilds-messenger-inbox">
        <div className="wilds-messenger-search"><Icons.search size={17} /><input aria-label="Search conversations" onChange={(event) => setQuery(event.target.value)} placeholder="Search explorers" value={query} /></div>
        <div className="wilds-messenger-inbox-title"><span><strong>Connections</strong><small>{messenger.unreadCount ? `${messenger.unreadCount} unread` : "You’re all caught up"}</small></span><div><button onClick={() => { setRoomName(""); setRoomMemberIds([]); setRoomEditor("create"); }} type="button">New room</button><button onClick={() => void messenger.refreshInbox()} type="button">Refresh</button></div></div>
        <div className="wilds-messenger-conversations">
          {messenger.rooms.map((room) => <button className="wilds-messenger-room-entry" key={room.id} onClick={() => messenger.selectRoom(room)} type="button"><span className="wilds-messenger-avatar"><Icons.users size={20} /></span><span><strong>{room.name}</strong><small>{room.messages.at(-1)?.body ?? `${room.members.length} members`}</small></span><span className="wilds-messenger-conversation-meta"><time>{room.messages.length ? shortTime(room.messages.at(-1)!.createdAt) : ""}</time><Icons.chevronRight size={15} /></span></button>)}
          <button className="wilds-messenger-room-entry" onClick={() => { setRoomError(""); setRoomOpen(true); }} type="button">
            <span className="wilds-messenger-avatar"><Icons.users size={20} /></span>
            <span><strong>World room</strong><small>{roomChat.messages.at(-1)?.text ?? "Everyone currently live in this world room"}</small></span>
            <span className="wilds-messenger-conversation-meta"><time>{roomChat.messages.length ? shortTime(roomChat.messages.at(-1)!.sentAt) : ""}</time><Icons.chevronRight size={15} /></span>
          </button>
          {visiblePeers.map((peer) => {
            const summary = messenger.summaries.find((item) => item.peer.id === peer.id);
            const latest = summary?.latestMessage;
            return <button className={summary?.unreadCount ? "is-unread" : ""} key={peer.id} onClick={() => messenger.selectConversation(peer)} type="button">
              <span className="wilds-messenger-avatar">{avatarLetters(peer.handle)}</span>
              <span><strong>{peer.handle}</strong><small>{latest ? `${latest.senderId === selfId ? "You: " : ""}${latest.deletedAt ? "Message removed" : latest.body}` : "Start a private conversation"}</small></span>
              <span className="wilds-messenger-conversation-meta"><time>{latest ? shortTime(latest.createdAt) : ""}</time>{summary?.unreadCount ? <b>{summary.unreadCount > 99 ? "99+" : summary.unreadCount}</b> : <Icons.chevronRight size={15} />}</span>
            </button>;
          })}
          {!visiblePeers.length ? <div className="wilds-messenger-empty"><span><Icons.users size={24} /></span><strong>Your next connection starts in the Wilds.</strong><p>Open a live explorer and choose Message. The conversation will stay here.</p></div> : null}
        </div>
      </div> : roomEditor ? <form className="wilds-messenger-room-editor" onSubmit={async (event) => { event.preventDefault(); const members = messenger.allPeers.filter((peer) => roomMemberIds.includes(peer.id)); if (!members.length) return; setRoomError(""); try { if (roomEditor === "create") await messenger.createRoom(roomName, members); else await messenger.addRoomMembers(members); setRoomEditor(null); setRoomMemberIds([]); } catch (cause) { setRoomError(cause instanceof Error ? cause.message : "Room could not be saved"); } }}>
        <label><span>Room name</span><input aria-label="Room name" autoFocus disabled={roomEditor === "add"} maxLength={48} onChange={(event) => setRoomName(event.target.value)} placeholder="Expedition crew" value={roomEditor === "add" ? messenger.selectedRoom?.name ?? "" : roomName} /></label>
        <fieldset><legend>{roomEditor === "add" ? "Add explorers" : "Choose members"}</legend>{messenger.allPeers.filter((peer) => !messenger.selectedRoom?.members.some((member) => member.id === peer.id)).map((peer) => <label key={peer.id}><input checked={roomMemberIds.includes(peer.id)} onChange={() => setRoomMemberIds((current) => current.includes(peer.id) ? current.filter((id) => id !== peer.id) : [...current, peer.id])} type="checkbox" /><span className="wilds-messenger-avatar">{avatarLetters(peer.handle)}</span><strong>{peer.handle}</strong></label>)}</fieldset>
        <button disabled={!roomMemberIds.length || (roomEditor === "create" && !roomName.trim())} type="submit">{roomEditor === "add" ? "Add to room" : "Create room"}</button>
      </form> : messenger.selectedRoom ? <div className="wilds-messenger-thread wilds-messenger-room-thread">
        <div className="wilds-messenger-room-members"><span>{messenger.selectedRoom.members.map((member) => member.handle).join(" · ")}</span>{messenger.selectedRoom.owner.id === selfId ? <button onClick={() => { setRoomMemberIds([]); setRoomEditor("add"); }} type="button">Add people</button> : null}</div>
        <div className="wilds-messenger-messages" ref={listRef}>{!messenger.selectedRoom.messages.length ? <div className="wilds-messenger-thread-start"><span className="wilds-messenger-avatar"><Icons.users size={20} /></span><strong>{messenger.selectedRoom.name} is ready.</strong><p>Only the explorers added to this room can participate.</p></div> : null}{messenger.selectedRoom.messages.map((message, index, roomMessages) => { const mine = message.senderId === selfId; const prior = roomMessages[index - 1]; const showDay = !prior || new Date(prior.createdAt).toDateString() !== new Date(message.createdAt).toDateString(); return <div className="wilds-message-block" key={message.id}>{showDay ? <div className="wilds-message-day"><span>{dayLabel(message.createdAt)}</span></div> : null}<div className={`wilds-message-row${mine ? " is-mine" : ""}`}><div className="wilds-message-bubble"><b className="wilds-room-message-sender">{mine ? "You" : message.senderHandle}</b><span>{message.body}</span><small>{shortTime(message.createdAt)}</small></div></div></div>; })}</div>
        <form className="wilds-messenger-composer" onSubmit={async (event) => { event.preventDefault(); const outgoing = roomDraft.trim(); if (!outgoing) return; try { await messenger.sendRoom(outgoing); setRoomDraft(""); } catch (cause) { setRoomError(cause instanceof Error ? cause.message : "Room message not sent"); } }}><div><textarea aria-label={`Message ${messenger.selectedRoom.name}`} maxLength={2_000} onChange={(event) => setRoomDraft(event.target.value)} placeholder="Message room…" rows={1} value={roomDraft} /><button aria-label="Send room message" disabled={!roomDraft.trim()} type="submit"><Icons.send size={19} /></button></div><small>Private to {messenger.selectedRoom.members.length} Receiz IDs</small></form>
      </div> : roomOpen ? <div className="wilds-messenger-thread wilds-messenger-world-thread">
        <div className="wilds-messenger-messages" ref={listRef}>
          {!roomChat.messages.length ? <div className="wilds-messenger-thread-start"><span className="wilds-messenger-avatar"><Icons.users size={20} /></span><strong>Create the room.</strong><p>Send the first message to open a shared conversation with the explorers live in this room.</p></div> : null}
          {roomChat.messages.slice(-50).map((message, index, messages) => {
            const mine = message.senderId === selfId;
            const prior = messages[index - 1];
            const showDay = !prior || new Date(prior.sentAt).toDateString() !== new Date(message.sentAt).toDateString();
            return <div className="wilds-message-block" key={message.id}>
              {showDay ? <div className="wilds-message-day"><span>{dayLabel(message.sentAt)}</span></div> : null}
              <div className={`wilds-message-row${mine ? " is-mine" : ""}`}>
                <div className="wilds-message-bubble"><b className="wilds-room-message-sender">{mine ? "You" : message.senderHandle}</b><span>{message.text}</span><small>{shortTime(message.sentAt)}</small></div>
              </div>
            </div>;
          })}
        </div>
        <form className="wilds-messenger-composer" onSubmit={async (event) => {
          event.preventDefault();
          const outgoing = roomDraft.trim();
          if (!outgoing) return;
          setRoomError("");
          try {
            await roomChat.onSend(outgoing);
            setRoomDraft("");
          } catch (cause) {
            setRoomError(cause instanceof Error ? cause.message : "Room message not sent");
          }
        }}>
          <div><textarea aria-label="Message shared room" maxLength={280} onChange={(event) => setRoomDraft(event.target.value)} placeholder="Message everyone live…" rows={1} value={roomDraft} /><button aria-label="Send room message" disabled={!roomDraft.trim()} type="submit"><Icons.send size={19} /></button></div>
          <small>Shared with explorers in this live room</small>
        </form>
      </div> : <div className="wilds-messenger-thread">
        <div className="wilds-messenger-messages" ref={listRef}>
          {!messages.length ? <div className="wilds-messenger-thread-start"><span className="wilds-messenger-avatar">{avatarLetters(selectedPeer?.handle ?? "Explorer")}</span><strong>Start something real.</strong><p>This is your private thread with {selectedPeer?.handle ?? "this explorer"}. Be yourself.</p></div> : null}
          {messages.map((message, index) => {
            const mine = message.senderId === selfId;
            const prior = messages[index - 1];
            const showDay = !prior || new Date(prior.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
            const reply = message.replyToId ? messages.find((candidate) => candidate.id === message.replyToId) : null;
            const pending = messenger.pending.find((item) => item.message.clientMessageId === message.clientMessageId);
            const offer = message.context?.kind === "card-offer" ? message.context.offer : null;
            const offerClaimed = offer ? messages.some((candidate) => candidate.context?.kind === "card-transfer"
              && candidate.context.transferId === offer.instrument.plan.transferId) : false;
            return <div className="wilds-message-block" key={message.id}>
              {showDay ? <div className="wilds-message-day"><span>{dayLabel(message.createdAt)}</span></div> : null}
              <div className={`wilds-message-row${mine ? " is-mine" : ""}`}>
                <div aria-label={`Message from ${message.senderHandle}. Tap for reactions`} className="wilds-message-bubble" onClick={() => setReactionFor((current) => current === message.id ? null : message.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setReactionFor((current) => current === message.id ? null : message.id); }} role="button" tabIndex={0}>
                  {reply ? <span className="wilds-message-reply"><b>{reply.senderId === selfId ? "You" : reply.senderHandle}</b>{reply.body}</span> : null}
                  {message.context?.kind === "phi-transfer" ? <span className="wilds-message-phi-transfer"><small>WALLET TRANSACTION</small><strong><PhiNetworkAmount value={formatWildsPhiExact(message.context.amountPhiMicro)} /></strong><em>Committed by source proof object</em></span>
                    : offer ? <span className="wilds-message-card-transfer"><small>ONE-USE CARD CLAIM</small><span className="wilds-message-card-scene"><WildsCardScene asset={offer.card} origin="https://wildz.quest" qr="" tapToFlip /></span><strong>{offer.card.manifest.name}</strong><em>{offerClaimed ? "Claimed · custody moved exactly once" : mine ? `Awaiting ${offer.targetHandle}` : "Source verified · accept into your Vault"}</em>{!mine && !offerClaimed && onClaimCard ? <button disabled={claimingTransferId === offer.instrument.plan.transferId} onClick={(event) => { event.stopPropagation(); setClaimingTransferId(offer.instrument.plan.transferId); void onClaimCard(offer).finally(() => setClaimingTransferId(null)); }} type="button">{claimingTransferId === offer.instrument.plan.transferId ? "Claiming…" : "Claim card"}</button> : null}</span>
                    : message.context?.kind === "card-transfer" ? <span className="wilds-message-card-transfer"><small>CARD TRANSFER COMMITTED</small><span className="wilds-message-card-scene"><WildsCardScene asset={message.context.card} origin="https://wildz.quest" qr="" tapToFlip /></span><strong>{message.context.card.manifest.name}</strong><em>Receiver admitted · sender Vault reconciled</em></span>
                      : <span>{message.deletedAt ? "Message removed" : message.body}</span>}
                  <small>{shortTime(message.createdAt)}{message.editedAt ? " · edited" : ""}{mine ? ` · ${pending?.state === "failed" ? "not sent" : pending ? "sending" : conversation ? wildsMessageDeliveryState(message, conversation, selfId) : "sent"}` : ""}</small>
                </div>
                {message.reactions.length ? <div className="wilds-message-reactions">{message.reactions.map((reaction) => <button aria-label={`${reaction.emoji}, ${reaction.actorIds.length}`} key={reaction.emoji} onClick={() => void messenger.react(message.id, reaction.emoji)} type="button">{reaction.emoji}<b>{reaction.actorIds.length}</b></button>)}</div> : null}
                {reactionFor === message.id && !pending ? <div className="wilds-message-actions">{WILDS_DIRECT_MESSAGE_REACTIONS.map((emoji) => <button aria-label={`React ${emoji}`} key={emoji} onClick={() => { setReactionFor(null); void messenger.react(message.id, emoji); }} type="button">{emoji}</button>)}<button onClick={() => { setReplyTo(message); setReactionFor(null); composerRef.current?.focus(); }} type="button">Reply</button></div> : null}
                {pending?.state === "failed" ? <button className="wilds-message-retry" onClick={() => void messenger.send(message.body, message.replyToId, message.clientMessageId)} type="button">Retry</button> : null}
              </div>
            </div>;
          })}
        </div>
        <form className="wilds-messenger-composer" onSubmit={async (event) => {
          event.preventDefault();
          if (!draft.trim() || composerSendingRef.current) return;
          composerSendingRef.current = true;
          const outgoing = draft;
          const replyId = replyTo?.id ?? null;
          setDraft("");
          setReplyTo(null);
          try { await messenger.send(outgoing, replyId); }
          finally { composerSendingRef.current = false; }
        }}>
          {replyTo ? <div className="wilds-messenger-replying"><span><small>Replying to {replyTo.senderId === selfId ? "yourself" : replyTo.senderHandle}</small><strong>{replyTo.body}</strong></span><button aria-label="Cancel reply" onClick={() => setReplyTo(null)} type="button"><Icons.close size={15} /></button></div> : null}
          <div>{selectedPeer && onSendPhi ? <button aria-label={`Send Phi to ${selectedPeer.handle}`} className="wilds-messenger-wallet-action" onClick={() => onSendPhi(selectedPeer)} title="Send Phi" type="button">Φ</button> : null}<textarea aria-label={`Message ${selectedPeer?.handle ?? "explorer"}`} maxLength={WILDS_DIRECT_MESSAGE_MAX_LENGTH} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && matchMedia("(pointer: fine)").matches) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} placeholder="Message…" ref={composerRef} rows={1} value={draft} /><button aria-label="Send message" disabled={!draft.trim()} type="submit"><Icons.send size={19} /></button></div>
          <small>{draft.length > WILDS_DIRECT_MESSAGE_MAX_LENGTH - 200 ? `${draft.length}/${WILDS_DIRECT_MESSAGE_MAX_LENGTH}` : "Messages originate from your Receiz ID"}</small>
        </form>
      </div>}
      {messenger.error || roomError ? <div aria-live="polite" className="wilds-messenger-error">{(roomError || messenger.error).replaceAll("_", " ")}</div> : null}
    </section>
  ), document.body);
}
