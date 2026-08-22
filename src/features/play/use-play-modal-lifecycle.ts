"use client";

import { useEffect, useRef, type RefObject } from "react";
import { canRestoreFocus } from "./focus-recovery";
import type { WorldOverlayOwner } from "./world-overlay-state";

const ESCAPE_OWNED_WORLD_OWNERS = new Set<WorldOverlayOwner>([
  "trainer", "map", "landmark", "settlement", "ecology", "raid", "reward", "ceremony", "memorial", "wallet", "multiplayer"
]);

function modalFocusable(dialog: HTMLElement | null) {
  return Array.from(dialog?.querySelectorAll<HTMLElement>(
    'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
  ) ?? []);
}

export function restorePlayModalFocusOnRelease(
  priorOwner: WorldOverlayOwner,
  owner: WorldOverlayOwner,
  origin: HTMLElement | null,
  restore: (origin: HTMLElement | null) => boolean
) {
  return priorOwner !== "none" && owner === "none" ? restore(origin) : false;
}

export function usePlayModalLifecycle({
  onEscape,
  originRef,
  owner
}: {
  onEscape: (owner: WorldOverlayOwner) => void;
  originRef: RefObject<HTMLElement | null>;
  owner: WorldOverlayOwner;
}) {
  const priorOwnerRef = useRef(owner);
  const focusFrameRef = useRef<number | null>(null);
  const onEscapeRef = useRef(onEscape);
  const restoreFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    const priorOwner = priorOwnerRef.current;
    priorOwnerRef.current = owner;
    if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;

    if (priorOwner === "none" && owner !== "none") {
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      originRef.current = owner === "multiplayer"
        ? document.querySelector<HTMLElement>('[data-play-modal-origin="multiplayer"]') ?? active
        : originRef.current ?? active;
    } else if (priorOwner !== "none" && owner === "none") {
      restoreFrameRef.current = window.requestAnimationFrame(() => {
        restoreFrameRef.current = null;
        const origin = originRef.current;
        originRef.current = null;
        restorePlayModalFocusOnRelease(priorOwner, owner, origin, (candidate) => {
          if (!canRestoreFocus(candidate)) return false;
          candidate.focus();
          return true;
        });
      });
    }
  }, [originRef, owner]);

  useEffect(() => {
    if (owner === "none" || owner === "combat") return;
    let dialog: HTMLElement | null = null;
    const focusFirst = () => {
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null;
        const first = modalFocusable(dialog)[0] ?? dialog;
        first?.focus();
      });
    };
    const resolveModal = () => {
      const candidates = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const nextDialog = candidates[candidates.length - 1] ?? null;
      if (dialog === nextDialog) return;
      dialog = nextDialog;
      if (dialog) focusFirst();
    };
    resolveModal();
    const observer = new MutationObserver(resolveModal);
    observer.observe(document.body, { childList: true, subtree: true });
    const containFocus = (event: FocusEvent) => {
      if (!dialog || !(event.target instanceof Node) || dialog.contains(event.target)) return;
      (modalFocusable(dialog)[0] ?? dialog).focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ESCAPE_OWNED_WORLD_OWNERS.has(owner)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onEscapeRef.current(owner);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = modalFocusable(dialog);
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      focusFrameRef.current = null;
      document.removeEventListener("focusin", containFocus);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [owner]);

  useEffect(() => () => {
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    if (restoreFrameRef.current !== null) window.cancelAnimationFrame(restoreFrameRef.current);
  }, []);
}
