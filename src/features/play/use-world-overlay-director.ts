"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialWorldOverlayState,
  reduceWorldOverlay,
  type WorldOverlayEvent,
  type WorldOverlayOwner
} from "./world-overlay-state";

export function useWorldOverlayDirector({
  dismissSignal,
  exclusiveOwner
}: {
  dismissSignal: number;
  exclusiveOwner: WorldOverlayOwner;
}) {
  const [state, reduce] = useReducer(reduceWorldOverlay, initialWorldOverlayState);
  const [gestureCancelSignal, cancelGestures] = useReducer((signal: number) => signal + 1, 0);
  const priorDismissSignal = useRef(dismissSignal);
  const panelOwnershipRef = useRef(false);
  const exclusiveOriginRef = useRef<HTMLElement | null>(null);
  const dispatch = useCallback((event: WorldOverlayEvent) => {
    if (event.type === "panel") panelOwnershipRef.current = event.key !== null;
    else if (event.type === "dismiss" || event.type === "viewport-change" || event.type === "exclusive") panelOwnershipRef.current = false;
    reduce(event);
  }, [reduce]);
  const claimExclusiveOwner = useCallback((
    owner: Exclude<WorldOverlayOwner, "none" | "command">,
    restoreOrigin?: HTMLElement | null
  ) => {
    exclusiveOriginRef.current = restoreOrigin
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    panelOwnershipRef.current = true;
    cancelGestures();
    reduce({ type: "exclusive", owner });
  }, []);
  const releaseExclusiveOwner = useCallback(() => {
    panelOwnershipRef.current = false;
    reduce({ type: "exclusive", owner: "none" });
  }, []);

  const resetTransientState = useCallback((event: Extract<WorldOverlayEvent, { type: "dismiss" | "viewport-change" }>) => {
    cancelGestures();
    dispatch(event);
    if (exclusiveOwner !== "none") dispatch({ type: "exclusive", owner: exclusiveOwner });
  }, [dispatch, exclusiveOwner]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && exclusiveOwner === "none") resetTransientState({ type: "dismiss" });
    };
    const onViewportChange = () => resetTransientState({ type: "viewport-change" });
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") onViewportChange();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("orientationchange", onViewportChange, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [exclusiveOwner, resetTransientState]);

  useEffect(() => {
    if (priorDismissSignal.current === dismissSignal) return;
    priorDismissSignal.current = dismissSignal;
    resetTransientState({ type: "dismiss" });
  }, [dismissSignal, resetTransientState]);

  useEffect(() => {
    cancelGestures();
    dispatch({ type: "exclusive", owner: exclusiveOwner });
  }, [dispatch, exclusiveOwner]);

  return { state, dispatch, gestureCancelSignal, panelOwnershipRef, exclusiveOriginRef, claimExclusiveOwner, releaseExclusiveOwner };
}
