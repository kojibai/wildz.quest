"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import type { WildsPresence } from "./multiplayer-core";
import { landmarkApproachPoint, type WildsLandmarkId } from "./wilds-landmarks";
import type { WildsLandmarkProgress } from "./wilds-landmark-access";
import {
  projectWildsAtlas,
  type WildsAtlasExactPlayer,
  type WildsAtlasPlayerCluster,
  type WildsAtlasZoom
} from "./wilds-world-atlas";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { WildsAtlasCanvas } from "./WildsAtlasCanvas";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsEcologyKnowledge } from "./wilds-ecology-history";
import type { WildsBossKnowledge } from "./wilds-raid-history";

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
  livingWorld,
  ecologyKnowledge,
  bossKnowledge,
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
  livingWorld?: WildsWorldProjection | null;
  ecologyKnowledge?: Record<string, WildsEcologyKnowledge>;
  bossKnowledge?: Record<string, WildsBossKnowledge>;
  onClose: () => void;
  onRift: (destination: { x: number; z: number }) => void | Promise<void>;
}) {
  const [zoom, setZoom] = useState<WildsAtlasZoom>("world");
  const [atlasPresence, setAtlasPresence] = useState<{
    loaded: boolean;
    players: WildsAtlasExactPlayer[];
    clusters: WildsAtlasPlayerCluster[];
  }>({ loaded: false, players: [], clusters: [] });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const localProjection = useMemo(() => projectWildsAtlas({
    center: currentPosition,
    zoom,
    missionProgress,
    worldMastery,
    discoveredLandmarkIds,
    selfId: "self",
    players: remotePlayers,
    dynamicSites: Object.values(livingWorld?.sites ?? {}),
    ecologySites: Object.values(livingWorld?.ecologySites ?? {}),
    ecologyKnowledge,
    bosses: Object.values(livingWorld?.bosses ?? {}),
    bossKnowledge
  }), [bossKnowledge, currentPosition, discoveredLandmarkIds, ecologyKnowledge, livingWorld?.bosses, livingWorld?.ecologySites, livingWorld?.sites, missionProgress, remotePlayers, worldMastery, zoom]);
  const projection = useMemo(() => atlasPresence.loaded ? {
    ...localProjection,
    exactPlayers: atlasPresence.players,
    playerClusters: atlasPresence.clusters
  } : localProjection, [atlasPresence, localProjection]);

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
            onDrop={(position) => void onRift(position)}
            onSelect={(landmarkId) => {
              const landmark = projection.landmarks.find((candidate) => candidate.id === landmarkId);
              if (landmark) void onRift(landmarkApproachPoint(landmark));
            }}
            projection={projection}
            qualityProfile={qualityProfile}
            reducedMotion={reducedMotion}
            selectedDrop={null}
            selectedId={null}
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

      </div>
    </div>
  ), document.body);
}
