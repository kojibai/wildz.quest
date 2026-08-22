"use client";

import { useCallback, useEffect, useMemo, useRef, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import { Icons } from "@/components/icons";
import type { WildzCardSort } from "./card-sort";
import type { PlayState, WildsInput } from "./game-state";
import type { PortableCardAsset } from "./portable-card";
import type { WildsAudioCue } from "./wilds-audio";
import { canRestoreFocus } from "./focus-recovery";
import { projectVaultCompanionRoster } from "./vault-companion-roster";
import { WildsCommandDock, type WildsCommandItem, type WildsCommandKey } from "./WildsCommandDock";
import { WildsCompanionCommand } from "./WildsCompanionCommand";
import { WildzCreatureDrawer } from "./WildzCreatureDrawer";
import { WildzDpad } from "./WildzDpad";
import type { WildsMovementMode } from "./wilds-movement";
import type { WorldOverlayEvent, WorldOverlayOwner, WorldOverlayState } from "./world-overlay-state";
import { WILDS_FLIGHT_RELAUNCH_ENERGY, type WildsAerialMode } from "./wilds-aerial-traversal";
import type { WildsTraversalCapability } from "./wilds-traversal-capabilities";
import type { WildsAquaticPresentation } from "./wilds-aquatic-presentation";
import { projectCreatureCapabilityIdentity } from "./creature-capability-identity";
import { projectWildsTraversalStatus } from "./wilds-traversal-status";
import { WILDS_POWERED_FLIGHT_CRUISE_CLEARANCE, type WildsVerticalTraversalIntent, type WildsVerticalTraversalState } from "./wilds-vertical-traversal";
import { projectWildsFlightObstruction } from "./wilds-flight-obstruction";

const ignore = () => {};
const DEFAULT_VERTICAL_READOUT = { layer: "ground", value: 0, safeMin: 0, safeMax: 0, blockerId: null } as const;

function useStableEvent<Arguments extends unknown[]>(handler: (...args: Arguments) => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return useCallback((...args: Arguments) => handlerRef.current(...args), []);
}

export function WildzWorldControls({
  nearbyCards,
  activeCard,
  companionProgress,
  cardConditions,
  cameraHeadingRef,
  movementMode,
  cardOrder,
  commandItems,
  dismissSignal,
  exclusiveOwner,
  overlayState,
  overlayDispatch,
  gestureCancelSignal,
  newRosterAssetId,
  requestedCommand = null,
  onRequestedCommandHandled = ignore,
  onCardOrderChange,
  onInput,
  onMovementModeChange,
  onSelectCard,
  onRest,
  onAudioCue,
  aerialEnergy,
  aerialMode,
  aquaticPresentation,
  verticalIntentRef: suppliedVerticalIntentRef,
  verticalReadout = DEFAULT_VERTICAL_READOUT,
  traversalCapabilities,
  glideLaunchAvailable,
  onAerialToggle
}: {
  nearbyCards: readonly PortableCardAsset[];
  activeCard: PortableCardAsset | null;
  companionProgress: PlayState["companionProgress"];
  cardConditions: PlayState["adventureConditions"];
  cameraHeadingRef: RefObject<number>;
  movementMode: WildsMovementMode;
  cardOrder: WildzCardSort;
  commandItems: readonly WildsCommandItem[];
  dismissSignal: number;
  exclusiveOwner: WorldOverlayOwner;
  overlayState: WorldOverlayState;
  overlayDispatch: (event: WorldOverlayEvent) => void;
  gestureCancelSignal: number;
  newRosterAssetId: string | null;
  requestedCommand?: WildsCommandKey | null;
  onRequestedCommandHandled?: () => void;
  onCardOrderChange: (order: WildzCardSort) => void;
  onInput: (input: WildsInput) => void;
  onMovementModeChange: (mode: WildsMovementMode) => void;
  onSelectCard: (assetId: string) => void;
  onRest: () => void;
  onAudioCue?: (cue: WildsAudioCue) => void;
  aerialEnergy: number;
  aerialMode: WildsAerialMode;
  aquaticPresentation?: WildsAquaticPresentation;
  verticalIntentRef?: MutableRefObject<WildsVerticalTraversalIntent>;
  verticalReadout?: Readonly<{ layer: WildsVerticalTraversalState["layer"]; value: number; safeMin: number; safeMax: number; blockerId: string | null }>;
  traversalCapabilities: readonly WildsTraversalCapability[];
  glideLaunchAvailable: boolean;
  onAerialToggle: () => void;
}) {
  const changeCardOrder = useStableEvent(onCardOrderChange);
  const fallbackVerticalIntentRef = useRef<WildsVerticalTraversalIntent>(0);
  const verticalIntentRef = suppliedVerticalIntentRef ?? fallbackVerticalIntentRef;
  const selectCard = useStableEvent(onSelectCard);
  const forwardInput = useStableEvent(onInput);
  const changeMovementMode = useStableEvent(onMovementModeChange);
  const rest = useStableEvent(onRest);
  const toggleAerial = useStableEvent(onAerialToggle);
  const requestHandled = useStableEvent(onRequestedCommandHandled);
  const drawerOriginRef = useRef<HTMLElement | null>(null);
  const companionCommandRef = useRef<HTMLButtonElement | null>(null);
  const drawerFocusFrameRef = useRef<number | null>(null);
  const previousDrawerSnapRef = useRef<"closed" | "preview" | "expanded">("closed");
  const pendingDrawerOriginRestoreRef = useRef(false);
  const controlsEnabled = (exclusiveOwner === "none" || exclusiveOwner === "command")
    && (overlayState.exclusiveOwner === "none" || overlayState.exclusiveOwner === "command");
  const panelOpen = exclusiveOwner === "command" && overlayState.panelKey !== null;
  const worldHomesEnabled = exclusiveOwner === "none" && controlsEnabled && !panelOpen;
  const movementHomeBlocked = exclusiveOwner !== "none" || panelOpen;
  const toolsHomeBlocked = exclusiveOwner !== "none" && exclusiveOwner !== "command";
  const companionHomeBlocked = exclusiveOwner !== "none" || panelOpen;
  const controlledDrawerSnap = worldHomesEnabled ? overlayState.drawerSnap : "closed";
  const hasFlight = traversalCapabilities.includes("flight");
  const flightRecharging = hasFlight && aerialMode === "ground" && aerialEnergy < WILDS_FLIGHT_RELAUNCH_ENERGY;
  const flightStatus = !hasFlight
    ? null
    : aerialMode === "flight" && aerialEnergy <= 25
      ? `Flight energy low · ${aerialEnergy}%`
      : aerialMode === "glide" && aerialEnergy === 0
        ? "Flight exhausted · land to recharge"
        : aerialMode === "ground" && aerialEnergy < 100
          ? aerialEnergy < WILDS_FLIGHT_RELAUNCH_ENERGY
            ? `Recharge on the ground · ${aerialEnergy}%`
            : `Flight ready · ${aerialEnergy}%`
          : aerialMode === "flight"
            ? `Flight energy · ${aerialEnergy}%`
            : null;
  const handleInput = useCallback((input: WildsInput) => {
    if (worldHomesEnabled) forwardInput(input);
  }, [forwardInput, worldHomesEnabled]);
  const handleToolsOpenChange = useCallback((open: boolean) => {
    if (!toolsHomeBlocked) overlayDispatch({ type: "tools", open });
  }, [overlayDispatch, toolsHomeBlocked]);
  const handlePanelKeyChange = useCallback((key: WildsCommandKey | null) => {
    if (!toolsHomeBlocked) overlayDispatch({ type: "panel", key });
  }, [overlayDispatch, toolsHomeBlocked]);
  const restoreDrawerOrigin = useCallback(() => {
    if (drawerFocusFrameRef.current !== null) window.cancelAnimationFrame(drawerFocusFrameRef.current);
    drawerFocusFrameRef.current = window.requestAnimationFrame(() => {
      drawerFocusFrameRef.current = null;
      if (canRestoreFocus(drawerOriginRef.current)) drawerOriginRef.current.focus();
    });
  }, []);
  useEffect(() => () => {
    if (drawerFocusFrameRef.current !== null) window.cancelAnimationFrame(drawerFocusFrameRef.current);
  }, []);
  useEffect(() => {
    if (previousDrawerSnapRef.current !== "closed" && controlledDrawerSnap === "closed") {
      pendingDrawerOriginRestoreRef.current = true;
    }
    previousDrawerSnapRef.current = controlledDrawerSnap;
    if (!pendingDrawerOriginRestoreRef.current || !worldHomesEnabled || companionHomeBlocked) return;
    pendingDrawerOriginRestoreRef.current = false;
    restoreDrawerOrigin();
  }, [companionHomeBlocked, controlledDrawerSnap, restoreDrawerOrigin, worldHomesEnabled]);
  const handleDrawerSnapChange = useCallback((snap: "closed" | "preview" | "expanded") => {
    if (companionHomeBlocked) return;
    overlayDispatch({ type: "drawer", snap });
  }, [companionHomeBlocked, overlayDispatch]);
  const handleRequestDrawer = useCallback((snap: "preview" | "expanded") => {
    if (!worldHomesEnabled) return;
    drawerOriginRef.current = companionCommandRef.current;
    overlayDispatch({ type: "drawer", snap });
  }, [overlayDispatch, worldHomesEnabled]);
  const handleSelectCard = useCallback((assetId: string) => {
    if (worldHomesEnabled) selectCard(assetId);
  }, [selectCard, worldHomesEnabled]);
  const handleRest = useCallback(() => {
    if (worldHomesEnabled) rest();
  }, [rest, worldHomesEnabled]);
  const handleTrainCharacter = useCallback((familyId: string) => {
    if (worldHomesEnabled) forwardInput({ type: "train", cardId: familyId, at: new Date().toISOString() });
  }, [forwardInput, worldHomesEnabled]);
  const handleOpenActiveCardInVault = useCallback(() => {
    if (!worldHomesEnabled) return;
    overlayDispatch({ type: "panel", key: "vault" });
  }, [overlayDispatch, worldHomesEnabled]);
  const handleMovementModeChange = useCallback(() => {
    if (worldHomesEnabled) changeMovementMode(movementMode === "walk" ? "run" : "walk");
  }, [changeMovementMode, movementMode, worldHomesEnabled]);
  const handleAerialToggle = useCallback(() => {
    if (worldHomesEnabled) toggleAerial();
  }, [toggleAerial, worldHomesEnabled]);
  const verticalControlsVisible = aerialMode === "flight" || aquaticPresentation?.mode === "swim";
  const stopVerticalIntent = useCallback(() => {
    verticalIntentRef.current = 0;
  }, [verticalIntentRef]);
  const startVerticalIntent = useCallback((intent: WildsVerticalTraversalIntent) => {
    if (worldHomesEnabled && verticalControlsVisible) verticalIntentRef.current = intent;
  }, [verticalControlsVisible, verticalIntentRef, worldHomesEnabled]);
  useEffect(() => {
    if (!worldHomesEnabled || !verticalControlsVisible) stopVerticalIntent();
  }, [stopVerticalIntent, verticalControlsVisible, worldHomesEnabled]);
  useEffect(() => {
    const stop = () => stopVerticalIntent();
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [stopVerticalIntent]);
  useEffect(() => {
    stopVerticalIntent();
  }, [gestureCancelSignal, stopVerticalIntent]);
  const companionRoster = useMemo(() => projectVaultCompanionRoster({
    inventory: nearbyCards,
    companionProgress,
    cardConditions,
    activeAssetId: activeCard?.id ?? null,
    newAssetId: newRosterAssetId
  }), [activeCard?.id, cardConditions, companionProgress, nearbyCards, newRosterAssetId]);
  const activeEntry = companionRoster.find((entry) => entry.active) ?? null;
  const swimSpecialty = useMemo(() => {
    if (!activeCard) return "aquatic movement";
    const specialties = projectCreatureCapabilityIdentity(activeCard).specialties;
    const specialty = specialties.find((candidate) => candidate.family === "swim")
      ?? specialties.find((candidate) => candidate.family === "dive")
      ?? specialties.find((candidate) => candidate.family === "current");
    if (!specialty) return "aquatic movement";
    const family = specialty.family[0]!.toUpperCase() + specialty.family.slice(1);
    return `${family} control ${specialty.control}`;
  }, [activeCard]);
  const aquaticStatus = aquaticPresentation?.mode === "swim" && activeEntry
    ? `Swimming with ${activeEntry.name} · ${swimSpecialty}`
    : aquaticPresentation?.mode === "blocked"
      ? "Deep water · lead with a swimmer"
      : aquaticPresentation?.mode === "wade"
        ? "Shallow water · wading"
        : null;
  const traversalStatus = projectWildsTraversalStatus({
    aerialMode,
    aquaticMode: aquaticPresentation?.mode ?? "land",
    aquaticStatus,
    flightStatus
  });
  const flightObstruction = projectWildsFlightObstruction(verticalReadout.blockerId);
  const clearAirClimb = verticalReadout.layer === "air"
    && aerialMode === "flight"
    && !flightObstruction
    && verticalReadout.value < WILDS_POWERED_FLIGHT_CRUISE_CLEARANCE - .05
      ? Math.max(0, Math.min(100, Math.round(verticalReadout.value / WILDS_POWERED_FLIGHT_CRUISE_CLEARANCE * 100)))
      : null;
  const verticalStatus = verticalReadout.layer === "air"
    ? flightObstruction
      ? `${verticalReadout.value.toFixed(1)} m altitude · ${flightObstruction.label} · ${flightObstruction.guidance}`
      : clearAirClimb !== null
        ? `${verticalReadout.value.toFixed(1)} m altitude · clear-air climb ${clearAirClimb}%`
      : `${verticalReadout.value.toFixed(1)} m altitude · open sky to ${verticalReadout.safeMax.toFixed(1)} m`
    : verticalReadout.layer === "water" && aquaticPresentation
      ? `${verticalReadout.value.toFixed(1)} m deep · safe ${(aquaticPresentation.waterDepth - verticalReadout.safeMax).toFixed(1)}–${(aquaticPresentation.waterDepth - verticalReadout.safeMin).toFixed(1)} m`
      : null;

  useEffect(() => {
    if (requestedCommand && exclusiveOwner !== "none") requestHandled();
  }, [exclusiveOwner, requestHandled, requestedCommand]);

  return (
    <section className={`wildz-world-controls${panelOpen ? " is-panel-open" : ""}`} aria-label="World controls">
      <div aria-hidden={movementHomeBlocked} className="wildz-movement-home" inert={movementHomeBlocked ? true : undefined}>
        <div className="wildz-quick-utilities" aria-label="Quick utilities">
          <button aria-label="Make camp and recover" disabled={!worldHomesEnabled} onClick={handleRest} type="button"><Icons.camp size={20} /></button>
          <button
            aria-label={movementMode === "walk" ? "Switch to running" : "Switch to walking"}
            disabled={!worldHomesEnabled}
            onClick={handleMovementModeChange}
            type="button"
          >
            {movementMode === "walk" ? <Icons.walk size={21} /> : <Icons.run size={21} />}
          </button>
          {(hasFlight || glideLaunchAvailable) ? <button
            aria-label={aerialMode === "ground" ? (hasFlight ? flightRecharging ? `Flight recharging, ${aerialEnergy} percent. Recharge on the ground` : `Take flight, ${aerialEnergy} percent energy` : "Glide from overlook") : `Land safely, ${aerialEnergy} percent flight energy`}
            className={aerialMode !== "ground" ? "is-active wildz-flight-control" : "wildz-flight-control"}
            disabled={!worldHomesEnabled || flightRecharging}
            onClick={handleAerialToggle}
            style={{ "--wildz-flight-energy": `${aerialEnergy}%` } as CSSProperties}
            type="button"
          ><Icons.sparkle size={20} /><i aria-hidden="true" /></button> : null}
          {verticalControlsVisible ? <div aria-label="Vertical traversal controls" className="wildz-vertical-controls">
            <button
              aria-label={verticalReadout.layer === "water" ? "Ascend toward the water surface" : "Ascend"}
              disabled={!worldHomesEnabled}
              onBlur={stopVerticalIntent}
              onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") startVerticalIntent(1); }}
              onKeyUp={stopVerticalIntent}
              onLostPointerCapture={stopVerticalIntent}
              onPointerCancel={stopVerticalIntent}
              onPointerDown={(event) => {
                startVerticalIntent(1);
                try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* intent remains valid without capture */ }
              }}
              onPointerUp={stopVerticalIntent}
              style={{ touchAction: "none" }}
              type="button"
            ><Icons.chevronUp size={18} /></button>
            <button
              aria-label={verticalReadout.layer === "water" ? "Descend toward the seabed" : "Descend"}
              disabled={!worldHomesEnabled}
              onBlur={stopVerticalIntent}
              onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") startVerticalIntent(-1); }}
              onKeyUp={stopVerticalIntent}
              onLostPointerCapture={stopVerticalIntent}
              onPointerCancel={stopVerticalIntent}
              onPointerDown={(event) => {
                startVerticalIntent(-1);
                try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* intent remains valid without capture */ }
              }}
              onPointerUp={stopVerticalIntent}
              style={{ touchAction: "none" }}
              type="button"
            ><Icons.chevronDown size={18} /></button>
          </div> : null}
          {traversalStatus ? <span aria-live="polite" className={`wildz-flight-status wildz-traversal-status${aerialEnergy <= 25 ? " is-low" : ""}`}>{traversalStatus}</span> : null}
          {verticalStatus ? <span aria-live="polite" className="wildz-vertical-status">{verticalStatus}</span> : null}
        </div>
        <WildzDpad
          cameraHeadingRef={cameraHeadingRef}
          cancelSignal={gestureCancelSignal}
          movementMode={movementMode}
          onInput={handleInput}
        />
      </div>

      <div aria-hidden={toolsHomeBlocked} className="wildz-tools-home" inert={toolsHomeBlocked ? true : undefined}>
        <WildsCommandDock
          items={commandItems}
          toolsOpen={controlsEnabled && overlayState.toolsOpen}
          panelKey={controlsEnabled ? overlayState.panelKey : null}
          onToolsOpenChange={handleToolsOpenChange}
          onPanelKeyChange={handlePanelKeyChange}
          requestedKey={exclusiveOwner === "none" ? requestedCommand : null}
          dismissSignal={dismissSignal}
          exclusiveOwner={exclusiveOwner}
          onRequestHandled={requestHandled}
        />
      </div>

      <div aria-hidden={companionHomeBlocked} className="wildz-companion-home" inert={companionHomeBlocked ? true : undefined}>
        <WildzCreatureDrawer
          cardOrder={cardOrder}
          entries={companionRoster}
          onCardOrderChange={changeCardOrder}
          onSelectCard={handleSelectCard}
          snap={controlledDrawerSnap}
          onSnapChange={handleDrawerSnapChange}
        />
        <WildsCompanionCommand
          activeEntry={activeEntry}
          cancelSignal={gestureCancelSignal}
          entries={companionRoster}
          onCommandButtonReady={(button) => { companionCommandRef.current = button; }}
          onRequestDrawer={handleRequestDrawer}
          onTrainCharacter={handleTrainCharacter}
          onRecoverCharacter={handleRest}
          onViewInVault={handleOpenActiveCardInVault}
          onAudioCue={worldHomesEnabled ? onAudioCue : undefined}
          onSelectCard={handleSelectCard}
        />
      </div>
    </section>
  );
}
