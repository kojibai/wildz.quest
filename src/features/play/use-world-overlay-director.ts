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
  const [state, dispatch] = useReducer(reduceWorldOverlay, initialWorldOverlayState);
  const [gestureCancelSignal, cancelGestures] = useReducer((signal: number) => signal + 1, 0);
  const priorDismissSignal = useRef(dismissSignal);

  const resetTransientState = useCallback((event: Extract<WorldOverlayEvent, { type: "dismiss" | "viewport-change" }>) => {
    cancelGestures();
    dispatch(event);
    if (exclusiveOwner !== "none") dispatch({ type: "exclusive", owner: exclusiveOwner });
  }, [exclusiveOwner]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") resetTransientState({ type: "dismiss" });
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
  }, [resetTransientState]);

  useEffect(() => {
    if (priorDismissSignal.current === dismissSignal) return;
    priorDismissSignal.current = dismissSignal;
    resetTransientState({ type: "dismiss" });
  }, [dismissSignal, resetTransientState]);

  useEffect(() => {
    cancelGestures();
    dispatch({ type: "exclusive", owner: exclusiveOwner });
  }, [exclusiveOwner]);

  return { state, dispatch, gestureCancelSignal };
}
