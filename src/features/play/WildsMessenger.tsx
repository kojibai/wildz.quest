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
  selfId
}: {
  messenger: WildsMessengerController;
  roomChat: { messages: readonly WildsRoomMessage[]; onSend: (message: string) => Promise<unknown> };
  selfId: string;
}) {
  const [draft, setDraft] = useState("");
  const [roomDraft, setRoomDraft] = useState("");
  const [roomOpen, setRoomOpen] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [query, setQuery] = useState("");
  const [replyTo, setReplyTo] = useState<WildsDirectMessage | null>(null);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const selectedPeerId = messenger.selectedPeer?.id ?? null;
  const closeMessenger = messenger.closeMessenger;
  const selectConversation = messenger.selectConversation;
  const selectedPeer = messenger.selectedPeer;
  const messages = useMemo(() => [
    ...(messenger.conversation?.messages ?? []),
    ...messenger.pending.map((item) => item.message)
  ].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)), [messenger.conversation?.messages, messenger.pending]);
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
  }, [closeMessenger, messenger.open, roomOpen, selectConversation, selectedPeer]);

  useEffect(() => {
    if (messenger.open) return;
    setRoomOpen(false);
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
    if (!list || (!selectedPeerId && !roomOpen)) return;
    const frame = requestAnimationFrame(() => list.scrollTo({ top: list.scrollHeight, behavior: "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [messages.length, roomChat.messages.length, roomOpen, selectedPeerId]);

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
        {messenger.selectedPeer || roomOpen ? <button aria-label="Back to conversations" className="wilds-messenger-back" onClick={() => { messenger.selectConversation(null); setRoomOpen(false); }} type="button"><Icons.chevronLeft size={20} /></button> : <span className="wilds-messenger-mark"><Icons.send size={18} /></span>}
        <div><small>{roomOpen ? "Shared live connection" : messenger.selectedPeer ? "Private connection" : "Receiz ID messenger"}</small><strong>{roomOpen ? "Shared room" : messenger.selectedPeer?.handle ?? "Messages"}</strong></div>
        <span className={`wilds-messenger-sync${messenger.syncing ? " is-syncing" : ""}`} title={messenger.syncing ? "Synchronizing" : "Source verified"}><i />{messenger.syncing ? "Syncing" : "Verified"}</span>
        <button aria-label="Close messages" className="wilds-messenger-close" onClick={messenger.closeMessenger} type="button"><Icons.close size={20} /></button>
      </header>

      {!messenger.selectedPeer && !roomOpen ? <div className="wilds-messenger-inbox">
        <div className="wilds-messenger-search"><Icons.search size={17} /><input aria-label="Search conversations" onChange={(event) => setQuery(event.target.value)} placeholder="Search explorers" value={query} /></div>
        <div className="wilds-messenger-inbox-title"><span><strong>Connections</strong><small>{messenger.unreadCount ? `${messenger.unreadCount} unread` : "You’re all caught up"}</small></span><button onClick={() => void messenger.refreshInbox()} type="button">Refresh</button></div>
        <div className="wilds-messenger-conversations">
          <button className="wilds-messenger-room-entry" onClick={() => { setRoomError(""); setRoomOpen(true); }} type="button">
            <span className="wilds-messenger-avatar"><Icons.users size={20} /></span>
            <span><strong>Shared room</strong><small>{roomChat.messages.at(-1)?.text ?? "Create a chat room for everyone live with you"}</small></span>
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
      </div> : roomOpen ? <div className="wilds-messenger-thread wilds-messenger-room-thread">
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
            return <div className="wilds-message-block" key={message.id}>
              {showDay ? <div className="wilds-message-day"><span>{dayLabel(message.createdAt)}</span></div> : null}
              <div className={`wilds-message-row${mine ? " is-mine" : ""}`}>
                <button aria-label={`Message from ${message.senderHandle}. Tap for reactions`} className="wilds-message-bubble" onClick={() => setReactionFor((current) => current === message.id ? null : message.id)} type="button">
                  {reply ? <span className="wilds-message-reply"><b>{reply.senderId === selfId ? "You" : reply.senderHandle}</b>{reply.body}</span> : null}
                  <span>{message.deletedAt ? "Message removed" : message.body}</span>
                  <small>{shortTime(message.createdAt)}{message.editedAt ? " · edited" : ""}{mine ? ` · ${pending?.state === "failed" ? "not sent" : pending ? "sending" : conversation ? wildsMessageDeliveryState(message, conversation, selfId) : "sent"}` : ""}</small>
                </button>
                {message.reactions.length ? <div className="wilds-message-reactions">{message.reactions.map((reaction) => <button aria-label={`${reaction.emoji}, ${reaction.actorIds.length}`} key={reaction.emoji} onClick={() => void messenger.react(message.id, reaction.emoji)} type="button">{reaction.emoji}<b>{reaction.actorIds.length}</b></button>)}</div> : null}
                {reactionFor === message.id && !pending ? <div className="wilds-message-actions">{WILDS_DIRECT_MESSAGE_REACTIONS.map((emoji) => <button aria-label={`React ${emoji}`} key={emoji} onClick={() => { setReactionFor(null); void messenger.react(message.id, emoji); }} type="button">{emoji}</button>)}<button onClick={() => { setReplyTo(message); setReactionFor(null); composerRef.current?.focus(); }} type="button">Reply</button></div> : null}
                {pending?.state === "failed" ? <button className="wilds-message-retry" onClick={() => void messenger.send(message.body, message.replyToId, message.clientMessageId)} type="button">Retry</button> : null}
              </div>
            </div>;
          })}
        </div>
        <form className="wilds-messenger-composer" onSubmit={(event) => {
          event.preventDefault();
          if (!draft.trim()) return;
          const outgoing = draft;
          const replyId = replyTo?.id ?? null;
          setDraft("");
          setReplyTo(null);
          void messenger.send(outgoing, replyId);
        }}>
          {replyTo ? <div className="wilds-messenger-replying"><span><small>Replying to {replyTo.senderId === selfId ? "yourself" : replyTo.senderHandle}</small><strong>{replyTo.body}</strong></span><button aria-label="Cancel reply" onClick={() => setReplyTo(null)} type="button"><Icons.close size={15} /></button></div> : null}
          <div><textarea aria-label={`Message ${selectedPeer?.handle ?? "explorer"}`} maxLength={WILDS_DIRECT_MESSAGE_MAX_LENGTH} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
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
