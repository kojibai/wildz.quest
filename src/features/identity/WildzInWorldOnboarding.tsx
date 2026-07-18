"use client";

import type { WildzGender } from "@/features/identity/wildz-genesis";
import { useEffect, useRef } from "react";

export function WildzInWorldOnboarding({
  busy,
  error,
  onChooseExplorer
}: {
  busy: boolean;
  error: string;
  onChooseExplorer: (gender: WildzGender) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="wildz-in-world-onboarding" role="dialog" aria-modal="true" aria-labelledby="wildz-onboarding-title">
      <div className="wildz-onboarding-card" aria-busy={busy}>
        <h1 id="wildz-onboarding-title" ref={headingRef} tabIndex={-1}>Choose your explorer</h1>
        <p>Pick the explorer who will enter the Wilds.</p>

        <div className="wildz-onboarding-explorers">
          <button type="button" disabled={busy} onClick={() => onChooseExplorer("female")}>
            <strong>Female explorer</strong><span>Enter the living world</span>
          </button>
          <button type="button" disabled={busy} onClick={() => onChooseExplorer("male")}>
            <strong>Male explorer</strong><span>Enter the living world</span>
          </button>
        </div>
        {error ? <p className="wildz-onboarding-error" role="alert">{error}</p> : null}
      </div>
    </section>
  );
}
