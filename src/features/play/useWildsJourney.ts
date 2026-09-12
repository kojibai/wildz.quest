"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseWildsJourney, rememberWildsJourney, wildsJourneyStorageKey,
  type WildsJourneyInput, type WildsJourneyMemory
} from "./wilds-journey";

const EMPTY_MEMORIES: readonly WildsJourneyMemory[] = [];
type Journal = { ownerId: string; memories: readonly WildsJourneyMemory[] };

/** Stores this device's witnessed events; it is deliberately independent from card proofs. */
export function useWildsJourney(ownerId: string): {
  memories: readonly WildsJourneyMemory[];
  remember: (input: WildsJourneyInput) => void;
} {
  const [journal, setJournal] = useState<Journal>({ ownerId: "", memories: EMPTY_MEMORIES });
  const active = useRef<{
    ownerId: string;
    memories: readonly WildsJourneyMemory[];
    remember: (input: WildsJourneyInput) => void;
  } | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    const key = wildsJourneyStorageKey(ownerId);
    let memories: readonly WildsJourneyMemory[] = EMPTY_MEMORIES;
    try { memories = parseWildsJourney(window.localStorage.getItem(key)); } catch { /* Storage can be disabled. */ }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dirty = false;
    const flush = () => {
      if (!dirty) return;
      try { window.localStorage.setItem(key, JSON.stringify(memories)); dirty = false; } catch { /* Keep the in-memory journal usable. */ }
    };
    const session = {
      ownerId,
      memories,
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

  const remember = useCallback((input: WildsJourneyInput) => {
    if (active.current?.ownerId === ownerId) active.current.remember(input);
  }, [ownerId]);

  return { memories: journal.ownerId === ownerId ? journal.memories : EMPTY_MEMORIES, remember };
}
