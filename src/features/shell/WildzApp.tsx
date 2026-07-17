"use client";

import { PlayCampaign } from "@/features/play/PlayCampaign";
import { WildzGenesis } from "@/features/identity/WildzGenesis";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import { createOwnerBoundInitialPlayState, initialPlayState, type PlayState } from "@/features/play/game-state";
import type { WildzCardOnlyConfirmation } from "@/features/identity/wildz-restore";
import {
  bootstrapWildzContinuity,
  alignWildzContinuityWithProofSession,
  connectWildzProofSession,
  createNamedWildzIdentity,
  downloadWildzIdentityPlayerVault,
  restoreWildzFileForSurface,
  resumePendingWildzVault,
  saveWildzContinuityPlayState,
  type WildzContinuitySnapshot,
  type WildzUiArtifactRestore
} from "@/lib/receiz/wildz-identity-adapter";
import { shouldClearWildzResumeAfterError } from "@/lib/receiz/wildz-resume-errors";
import {
  bootstrapWildzSharedWorld,
  wildzRemoteSessionMatchesIdentity
} from "@/lib/receiz/wildz-session-bridge";
import {
  createLatestOnlySaveScheduler,
  type WildzLatestSaveScheduler
} from "@/lib/receiz/wildz-save-scheduler";
import { sanitizePublicWildzProfile } from "@/features/profile/public-profile";
import {
  fetchPublicWildzProfile,
  publishCurrentWildzProfile
} from "@/lib/receiz/wildz-profile-adapter";
import { WildzProfileSheet } from "@/features/profile/WildzProfileSheet";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";
import { WildzMarketSheet } from "@/features/market/WildzMarketSheet";
import type { WildzOverlay } from "@/features/shell/wildz-overlay";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PendingPlayStateSave = {
  snapshot: WildzContinuitySnapshot;
  playState: PlayState;
  playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>;
};

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
  const [continuity, setContinuity] = useState<WildzContinuitySnapshot | null>(null);
  const continuityRef = useRef<WildzContinuitySnapshot | null>(null);
  const playStateSaveSchedulerRef = useRef<WildzLatestSaveScheduler<PendingPlayStateSave> | null>(null);
  if (!playStateSaveSchedulerRef.current) {
    playStateSaveSchedulerRef.current = createLatestOnlySaveScheduler({
      delayMs: 400,
      write: ({ snapshot, playState, playerContinuity }: PendingPlayStateSave) => saveWildzContinuityPlayState(
        snapshot,
        playState,
        playerContinuity,
        snapshot.character
      )
    });
  }
  const [character, setCharacter] = useState<WildzCharacterGenesis | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [proofSessionConnected, setProofSessionConnected] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<ReturnType<typeof sanitizePublicWildzProfile> | null>(null);
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "publishing" | "ready" | "unpublished" | "missing" | "error">("idle");
  const publishedProfileRef = useRef("");
  const identity = continuity?.session ?? null;
  const ownerPlayState = useMemo(
    () => continuity?.playState ?? (identity ? createOwnerBoundInitialPlayState(identity.actorId) : initialPlayState),
    [continuity?.playState, identity]
  );
  const ownerUsername = identity?.username ?? identity?.actorId ?? "explorer";
  const viewingOwnProfile = !overlay || overlay.kind !== "profile" || overlay.username.toLowerCase() === `@${ownerUsername}`.toLowerCase();
  const localPublicProfile = useMemo(() => sanitizePublicWildzProfile({
    username: overlay?.kind === "profile" ? overlay.username : ownerUsername,
    displayName: viewingOwnProfile ? identity?.displayName ?? undefined : overlay?.kind === "profile" ? overlay.username.replace(/^@/, "") : undefined,
    explorer: viewingOwnProfile ? character : null,
    vault: viewingOwnProfile ? ownerPlayState.inventory.map((asset) => ({
      id: asset.id,
      name: asset.manifest.name,
      proofDigest: asset.proof.digest,
      visibility: "public",
      status: asset.status
    })) : [],
    discoveries: viewingOwnProfile ? ownerPlayState.inventory.length : 0,
    reputation: viewingOwnProfile ? ownerPlayState.inventory.length * 12 : 0,
    record: { wins: 0, losses: 0, raids: 0 }
  }), [character, identity, overlay, ownerPlayState.inventory, ownerUsername, viewingOwnProfile]);
  const gameplayReady = Boolean(
    continuity
    && identity
    && character
  );

  const acceptSnapshot = useCallback((snapshot: WildzContinuitySnapshot) => {
    const previous = continuityRef.current;
    continuityRef.current = snapshot;
    setContinuity(snapshot);
    setCharacter(snapshot.character);
    if (!previous
      || previous.session.keyId !== snapshot.session.keyId
      || previous.session.actorId !== snapshot.session.actorId) {
      setProofSessionConnected(false);
    }
  }, []);

  useEffect(() => {
    const scheduler = playStateSaveSchedulerRef.current;
    if (!scheduler) return;
    const flush = () => { void scheduler.flush().catch(() => undefined); };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("wildz:preserve-state", flush);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("wildz:preserve-state", flush);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      flush();
    };
  }, []);

  useEffect(() => {
    if (!identity) return;
    let active = true;
    let connecting = false;
    let retryTimer: number | null = null;
    const connect = () => {
      if (connecting) return;
      connecting = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      void connectWildzProofSession(identity).then(async (session) => {
        if (!active || !wildzRemoteSessionMatchesIdentity(identity, session)) {
          if (active) setProofSessionConnected(false);
          return;
        }
        setProofSessionConnected(true);
        void bootstrapWildzSharedWorld().catch(() => undefined);
        const current = continuityRef.current;
        if (!current
          || current.session.keyId !== identity.keyId
          || current.session.actorId !== identity.actorId) return;
        const aligned = await alignWildzContinuityWithProofSession(current, session);
        if (!active) return;
        const stillCurrent = continuityRef.current;
        if (!stillCurrent
          || stillCurrent.session.keyId !== identity.keyId
          || stillCurrent.session.actorId !== identity.actorId) return;
        if (aligned !== current) acceptSnapshot(aligned);
        setProofSessionConnected(true);
      }).catch(() => {
        if (active) {
          setProofSessionConnected(false);
          retryTimer = window.setTimeout(connect, 5_000);
        }
      }).finally(() => {
        connecting = false;
      });
    };
    connect();
    window.addEventListener("online", connect);
    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener("online", connect);
    };
  }, [acceptSnapshot, identity]);

  useEffect(() => {
    if (overlay?.kind !== "profile") {
      setRemoteProfile(null);
      setProfileStatus("idle");
      return;
    }
    let active = true;
    if (viewingOwnProfile) {
      setRemoteProfile(localPublicProfile);
      const publicationKey = JSON.stringify(localPublicProfile);
      if (publishedProfileRef.current === publicationKey) {
        setProfileStatus("ready");
        return () => { active = false; };
      }
      if (!identity || !character || !proofSessionConnected) {
        setProfileStatus("unpublished");
        return () => { active = false; };
      }
      setProfileStatus("publishing");
      void publishCurrentWildzProfile(localPublicProfile, ownerPlayState.inventory).then((published) => {
        if (!active) return;
        publishedProfileRef.current = publicationKey;
        setRemoteProfile(published);
        setProfileStatus("ready");
      }).catch(() => {
        if (active) setProfileStatus("unpublished");
      });
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
  }, [character, identity, localPublicProfile, overlay, ownerPlayState.inventory, proofSessionConnected, viewingOwnProfile]);

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
      acceptSnapshot(snapshot);
    };
    void initialize().catch((cause) => {
      if (active) setIdentityError(cause instanceof Error ? cause.message : "Unable to prepare your Receiz ID.");
    });
    return () => { active = false; };
  }, [acceptSnapshot]);

  const completeGenesis = async (next: WildzCharacterGenesis) => {
    const current = continuityRef.current;
    if (!current) return;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId);
    const snapshot: WildzContinuitySnapshot = { ...current, playState, character: next };
    try {
      await saveWildzContinuityPlayState(snapshot, playState, current.playerContinuity ?? undefined, next);
      acceptSnapshot(snapshot);
    } catch {
      setIdentityError("Your explorer could not be saved. Try again before closing Wildz.");
    }
  };

  const createGenesisIdentity = async (username: string) => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_identity_missing");
    const snapshot = await createNamedWildzIdentity(current, { username });
    publishedProfileRef.current = "";
    acceptSnapshot(snapshot);
    return snapshot.session;
  };

  const restoreArtifact = useCallback(async (
    file: File,
    surface: "genesis" | "card-vault",
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState
  ): Promise<WildzUiArtifactRestore> => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    const outcome = await restoreWildzFileForSurface(
      file,
      surface,
      confirmCardOnly,
      current,
      currentPlayState ?? current.playState
    );
    const next: WildzContinuitySnapshot = {
      session: outcome.session,
      playState: outcome.playState,
      character: outcome.character,
      playerContinuity: outcome.playerContinuity,
      restoreEpoch: outcome.restoreEpoch
    };
    if (current.session.keyId !== outcome.session.keyId || current.session.actorId !== outcome.session.actorId) {
      publishedProfileRef.current = "";
    }
    acceptSnapshot(next);
    return outcome;
  }, [acceptSnapshot]);

  const persistPlayState = useCallback((playState: PlayState, playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>) => {
    const current = continuityRef.current;
    if (!current) return;
    const snapshot = { ...current, playState, playerContinuity };
    continuityRef.current = snapshot;
    playStateSaveSchedulerRef.current?.schedule({ snapshot, playState, playerContinuity });
  }, []);

  return (
    <main className="wildz-app-shell" data-wildz-active-username={ownerUsername}>
      <div className="wildz-app" data-overlay={overlay?.kind ?? "world"}>
        {gameplayReady && continuity && identity && character ? <PlayCampaign
          key={`${identity.keyId}:${identity.actorId}`}
          campaignName="Wildz"
          character={character}
          enabled
          networkEnabled={proofSessionConnected}
          initialState={ownerPlayState}
          initialPlayerContinuity={continuity.playerContinuity}
          ownerReceizId={ownerUsername}
          playerDisplayName={identity.displayName ?? `@${ownerUsername}`}
          onPlayStateChange={persistPlayState}
          onExportVault={(assets, player) => downloadWildzIdentityPlayerVault(identity, assets, player)}
          onRestoreArtifact={(file, confirmCardOnly, currentPlayState) => restoreArtifact(file, "card-vault", confirmCardOnly, currentPlayState)}
          onOpenProfile={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })}
          onOpenMarket={() => setOverlay({ kind: "market" })}
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
        /> : identity && !character ? <WildzGenesis
          identity={identity}
          onCreateIdentity={createGenesisIdentity}
          onComplete={completeGenesis}
          onRestoreArtifact={(file, confirmCardOnly) => restoreArtifact(file, "genesis", confirmCardOnly)}
        /> : <div className="wildz-identity-loading" role="status">
          <Image src="/brand/wildz-mark.svg" alt="" width={64} height={64} priority />
          <span>{identityError || "Preparing your Receiz ID…"}</span>
        </div>}
      </div>

      <div className="wildz-brand-corner" aria-label="Wildz">
        <Image src="/brand/wildz-mark.svg" alt="" width={42} height={42} priority />
        <span>WILDZ</span>
      </div>

      {identity && character ? <nav className="wildz-utility-dock" aria-label="Wildz utilities">
        <button type="button" onClick={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })} aria-label="Open player profile">◉</button>
        <button type="button" onClick={() => setOverlay({ kind: "vault" })} aria-label="Open public Vault">◇</button>
        <button type="button" onClick={() => setOverlay({ kind: "market" })} aria-label="Open player market">↝</button>
      </nav> : null}

      {overlay ? (
        <section className="wildz-shell-overlay" role="dialog" aria-modal="true" aria-label={`${overlay.kind} panel`}>
          <button type="button" className="wildz-overlay-dismiss" onClick={() => setOverlay(null)} aria-label="Return to world">
            <span aria-hidden="true">×</span>
          </button>
          {overlay.kind === "profile" ? remoteProfile ? <WildzProfileSheet
            profile={remoteProfile}
            publicationStatus={viewingOwnProfile && profileStatus !== "ready" ? "local" : "published"}
            shareEnabled={!viewingOwnProfile || profileStatus === "ready"}
          /> : <div className="wildz-shell-overlay-placeholder" role="status">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{profileStatus === "loading" ? "Finding explorer…" : "Explorer unavailable"}</strong>
            <span>{profileStatus === "missing" || profileStatus === "unpublished" ? "This Wildz profile has not been published yet." : profileStatus === "error" ? "Receiz profile recovery is temporarily unavailable." : "Preparing profile"}</span>
          </div> : overlay.kind === "vault" ? <WildzVaultSheet cards={localPublicProfile.vault} /> : overlay.kind === "market" ? <WildzMarketSheet listings={[]} buyer={`@${ownerUsername}`} /> : <div className="wildz-shell-overlay-placeholder">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{overlay.kind}</strong>
            <span>Wildz surface loading</span>
          </div>}
        </section>
      ) : null}
    </main>
  );
}
