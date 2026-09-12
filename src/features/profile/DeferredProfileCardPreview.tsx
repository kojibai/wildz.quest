"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep the tile and its name available while deferring expensive card detail DOM. */
export function DeferredProfileCardPreview({ eager = false, children }: {
  eager?: boolean;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(eager);
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (visible) return;
    const target = previewRef.current;
    if (!target) return;
    if (typeof IntersectionObserver === "undefined") {
      // Older browsers retain complete previews rather than permanently empty tiles.
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setVisible(true);
    }, { rootMargin: "160px 0px", threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [visible]);
  return <div ref={previewRef} className="wildz-profile-card-local" aria-hidden="true"
    data-profile-preview={visible ? "ready" : "deferred"}>
    {visible ? children : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#8fc5a7", fontSize: 12 }}>Card preview</div>}
  </div>;
}
