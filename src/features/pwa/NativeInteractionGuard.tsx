"use client";

import { useEffect } from "react";

/** Covers portals and public routes as well as the game canvas, without touching pointer input. */
export function NativeInteractionGuard() {
  useEffect(() => {
    const preventNativeMenu = (event: Event) => event.preventDefault();
    const clearHighlight = () => {
      const selection = document.getSelection();
      if (selection && !selection.isCollapsed) selection.collapseToEnd();
    };
    const clearFieldHighlight = (event: Event) => {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
      const end = field.selectionEnd;
      if (end !== null && field.selectionStart !== end) field.setSelectionRange(end, end);
    };

    document.addEventListener("contextmenu", preventNativeMenu, true);
    document.addEventListener("selectstart", preventNativeMenu, true);
    document.addEventListener("dragstart", preventNativeMenu, true);
    document.addEventListener("selectionchange", clearHighlight);
    document.addEventListener("select", clearFieldHighlight, true);
    clearHighlight();
    return () => {
      document.removeEventListener("contextmenu", preventNativeMenu, true);
      document.removeEventListener("selectstart", preventNativeMenu, true);
      document.removeEventListener("dragstart", preventNativeMenu, true);
      document.removeEventListener("selectionchange", clearHighlight);
      document.removeEventListener("select", clearFieldHighlight, true);
    };
  }, []);

  return null;
}
