"use client";
import { useState } from "react";
import { DeferredProfileCardPreview } from "./DeferredProfileCardPreview";

export function ProfilePreviewBrowserFixture() {
  const [action, setAction] = useState("No card opened");
  return <main style={{ maxWidth: 560, margin: "0 auto", padding: 20, background: "#101b1d", color: "#eaf5ed" }}>
    <h1>Profile preview fixture</h1>
    <p>34 synthetic display tiles. No player data, proofs, or saved state.</p>
    <p role="status" style={{ position: "sticky", top: 0, zIndex: 1, padding: 12, background: "#101b1d" }}>{action}</p>
    <section className="wildz-profile-card-grid" aria-label="Synthetic companion cards">
      {Array.from({ length: 34 }, (_, index) => <button type="button" key={index}
        className="wildz-profile-card-tile" aria-label={`Open synthetic companion ${index + 1}`}
        onClick={() => setAction(`Opened synthetic companion ${index + 1}`)}>
        <DeferredProfileCardPreview eager={index < 2}>
          <div data-synthetic-card-detail="" style={{ height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(#234f42, #102b25)" }}>
            Synthetic detail {index + 1}
          </div>
        </DeferredProfileCardPreview>
        <span><strong>Companion {index + 1}</strong><small>Preview</small></span>
      </button>)}
    </section>
  </main>;
}
