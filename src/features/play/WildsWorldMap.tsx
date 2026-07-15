"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import type { WildsPresence } from "./multiplayer-core";
import { landmarkApproachPoint, WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "./wilds-landmarks";
import { evaluateLandmarkAccess, type WildsLandmarkProgress } from "./wilds-landmark-access";
import {
  projectWildsAtlas,
  type WildsAtlasExactPlayer,
  type WildsAtlasPlayerCluster,
  type WildsAtlasZoom
} from "./wilds-world-atlas";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { WildsAtlasCanvas } from "./WildsAtlasCanvas";
import { describeWildsPoint } from "./wilds-world-geography";

const zoomLevels: readonly WildsAtlasZoom[] = ["world", "region", "landmark"];

export function WildsWorldMap({
  open,
  guestId,
  currentPosition,
  remotePlayers,
  missionProgress,
  worldMastery,
  discoveredLandmarkIds,
  qualityProfile,
  reducedMotion,
  landmarkProgress,
  onClose,
  onRift
}: {
  open: boolean;
  guestId: string;
  currentPosition: { x: number; z: number };
  remotePlayers: WildsPresence[];
  missionProgress: number;
  worldMastery: number;
  discoveredLandmarkIds: readonly WildsLandmarkId[];
  qualityProfile: WildsQualityProfile;
  reducedMotion: boolean;
  landmarkProgress: WildsLandmarkProgress;
  onClose: () => void;
  onRift: (destination: { x: number; z: number }) => void | Promise<void>;
}) {
  const [zoom, setZoom] = useState<WildsAtlasZoom>("world");
  const [selectedId, setSelectedId] = useState<WildsLandmarkId | null>(null);
  const [freeDrop, setFreeDrop] = useState<{ x: number; z: number } | null>(null);
  const [holding, setHolding] = useState(false);
  const [atlasPresence, setAtlasPresence] = useState<{
    loaded: boolean;
    players: WildsAtlasExactPlayer[];
    clusters: WildsAtlasPlayerCluster[];
  }>({ loaded: false, players: [], clusters: [] });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const holdTimer = useRef<number | null>(null);
  const localProjection = useMemo(() => projectWildsAtlas({
    center: currentPosition,
    zoom,
    missionProgress,
    worldMastery,
    discoveredLandmarkIds,
    selfId: "self",
    players: remotePlayers
  }), [currentPosition, discoveredLandmarkIds, missionProgress, remotePlayers, worldMastery, zoom]);
  const projection = useMemo(() => atlasPresence.loaded ? {
    ...localProjection,
    exactPlayers: atlasPresence.players,
    playerClusters: atlasPresence.clusters
  } : localProjection, [atlasPresence, localProjection]);
  const selected = projection.landmarks.find((landmark) => landmark.id === selectedId) ?? null;
  const selectedAccess = selected ? evaluateLandmarkAccess(selected, landmarkProgress) : null;
  const freeDropRegion = freeDrop ? describeWildsPoint(freeDrop) : null;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [onClose, open]);

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
  }, []);

  useEffect(() => {
    if (!open || !guestId) return;
    let active = true;
    const refresh = async () => {
      const params = new URLSearchParams({
        x: String(currentPosition.x),
        z: String(currentPosition.z),
        guestId
      });
      try {
        const response = await fetch(`/api/wilds/atlas?${params.toString()}`, { cache: "no-store" });
        const result = await response.json().catch(() => null) as {
          ok?: boolean;
          players?: WildsAtlasExactPlayer[];
          clusters?: WildsAtlasPlayerCluster[];
        } | null;
        if (active && response.ok && result?.ok) {
          setAtlasPresence({ loaded: true, players: result.players ?? [], clusters: result.clusters ?? [] });
        }
      } catch {
        // The local room projection remains available while global atlas presence reconnects.
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [currentPosition.x, currentPosition.z, guestId, open]);

  if (!open || typeof document === "undefined") return null;

  const cancelRiftHold = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  };
  const startRiftHold = () => {
    if (!selected || holdTimer.current !== null) return;
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      setHolding(false);
      void onRift(landmarkApproachPoint(selected));
    }, 700);
  };

  return createPortal((
    <div
      aria-labelledby="wilds-world-map-title"
      aria-modal="true"
      className="wilds-world-map"
      role="dialog"
    >
      <header className="wilds-world-map-header">
        <div>
          <span className="eyebrow">Living world atlas</span>
          <h2 id="wilds-world-map-title" ref={headingRef} tabIndex={-1}>The Wilds are bigger than the horizon</h2>
        </div>
        <button aria-label="Close world map" className="wilds-world-map-close" onClick={onClose} type="button">
          <Icons.close aria-hidden="true" size={20} />
        </button>
      </header>

      <div className="wilds-world-map-body">
        <div className="wilds-atlas-stage">
          <WildsAtlasCanvas
            currentPosition={currentPosition}
            onDrop={(position) => {
              setSelectedId(null);
              setFreeDrop(position);
            }}
            onSelect={(landmarkId) => {
              setFreeDrop(null);
              setSelectedId(landmarkId as WildsLandmarkId);
            }}
            projection={projection}
            qualityProfile={qualityProfile}
            reducedMotion={reducedMotion}
            selectedDrop={freeDrop}
            selectedId={selectedId}
          />
          <div aria-label="Atlas zoom level" className="wilds-atlas-zoom" role="group">
            {zoomLevels.map((level) => (
              <button aria-pressed={zoom === level} key={level} onClick={() => setZoom(level)} type="button">
                {level}
              </button>
            ))}
          </div>
          <div className="wilds-atlas-current" aria-label={`Current position X ${Math.round(currentPosition.x)}, Z ${Math.round(currentPosition.z)}`}>
            <Icons.home aria-hidden="true" size={15} />
            <span>You · X {Math.round(currentPosition.x)} · Z {Math.round(currentPosition.z)}</span>
            <i aria-hidden="true" />
            <span>{projection.exactPlayers.length + projection.playerClusters.reduce((sum, cluster) => sum + cluster.count, 0)} live</span>
          </div>
        </div>

        <aside className="wilds-atlas-destinations" aria-label="World destinations">
          <div className="wilds-atlas-fallback">
            {WILDS_FLAGSHIP_LANDMARKS.map((landmark) => (
              <button
                aria-pressed={selectedId === landmark.id}
                key={landmark.id}
                onClick={() => {
                  setFreeDrop(null);
                  setSelectedId(landmark.id);
                }}
                type="button"
              >
                <span style={{ background: landmark.accent }} />
                <strong>{landmark.name}</strong>
                <small>{landmark.subtitle}</small>
              </button>
            ))}
          </div>

          {freeDrop ? (
            <section className="wilds-atlas-destination-card wilds-atlas-free-drop" aria-live="polite">
              <span className="eyebrow">Dropped pin · {freeDropRegion}</span>
              <h3>Travel here?</h3>
              <p>Rift to this exact terrain point, then explore nearby roads, buildings, and secrets on foot.</p>
              <div className="wilds-atlas-destination-meta">
                <span>X {Math.round(freeDrop.x)}</span>
                <span>Z {Math.round(freeDrop.z)}</span>
                <span>Open terrain</span>
              </div>
              <div className="wilds-atlas-confirm-actions">
                <button onClick={() => setFreeDrop(null)} type="button">Cancel</button>
                <button
                  aria-label="Confirm Rift travel"
                  onClick={() => void onRift(freeDrop)}
                  type="button"
                >
                  <Icons.globe aria-hidden="true" size={18} />
                  Accept Rift
                </button>
              </div>
            </section>
          ) : selected ? (
            <section className="wilds-atlas-destination-card" aria-live="polite">
              <span className="eyebrow">{selected.discovered ? "Discovered destination" : "Uncharted signal"}</span>
              <h3>{selected.name}</h3>
              <p>{selected.subtitle}</p>
              <div className="wilds-atlas-destination-meta">
                <span>{selected.kind}</span>
                <span>{selected.occupancy}</span>
                <span>{selectedAccess?.allowed ? "Entrance ready" : "Sealed entrance"}</span>
              </div>
              <p className="wilds-atlas-access-summary">{selectedAccess?.summary}</p>
              <button
                aria-label="Hold to Rift Drop"
                className={`wilds-rift-button${holding ? " is-holding" : ""}`}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && !event.repeat) startRiftHold();
                }}
                onKeyUp={cancelRiftHold}
                onPointerCancel={cancelRiftHold}
                onPointerDown={startRiftHold}
                onPointerLeave={cancelRiftHold}
                onPointerUp={cancelRiftHold}
                type="button"
              >
                <Icons.globe aria-hidden="true" size={20} />
                <span><strong>{holding ? "Opening Rift…" : "Hold to Rift Drop"}</strong><small>Land nearby, then walk to the physical entrance</small></span>
                <i aria-hidden="true" />
              </button>
            </section>
          ) : (
            <div className="wilds-atlas-empty">
              <Icons.globe aria-hidden="true" size={28} />
              <strong>Drop anywhere. Learn everywhere.</strong>
              <p>Tap terrain for an exact Rift, or choose a landmark to arrive nearby and discover its entrance on foot.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  ), document.body);
}
