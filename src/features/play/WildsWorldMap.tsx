"use client";

import { projectWildsCustomBuildingMap } from "./wilds-custom-building-map";
import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { GripHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { Icons } from "@/components/icons";
import { regionForPosition, type WildsPresence } from "./multiplayer-core";
import { landmarkApproachPoint, WILDS_FLAGSHIP_LANDMARKS, type WildsLandmarkId } from "./wilds-landmarks";
import {
  filterWildsAtlasPresence,
  projectWildsAtlas,
  projectWildsAtlasPresence,
  type WildsAtlasLandmark,
  type WildsAtlasExactPlayer,
  type WildsAtlasPlayerCluster,
  type WildsAtlasZoom
} from "./wilds-world-atlas";
import { wildsExplorationContainsWorld, type WildsExplorationAtlas } from "./wilds-exploration-atlas";
import type { WildsQualityProfile } from "./wilds-quality-profile";
import { WildsMapSharing } from "./WildsMapSharing";
import { WildsAtlasCanvas, atlasTerrainHeight } from "./WildsAtlasCanvas";
import type { WildsAtlasBuilder } from "./WildsAtlasBuilder";
import type { CreationPhysicalSnapshot } from "./creation/physical-store";
import { WildsAtlasCivicPanel, type WildsAtlasCivicMode } from "./WildsAtlasCivicPanel";
import { WildsAtlasTerritories } from "./WildsAtlasTerritories";
import { wildsCityCellAt, wildsCityCellCenter, WILDS_CITY_MAX_CELLS, type WildsCityCell, type WildsCityCommand, type WildsCityFoundingAnchor } from "./wilds-city";
import type { WildsWorldProjection } from "./wilds-world-state";
import type { WildsEcologyKnowledge } from "./wilds-ecology-history";
import type { WildsBossKnowledge } from "./wilds-raid-history";
import type { WildsTrainerProjection } from "./wilds-saga-trainers";
import { canRestoreFocus } from "./focus-recovery";
import { WildsAtlasDirectory, WildsAtlasSettlement, type WildsAtlasDirectoryTab } from "./WildsAtlasDirectory";
import type { WildsCivicProjection } from "./wilds-civic-history";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { describeWildsPoint } from "./wilds-world-geography";
import { wildsTrailDirection } from "./wilds-journey-discovery";

import { projectWildsRemoteRoamingMarkers } from "./wilds-roaming-presence";
import { useWildsCrewMap } from "./use-wilds-crew-map";
import type { WildsCrewMapSource } from "./wilds-crew-map";

const zoomLevels: readonly WildsAtlasZoom[] = ["world", "region", "landmark"];
type AtlasPosition = { x: number; z: number };
type AtlasDestination = AtlasPosition & { label: string };
type AtlasSelection = { label: string; position: AtlasPosition; landmark?: WildsAtlasLandmark };

function WildsWorldMapView({
  open,
  trackedDestination,
  onClearDestination,
  onTrackDestination,
  crewMapSource,
  guestId,
  currentPosition,
  explorationAtlas,
  onImportMap,
  remotePlayers,
  missionProgress,
  worldMastery,
  discoveredLandmarkIds,
  qualityProfile,
  reducedMotion,
  livingWorld,
  ecologyKnowledge,
  bossKnowledge,
  trainers,
  civic,
  builder,
  creationPhysical,
  viewerOwnerId,
  onCivicCommand,
  onRefreshWorld,
  onClose,
  onRift
}: {
  open: boolean;
  trackedDestination?: AtlasDestination | null;
  onClearDestination?: () => void;
  onTrackDestination: (destination: AtlasDestination) => void;
  crewMapSource?: WildsCrewMapSource;
  guestId: string;
  currentPosition: { x: number; z: number };
  explorationAtlas: WildsExplorationAtlas;
  onImportMap: (atlas: WildsExplorationAtlas) => void;
  remotePlayers: WildsPresence[];
  missionProgress: number;
  worldMastery: number;
  discoveredLandmarkIds: readonly WildsLandmarkId[];
  qualityProfile: WildsQualityProfile;
  reducedMotion: boolean;
  livingWorld?: WildsWorldProjection | null;
  ecologyKnowledge?: Record<string, WildsEcologyKnowledge>;
  bossKnowledge?: Record<string, WildsBossKnowledge>;
  trainers: readonly WildsTrainerProjection[];
  civic: WildsCivicProjection;
  builder?: WildsAtlasBuilder;
  creationPhysical?: Pick<CreationPhysicalSnapshot, "instances" | "projections">;
  viewerOwnerId?: string;
  onCivicCommand?: (command: WildsCityCommand) => Promise<WildsWorldProjection>;
  onRefreshWorld?: () => void | Promise<unknown>;
  onClose: () => void;
  onRift: (destination: { x: number; z: number }) => void | Promise<void>;
}) {
  const ownCrewMarkers = useWildsCrewMap(crewMapSource, open);
  const remoteCrewMarkers = useMemo(() => projectWildsRemoteRoamingMarkers(remotePlayers, "self"), [remotePlayers]);
  const crewMarkers = [...ownCrewMarkers, ...remoteCrewMarkers];
  const [zoom, setZoom] = useState<WildsAtlasZoom>("world");
  const [mapFocus, setMapFocus] = useState<AtlasPosition | null>(null);
  const [detailCenter, setDetailCenter] = useState<AtlasPosition | null>(null);
  const [selection, setSelection] = useState<AtlasSelection | null>(null);
  const [directory, setDirectory] = useState<WildsAtlasDirectoryTab | null>(null);
  const [civicMode, setCivicMode] = useState<WildsAtlasCivicMode | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string>();
  const [foundingAnchor, setFoundingAnchor] = useState<WildsCityFoundingAnchor>();
  const [draftCells, setDraftCells] = useState<WildsCityCell[]>([]);
  const [layers, setLayers] = useState<"explore" | "territories">("explore");
  const [riftBusy, setRiftBusy] = useState(false);
  const [riftError, setRiftError] = useState("");
  const riftInFlight = useRef(false);
  const [northRequest, setNorthRequest] = useState(0);
  const [recenterRequest, setRecenterRequest] = useState(0);
  const [fitRequest, setFitRequest] = useState(0);
  const [atlasReady, setAtlasReady] = useState(false);
  const [atlasPresence, setAtlasPresence] = useState<{
    loaded: boolean;
    players: WildsAtlasExactPlayer[];
    clusters: WildsAtlasPlayerCluster[];
  }>({ loaded: false, players: [], clusters: [] });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const buildBoxOffset = useRef({ x: 0, y: 0 });
  const buildBoxDrag = useRef<{ pointer: number; x: number; y: number; minX: number; maxX: number; minY: number; maxY: number } | null>(null);
  const startBuildBoxDrag = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0) return;
    const panel = inspectorRef.current, stage = panel?.parentElement;
    if (!panel || !stage) return;
    const box = panel.getBoundingClientRect(), bounds = stage.getBoundingClientRect();
    const { x, y } = buildBoxOffset.current;
    buildBoxDrag.current = {
      pointer: event.pointerId, x: event.clientX - x, y: event.clientY - y,
      minX: x + bounds.left - box.left + 8, maxX: x + bounds.right - box.right - 8,
      minY: y + bounds.top - box.top + 8, maxY: y + bounds.bottom - box.bottom - 8
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveBuildBox = (event: PointerEvent<HTMLElement>) => {
    const drag = buildBoxDrag.current;
    if (!drag || drag.pointer !== event.pointerId || !inspectorRef.current) return;
    const x = Math.max(drag.minX, Math.min(drag.maxX, event.clientX - drag.x));
    const y = Math.max(drag.minY, Math.min(drag.maxY, event.clientY - drag.y));
    buildBoxOffset.current = { x, y };
    inspectorRef.current.style.translate = `${x}px ${y}px`;
  };
  const resetBuildBox = () => {
    buildBoxDrag.current = null;
    buildBoxOffset.current = { x: 0, y: 0 };
    inspectorRef.current?.style.removeProperty("translate");
  };
  useEffect(() => {
    window.addEventListener("resize", resetBuildBox);
    return () => window.removeEventListener("resize", resetBuildBox);
  }, []);

  const indexButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const refreshWorldRef = useRef(onRefreshWorld);
  refreshWorldRef.current = onRefreshWorld;
  const refreshInFlight = useRef(false);
  const refreshGeneration = useRef(0);
  const atlasOrigin = useRef((() => {
    const region = regionForPosition(currentPosition);
    return { x: region.x + 0.5, z: region.z + 0.5 };
  })());
  const customProjects = livingWorld?.constructionProjects;
  const customComponents = livingWorld?.constructionComponents;
  const customCreations = livingWorld?.creations;
  const customBuildings = useMemo(() => customProjects && customComponents ? projectWildsCustomBuildingMap({ constructionProjects: customProjects, constructionComponents: customComponents, creations: customCreations }) : [], [customProjects, customComponents, customCreations]);
  const staticProjection = useMemo(() => projectWildsAtlas({
    center: zoom === "world" ? currentPosition : detailCenter ?? currentPosition,
    atlasOrigin: atlasOrigin.current,
    zoom,
    missionProgress,
    worldMastery,
    discoveredLandmarkIds,
    selfId: "self",
    viewerOwnerId,
    players: [],
    explorationAtlas,
    dynamicSites: Object.values(livingWorld?.sites ?? {}),
    ecologySites: Object.values(livingWorld?.ecologySites ?? {}),
    ecologyKnowledge,
    bosses: Object.values(livingWorld?.bosses ?? {}),
    bossKnowledge,
    trainers,
    customBuildings,
    constructionSites: Object.values(livingWorld?.constructionSites ?? {}),
    structures: Object.values(livingWorld?.structures ?? {})
  }), [customBuildings, bossKnowledge, currentPosition, detailCenter, discoveredLandmarkIds, ecologyKnowledge, explorationAtlas, livingWorld?.bosses, livingWorld?.constructionSites, livingWorld?.ecologySites, livingWorld?.sites, livingWorld?.structures, missionProgress, trainers, viewerOwnerId, worldMastery, zoom]);
  const cities = useMemo(() => Object.values(livingWorld?.cities ?? {})
    .filter(city => wildsExplorationContainsWorld(explorationAtlas, city.anchor.position) || (viewerOwnerId && (
      city.founderId === viewerOwnerId || sameWildzPlayerCoordinate(city.founderId, viewerOwnerId)
    )))
    .sort((left, right) => left.name.localeCompare(right.name)), [explorationAtlas, livingWorld?.cities, viewerOwnerId]);
  const selectedCity = cities.find(city => city.id === selectedCityId);
  const localPresence = useMemo(() => projectWildsAtlasPresence({
    center: currentPosition,
    players: remotePlayers,
    selfId: "self",
    explorationAtlas,
    visibleRegions: staticProjection.territory ? undefined : staticProjection.nodes
  }), [currentPosition, explorationAtlas, remotePlayers, staticProjection.nodes, staticProjection.territory]);
  const projection = useMemo(() => {
    const presence = atlasPresence.loaded
      ? filterWildsAtlasPresence({ exactPlayers: atlasPresence.players, playerClusters: atlasPresence.clusters }, staticProjection.territory ?? staticProjection.nodes)
      : localPresence;
    return {
      ...staticProjection,
      exactPlayers: presence.exactPlayers,
      playerClusters: presence.playerClusters
    };
  }, [atlasPresence, localPresence, staticProjection]);

  const dismissInspector = () => {
    setSelection(null);
    setDirectory(null);
    setCivicMode(null);
    setRiftError("");
  };

  useEffect(() => {
    if (!open) {
      dismissInspector();
      return;
    }
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !riftInFlight.current) closeRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (canRestoreFocus(previousFocus.current)) previousFocus.current.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const refresh = () => { void refreshWorldRef.current?.(); };
    refresh();
    const timer = window.setInterval(refresh, 20_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [open]);

  useEffect(() => {
    if (!open || !guestId) return;
    let active = true;
    const generation = ++refreshGeneration.current;
    const refresh = async () => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
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
        if (active && generation === refreshGeneration.current && response.ok && result?.ok) {
          setAtlasPresence({ loaded: true, players: result.players ?? [], clusters: result.clusters ?? [] });
        }
      } catch {
        // The local room projection remains available while global atlas presence reconnects.
      } finally {
        refreshInFlight.current = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_000);
    return () => {
      active = false;
      refreshGeneration.current += 1;
      window.clearInterval(timer);
    };
  }, [currentPosition.x, currentPosition.z, guestId, open]);

  const inspectPoint = (label: string, position: AtlasPosition) => {
    if (riftInFlight.current || !wildsExplorationContainsWorld(explorationAtlas, position)) return;
    setDirectory(null);
    setCivicMode(null);
    setSelection({ label, position: { x: position.x, z: position.z } });
    setRiftError("");
  };
  const canInspect = (position: AtlasPosition) => wildsExplorationContainsWorld(explorationAtlas, position);
  const togglePlot = (cell: WildsCityCell) => {
    const first = foundingAnchor && wildsCityCellAt(foundingAnchor.position);
    if (!first || !canInspect(wildsCityCellCenter(cell)) || Math.max(Math.abs(cell.x - first.x), Math.abs(cell.z - first.z)) > 1) return;
    setDraftCells(current => {
      const contains = current.some(item => item.x === cell.x && item.z === cell.z);
      if (contains) return cell.x === first.x && cell.z === first.z ? current : current.filter(item => item.x !== cell.x || item.z !== cell.z);
      return current.length < WILDS_CITY_MAX_CELLS ? [...current, cell] : current;
    });
  };
  const inspectTerrain = (position: AtlasPosition) => {
    if (riftInFlight.current || !wildsExplorationContainsWorld(explorationAtlas, position)) return;
    if (builder?.active) {
      builder.onChooseSite(position);
      if (!builder.position) focusDistrict(position);
      return;
    }
    if (civicMode === "found" && foundingAnchor) {
      const cell = wildsCityCellAt(position);
      if (cell) togglePlot(cell);
      return;
    }
    inspectPoint(describeWildsPoint(position), position);
  };
  const inspectLandmark = (landmarkId: string) => {
    if (riftInFlight.current || builder?.active || civicMode === "found") return;
    const landmark = WILDS_FLAGSHIP_LANDMARKS.find(candidate => candidate.id === landmarkId);
    if (!landmark || !wildsExplorationContainsWorld(explorationAtlas, landmark.position)) return;
    setDirectory(null);
    setCivicMode(null);
    setSelection({ label: landmark.name, position: landmark.position,
      landmark: { ...landmark, discovered: discoveredLandmarkIds.includes(landmark.id) } });
    setRiftError("");
  };
  const focusPosition = (position: AtlasPosition) => {
    setMapFocus(position);
    setRecenterRequest(value => value + 1);
  };
  const focusDistrict = (position: AtlasPosition) => {
    setDetailCenter(position);
    setZoom("landmark");
    focusPosition(position);
  };
  const chooseCivicMode = (mode: WildsAtlasCivicMode) => {
    setSelection(null);
    setDirectory(null);
    setCivicMode(mode);
    setLayers("territories");
  };
  const inspectCity = (cityId: string) => {
    if (builder?.active || riftInFlight.current) return;
    setSelectedCityId(cityId);
    chooseCivicMode("city");
    const city = cities.find(item => item.id === cityId);
    if (city && canInspect(city.anchor.position)) focusDistrict(city.anchor.position);
  };
  const openBuilder = builder && (() => {
    const position = selection?.position ?? (civicMode === "city" ? selectedCity?.anchor.position : undefined) ?? builder.position;
    dismissInspector();
    builder.onOpen();
    if (position && canInspect(position)) {
      builder.onChooseSite(position);
      focusDistrict(position);
    }
  });
  const destination = selection && (selection.landmark ? landmarkApproachPoint(selection.landmark) : selection.position);
  const isTracked = Boolean(destination && trackedDestination?.x === destination.x && trackedDestination.z === destination.z);
  const confirmRift = async () => {
    if (!open || !destination || riftInFlight.current) return;
    riftInFlight.current = true;
    setRiftBusy(true);
    setRiftError("");
    try {
      await onRift(destination);
    } catch (error) {
      setRiftError(error instanceof Error && !error.message.startsWith("wilds_") ? error.message : "Rift couldn’t complete. You can try again.");
    } finally {
      riftInFlight.current = false;
      setRiftBusy(false);
    }
  };
  const panelOpen = Boolean(selection || directory || civicMode || builder?.active);
  const showingDirectory = directory !== null;

  useEffect(() => {
    if (open && panelOpen) inspectorRef.current?.querySelector("h3")?.focus({ preventScroll: true });
  }, [open, panelOpen, selection, showingDirectory, civicMode, builder?.active]);
  useEffect(() => { if (!open || !builder?.active) resetBuildBox(); }, [open, builder?.active]);

  if (typeof document === "undefined") return null;

  return createPortal((
    <div
      aria-labelledby="wilds-world-map-title"
      aria-modal="true"
      aria-hidden={!open}
      className={`wilds-world-map${open ? " is-open" : " is-dormant"}${atlasReady ? " is-ready" : ""}`}
      inert={!open ? true : undefined}
      role="dialog"
    >
      <header className="wilds-world-map-header">
        <div>
          <span className="eyebrow">Living world atlas</span>
          <h2 id="wilds-world-map-title" ref={headingRef} tabIndex={-1}>The Wildz are bigger than the horizon</h2>
        </div>
        <button aria-label="Close world map" className="wilds-world-map-close" disabled={riftBusy} onClick={onClose} type="button">
          <Icons.close aria-hidden="true" size={20} />
        </button>
      </header>

      <div className="wilds-world-map-body">
        <div className="wilds-atlas-stage">
          <WildsAtlasCanvas
            active={open}
            crewMarkers={crewMarkers}
            currentPosition={currentPosition}
            onSelectTerrain={inspectTerrain}
            onSelectLandmark={inspectLandmark}
            buildingPreview={builder?.active ? builder.preview : null}
            onDropBuild={builder?.active && builder.position ? builder.onDropSite : undefined}
            creationPhysical={creationPhysical}
            renderMapLayer={layers === "territories" ? rebased => <WildsAtlasTerritories
              projection={rebased} cities={cities} draft={civicMode === "found" ? draftCells : []}
              selectedId={civicMode === "city" ? selectedCityId : undefined} height={atlasTerrainHeight} onCity={inspectCity} /> : undefined}
            projection={projection}
            qualityProfile={qualityProfile}
            recenterPosition={mapFocus ?? currentPosition}
            detailRecenter={Boolean(builder?.active && builder.position) || civicMode === "found" || civicMode === "city"}
            recenterRequest={recenterRequest}
            northRequest={northRequest}
            fitRequest={fitRequest}
            reducedMotion={reducedMotion}
            onReady={() => setAtlasReady(true)}
            selectedDrop={builder?.active ? builder.position : selection && !selection.landmark ? selection.position : trackedDestination ?? null}
            selectedId={selection?.landmark?.id ?? null}
          />
          <div className="wilds-atlas-controls">
          <div aria-label="Atlas zoom level" className="wilds-atlas-zoom" role="group">
            {zoomLevels.map((level) => (
              <button aria-pressed={zoom === level} key={level} onClick={() => {
                setZoom(level);
                const center = selection?.position ?? currentPosition;
                setDetailCenter(selection ? center : null);
                if (level !== "world") focusPosition(center);
              }} type="button">
                {level}
              </button>
            ))}
          </div>
          <div className="wilds-atlas-world-tools" role="group" aria-label="Living atlas tools">
            <button type="button" aria-pressed={layers === "explore" && !builder?.active && directory !== "activity"} disabled={riftBusy} onClick={() => {
              builder?.onClose();
              dismissInspector();
              setLayers("explore");
            }}>Explore</button>
            <button type="button" aria-pressed={layers === "territories" && !builder?.active} disabled={riftBusy} onClick={() => {
              builder?.onClose();
              chooseCivicMode("territories");
            }}>Territories</button>
            <button type="button" aria-pressed={directory === "activity"} disabled={riftBusy} onClick={() => {
              builder?.onClose();
              dismissInspector();
              setDirectory("activity");
            }}>Changes</button>
            {openBuilder ? <button type="button" aria-pressed={builder?.active} disabled={riftBusy} onClick={openBuilder}>Build mode</button> : null}
          </div>
          <div aria-label="Atlas navigation" className="wilds-atlas-navigation" role="group">
            <button aria-label="Orient map north up" title="North up" onClick={() => setNorthRequest(value => value + 1)} type="button">↑ N</button>
            <button
              aria-label="Center map on your current location"
              onClick={() => { setDetailCenter(null); focusPosition(currentPosition); }}
              type="button"
            >
              <Icons.home aria-hidden="true" size={16} />
              You
            </button>
            <button
              aria-label="Fit all discovered territory"
              onClick={() => {
                setZoom("world");
                setFitRequest((value) => value + 1);
              }}
              type="button"
            >
              <Icons.map aria-hidden="true" size={16} />
              Fit
            </button>
            <WildsMapSharing atlas={explorationAtlas} onImport={atlas => {
              onImportMap(atlas);
              setZoom("world");
              setFitRequest(value => value + 1);
            }} />
          </div>
          </div>
          {trackedDestination ? <div className="wilds-atlas-destination"><Icons.map size={16} aria-hidden="true" /><button className="wilds-atlas-destination-focus" type="button" aria-label="Center map on tracked destination" onClick={() => { setDetailCenter(trackedDestination); focusPosition(trackedDestination); }}><strong>{trackedDestination.label}</strong><small>X {Math.round(trackedDestination.x)} · Z {Math.round(trackedDestination.z)}</small></button><button type="button" aria-label="Clear tracked destination" onClick={onClearDestination}><Icons.close size={16} /></button></div> : null}
          <div className="wilds-atlas-current" aria-label={`Current position X ${Math.round(currentPosition.x)}, Z ${Math.round(currentPosition.z)}`}>
            <Icons.home aria-hidden="true" size={15} />
            <span>You · X {Math.round(currentPosition.x)} · Z {Math.round(currentPosition.z)}</span>
            <i aria-hidden="true" />
            <span>{projection.exactPlayers.length + projection.playerClusters.reduce((sum, cluster) => sum + cluster.count, 0)} live</span>
          </div>
          <details className="wilds-atlas-intelligence" aria-label="Live world">
            <summary>Live world · {crewMarkers.length} roaming</summary>
            <span>Creature expeditions · {crewMarkers.length}</span>
            {crewMarkers.length > 0 ? <ul aria-label="Roaming creatures" style={{ maxHeight: 150, overflowY: "auto", paddingLeft: 16, fontSize: 12 }}>
              {crewMarkers.map(marker => <li key={`${marker.ownerId ?? "self"}:${marker.assetId}`} style={{ color: marker.returning ? "#ffdc87" : marker.remote ? "#65e4ff" : "#d0bfff", marginBottom: 5 }}>
                <strong>{marker.name}</strong>{marker.ownerHandle ? ` · ${marker.ownerHandle}` : ""} · {marker.status}<br />
                X {Math.round(marker.position.x)} · Z {Math.round(marker.position.z)}
              </li>)}
            </ul> : null}
            <strong>{projection.worldAdditions.length} builds · {projection.dynamicSites.length} discoveries</strong>
            <p>Explore real paths. Discover living events. Let every choice become remembered experience.</p>
            <div className="wilds-atlas-mission-meter" role="progressbar" aria-label="Mission progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={missionProgress}>
              <i style={{ width: `${Math.max(0, Math.min(100, missionProgress))}%` }} />
            </div>
            <dl>
              <div><dt>Mission</dt><dd>{missionProgress}%</dd></div>
              <div><dt>Mastery</dt><dd>{worldMastery}%</dd></div>
              <div><dt>Known</dt><dd>{discoveredLandmarkIds.length}</dd></div>
            </dl>
          </details>
          <button type="button" className="wilds-atlas-index" ref={indexButton} aria-controls="wilds-atlas-inspector" aria-expanded={panelOpen} disabled={riftBusy} onClick={() => {
            if (panelOpen) { builder?.onClose(); dismissInspector(); }
            else setDirectory("places");
          }}><Icons.map aria-hidden="true" size={17} /> Explore atlas</button>
          <aside className={`wilds-atlas-inspector${builder?.active ? " is-atlas-build-box" : ""}`} id="wilds-atlas-inspector" ref={inspectorRef} aria-label={builder?.active ? "Build mode" : "Atlas details"} hidden={!panelOpen}>
            {panelOpen ? <>
              <div className="wilds-atlas-inspector-bar">
                {builder?.active ? <h3 tabIndex={-1} className="wilds-atlas-build-grip"
                  onPointerDown={startBuildBoxDrag} onPointerMove={moveBuildBox}
                  onLostPointerCapture={() => { buildBoxDrag.current = null; }}><GripHorizontal size={16} aria-hidden="true" /> Build mode</h3>
                  : <button type="button" onClick={() => { dismissInspector(); setDirectory("places"); }} disabled={riftBusy}>Atlas index</button>}
                <button type="button" aria-label="Close atlas details" disabled={riftBusy} onClick={() => { builder?.onClose(); dismissInspector(); indexButton.current?.focus(); }}><Icons.close aria-hidden="true" size={16} /></button>
              </div>
              {directory ? <WildsAtlasDirectory tab={directory} onTabChange={setDirectory}
                landmarks={WILDS_FLAGSHIP_LANDMARKS.filter(landmark => wildsExplorationContainsWorld(explorationAtlas, landmark.position))}
                projection={projection} crewMarkers={crewMarkers.filter(marker => wildsExplorationContainsWorld(explorationAtlas, marker.position))}
                communities={livingWorld?.communities} cities={cities} onLandmark={inspectLandmark} onCity={inspectCity} canInspect={canInspect}
                onPoint={(label, position) => { inspectPoint(label, position); setDetailCenter(position); focusPosition(position); }} /> : null}
              {civicMode ? <WildsAtlasCivicPanel mode={civicMode} world={livingWorld} cities={cities} selectedCity={selectedCity}
                viewer={viewerOwnerId} anchor={foundingAnchor} draft={draftCells} onBuild={openBuilder} submit={onCivicCommand} canInspect={canInspect} onTogglePlot={togglePlot}
                buildings={selectedCity ? projection.worldAdditions.filter(build => {
                  const plot = wildsCityCellAt(build.position);
                  return selectedCity.cells.some(cell => cell.x === plot.x && cell.z === plot.z);
                }) : []} onFocusBuilding={focusDistrict} onTrackCity={city => onTrackDestination({ label: city.name, ...city.anchor.position })}
                presenceCount={selectedCity ? [currentPosition, ...projection.exactPlayers].filter(position => {
                  const cell = wildsCityCellAt(position);
                  return cell && selectedCity.cells.some(plot => plot.x === cell.x && plot.z === cell.z);
                }).length : 0}
                onMode={chooseCivicMode} onCity={inspectCity} onAnchor={anchor => {
                  setFoundingAnchor(anchor);
                  const first = wildsCityCellAt(anchor.position);
                  setDraftCells(first ? [first] : []);
                  focusDistrict(anchor.position);
                }} onClearDraft={() => {
                  const first = foundingAnchor && wildsCityCellAt(foundingAnchor.position);
                  setDraftCells(first ? [first] : []);
                }} /> : null}
              {selection && destination ? <>
                <div className="wilds-atlas-inspector-scroll" key={selection.landmark?.id ?? "point"}>
                  <p className="wilds-atlas-inspector-kicker">{selection.landmark?.kind === "settlement" ? "Settlement" : selection.landmark ? "Landmark" : "Charted location"}</p>
                  <h3 tabIndex={-1}>{selection.label}</h3>
                  <p>{selection.landmark?.subtitle}</p>
                  <p className="wilds-atlas-inspector-coordinates">X {Math.round(selection.position.x)} · Z {Math.round(selection.position.z)} · {wildsTrailDirection(currentPosition, destination)}</p>
                  {selection.landmark ? <p>{selection.landmark.discovered ? "Discovered" : "Charted · visit to discover"}{selection.landmark.cardRequired ? " · Companion card required to enter" : ""}</p> : null}
                  {selection.landmark?.access.requirements.length ? <div className="wilds-atlas-entry"><h4>Entrance requirements</h4><ul>{selection.landmark.access.requirements.map(rule => <li key={rule.kind}>{rule.label}</li>)}</ul></div> : null}
                  {selection.landmark?.kind === "settlement" ? <WildsAtlasSettlement civic={civic} onFocus={focusDistrict} /> : null}
                </div>
                <div className="wilds-atlas-inspector-actions">
                  {riftError ? <p className="wilds-atlas-rift-error" role="alert">{riftError}</p> : null}
                  <button type="button" disabled={riftBusy} onClick={() => isTracked ? onClearDestination?.() : onTrackDestination({ label: selection.label, ...destination })}>{isTracked ? "Clear tracking" : "Track on foot"}</button>
                  <button type="button" className="wilds-atlas-rift-action" disabled={riftBusy} onClick={confirmRift}>{riftBusy ? "Rifting…" : selection.landmark?.kind === "settlement" ? "Rift to Trail Gate" : "Rift here"}</button>
                </div>
              </> : null}
            </> : null}
            {builder ? <div className="wilds-atlas-inspector-scroll wilds-atlas-build-body" hidden={!builder.active}>{builder.panel}</div> : null}
          </aside>
        </div>

      </div>
    </div>
  ), document.body);
}

// Keep the prepared atlas for quick reopening, but do no projection/scene work
// for gameplay snapshots while hidden. Opening always receives the latest props.
export const WildsWorldMap = memo(WildsWorldMapView, (previous, next) => !previous.open && !next.open);
