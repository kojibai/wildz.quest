"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { WildsExplorationAtlas } from "./wilds-exploration-atlas";
import { readWildsMapFromPng } from "./wilds-map-image";

export function WildsMapSharing({ atlas, onImport }: {
  atlas: WildsExplorationAtlas;
  onImport: (atlas: WildsExplorationAtlas) => void;
}) {
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
      const { renderWildsMapImage } = await import("./wilds-map-image-render");
      const blob = await renderWildsMapImage(atlas);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "wildz-discovered-map.png";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus("Map saved. Share the original PNG so others can import it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save your map. Try again.");
    } finally { busyRef.current = false; setBusy(null); }
  };
  const upload = async (file: File) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy("import"); setStatus("Reading map…");
    try {
      const incoming = readWildsMapFromPng(new Uint8Array(await file.arrayBuffer()));
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
      <input ref={input} type="file" accept="image/png,.png" hidden aria-label="Choose a saved Wildz map PNG" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void upload(file);
      }} />
    </span>
    <span className="wilds-map-sharing-status" role="status" aria-live="polite" aria-atomic="true">{status}</span>
  </>;
}
