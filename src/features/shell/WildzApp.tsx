"use client";
import { hasLaterWildsPlayerLedger } from "@/features/play/wilds-play-state-source";
import { isCurrentWildzGameplaySource } from "../identity/wildz-gameplay-source";
import { validateWildsRoamingHandoffCard } from "../../lib/receiz/wilds-roaming-handoff";
import { pruneWildzCrewCustody } from "../../lib/receiz/wildz-artifact-codec";

import { emitWildsPlaytestEvent } from "@/features/play/wilds-playtest-events";
import { wildsCardArtwork } from "@/features/play/wilds-card-artwork";
import { WildzMarketSheet } from "@/features/market/WildzMarketSheet";
import { WildzProfileSheet } from "@/features/profile/WildzProfileSheet";
import { PlayCampaign } from "@/features/play/PlayCampaign";
import { generateIdentityBoundWildzCharacter, type WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import { applyWildsInput, createOwnerBoundInitialPlayState, initialPlayState, type PlayState } from "@/features/play/game-state";
import type { PortableCardAsset } from "@/features/play/portable-card";
import {
  createWildsPlayerVault,
  mergeWildsPlayerPlayStates
} from "@/features/play/wilds-player-vault";
import {
  wildzVaultUploadDisposition,
  type WildzCardOnlyConfirmation
} from "@/features/identity/wildz-restore";
import {
  locallyClaimedWildzAssetIds,
  locallyTransferredWildzAssetIds,
  recordLocalWildzOwnershipTransfer,
  removeWildzAssetsFromActiveVault
} from "@/features/identity/wildz-ownership-reconciliation";
import {
  defaultWildzProofSourceRepository,
  bootstrapWildzContinuity,
  reopenWildzContinuityCrewCustody,
  commitWildzArtifactContinuity,
  alignWildzContinuityWithProofSession,
  claimWildzProfileIdentity,
  connectWildzProofSession,
  downloadWildzIdentityPlayerCard,
  downloadWildzIdentityOwnedCard,
  prepareWildzBackgroundPlayerVault,
  savePreparedWildzIdentityPlayerVault,
  type WildzPreparedIdentityPlayerVault,
  isWildzIdentityActivationInspection,
  prepareWildzRestore,
  restoreWildzFileForSurface,
  resumePendingWildzVault,
  prepareWildzIdentityOwnedCard,
  savePreparedWildzIdentityOwnedCard,
  matchesPreparedWildzIdentityOwnedCard,
  saveWildzContinuityPlayState,
  type WildzContinuitySnapshot,
  type WildzRestoreIntent,
  type WildzPreparedRestore,
  type WildzUiArtifactRestore
} from "@/lib/receiz/wildz-identity-adapter";
import { shouldClearWildzResumeAfterError } from "@/lib/receiz/wildz-resume-errors";
import { startWildzLiveOwnershipRefresh, WILDZ_OWNERSHIP_REFRESH_EVENT } from "@/features/identity/wildz-live-ownership";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import {
  WILDZ_OWNERSHIP_RECONCILE_MAX_ASSETS
} from "@/lib/receiz/wildz-ownership-reconcile";
import {
  admitWildzVaultProofObjects,
  deriveWildzVaultCardAdmission
} from "@/lib/receiz/wildz-vault-card-admission";
import {
  bootstrapWildzSharedWorld,
  wildzProofSessionGeneration,
  wildzRemoteSessionMatchesIdentity
} from "@/lib/receiz/wildz-session-bridge";
import { publishWildsWorldWithIdentityProof } from "@/lib/receiz/wilds-world-identity-publication";
import {
  createWildzPlayStatePersistenceCoordinator,
  type WildzPlayStatePersistenceCoordinator
} from "@/lib/receiz/wildz-play-state-persistence";
import { createOwnerPublicWildzProfile, sanitizePublicWildzProfile } from "@/features/profile/public-profile";
import {
  fetchPublicWildzProfile,
  publishCurrentWildzProfile,
  wildzProfilePublicationReadiness
} from "@/lib/receiz/wildz-profile-adapter";
import type { WildzOverlay } from "@/features/shell/wildz-overlay";
import { usePublicCardPublisher } from "@/features/play/use-public-card-publisher";
import { startWildzProfilePublication, wildzProfilePublicationDisposition, type ProfilePublicationStatus } from "@/features/profile/background-publication";
import type { ProfilePublicationFailure } from "@/features/profile/publication-failure";
import { downloadBlob } from "@/features/play/card-export";
import { downloadRestoredWildzCard } from "@/lib/receiz/wildz-upload-card-download";
import { publishWildzProfileWithIdentityProof } from "@/lib/receiz/wildz-profile-identity-publication";
import { startWildzSessionReconnect } from "@/lib/receiz/wildz-session-reconnect";
import { openWildzArtifactSameOrigin } from "@/lib/receiz/wildz-same-origin-verifier";
import { canRestoreFocus } from "@/features/play/focus-recovery";
import type { WildzPlayerStateRecord } from "@/lib/receiz/wildz-player-state-sync";
import { wildzGameplayBackground } from "@/lib/performance/wildz-gameplay-background";
import { wildzPlayerStateSerializer } from "@/lib/performance/wildz-player-state-serializer";
import { wildzJsonSerializer } from "@/lib/performance/wildz-json-serializer";
import { projectWildzContinuityExplorer } from "@/features/play/wildz-explorer-proof";
import type { WildsWorldProjection } from "@/features/play/wilds-world-state";
import {
  clearWildzPendingInventoryCheckpoint,
  clearWildzRuntimeCheckpoint,
  prepareWildzRuntimeCheckpoint,
  readWildzRuntimeCheckpoint,
  writeWildzPendingInventoryCheckpoint,
  writePreparedWildzRuntimeCheckpoint,
  writeWildzRuntimeCheckpoint
} from "@/features/play/wildz-runtime-checkpoint";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const loadWildzProfileSheet = () => import("@/features/profile/WildzProfileSheet").then((module) => module.WildzProfileSheet);
const loadWildzVaultSheet = () => import("@/features/profile/WildzVaultSheet").then((module) => module.WildzVaultSheet);
const loadWildzMarketSheet = () => import("@/features/market/WildzMarketSheet").then((module) => module.WildzMarketSheet);
const WildzVaultSheet = dynamic(loadWildzVaultSheet, { ssr: false });


type PendingPlayStateSave = {
  snapshot: WildzContinuitySnapshot;
  playState: PlayState;
  previousInventory?: PlayState["inventory"];
  playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>;
};

function playerVaultInputFromSnapshot(
  snapshot: WildzContinuitySnapshot,
  playState: PlayState,
  exportedAt = new Date().toISOString()
) {
  const playerContinuity = snapshot.playerContinuity;
  return {
    playerId: snapshot.session.username ?? snapshot.session.actorId,
    exportedAt,
    playState,
    character: snapshot.character,
    settings: playerContinuity?.settings ?? {
      avatarStyle: snapshot.character?.gender ?? null,
      movementMode: "walk",
      audio: {},
      cardOrder: "rarity"
    },
    personalEvents: playerContinuity?.personalEvents ?? [],
    canonicalCursor: playerContinuity?.canonicalCursor ?? { worldId: "wilds:global:v3", revision: 0, eventId: null },
    receipts: playerContinuity?.receipts ?? []
  };
}

function clearWildzAuthQuery() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.delete("wildzResume");
  searchParams.delete("receiz");
  searchParams.delete("receiz_error");
  const next = `${url.pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

export function WildzApp({ initialOverlay = null }: { initialOverlay?: WildzOverlay }) {
  const [overlay, setOverlay] = useState<WildzOverlay>(initialOverlay);
  const shellOverlayRef = useRef<HTMLElement | null>(null);
  const shellOverlayOriginRef = useRef<HTMLElement | null>(null);
  const shellFocusFrameRef = useRef<number | null>(null);
  const priorShellOverlayOpenRef = useRef(Boolean(initialOverlay));
  const [identityActivationRevision, setIdentityActivationRevision] = useState(0);
  const [paintedWorldKey, setPaintedWorldKey] = useState<string | null>(null);
  const [continuity, setContinuity] = useState<WildzContinuitySnapshot | null>(null);
  const continuityRef = useRef<WildzContinuitySnapshot | null>(null);
  const playerStateSyncTimerRef = useRef<number | null>(null);
  const playerStateSyncInFlightRef = useRef(false);
  const playerStateSyncQueuedRef = useRef<WildzContinuitySnapshot | null>(null);
  const playerStateMutationRef = useRef(0);
  const playerStateSourceTimesRef = useRef(new WeakMap<WildzContinuitySnapshot, { mutation: number; exportedAt: string }>());
  const playerStateSubmittedMutationRef = useRef(0);
  const lastRemotePlayerDigestRef = useRef("");
  const adoptingRemotePlayStateRef = useRef<PlayState | null>(null);
  const playStateSaveSchedulerRef = useRef<WildzPlayStatePersistenceCoordinator<PendingPlayStateSave> | null>(null);

  useEffect(() => {
    let active = true;
    void wildzGameplayBackground.run(async () => {
      if (!active) return;
      await Promise.all([loadWildzProfileSheet(), loadWildzVaultSheet(), loadWildzMarketSheet()]);
    }, { timeoutMs: 2_500 }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!playStateSaveSchedulerRef.current) {
    playStateSaveSchedulerRef.current = createWildzPlayStatePersistenceCoordinator({
      delayMs: 400,
      stagePendingVault: ({ snapshot, playState, previousInventory }: PendingPlayStateSave) => {
        writeWildzPendingInventoryCheckpoint(window.localStorage, {
          keyId: snapshot.session.keyId,
          actorId: snapshot.session.actorId,
          playState,
          previousInventory
        });
      },
      writeRuntime: async ({ snapshot, playState }: PendingPlayStateSave) => {
        const prepared = prepareWildzRuntimeCheckpoint({
          keyId: snapshot.session.keyId,
          actorId: snapshot.session.actorId,
          playState
        });
        const serialized = await wildzJsonSerializer.serialize(prepared.checkpoint);
        await wildzGameplayBackground.run(() => {
          const latest = continuityRef.current;
          if (!latest || !isCurrentWildzGameplaySource(latest, snapshot)
            || (latest.playState && hasLaterWildsPlayerLedger(latest.playState, playState))) return;
          if (serialized) {
            writePreparedWildzRuntimeCheckpoint(window.localStorage, { key: prepared.key, serialized });
          } else {
            writeWildzRuntimeCheckpoint(window.localStorage, {
              keyId: snapshot.session.keyId,
              actorId: snapshot.session.actorId,
              playState
            });
          }
        }, { timeoutMs: 1_200 });
      },
      writeVault: async ({ snapshot, playState, playerContinuity }: PendingPlayStateSave) => {
        const saved = await saveWildzContinuityPlayState(
          snapshot,
          playState,
          playerContinuity,
          snapshot.character
        );
        if (saved) {
          clearWildzPendingInventoryCheckpoint(window.localStorage, {
            keyId: snapshot.session.keyId,
            actorId: snapshot.session.actorId,
            expectedInventory: playState.inventory
          });
        }
      }
    });
  }
  const [character, setCharacter] = useState<WildzCharacterGenesis | null>(null);
  const genesisInFlightRef = useRef<string | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [proofSessionConnected, setProofSessionConnected] = useState(false);
  const [proofSessionGeneration, setProofSessionGeneration] = useState("");
  const [worldBootstrap, setWorldBootstrap] = useState<{
    projection: WildsWorldProjection;
    mode: "receiz_live" | "kai_live";
  } | null>(null);
  const [remoteProfile, setRemoteProfile] = useState<ReturnType<typeof sanitizePublicWildzProfile> | null>(null);
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "publishing" | "ready" | "unpublished" | "missing" | "error">("idle");
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const publishedProfileRef = useRef("");
  const [ownerPublicationStatus, setOwnerPublicationStatus] = useState<ProfilePublicationStatus>("unpublished");
  const [ownerPublicationFailure, setOwnerPublicationFailure] = useState<ProfilePublicationFailure | null>(null);
  const [profileRetryRevision, setProfileRetryRevision] = useState(0);
  const retryProfilePublicationRef = useRef<(() => void) | null>(null);
  const identity = continuity?.session ?? null;
  const campaignExplorer = useMemo(() => continuity ? projectWildzContinuityExplorer(continuity) : null, [continuity]);
  const campaignCharacter = campaignExplorer?.character ?? null;
  const profilePublicationReadiness = wildzProfilePublicationReadiness({
    hasIdentity: Boolean(identity),
    hasCharacter: Boolean(character ?? campaignCharacter),
    proofSessionConnected,
    localSigningAvailable: identity?.localAuthority === "verified"
  });
  const ownerPlayState = useMemo(
    () => continuity?.playState ?? (identity ? createOwnerBoundInitialPlayState(identity.actorId, identity.createdAt) : initialPlayState),
    [continuity?.playState, identity]
  );
  const publishableOwnerAssets = useMemo(() => {
    if (!identity || typeof window === "undefined") return ownerPlayState.inventory;
    const locallyClaimed = new Set(locallyClaimedWildzAssetIds(
      window.localStorage,
      identity.actorId,
      ownerPlayState.inventory.map((asset) => asset.id)
    ));
    return ownerPlayState.inventory.filter((asset) => !locallyClaimed.has(asset.id));
  }, [identity, ownerPlayState.inventory]);
  const ownerUsername = identity?.username ?? identity?.actorId ?? "explorer";
  const ownerActorId = identity?.actorId;
  const admittedVault = useMemo(() => ownerActorId ? admitWildzVaultProofObjects({
    cards: ownerPlayState.inventory,
    playerHandle: ownerActorId
  }) : null, [ownerActorId, ownerPlayState.inventory]);
  const vaultAdmission = admittedVault?.admission ?? null;
  const admittedProofObjects = admittedVault?.proofObjects;
  // Card proofs can publish independently of explorer/profile/session readiness.
  usePublicCardPublisher(publishableOwnerAssets, Boolean(identity), admittedProofObjects, continuity?.crewCustody, identity?.username ?? identity?.actorId);
  const viewingOwnProfile = !overlay
    || overlay.kind !== "profile"
    || (overlay.mode !== "public" && overlay.username.toLowerCase() === `@${ownerUsername}`.toLowerCase());
  const ownerSourceProfile = useMemo(() => createOwnerPublicWildzProfile({
    username: ownerUsername,
    displayName: identity?.displayName ?? undefined,
    avatarImageUrl,
    explorer: character ?? campaignCharacter,
    assets: ownerPlayState.inventory
  }), [avatarImageUrl, character, campaignCharacter, identity?.displayName, ownerPlayState.inventory, ownerUsername]);
  useEffect(() => {
    let cancelled = false;
    // Prepare one preview at a time before Profile is opened, yielding between cards.
    void (async () => {
      for (const asset of ownerPlayState.inventory) {
        if (cancelled) return;
        await wildzGameplayBackground.run(() => { if (!cancelled) wildsCardArtwork(asset); });
      }
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [ownerPlayState.inventory]);
  // Publish the same complete local collection shown in the owner’s profile.
  const publishablePublicProfile = ownerSourceProfile;
  // Equal public content must not cancel a request when gameplay saves replace object references.
  const profilePublicationKey = useMemo(() => `${identity?.keyId ?? ""}:${JSON.stringify(publishablePublicProfile)}`,
    [identity?.keyId, publishablePublicProfile]);
  const profilePublicationRequestRef = useRef({
    key: profilePublicationKey,
    profile: publishablePublicProfile,
    assets: ownerPlayState.inventory,
    proofObjects: admittedProofObjects
  });
  profilePublicationRequestRef.current = {
    key: profilePublicationKey,
    profile: publishablePublicProfile,
    assets: ownerPlayState.inventory,
    proofObjects: admittedProofObjects
  };
  const shellOverlayOwner = overlay?.kind === "profile" ? "profile" : overlay?.kind === "market" ? "market" : "none";

  const openShellOverlay = useCallback((next: Exclude<WildzOverlay, null>, fallbackOrigin?: HTMLElement | null) => {
    if (next.kind === "profile" || next.kind === "market") emitWildsPlaytestEvent(next.kind, "start");
    shellOverlayOriginRef.current = fallbackOrigin
      ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setOverlay(next);
  }, []);
  const closeShellOverlay = useCallback(() => setOverlay(null), []);

  useEffect(() => {
    if (overlay?.kind !== "profile" && overlay?.kind !== "market") return;
    const action = overlay.kind;
    let completed = false;
    let timer: number | undefined;
    // A task after rAF gives the committed panel a rendering opportunity before completion.
    // This measures panel presentation, not background publication or data hydration.
    const frame = window.requestAnimationFrame(() => {
      timer = window.setTimeout(() => {
        completed = true;
        emitWildsPlaytestEvent(action, "success");
      }, 0);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (timer !== undefined) window.clearTimeout(timer);
      if (!completed) emitWildsPlaytestEvent(action, "failure");
    };
  }, [overlay]);

  useEffect(() => {
    const wasOpen = priorShellOverlayOpenRef.current;
    priorShellOverlayOpenRef.current = Boolean(overlay);
    if (!overlay) {
      if (!wasOpen) return;
      if (shellFocusFrameRef.current !== null) window.cancelAnimationFrame(shellFocusFrameRef.current);
      shellFocusFrameRef.current = window.requestAnimationFrame(() => {
        shellFocusFrameRef.current = null;
        const origin = shellOverlayOriginRef.current;
        if (canRestoreFocus(origin)) origin.focus();
      });
      return;
    }

    const focusable = () => Array.from(shellOverlayRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter(canRestoreFocus);
    const focusFirst = () => focusable()[0]?.focus();
    if (shellFocusFrameRef.current !== null) window.cancelAnimationFrame(shellFocusFrameRef.current);
    shellFocusFrameRef.current = window.requestAnimationFrame(() => {
      shellFocusFrameRef.current = null;
      focusFirst();
    });
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !shellOverlayRef.current?.contains(event.target)) focusFirst();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (shellOverlayRef.current?.querySelector("[data-profile-card-viewer]")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeShellOverlay();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !shellOverlayRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !shellOverlayRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("focusin", containFocus);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeShellOverlay, overlay]);

  useEffect(() => () => {
    if (shellFocusFrameRef.current !== null) window.cancelAnimationFrame(shellFocusFrameRef.current);
  }, []);

  const acceptSnapshot = useCallback((snapshot: WildzContinuitySnapshot) => {
    snapshot = { ...snapshot, crewCustody: pruneWildzCrewCustody(snapshot.crewCustody, snapshot.session.actorId, snapshot.playState?.inventory ?? []) };
    const previous = continuityRef.current;
    continuityRef.current = snapshot;
    setContinuity(snapshot);
    setCharacter(snapshot.character);
    if (!previous || !sameWildzPlayerCoordinate(previous.session.actorId, snapshot.session.actorId)) {
      playerStateMutationRef.current = 0;
      playerStateSubmittedMutationRef.current = 0;
      lastRemotePlayerDigestRef.current = "";
      setProofSessionConnected(false);
      setProofSessionGeneration("");
    }
  }, []);

  useEffect(() => {
    const snapshot = continuityRef.current;
    if (!snapshot || snapshot.crewCustody) return;
    let disposed = false;
    void reopenWildzContinuityCrewCustody(snapshot).then(custody => {
      const current = continuityRef.current;
      if (disposed || !custody || !current || current.session.keyId !== snapshot.session.keyId
        || current.session.actorId !== snapshot.session.actorId || current.restoreEpoch !== snapshot.restoreEpoch) return;
      acceptSnapshot({ ...current, crewCustody: pruneWildzCrewCustody(custody, current.session.actorId, current.playState?.inventory ?? []) });
    }).catch(() => undefined);
    return () => { disposed = true; };
  }, [identity?.keyId, identity?.actorId, continuity?.restoreEpoch, acceptSnapshot]);

  useEffect(() => {
    if (!identity) return;
    setAvatarImageUrl(window.localStorage.getItem(`wildz:profile-avatar:${identity.keyId}`));
  }, [identity]);

  useEffect(() => {
    const scheduler = playStateSaveSchedulerRef.current;
    if (!scheduler) return;
    let exitPreservationStarted = false;
    const flush = () => { void scheduler.flush().catch(() => undefined); };
    const flushLatestRuntimeCheckpoint = () => {
      if (exitPreservationStarted) return;
      exitPreservationStarted = true;
      const current = continuityRef.current;
      if (current?.playState) {
        try {
          writeWildzRuntimeCheckpoint(window.localStorage, {
            keyId: current.session.keyId,
            actorId: current.session.actorId,
            playState: current.playState
          });
        } catch {
          // The debounced durable path remains queued if browser storage is unavailable.
        }
      }
      flush();
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        flushLatestRuntimeCheckpoint();
      } else {
        // A background/foreground cycle is not a page exit. Permit the next
        // real exit to preserve any gameplay performed after returning.
        exitPreservationStarted = false;
      }
    };
    window.addEventListener("pagehide", flushLatestRuntimeCheckpoint);
    window.addEventListener("wildz:preserve-state", flushLatestRuntimeCheckpoint);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushLatestRuntimeCheckpoint);
      window.removeEventListener("wildz:preserve-state", flushLatestRuntimeCheckpoint);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      flushLatestRuntimeCheckpoint();
    };
  }, []);

  useEffect(() => {
    if (!identity || !vaultAdmission) return;
    let active = true;
    const reconnect = startWildzSessionReconnect({ connect: () =>
      connectWildzProofSession(identity, { vaultAdmission }).then(async (session) => {
        if (!active || !wildzRemoteSessionMatchesIdentity(identity, session)) {
          if (active) { setProofSessionConnected(false); setProofSessionGeneration(""); }
          return false;
        }
        setProofSessionConnected(true);
        setProofSessionGeneration(wildzProofSessionGeneration(session));
        void bootstrapWildzSharedWorld().then(async (world) => {
          let admitted = world;
          if (world.publication?.required === "identity_proof" && identity.localAuthority === "verified") {
            await publishWildsWorldWithIdentityProof(identity, world.publication.draft);
            admitted = await bootstrapWildzSharedWorld();
          }
          if (active) setWorldBootstrap({ projection: admitted.projection as WildsWorldProjection, mode: admitted.mode });
        }).catch(() => undefined);
        const current = continuityRef.current;
        if (!current
          || current.session.keyId !== identity.keyId
          || current.session.actorId !== identity.actorId) return false;
        const aligned = await alignWildzContinuityWithProofSession(current, session);
        if (!active) return false;
        const stillCurrent = continuityRef.current;
        if (!stillCurrent
          || stillCurrent.session.keyId !== identity.keyId
          || stillCurrent.session.actorId !== identity.actorId) return false;
        if (aligned !== current && stillCurrent.restoreEpoch === current.restoreEpoch) {
          acceptSnapshot({ ...stillCurrent, session: aligned.session });
        }
        setProofSessionConnected(true);
        setProofSessionGeneration(wildzProofSessionGeneration(session));
        return true;
      }).catch(() => {
        if (active) { setProofSessionConnected(false); setProofSessionGeneration(""); }
        return false;
      })
    });
    window.addEventListener("online", reconnect.wake);
    return () => {
      active = false;
      reconnect.stop();
      window.removeEventListener("online", reconnect.wake);
    };
  }, [acceptSnapshot, identity, vaultAdmission, identityActivationRevision]);

  useEffect(() => {
    setOwnerPublicationFailure(null);
    retryProfilePublicationRef.current = null;
    const publicationKey = profilePublicationKey;
    const disposition = wildzProfilePublicationDisposition(publicationKey, publishedProfileRef.current, profilePublicationReadiness === "ready");
    if (disposition !== "publish") {
      setOwnerPublicationStatus(disposition === "confirmed" ? "ready" : "unpublished");
      return;
    }
    const publication = startWildzProfilePublication({
      isOnline: () => navigator.onLine !== false,
      schedule: (task) => wildzGameplayBackground.run(task),
      onStatus: (status) => {
        if (status === "ready") publishedProfileRef.current = publicationKey;
        setOwnerPublicationStatus(status);
        if (status !== "unpublished") setOwnerPublicationFailure(null);
      },
      onFailure: setOwnerPublicationFailure,
      publish: (signal, progress) => {
        // Each retry sees current proof data without interrupting an equivalent in-flight request.
        const profilePublicationRequest = profilePublicationRequestRef.current;
        return publishCurrentWildzProfile(profilePublicationRequest.profile, profilePublicationRequest.assets, globalThis.fetch, {
          signal,
          onProgress: progress,
          confirmExisting: true,
          proofObjects: profilePublicationRequest.proofObjects,
          // A connected proof session is not necessarily a delegated registry
          // write token. Publish the complete collection with the active seal,
          // just as world bootstrap signs an identity-proof publication draft.
          // Standalone card indexing must never gate this source projection.
          publishSourceProfile: identity?.localAuthority === "verified"
            ? (profile, assets, signal) => publishWildzProfileWithIdentityProof(profile, { assets, signal })
            : undefined,
          prepareBody: async (value) => await wildzJsonSerializer.serialize(value)
            ?? wildzGameplayBackground.run(() => JSON.stringify(value))
        });
      }
    });
    retryProfilePublicationRef.current = publication.wake;
    window.addEventListener("online", publication.wake);
    return () => {
      window.removeEventListener("online", publication.wake);
      publication.stop();
      if (retryProfilePublicationRef.current === publication.wake) retryProfilePublicationRef.current = null;
    };
  }, [profilePublicationReadiness, profilePublicationKey, proofSessionConnected, proofSessionGeneration, identityActivationRevision, profileRetryRevision, identity?.localAuthority, identity?.remoteStatus]);

  useEffect(() => {
    if (overlay?.kind !== "profile") {
      setRemoteProfile(null);
      setProfileStatus("idle");
      return;
    }
    let active = true;
    if (viewingOwnProfile) {
      setRemoteProfile(ownerSourceProfile);
      return () => { active = false; };
    }
    setRemoteProfile(null);
    setProfileStatus("loading");
    void fetchPublicWildzProfile(overlay.username).then((profile) => {
      if (!active) return;
      setRemoteProfile(profile);
      setProfileStatus(profile ? "ready" : "missing");
    }).catch(() => {
      if (active) setProfileStatus("error");
    });
    return () => { active = false; };
  }, [overlay, ownerSourceProfile, viewingOwnProfile]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const resumeId = searchParams.get("wildzResume");
      if (resumeId) {
        try {
          const resumed = await resumePendingWildzVault(resumeId);
          if (!active) return;
          clearWildzAuthQuery();
          acceptSnapshot({
            session: resumed.restore.session,
            playState: resumed.restore.playState,
            character: resumed.restore.character,
            playerContinuity: resumed.restore.playerContinuity,
            crewCustody: resumed.restore.crewCustody,
            restoreEpoch: resumed.restore.restoreEpoch
          });
          return;
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : "wildz_restore_invalid";
          const clearResume = shouldClearWildzResumeAfterError(code);
          clearWildzAuthQuery();
          setIdentityError(code === "wildz_restore_resume_missing"
            ? "That Vault restore expired. Upload the Vault image again to continue."
            : code === "wildz_restore_v4_unavailable"
              ? "Receiz proof verification is temporarily unavailable. Upload the Vault again when the connection returns."
              : clearResume
                ? "The proof-sealed Vault could not be restored. Upload it again to retry."
                : "Wildz could not finish the staged Vault restore. Nothing was changed; upload it again to retry.");
        }
      } else if (searchParams.has("receiz") || searchParams.has("receiz_error")) {
        clearWildzAuthQuery();
      }
      const snapshot = await bootstrapWildzContinuity(window.localStorage);
      if (!active) return;
      const checkpointBaseline = snapshot.playState ?? createOwnerBoundInitialPlayState(
        snapshot.session.actorId,
        snapshot.session.createdAt
      );
      snapshot.playState = readWildzRuntimeCheckpoint(window.localStorage, {
        keyId: snapshot.session.keyId,
        actorId: snapshot.session.actorId,
        playState: checkpointBaseline
      });
      acceptSnapshot(snapshot);
      if (snapshot.playState.inventory !== checkpointBaseline.inventory && snapshot.playerContinuity) {
        void saveWildzContinuityPlayState(
          snapshot,
          snapshot.playState,
          snapshot.playerContinuity,
          snapshot.character
        ).then((saved) => {
          if (!saved) return;
          clearWildzPendingInventoryCheckpoint(window.localStorage, {
            keyId: snapshot.session.keyId,
            actorId: snapshot.session.actorId,
            expectedInventory: snapshot.playState!.inventory
          });
        }).catch(() => undefined);
      }
    };
    void initialize().catch((cause) => {
      if (active) setIdentityError(cause instanceof Error ? cause.message : "Unable to prepare your Receiz ID.");
    });
    return () => { active = false; };
  }, [acceptSnapshot]);

  const completeGenesis = useCallback(async (next: WildzCharacterGenesis) => {
    const current = continuityRef.current;
    if (!current) return;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId, current.session.createdAt);
    const playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]> = {
      settings: {
        avatarStyle: next.gender,
        movementMode: current.playerContinuity?.settings.movementMode ?? "walk",
        audio: current.playerContinuity?.settings.audio ?? {},
        cardOrder: current.playerContinuity?.settings.cardOrder ?? "rarity"
      },
      personalEvents: current.playerContinuity?.personalEvents ?? [],
      canonicalCursor: current.playerContinuity?.canonicalCursor ?? { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: current.playerContinuity?.receipts ?? []
    };
    const snapshot: WildzContinuitySnapshot = { ...current, playState, character: next, playerContinuity };
    try {
      await saveWildzContinuityPlayState(snapshot, playState, playerContinuity, next);
      acceptSnapshot(snapshot);
    } catch {
      setIdentityError("Your explorer could not be saved. Try again before closing Wildz.");
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    if (!identity?.createdAt || character || genesisInFlightRef.current === identity.keyId) return;
    genesisInFlightRef.current = identity.keyId;
    const next = generateIdentityBoundWildzCharacter(identity);
    void completeGenesis(next).finally(() => {
      if (continuityRef.current?.character === null) genesisInFlightRef.current = null;
    });
  }, [character, completeGenesis, identity]);

  const saveProfileIdentity = async (input: { username: string; displayName: string; avatarImageUrl: string | null }) => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_identity_missing");
    const snapshot = await claimWildzProfileIdentity(current, input);
    if (input.avatarImageUrl) window.localStorage.setItem(`wildz:profile-avatar:${snapshot.session.keyId}`, input.avatarImageUrl);
    else window.localStorage.removeItem(`wildz:profile-avatar:${snapshot.session.keyId}`);
    setAvatarImageUrl(input.avatarImageUrl);
    publishedProfileRef.current = "";
    acceptSnapshot(snapshot);
    const canonicalHandle = `@${snapshot.session.username ?? snapshot.session.actorId}`;
    setRemoteProfile((profile) => profile ? sanitizePublicWildzProfile({
      ...profile,
      username: canonicalHandle,
      displayName: input.displayName,
      avatarImageUrl: input.avatarImageUrl
    }) : profile);
    setOverlay({ kind: "profile", username: canonicalHandle });
  };

  const saveIdentityCard = async () => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_identity_missing");
    if (current.session.localAuthority !== "verified") throw new Error("wildz_identity_card_authority_required");
    const playerContinuity = current.playerContinuity;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId, current.session.createdAt);
    const player: Parameters<typeof createWildsPlayerVault>[0] = {
      playerId: current.session.username ?? current.session.actorId,
      exportedAt: new Date().toISOString(),
      playState,
      character: current.character,
      settings: playerContinuity?.settings ?? {
        avatarStyle: current.character?.gender ?? null,
        movementMode: "walk",
        audio: {},
        cardOrder: "rarity"
      },
      personalEvents: playerContinuity?.personalEvents ?? [],
      canonicalCursor: playerContinuity?.canonicalCursor ?? { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: playerContinuity?.receipts ?? []
    };
    await downloadWildzIdentityPlayerCard(current.session, playState.inventory, player);
  };

  const saveIdentitySeal = async () => {
    emitWildsPlaytestEvent("identity-save", "start");
    try {
      const current = continuityRef.current;
      if (!current) throw new Error("wildz_identity_missing");
      if (current.session.localAuthority !== "verified") throw new Error("wildz_identity_seal_authority_required");
      await saveIdentityCard();
      emitWildsPlaytestEvent("identity-save", "success");
    } catch (error) {
      emitWildsPlaytestEvent("identity-save", "failure");
      throw error;
    }
  };

  const preparedCombinedVault = useRef<{ snapshot: WildzContinuitySnapshot; artifact: WildzPreparedIdentityPlayerVault } | null>(null);
  const [combinedVaultPreparing, setCombinedVaultPreparing] = useState(false);
  const buildCombinedVault = useCallback((current: WildzContinuitySnapshot, allowPrompt: boolean) => {
    const playerContinuity = current.playerContinuity;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId, current.session.createdAt);
    const player: Parameters<typeof createWildsPlayerVault>[0] = {
      playerId: current.session.username ?? current.session.actorId,
      exportedAt: new Date().toISOString(),
      playState,
      character: current.character,
      settings: playerContinuity?.settings ?? {
        avatarStyle: current.character?.gender ?? null,
        movementMode: "walk",
        audio: {},
        cardOrder: "rarity"
      },
      personalEvents: playerContinuity?.personalEvents ?? [],
      canonicalCursor: playerContinuity?.canonicalCursor ?? { worldId: "wilds:global:v3", revision: 0, eventId: null },
      receipts: playerContinuity?.receipts ?? []
    };
    return prepareWildzBackgroundPlayerVault(current.session, playState.inventory, player, { allowPrompt });
  }, []);

  const combinedVaultJob = useRef<{ snapshot: WildzContinuitySnapshot; promise: Promise<WildzPreparedIdentityPlayerVault> } | null>(null);
  const combinedVaultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sameVaultSnapshot = (left: WildzContinuitySnapshot, right: WildzContinuitySnapshot) =>
    left.session.keyId === right.session.keyId && left.playState === right.playState
    && left.playerContinuity === right.playerContinuity && left.character === right.character;
  const prepareCombinedVault = useCallback((current: WildzContinuitySnapshot, allowPrompt: boolean) => {
    const held = preparedCombinedVault.current;
    if (held && sameVaultSnapshot(held.snapshot, current)) return Promise.resolve(held.artifact);
    const pending = combinedVaultJob.current;
    if (pending && sameVaultSnapshot(pending.snapshot, current)) return pending.promise;
    // Serialize preparations so a burst of additions cannot build concurrent backups.
    const promise = (pending ? pending.promise.catch(() => undefined) : Promise.resolve()).then(() => buildCombinedVault(current, allowPrompt));
    const job = { snapshot: current, promise };
    combinedVaultJob.current = job;
    void promise.then(artifact => {
      if (continuityRef.current?.session.keyId === current.session.keyId) preparedCombinedVault.current = { snapshot: current, artifact };
    }).catch(() => {}).finally(() => {
      if (combinedVaultJob.current === job) combinedVaultJob.current = null;
    });
    return promise;
  }, [buildCombinedVault]);
  const scheduleCombinedVault = useCallback(() => {
    if (combinedVaultTimer.current !== null) clearTimeout(combinedVaultTimer.current);
    // Coalesce state changes; this callback never hashes or traverses cards.
    combinedVaultTimer.current = setTimeout(() => {
      combinedVaultTimer.current = null;
      const current = continuityRef.current;
      if (current?.playState?.inventory.length) void prepareCombinedVault(current, false).catch(() => {});
    }, 750);
  }, [prepareCombinedVault]);
  useEffect(() => {
    scheduleCombinedVault();
  }, [continuity, scheduleCombinedVault]);
  useEffect(() => () => {
    if (combinedVaultTimer.current !== null) clearTimeout(combinedVaultTimer.current);
  }, []);

  const saveCombinedVault = async () => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_identity_missing");
    const held = preparedCombinedVault.current;
    if (held && sameVaultSnapshot(held.snapshot, current)) {
      // No await precedes the native sheet: preserve the Save tap on iOS.
      await savePreparedWildzIdentityPlayerVault(held.artifact);
      return;
    }
    if (combinedVaultTimer.current !== null) clearTimeout(combinedVaultTimer.current);
    combinedVaultTimer.current = null;
    setCombinedVaultPreparing(true);
    try {
      let artifact: WildzPreparedIdentityPlayerVault;
      try { artifact = await prepareCombinedVault(current, false); }
      catch (error) {
        if (!(error instanceof Error) || error.message !== "wildz_identity_passphrase_required") throw error;
        if (combinedVaultJob.current?.snapshot === current) combinedVaultJob.current = null;
        artifact = await prepareCombinedVault(current, true);
      }
      if (continuityRef.current?.session.keyId !== current.session.keyId) throw new Error("wildz_identity_changed");
      await savePreparedWildzIdentityPlayerVault(artifact);
    } finally { setCombinedVaultPreparing(false); }
  };

  const restoreArtifact = useCallback(async (
    file: File,
    surface: "genesis" | "card-vault",
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState,
    intent: WildzRestoreIntent = surface === "genesis" ? "activate-identity" : "merge-vault",
    prepared?: WildzPreparedRestore,
    roamingCaptureCard?: PortableCardAsset
  ): Promise<WildzUiArtifactRestore> => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    const outcome = await restoreWildzFileForSurface(
      file,
      surface,
      confirmCardOnly,
      current,
      currentPlayState ?? current.playState,
      intent,
      prepared,
      roamingCaptureCard
    );
    if (roamingCaptureCard) {
      const latest = continuityRef.current;
      if (!latest || latest.session.keyId !== current.session.keyId || latest.session.actorId !== current.session.actorId
        || latest.restoreEpoch !== current.restoreEpoch)
        throw new Error("The capture was saved for its keeper. Its downloaded artifact can be reopened in that account.");
    }
    const next = commitWildzArtifactContinuity(outcome);
    clearWildzRuntimeCheckpoint(window.localStorage, {
      keyId: outcome.session.keyId,
      actorId: outcome.session.actorId
    });
    clearWildzPendingInventoryCheckpoint(window.localStorage, {
      keyId: outcome.session.keyId,
      actorId: outcome.session.actorId
    });
    // Restoring a seal is an explicit authority refresh. Even for the same
    // actor, do not let an older confirmation suppress global publication.
    if (intent === "activate-identity" || current.session.keyId !== outcome.session.keyId || current.session.actorId !== outcome.session.actorId) {
      publishedProfileRef.current = "";
    }
    if (intent === "activate-identity") setIdentityActivationRevision(revision => revision + 1);
    acceptSnapshot(next);
    if (intent === "merge-vault" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("receiz:wildz:ownership:v119");
      channel.postMessage({ ownerActorId: outcome.session.actorId, assetIds: outcome.verifiedAssetIds });
      channel.close();
    }
    return outcome;
  }, [acceptSnapshot]);

  const restoreRoamingCapture = useCallback(async (file: File, currentCard: PortableCardAsset, currentPlayState: PlayState) => {
    const current = continuityRef.current;
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Claim already committed remotely. Preserve its exact successor before any
    // verification, account switch, retention or local restore can fail.
    downloadBlob(new Blob([bytes.slice().buffer], { type: file.type }), file.name);
    const sidecar = structuredClone(currentCard);
    if (!current) throw new Error("wildz_restore_identity_missing");
    const opened = await openWildzArtifactSameOrigin({ bytes, mimeType: file.type, name: file.name });
    if (opened.compatibility !== "current-native" || !opened.ownershipWitness
      || !sameWildzPlayerCoordinate(opened.ownerReceizId, current.session.actorId)
      || !sameWildzPlayerCoordinate(opened.ownershipWitness.ownerReceizId, current.session.actorId))
      throw new Error("The captured artifact did not verify for this keeper.");
    validateWildsRoamingHandoffCard(opened.payloadBytes, sidecar);
    await defaultWildzProofSourceRepository.retain({ bytes, filename: file.name, mimeType: file.type, assetId: sidecar.id });
    const prepared = await prepareWildzRestore(file);
    const latest = continuityRef.current;
    if (!latest || latest.session.keyId !== current.session.keyId || latest.session.actorId !== current.session.actorId
      || latest.restoreEpoch !== current.restoreEpoch)
      throw new Error("The captured artifact was downloaded. Reopen its keeper account to restore it.");
    return restoreArtifact(file, "card-vault", true, latest.playState ?? currentPlayState, "merge-vault", prepared, sidecar);
  }, [restoreArtifact]);

  const activateIdentitySeal = useCallback(async (file: File) => {
    const prepared = await prepareWildzRestore(file);
    if (!isWildzIdentityActivationInspection(prepared.inspection)) {
      throw new Error("wildz_identity_seal_required");
    }
    const outcome = await restoreArtifact(
      file,
      "card-vault",
      false,
      continuityRef.current?.playState ?? undefined,
      "activate-identity",
      prepared
    );

    const restored = continuityRef.current;
    if (!restored
      || restored.session.keyId !== outcome.session.keyId
      || restored.session.actorId !== outcome.session.actorId) {
      throw new Error("wildz_identity_activation_failed");
    }

    setOverlay({ kind: "profile", username: `@${outcome.session.username ?? outcome.session.actorId}` });
    // Identity and Vault admission changes are reconciled by the shared
    // connection effect. Starting a second admission/alignment pass here made
    // Seal imports perform the same hash, network, and persistence work twice.
  }, [restoreArtifact]);

  const claimAndRestoreVaultArtifact = useCallback(async (
    file: File,
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState
  ): Promise<WildzUiArtifactRestore> => {
    const prepared = await prepareWildzRestore(file);
    const inspection = prepared.inspection;
    if (inspection.kind === "invalid"
      || inspection.kind === "unsupported"
      || inspection.kind === "retirement-quarantine") throw new Error(inspection.code);
    if (inspection.kind !== "card-vault" && inspection.kind !== "commerce-vault") {
      throw new Error("Choose a sealed card or Vault image here. Identity Seals activate from Profile.");
    }
    const confirmed = typeof confirmCardOnly === "function" ? await confirmCardOnly() : confirmCardOnly;
    if (!confirmed) throw new Error("wildz_restore_confirmation_required");

    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    const disposition = wildzVaultUploadDisposition(inspection, current.session.actorId);
    const artifactAssetIds = inspection.assets.map((asset) => asset.id);
    if (disposition === "merge-owned" || disposition === "restore-portable") {
      const outcome = await restoreArtifact(file, "card-vault", true, currentPlayState, "merge-vault", prepared);
      if (artifactAssetIds.length === 1) {
        try {
          await downloadRestoredWildzCard(outcome, artifactAssetIds[0]!, {
            prepare: prepareWildzIdentityOwnedCard,
            download: downloadBlob
          });
        } catch {
          throw new Error("Your card was added to the Vault, but its automatic download could not start. Use Save on the card to download it.");
        }
      }
      return outcome;
    }
    // Foreign custody changes only after native Record -> Seal succeeds. Awaiting
    // this action keeps rendering live and avoids restoring/resealing twice.
    const { authorizeWildsWalletReadWithIdentity } = await import("@/features/play/wallet/wilds-wallet-read-authorization");
    if (!await authorizeWildsWalletReadWithIdentity(current.session.keyId, undefined, "artifact-claim")) {
      throw new Error("Receiz could not authorize this card claim. Your existing Vault is unchanged.");
    }
    const stableName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64) || "artifact";
    const response = await fetch("/api/market/claims", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: {
        "content-type": file.type || "application/octet-stream",
        "idempotency-key": `bearer:${file.size}:${file.lastModified}:${stableName}`.slice(0, 160),
        "x-wildz-artifact-filename": encodeURIComponent(file.name)
      },
      body: prepared.bytes.slice()
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(failure?.error ?? "Receiz did not complete this ownership claim. Keep the original artifact and retry.");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "application/octet-stream";
    const filename = /filename="([^"\\]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "wildz-claimed.receized";
    const opened = await openWildzArtifactSameOrigin({ bytes, mimeType, name: filename });
    const expectedDigest = response.headers.get("x-receiz-artifact-sha256");
    if (!expectedDigest || opened.artifactSha256 !== expectedDigest
      || !opened.ownershipWitness
      || !sameWildzPlayerCoordinate(opened.ownerReceizId, current.session.actorId)) {
      throw new Error("The returned ownership artifact did not verify for this account.");
    }
    // Preserve the exact committed artifact even if the user changed accounts
    // while the network operation was completing.
    downloadBlob(new Blob([bytes.slice().buffer], { type: mimeType }), filename);
    if (!sameWildzPlayerCoordinate(continuityRef.current?.session.actorId ?? "", current.session.actorId)) {
      throw new Error("Ownership was claimed by the original account. Its artifact was downloaded; reopen that account to restore it.");
    }
    // Index only single-card native custody. A multi-card Vault must never become
    // a claimable per-creature source; its existing restore/save path is unchanged.
    if (artifactAssetIds.length === 1) await defaultWildzProofSourceRepository.retain({
      bytes, filename, mimeType, assetId: artifactAssetIds[0]!
    });
    const claimedFile = new File([bytes.slice().buffer], filename, { type: mimeType });
    const outcome = await restoreArtifact(claimedFile, "card-vault", true, undefined, "merge-vault");
    recordLocalWildzOwnershipTransfer(window.localStorage, outcome.session.actorId, artifactAssetIds,
      opened.ownershipWitness.witnessedAt,
      response.headers.get("x-wildz-ownership-sync") === "admitted" ? "published" : "pending");
    return outcome;
  }, [restoreArtifact]);

  const claimBearerArtifact = useCallback(async (file: File): Promise<number | null> => {
    if (!window.confirm(
      "Claim this complete bearer artifact? This creates and downloads a new Receiz ownership artifact; the original witnessed history is preserved."
    )) return null;
    const outcome = await claimAndRestoreVaultArtifact(
      file,
      true,
      continuityRef.current?.playState ?? undefined
    );
    return outcome.verifiedAssetIds.length;
  }, [claimAndRestoreVaultArtifact]);

  const admitRemotePlayerState = useCallback(async (record: WildzPlayerStateRecord | null) => {
    if (!record || record.sourceDigest === lastRemotePlayerDigestRef.current) return;
    const current = continuityRef.current;
    if (!current?.playState || !sameWildzPlayerCoordinate(current.session.actorId, record.playerId)) return;
    if (!hasLaterWildsPlayerLedger(record.player.playState, current.playState)) return;
    const playState = mergeWildsPlayerPlayStates({
      local: current.playState,
      restored: record.player.playState,
      actorId: current.session.actorId
    });
    const snapshot: WildzContinuitySnapshot = {
      ...current,
      playState,
      character: record.player.character ?? current.character,
      playerContinuity: {
        settings: record.player.settings,
        personalEvents: record.player.personalEvents,
        canonicalCursor: record.player.canonicalCursor,
        receipts: record.player.receipts
      }
    };
    lastRemotePlayerDigestRef.current = record.sourceDigest;
    adoptingRemotePlayStateRef.current = playState;
    acceptSnapshot(snapshot);
    writeWildzRuntimeCheckpoint(window.localStorage, {
      keyId: snapshot.session.keyId,
      actorId: snapshot.session.actorId,
      playState
    });
    await saveWildzContinuityPlayState(
      snapshot,
      playState,
      snapshot.playerContinuity!,
      snapshot.character
    ).catch(() => null);
  }, [acceptSnapshot]);

  const queueGlobalPlayerStateSync = useCallback((snapshot: WildzContinuitySnapshot) => {
    if (!proofSessionConnected || !snapshot.playState || !snapshot.playerContinuity) return;
    playerStateSyncQueuedRef.current = snapshot;
    if (playerStateSyncTimerRef.current !== null || playerStateSyncInFlightRef.current) return;
    playerStateSyncTimerRef.current = window.setTimeout(() => {
      playerStateSyncTimerRef.current = null;
      const queued = playerStateSyncQueuedRef.current;
      playerStateSyncQueuedRef.current = null;
      if (!queued?.playState || !queued.playerContinuity) return;
      if (queued.session.keyId !== continuityRef.current?.session.keyId) return;
      const source = playerStateSourceTimesRef.current.get(queued);
      // Retries carry the original gameplay timestamp and mutation, not retry time.
      if (!source) return;
      const mutationAtSubmit = source.mutation;
      const projectionInput = playerVaultInputFromSnapshot(queued, queued.playState, source.exportedAt);
      playerStateSyncInFlightRef.current = true;
      void wildzPlayerStateSerializer.serialize(projectionInput).then((workerBody) => workerBody
        ?? wildzGameplayBackground.run(() => {
          const player = createWildsPlayerVault(projectionInput);
          return JSON.stringify({ player });
        }, { timeoutMs: 1_500 })).then((body) => fetch("/api/wilds/player-state", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body
      })).then(async (response) => {
        const result = await response.json().catch(() => null) as { ok?: boolean; record?: WildzPlayerStateRecord | null } | null;
        if (!response.ok || !result?.ok || !result.record
          || queued.session.keyId !== continuityRef.current?.session.keyId) return;
        playerStateSubmittedMutationRef.current = Math.max(playerStateSubmittedMutationRef.current, mutationAtSubmit);
        if (playerStateMutationRef.current === mutationAtSubmit) await admitRemotePlayerState(result.record);
      }).catch(() => undefined).finally(() => {
        playerStateSyncInFlightRef.current = false;
        const latest = playerStateSyncQueuedRef.current;
        if (latest) {
          queueGlobalPlayerStateSync(latest);
        } else if (playerStateMutationRef.current > playerStateSubmittedMutationRef.current) {
          const current = continuityRef.current;
          if (current?.playState && current.playerContinuity) {
            playerStateSyncQueuedRef.current = current;
            playerStateSyncTimerRef.current = window.setTimeout(() => {
              playerStateSyncTimerRef.current = null;
              const latest = continuityRef.current;
              if (latest) queueGlobalPlayerStateSync(latest);
            }, 12_500);
          }
        }
      });
    }, 2_500);
  }, [admitRemotePlayerState, proofSessionConnected]);

  useEffect(() => {
    if (!proofSessionConnected || !identity) return;
    let active = true;
    let inFlight = false;
    let timer: number | null = null;
    const schedule = (delayMs: number) => {
      if (!active || timer !== null || document.visibilityState !== "visible" || navigator.onLine === false) return;
      timer = window.setTimeout(() => {
        timer = null;
        void pull();
      }, delayMs);
    };
    const pull = async () => {
      if (!active || document.visibilityState !== "visible"
        || inFlight
        || playerStateMutationRef.current !== playerStateSubmittedMutationRef.current) {
        schedule(5_000);
        return;
      }
      inFlight = true;
      const mutationAtRead = playerStateMutationRef.current;
      await fetch("/api/wilds/player-state", {
        credentials: "same-origin",
        cache: "no-store"
      }).then(async (response) => {
        const result = await response.json().catch(() => null) as { ok?: boolean; record?: WildzPlayerStateRecord | null } | null;
        if (active && response.ok && result?.ok && result.record
          && playerStateMutationRef.current === mutationAtRead
          && playerStateMutationRef.current === playerStateSubmittedMutationRef.current) {
          await admitRemotePlayerState(result.record);
        }
      }).catch(() => undefined).finally(() => {
        inFlight = false;
        schedule(5_000);
      });
    };
    void pull();
    const onVisibility = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      if (document.visibilityState === "visible" && navigator.onLine !== false) void pull();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      active = false;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [admitRemotePlayerState, identity, proofSessionConnected]);

  useEffect(() => () => {
    if (playerStateSyncTimerRef.current !== null) window.clearTimeout(playerStateSyncTimerRef.current);
  }, []);

  const persistPlayState = useCallback((playState: PlayState, playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>, source: WildzContinuitySnapshot) => {
    const current = continuityRef.current;
    if (!current || !isCurrentWildzGameplaySource(current, source)) return;
    if (adoptingRemotePlayStateRef.current === playState) {
      adoptingRemotePlayStateRef.current = null;
      continuityRef.current = { ...current, playerContinuity };
      return;
    }
    const cardTruthChanged = current.playState?.inventory === playState.inventory
      ? false
      : (() => {
          const previousCardPins = current.playState?.inventory.map((asset) => `${asset.id}:${asset.proof.digest}`) ?? [];
          const nextCardPins = playState.inventory.map((asset) => `${asset.id}:${asset.proof.digest}`);
          return previousCardPins.length !== nextCardPins.length
            || previousCardPins.some((pin, index) => pin !== nextCardPins[index]);
        })();
    const worldTruthChanged = current.playState?.ownedWorldAdditions !== playState.ownedWorldAdditions;
    const identityTruthChanged = cardTruthChanged || worldTruthChanged;
    const snapshot = { ...current, playState, playerContinuity, crewCustody: current.playState?.inventory === playState.inventory ? current.crewCustody : pruneWildzCrewCustody(current.crewCustody, current.session.actorId, playState.inventory) };
    continuityRef.current = snapshot;
    scheduleCombinedVault();
    if (cardTruthChanged) {
      setContinuity(snapshot);
    }
    const pendingSave = {
      snapshot,
      playState,
      previousInventory: cardTruthChanged ? current.playState?.inventory : undefined,
      playerContinuity
    };
    playStateSaveSchedulerRef.current?.schedule(pendingSave, {
      durableChanged: identityTruthChanged,
      inventoryChanged: cardTruthChanged
    });
    playerStateMutationRef.current += 1;
    playerStateSourceTimesRef.current.set(snapshot, {
      mutation: playerStateMutationRef.current,
      exportedAt: new Date().toISOString()
    });
    queueGlobalPlayerStateSync(snapshot);
  }, [queueGlobalPlayerStateSync, scheduleCombinedVault]);

  const removeLostVaultAssets = useCallback((assetIds: readonly string[]) => {
    const current = continuityRef.current;
    if (!current?.playState || !current.playerContinuity) return;
    const reconciled = removeWildzAssetsFromActiveVault(current.playState, assetIds);
    if (reconciled === current.playState) return;
    const snapshot = { ...current, playState: reconciled };
    acceptSnapshot(snapshot);
    playStateSaveSchedulerRef.current?.schedule({
      snapshot,
      playState: reconciled,
      previousInventory: current.playState.inventory,
      playerContinuity: current.playerContinuity
    }, true);
  }, [acceptSnapshot]);

  const admitPurchasedMarketAsset = useCallback((asset: PortableCardAsset) => {
    const current = continuityRef.current;
    if (!current?.playState || !current.playerContinuity) throw new Error("wildz_market_vault_unavailable");
    const playState = applyWildsInput(current.playState, { type: "import-card", asset });
    const admitted = playState.inventory.find((candidate) => candidate.id === asset.id);
    if (!admitted || admitted.proof.digest !== asset.proof.digest) throw new Error("wildz_market_asset_admission_failed");
    const snapshot = { ...current, playState };
    acceptSnapshot(snapshot);
    playStateSaveSchedulerRef.current?.schedule({
      snapshot,
      playState,
      previousInventory: current.playState.inventory,
      playerContinuity: current.playerContinuity
    }, true);
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("receiz:wildz:ownership:v119");
      channel.postMessage({ ownerActorId: current.session.actorId, assetIds: [asset.id] });
      channel.close();
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    const current = continuityRef.current;
    const assetIds = current?.playState?.inventory.map((asset) => asset.id) ?? [];
    if (!current || !assetIds.length) return;
    const locallyLost = locallyTransferredWildzAssetIds(window.localStorage, current.session.actorId, assetIds);
    if (locallyLost.length) removeLostVaultAssets(locallyLost);
  }, [removeLostVaultAssets, continuity?.session.actorId, continuity?.playState?.inventory]);

  useEffect(() => {
    if (!proofSessionConnected) return;
    let disposed = false;
    let reconcileInFlight = false;
    let controller: AbortController | null = null;

    const reconcileActiveVaultOwnership = async () => {
      if (disposed || reconcileInFlight) return;
      const current = continuityRef.current;
      const activeAssetIds = current?.playState?.inventory.map((asset) => asset.id) ?? [];
      const pendingBearerClaims = new Set(current
        ? locallyClaimedWildzAssetIds(window.localStorage, current.session.actorId, activeAssetIds)
        : []);
      const assetIds = activeAssetIds
        .filter((assetId) => !pendingBearerClaims.has(assetId))
        .slice(0, WILDZ_OWNERSHIP_RECONCILE_MAX_ASSETS);
      if (!current || !assetIds.length) return;
      const requestedActorId = current.session.actorId;
      reconcileInFlight = true;
      controller = new AbortController();
      try {
        const response = await fetch("/api/market/ownership/reconcile", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetIds }),
          signal: controller.signal
        });
        const result = await response.json().catch(() => null) as {
          status?: unknown;
          lostAssetIds?: unknown;
        } | null;
        if (disposed
          || !response.ok
          || result?.status !== "ready"
          || !Array.isArray(result.lostAssetIds)
          || result.lostAssetIds.some((id) => typeof id !== "string" || !assetIds.includes(id))
          || !sameWildzPlayerCoordinate(continuityRef.current?.session.actorId ?? "", requestedActorId)) return;
        removeLostVaultAssets(result.lostAssetIds as string[]);
      } catch {
        // Sync unavailability changes no local custody; the visible world retries.
      } finally {
        reconcileInFlight = false;
        controller = null;
      }
    };
    const stop = startWildzLiveOwnershipRefresh({
      refresh: reconcileActiveVaultOwnership, visibility: document, notifications: window,
      setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval
    });
    return () => {
      disposed = true;
      stop();
      controller?.abort();
    };
  }, [proofSessionConnected, identity?.keyId, identity?.actorId, removeLostVaultAssets]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("receiz:wildz:ownership:v119");
    channel.addEventListener("message", (event: MessageEvent<unknown>) => {
      const message = event.data as { ownerActorId?: unknown; assetIds?: unknown } | null;
      if (!message || typeof message.ownerActorId !== "string" || !Array.isArray(message.assetIds)
        || message.assetIds.some((id) => typeof id !== "string")) return;
      const current = continuityRef.current;
      if (!current?.playState || sameWildzPlayerCoordinate(current.session.actorId, message.ownerActorId)) return;
      // A broadcast is a location hint, never proof that the sender owns a card.
      window.dispatchEvent(new Event(WILDZ_OWNERSHIP_REFRESH_EVENT));
    });
    return () => channel.close();
  }, [removeLostVaultAssets]);

  const worldKey = identity ? `${identity.keyId}:${identity.actorId}:${identityActivationRevision}` : null;
  const worldPainted = worldKey !== null && paintedWorldKey === worldKey;
  return (
    <main className="wildz-app-shell" data-wildz-active-username={ownerUsername}>
      <div aria-hidden={overlay ? true : undefined} className="wildz-app" data-overlay={overlay?.kind ?? "world"} inert={overlay ? true : undefined}>
        {continuity && identity && campaignCharacter ? <PlayCampaign
          key={`${identity.keyId}:${identity.actorId}:${identityActivationRevision}`}
          onWorldReady={() => setPaintedWorldKey(worldKey)}
          worldVisible={worldPainted}
          campaignName="Wildz"
          character={campaignCharacter}
          enabled={true}
          interactionEnabled={Boolean(campaignCharacter)}
          networkEnabled={Boolean(character) && proofSessionConnected}
          walletAuthorityGeneration={proofSessionGeneration || identity.keyId}
          walletIdentityKey={identity.actorId}
          walletReadIdentityKey={identity.localAuthority === "verified" ? identity.keyId : undefined}
          walletPublicUsername={identity.username ?? null}
          initialState={ownerPlayState}
          initialPlayerContinuity={continuity.playerContinuity}
          crewCustody={continuity.crewCustody}
          initialWorld={worldBootstrap}
          ownerReceizId={ownerUsername}
          playerDisplayName={identity.displayName ?? `@${ownerUsername}`}
          shellOverlayOwner={shellOverlayOwner}
          onPlayStateChange={(playState, playerContinuity) => persistPlayState(playState, playerContinuity, continuity)}
          onPrepareCard={(asset, player) => prepareWildzIdentityOwnedCard(identity, asset, player, { allowPrompt: false })}
          onExportCard={(asset, player, prepared) => prepared && matchesPreparedWildzIdentityOwnedCard(prepared, identity, asset)
            ? savePreparedWildzIdentityOwnedCard(prepared)
            : downloadWildzIdentityOwnedCard(identity, asset, player())}
          onExportVault={() => saveCombinedVault()}
          vaultAdmission={vaultAdmission}
          onRestoreArtifact={claimAndRestoreVaultArtifact}
          onRestoreRoamingCapture={restoreRoamingCapture}
          onOpenProfile={(origin) => openShellOverlay({ kind: "profile", username: `@${ownerUsername}` }, origin)}
          onOpenMarket={(origin) => openShellOverlay({ kind: "market" }, origin)}
          onListAsset={async (asset, priceCents) => {
            if (!proofSessionConnected) return null;
            const headResponse = await fetch("/api/market/listings", { method: "GET", credentials: "same-origin", cache: "no-store" });
            const headResult = await headResponse.json().catch(() => null) as { status?: unknown; head?: { revision?: unknown; appendAnchorId?: unknown } } | null;
            const head = headResult?.head;
            if (!headResponse.ok || headResult?.status !== "ready" || !head || !Number.isInteger(head.revision)
              || (head.appendAnchorId !== null && typeof head.appendAnchorId !== "string")) return null;
            const expectedRevision = Number(head.revision);
            const expectedAppendAnchorId = head.appendAnchorId as string | null;
            const idempotencyKey = `list:${ownerUsername}:${asset.id}:${asset.proof.digest.slice(7, 23)}`;
            const response = await fetch("/api/market/listings", {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
              body: JSON.stringify({ asset, priceCents, expectedRevision, expectedAppendAnchorId })
            });
            if (!response.ok) return null;
            return { ...asset, status: "listed" as const, synchronizedAt: new Date().toISOString() };
          }}
        /> : null}
        {!worldPainted && <div className="wildz-identity-loading" role="status">
          <Image src="/brand/wildz-mark.svg" alt="" width={64} height={64} priority />
          <span>{identityError || "Preparing your Receiz ID…"}</span>
        </div>}
      </div>

      <div className="wildz-brand-corner" aria-label="Wildz">
        <Image src="/brand/wildz-mark.svg" alt="" width={42} height={42} priority />
        <span>WILDZ</span>
      </div>

      {identity && worldPainted ? <nav aria-hidden={overlay ? true : undefined} className="wildz-utility-dock" inert={overlay ? true : undefined} aria-label="Wildz utilities">
        <button type="button" onClick={() => openShellOverlay({ kind: "profile", username: `@${ownerUsername}` })} aria-label="Open player profile">◉</button>
        <button type="button" onClick={() => openShellOverlay({ kind: "vault" })} aria-label="Open public Vault">◇</button>
        <button type="button" onClick={() => openShellOverlay({ kind: "market" })} aria-label="Open player market">↝</button>
      </nav> : null}

      {overlay ? (
        <section className="wildz-shell-overlay" ref={shellOverlayRef} role="dialog" aria-modal="true" aria-label={`${overlay.kind} panel`}>
          <button type="button" className="wildz-overlay-dismiss" onClick={closeShellOverlay} aria-label="Return to world">
            <span aria-hidden="true">×</span>
          </button>
          {overlay.kind === "profile" ? (viewingOwnProfile ? ownerSourceProfile : remoteProfile) ? <WildzProfileSheet
            profile={(viewingOwnProfile ? ownerSourceProfile : remoteProfile)!}
            vaultAssets={viewingOwnProfile ? ownerPlayState.inventory : undefined}
            publicationStatus={viewingOwnProfile && ownerPublicationStatus !== "ready" ? "local" : "published"}
            shareEnabled={!viewingOwnProfile || ownerPublicationStatus === "ready"}
            publicationFailure={viewingOwnProfile ? ownerPublicationFailure?.message : undefined}
            onRetryPublication={viewingOwnProfile && profilePublicationReadiness === "ready" ? () => {
              // A retry must be a new publication lifecycle. Waking a worker
              // that already completed can otherwise be a silent no-op.
              publishedProfileRef.current = "";
              setOwnerPublicationFailure(null);
              setProfileRetryRevision((revision) => revision + 1);
            } : undefined}
            publicationMessage={viewingOwnProfile ? ownerPublicationStatus === "ready" ? "Profile is live" : ownerPublicationStatus === "publishing" ? "Syncing profile in the background" : !proofSessionConnected && identity?.localAuthority !== "verified" ? "Saved here · publishes automatically when connected with your Identity Seal" : !(character ?? campaignCharacter) ? "Saved here · publishes after your explorer is ready" : "Saved here · syncing will retry automatically" : undefined}
            publishing={ownerPublicationStatus === "publishing"}
            editable={viewingOwnProfile}
            signingAvailable={identity?.localAuthority === "verified"}
            onAuthenticateIdentitySeal={activateIdentitySeal}
            onSaveIdentitySeal={saveIdentitySeal}
            onSaveProfile={saveProfileIdentity}
          /> : <div className="wildz-shell-overlay-placeholder" role="status">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{profileStatus === "loading" ? "Finding explorer…" : "Explorer unavailable"}</strong>
            <span>{profileStatus === "missing" || profileStatus === "unpublished" ? "This Wildz profile has not been published yet." : profileStatus === "error" ? "Receiz profile recovery is temporarily unavailable." : "Preparing profile"}</span>
          </div> : overlay.kind === "vault" ? <WildzVaultSheet
            cards={ownerSourceProfile.vault}
            title="Card Vault"
            onAddVault={async (file) => {
              const outcome = await claimAndRestoreVaultArtifact(file, () => window.confirm(
                "Claim and combine every verified card from this Vault? Receiz will create and download a new ownership artifact; the original history stays preserved."
              ), continuityRef.current?.playState ?? undefined);
              return outcome.verifiedAssetIds.length;
            }}
            onClaimBearer={proofSessionConnected ? claimBearerArtifact : undefined}
            onSaveVault={saveCombinedVault}
            savePreparing={combinedVaultPreparing}
          /> : overlay.kind === "market" ? <WildzMarketSheet
            listings={[]}
            buyer={`@${ownerUsername}`}
            connected={proofSessionConnected}
            onSettlement={admitPurchasedMarketAsset}
          /> : <div className="wildz-shell-overlay-placeholder">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{overlay.kind}</strong>
            <span>Wildz surface loading</span>
          </div>}
        </section>
      ) : null}
    </main>
  );
}
