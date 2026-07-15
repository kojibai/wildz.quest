"use client";
import { useEffect, useState } from "react";

export function PwaController() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null); const [online, setOnline] = useState(true);
  useEffect(() => { setOnline(navigator.onLine); const status = () => setOnline(navigator.onLine); window.addEventListener("online", status); window.addEventListener("offline", status); if (!("serviceWorker" in navigator)) return () => { window.removeEventListener("online", status); window.removeEventListener("offline", status); };
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => { if (registration.waiting) setWaiting(registration.waiting); registration.addEventListener("updatefound", () => { const worker = registration.installing; worker?.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker); }); }); });
    const idle: number = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(register) : (window as Window).setTimeout(register, 1200);
    return () => { window.removeEventListener("online", status); window.removeEventListener("offline", status); if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle); else (window as Window).clearTimeout(idle); };
  }, []);
  if (!online) return <div className="wildz-pwa-notice" role="status">Offline · your current trail remains available</div>;
  if (!waiting) return null;
  return <div className="wildz-pwa-notice" role="status"><span>Update ready</span><button type="button" onClick={() => { window.dispatchEvent(new Event("wildz:preserve-state")); waiting.postMessage({ type: "SKIP_WAITING" }); setWaiting(null); }}>Apply when ready</button></div>;
}
