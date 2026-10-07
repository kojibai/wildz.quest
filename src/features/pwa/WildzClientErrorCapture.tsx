"use client";
import { useEffect } from "react";
import { recordWildzClientError } from "../../lib/wildz/client-error-report";

export function WildzClientErrorCapture() {
  useEffect(() => {
    const record = (error: unknown) => {
      let storage: Storage | null = null;
      try { storage = window.localStorage; } catch { /* Private browser modes may deny storage. */ }
      recordWildzClientError(error, storage);
    };
    const onError = (event: ErrorEvent) => record(event.error ?? event.message);
    const onRejection = (event: PromiseRejectionEvent) => record(event.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
