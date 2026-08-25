"use client";

import { useEffect, useRef, useState } from "react";
import {
  WILDZ_CARE_NOTIFICATIONS_READY,
  WILDZ_ENABLE_CARE_NOTIFICATIONS,
  WILDZ_APPLY_UPDATE_MESSAGE,
  WILDZ_PREPARE_LOCAL_VOICE_MESSAGE
} from "@/features/pwa/pwa-events";
import { activateWaitingUpdate } from "@/features/pwa/pwa-update";

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type UpdateStatus = "idle" | "applying" | "applied";

export function PwaController() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [online, setOnline] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const applyingUpdateRef = useRef(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

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
    setOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    const enableCareNotifications = () => {
      if (!("Notification" in window) || Notification.permission === "denied") return;
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") window.dispatchEvent(new Event(WILDZ_CARE_NOTIFICATIONS_READY));
      });
    };
    window.addEventListener(WILDZ_ENABLE_CARE_NOTIFICATIONS, enableCareNotifications);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener("online", updateOnlineStatus);
        window.removeEventListener("offline", updateOnlineStatus);
        window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
        window.removeEventListener(WILDZ_ENABLE_CARE_NOTIFICATIONS, enableCareNotifications);
      };
    }

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker || stateListeners.has(worker)) return;
      const handleStateChange = () => {
        if (cancelled) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaiting(worker);
          setUpdateStatus("idle");
        }
        if (worker.state === "redundant") setWaiting((current) => current === worker ? null : current);
      };
      stateListeners.set(worker, handleStateChange);
      worker.addEventListener("statechange", handleStateChange);
    };

    const handleUpdateFound = () => watchWorker(registration?.installing ?? null);
    const register = () => {
      const release = process.env.NEXT_PUBLIC_WILDZ_SW_RELEASE ?? "v8.0.0-r1";
      const workerUrl = `/sw.js?release=${encodeURIComponent(release)}`;
      void navigator.serviceWorker.register(workerUrl, {
        scope: "/",
        updateViaCache: "none"
      }).then((activeRegistration) => {
        if (cancelled) return;
        registration = activeRegistration;
        registrationRef.current = activeRegistration;
        if (registration.waiting) {
          setWaiting(registration.waiting);
          setUpdateStatus("idle");
          watchWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", handleUpdateFound);
        watchWorker(registration.installing);
        const voiceWorker = activeRegistration.active ?? navigator.serviceWorker.controller;
        if (voiceWorker) {
          // Download-only preparation runs after app registration and never
          // participates in capture, identity, movement, or response timing.
          voiceWorker.postMessage({ type: WILDZ_PREPARE_LOCAL_VOICE_MESSAGE });
          void navigator.storage?.persist?.().catch(() => false);
        }
      }).catch(() => {
        // Wildz remains browser-usable when installability is unavailable.
      });
    };

    const idle: number = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(register)
      : window.setTimeout(register, 1200);

    return () => {
      cancelled = true;
      applyingUpdateRef.current = false;
      registrationRef.current = null;
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener(WILDZ_ENABLE_CARE_NOTIFICATIONS, enableCareNotifications);
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
    setUpdateStatus("applying");
    window.dispatchEvent(new Event("wildz:preserve-state"));
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    try {
      const registration = registrationRef.current
        ?? await navigator.serviceWorker.getRegistration();
      if (!registration) throw new Error("wildz_update_registration_unavailable");
      await activateWaitingUpdate({
        serviceWorkers: navigator.serviceWorker,
        registration,
        renderedWorker: waiting,
        message: { type: WILDZ_APPLY_UPDATE_MESSAGE }
      });
    } catch {
      // A navigation still fetches the deployed document network-first and
      // lets the browser finish any activation that advanced during the tap.
      void registrationRef.current?.update().catch(() => undefined);
    }
    setWaiting(null);
    setUpdateStatus("applied");
    window.requestAnimationFrame(() => window.location.reload());
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
          <span>{applying ? "Applying update…" : "Update ready"}</span>
          <button type="button" disabled={applying} onClick={() => void applyUpdate()}>
            {applying ? "Applying…" : "Apply update"}
          </button>
        </>
      ) : null}
      {updateStatus === "applied" ? (
        <span role="status" aria-live="polite">Update applied. New Wildz assets are ready.</span>
      ) : null}
    </div>
  );
}
