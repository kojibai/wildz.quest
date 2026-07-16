"use client";

import { useEffect, useRef, useState } from "react";
import { WILDZ_APPLY_UPDATE_MESSAGE } from "@/features/pwa/pwa-events";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type UpdateStatus = "idle" | "applying" | "applied" | "failed";

const UPDATE_TIMEOUT_MS = 15_000;

export function PwaController() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const applyingUpdateRef = useRef(false);
  const updateRequestedRef = useRef(false);
  const updateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;
    const stateListeners = new Map<ServiceWorker, () => void>();
    const updateOnlineStatus = () => setOnline(navigator.onLine);
    const captureInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    };
    const clearUpdateTimeout = () => {
      if (updateTimeoutRef.current === null) return;
      window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    };

    setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("online", updateOnlineStatus);
        window.removeEventListener("offline", updateOnlineStatus);
        window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      };
    }

    const handleControllerChange = () => {
      if (!updateRequestedRef.current) return;
      updateRequestedRef.current = false;
      applyingUpdateRef.current = false;
      clearUpdateTimeout();
      if (cancelled) return;
      setWaiting(null);
      setUpdateStatus("applied");
    };

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker || stateListeners.has(worker)) return;
      const handleStateChange = () => {
        if (cancelled) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaiting(worker);
          setUpdateStatus("idle");
        }
        if (worker.state === "redundant" && updateRequestedRef.current) {
          updateRequestedRef.current = false;
          applyingUpdateRef.current = false;
          clearUpdateTimeout();
          setWaiting(null);
          setUpdateStatus("failed");
        }
      };
      stateListeners.set(worker, handleStateChange);
      worker.addEventListener("statechange", handleStateChange);
    };

    const handleUpdateFound = () => watchWorker(registration?.installing ?? null);
    const register = () => {
      const release = process.env.NEXT_PUBLIC_WILDZ_SW_RELEASE ?? "v3.0.0";
      const workerUrl = `/sw.js?release=${encodeURIComponent(release)}`;
      void navigator.serviceWorker.register(workerUrl, {
        scope: "/",
        updateViaCache: "none"
      }).then((activeRegistration) => {
        if (cancelled) return;
        registration = activeRegistration;
        if (registration.waiting) {
          setWaiting(registration.waiting);
          setUpdateStatus("idle");
          watchWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", handleUpdateFound);
        watchWorker(registration.installing);
      }).catch(() => {
        // Wildz remains browser-usable when installability is unavailable.
      });
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    const idle: number = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(register)
      : window.setTimeout(register, 1200);

    return () => {
      cancelled = true;
      applyingUpdateRef.current = false;
      updateRequestedRef.current = false;
      clearUpdateTimeout();
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      registration?.removeEventListener("updatefound", handleUpdateFound);
      for (const [worker, listener] of stateListeners) worker.removeEventListener("statechange", listener);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  const installWildz = async () => {
    const promptEvent = installPrompt;
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } finally {
      setInstallPrompt((current) => current === promptEvent ? null : current);
    }
  };

  const applyUpdate = async () => {
    if (!waiting || applyingUpdateRef.current) return;
    applyingUpdateRef.current = true;
    updateRequestedRef.current = true;
    setUpdateStatus("applying");
    window.dispatchEvent(new Event("wildz:preserve-state"));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    if (waiting.state === "redundant") {
      applyingUpdateRef.current = false;
      updateRequestedRef.current = false;
      setWaiting(null);
      setUpdateStatus("failed");
      return;
    }

    updateTimeoutRef.current = window.setTimeout(() => {
      applyingUpdateRef.current = false;
      updateTimeoutRef.current = null;
      setUpdateStatus("failed");
    }, UPDATE_TIMEOUT_MS);

    try {
      waiting.postMessage({ type: WILDZ_APPLY_UPDATE_MESSAGE });
    } catch {
      applyingUpdateRef.current = false;
      updateRequestedRef.current = false;
      if (updateTimeoutRef.current !== null) window.clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
      setUpdateStatus("failed");
    }
  };

  const applying = updateStatus === "applying";
  const showNotice = !online || installPrompt !== null || waiting !== null || updateStatus !== "idle";
  if (!showNotice) return null;

  return (
    <div className="wildz-pwa-notice">
      {!online ? <span role="status">Offline · cached public trails remain readable</span> : null}
      {online && installPrompt ? (
        <button type="button" onClick={() => void installWildz()}>Install Wildz</button>
      ) : null}
      {online && waiting ? (
        <>
          <span>{applying ? "Applying update…" : updateStatus === "failed" ? "Update paused" : "Update ready"}</span>
          <button type="button" disabled={applying} onClick={() => void applyUpdate()}>
            {applying ? "Applying…" : updateStatus === "failed" ? "Retry update" : "Apply update"}
          </button>
        </>
      ) : null}
      {updateStatus === "applied" ? (
        <span role="status" aria-live="polite">Update applied. New Wildz assets are ready.</span>
      ) : null}
      {updateStatus === "failed" && !waiting ? (
        <span role="status" aria-live="polite">Update could not be applied. Wildz will retry when another update is ready.</span>
      ) : null}
    </div>
  );
}
