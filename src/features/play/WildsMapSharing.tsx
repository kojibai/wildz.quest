"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { WildsExplorationAtlas } from "./wilds-exploration-atlas";
import { prepareWildzGameImage } from "../../lib/receiz/wildz-game-image-export";
import { openWildzSealedCard } from "../../lib/receiz/wildz-sealed-card";
import { saveBlobToDevice } from "./card-export";
import { scheduleAfterPaint } from "./schedule-after-paint";
import { createWildzExportCoordinator } from "../../lib/receiz/wildz-export-coordinator";
import { readWildsMapFromPng } from "./wilds-map-image";

export function WildsMapSharing({ atlas, onImport }: {
  atlas: WildsExplorationAtlas;
  onImport: (atlas: WildsExplorationAtlas) => void;
}) {
  const prepared = useMemo(() => createWildzExportCoordinator({
    sameSnapshot: (left: WildsExplorationAtlas, right) => left === right,
    build: async (snapshot, allowEnrollment) => {
      const { renderWildsMapImage } = await import("./wilds-map-image-render");
      const blob = await renderWildsMapImage(snapshot);
      return prepareWildzGameImage({ bytes: new Uint8Array(await blob.arrayBuffer()),
        filename: "wildz-discovered-map.png", kind: "map", allowEnrollment });
    }
  }), []);
  useEffect(() => scheduleAfterPaint(() => {
    void prepared.prepare(atlas, false).catch(() => undefined);
  }), [atlas, prepared]);
  const input = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<"save" | "import" | null>(null);
  const [status, setStatus] = useState("");
  useEffect(() => {
    if (!status || busy) return;
    const timer = setTimeout(() => setStatus(""), 8_000);
    return () => clearTimeout(timer);
  }, [busy, status]);

  const save = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("save"); setStatus("Drawing your discovered territory…");
    try {
      // A ready map opens the device sheet synchronously with the Save tap.
      const artifact = prepared.peek(atlas) ?? await prepared.prepare(atlas, false).catch(error => {
        if (error instanceof Error && error.message === "offline_seal_enrollment_required") return prepared.prepare(atlas, true);
        throw error;
      });
      await saveBlobToDevice(artifact.blob, artifact.filename);
      setStatus("Map saved. Share the original PNG so others can import it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save your map. Try again.");
    } finally { busyRef.current = false; setBusy(null); }
  };
  const upload = async (file: File) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("import"); setStatus("Reading map…");
    try {
      const opened = await openWildzSealedCard({ bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type, name: file.name });
      const incoming = readWildsMapFromPng(opened.payloadBytes);
      onImport(incoming);
      setStatus("Map added. All your previous discoveries are preserved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import this map.");
    } finally { busyRef.current = false; setBusy(null); }
  };
  return <>
    <span className="wilds-map-sharing" role="group" aria-label="Share discovered territory" aria-busy={busy !== null}>
      <button className="wilds-map-share-button" aria-label="Save map image" title="Save map image" disabled={busy !== null} onClick={() => void save()} type="button"><Download size={16} strokeWidth={1.7} aria-hidden="true" /></button>
      <button className="wilds-map-share-button" aria-label="Import map image" title="Import map image" disabled={busy !== null} onClick={() => input.current?.click()} type="button"><Upload size={16} strokeWidth={1.7} aria-hidden="true" /></button>
      <input ref={input} type="file" accept="image/png,.png,.receizbundle,.receized" hidden aria-label="Choose a saved Wildz map PNG" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void upload(file);
      }} />
    </span>
    <span className="wilds-map-sharing-status" role="status" aria-live="polite" aria-atomic="true">{status}</span>
  </>;
}
