"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { enqueueProfileCardPreview } from './profile-preview-queue';

/** Keep the tile and its name available while deferring expensive card detail DOM. */
export function DeferredProfileCardPreview({ eager = false, active = true, children }: {
  eager?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  // Even the first visible cards wait until the profile controls have painted.
  const [visible, setVisible] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visible || !active) return;
    if (eager) return enqueueProfileCardPreview(() => setVisible(true));
    const target = previewRef.current;
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      // Older browsers retain complete previews rather than permanently empty tiles.
      return enqueueProfileCardPreview(() => setVisible(true));
    }
    let cancelPreview: (() => void) | undefined;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      cancelPreview = enqueueProfileCardPreview(() => setVisible(true));
    }, { rootMargin: "160px 0px", threshold: 0 });
    observer.observe(target);
    return () => { observer.disconnect(); cancelPreview?.(); };
  }, [active, eager, visible]);
  return <div ref={previewRef} className="wildz-profile-card-local" aria-hidden="true"
    data-profile-preview={visible ? "ready" : "deferred"}>
    {visible ? children : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8fc5a7", fontSize: 12 }}>Card preview</div>}
  </div>;
}
