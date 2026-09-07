"use client";
import { useEffect, useState } from "react";
import { WildsContinuousBuilderPanel } from "./WildsContinuousBuilderPanel";
import type { useWildsContinuousBuilder } from "./use-wilds-continuous-builder";
import type { WildsConstructionKind } from "./wilds-world-construction";
import { WildsStewardCraftPanel } from "./WildsStewardCraftPanel";
import { projectWildsStewardCraft } from "./wilds-steward-craft";
import type { WildsConstructionSiteV1 } from "./wilds-construction-site";
import { createWildzIdentityCardArtworkPng, wildzIdentitySealFilename, wildzIdentitySealStamp } from "@/lib/receiz/wildz-identity-seal";
import type { WildzIdentitySession } from "@/lib/receiz/wildz-identity-repository";
const exportedAt = "2026-09-07T20:00:00.000Z";
/** Public artwork and simulated UI only. No credential is generated or exported. */
export function BuildGuidanceBrowserFixture() {
  const [piece, setPiece] = useState<WildsConstructionKind>("foundation");
  const [taps, setTaps] = useState(0);
  const [mode, setMode] = useState("build");
  const [funded, setFunded] = useState(false);
  const [distance, setDistance] = useState(3);
  const [feedback, setFeedback] = useState("");
  const [username, setUsername] = useState("wildz.explorer");
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    void createWildzIdentityCardArtworkPng({ keyId: "demo0001-public-artwork", username, displayName: "Wildz Explorer" } as WildzIdentitySession, exportedAt).then(bytes => {
      if (disposed) return;
      url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "image/png" })); setArt(url);
    });
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [username]);
  const lots = funded ? Array.from({ length: 8 }, (_, index) => ({ lotId: `fixture:${index}`, kind: index < 4 ? "timber" as const : "stone" as const })) : [];
  const projection = projectWildsStewardCraft({ activeCreatureName: "No companion", materialLots: lots, pending: false, selectedBlueprintId: null, workMeters: [] });
  const site = { siteId: "fixture:site", blueprint: "trail-shelter", stage: "materials-ready", contributedLots: [{ kind: "timber" }, { kind: "timber" }, { kind: "stone" }], materialsRequired: { timber: 2, stone: 1 }, workRequired: 1, workCompleted: 0 } as unknown as WildsConstructionSiteV1;
  const stamp = wildzIdentitySealStamp(exportedAt);
  const mockBuilder = { kind: piece, open: true, rotation: 0, height: 0, nearbyPieces: [], selected: null, progress: null, preview: null, busy: false, error: null, placeBlocker: "Select a piece, then tap the world to place.", canPlace: false, selectKind: setPiece, close: () => setMode("build"), rotate: () => {}, raise: () => {}, lower: () => {}, undoPreview: () => {}, place: () => {}, selectComponent: () => {} } as unknown as ReturnType<typeof useWildsContinuousBuilder>;
  return <main style={{ background: "#081d19", minHeight: "100dvh", padding: 16, color: "#edf8f2" }}>
    <nav style={{ display: "flex", gap: 12, marginBottom: 16 }}><button onClick={() => setMode("build")}>Build guidance</button><button onClick={() => setMode("seal")}>Identity seal artwork</button><button onClick={() => setMode("mobile")}>Mobile tray</button></nav>
    {mode === "mobile" ? <><button aria-label="World placement surface" onClick={() => setTaps(value => value + 1)} style={{ position: "absolute", inset: "110px 0 0", width: "100%", border: 0, background: "linear-gradient(#5a948b, #284e31)", color: "white" }}>World taps: {taps} · {piece}</button><WildsContinuousBuilderPanel builder={mockBuilder} materials={{ hay: 2, timber: 12, stone: 8 }} /><button style={{ position: "fixed", bottom: 20, left: 20, width: 88, height: 88 }} aria-label="Move forward" onClick={() => setFeedback("Moving")}>↑ {feedback}</button></> : mode === "build" ? <div style={{ maxWidth: 720, margin: "auto" }}>
      <label><input type="checkbox" checked={funded} onChange={event => setFunded(event.target.checked)} /> Carry full materials</label>
      <label style={{ display: "block", margin: "12px 0" }}>Distance <select value={distance} onChange={event => setDistance(Number(event.target.value))}><option value={3}>3 metres</option><option value={6.5}>6.5 metres</option></select></label>
      <p role="status">{feedback}</p>
      <WildsStewardCraftPanel projection={projection} nearbySite={site} siteDistance={distance} nearbyWorkbench={funded} onSelectBlueprint={id => setFeedback(`Selected ${id}`)} onWorkSite={() => setFeedback("Player finished shelter")} onCraftTool={kind => setFeedback(`Crafted ${kind}`)} />
    </div> : <div style={{ maxWidth: 900, margin: "auto" }}>
      <label>Seal name <input value={username} onChange={event => setUsername(event.target.value)} /></label>
      <p style={{ overflowWrap: "anywhere" }}>{wildzIdentitySealFilename(username || "explorer", exportedAt)}</p>
      <p>Kai {stamp.coordinate} · Total pulses {stamp.totalPulses}</p>
      {art && <img src={art} width={900} height={900} style={{ width: "100%", height: "auto" }} alt={`Public sample identity seal for ${username}. Kai ${stamp.coordinate}, total pulses ${stamp.totalPulses}.`} />}
    </div>}
  </main>;
}
