"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  parseWildsJourney, rememberWildsJourney, wildsJourneyStorageKey, mergeWildsJourneyJournal,
  type WildsJourneyInput, type WildsJourneyMemory, type WildsJourneyJournal
} from "./wilds-journey";

const EMPTY_MEMORIES: readonly WildsJourneyMemory[] = [];
type Journal = { ownerId: string; memories: readonly WildsJourneyMemory[] };

/** Merges owner-scoped explorer notes from this device and the restored Identity Seal. */
export function useWildsJourney(ownerId: string, portable?: WildsJourneyJournal): {
  journal: WildsJourneyJournal;
  ready: boolean;
  memories: readonly WildsJourneyMemory[];
  remember: (input: WildsJourneyInput) => void;
} {
  const portableRef = useRef(portable);
  portableRef.current = portable;
  const [journal, setJournal] = useState<Journal>({ ownerId: "", memories: EMPTY_MEMORIES });
  const active = useRef<{
    ownerId: string;
    memories: readonly WildsJourneyMemory[];
    remember: (input: WildsJourneyInput) => void;
    merge: (portable: unknown) => void;
  } | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    const key = wildsJourneyStorageKey(ownerId);
    let memories: readonly WildsJourneyMemory[] = EMPTY_MEMORIES;
    try { memories = parseWildsJourney(window.localStorage.getItem(key)); } catch { /* Storage can be disabled. */ }
    memories = mergeWildsJourneyJournal(ownerId, memories, portableRef.current).memories;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = true;
    const flush = () => {
      if (!dirty) return;
      try { window.localStorage.setItem(key, JSON.stringify(memories)); dirty = false; } catch { /* Keep the in-memory journal usable. */ }
    };
    const session = {
      ownerId,
      memories,
      merge(portable: unknown) {
        const next = mergeWildsJourneyJournal(ownerId, memories, portable).memories;
        if (JSON.stringify(next) === JSON.stringify(memories)) return;
        memories = next;
        session.memories = next;
        dirty = true;
        setJournal({ ownerId, memories });
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(flush, 750);
      },
      remember(input: WildsJourneyInput) {
        const next = rememberWildsJourney(memories, input);
        if (next === memories) return;
        memories = next;
        session.memories = next;
        dirty = true;
        setJournal({ ownerId, memories });
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(flush, 750);
      }
    };
    timer = setTimeout(flush, 750);
    active.current = session;
    setJournal({ ownerId, memories });
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      // The key and memory collection belong to this effect's owner, including on logout.
      flush();
      if (active.current === session) active.current = null;
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ownerId]);

  useEffect(() => {
    if (active.current?.ownerId === ownerId) active.current.merge(portable);
  }, [ownerId, portable]);

  const remember = useCallback((input: WildsJourneyInput) => {
    if (active.current?.ownerId === ownerId) active.current.remember(input);
  }, [ownerId]);

  const ready = journal.ownerId === ownerId && !!ownerId;
  const memories = ready ? journal.memories : EMPTY_MEMORIES;
  const portableJournal = useMemo<WildsJourneyJournal>(() => ({ version: 1, ownerId, memories }), [ownerId, memories]);
  return { memories, remember, journal: portableJournal, ready };
}
