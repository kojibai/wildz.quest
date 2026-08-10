"use client";

import { PlayCampaign } from "@/features/play/PlayCampaign";
import { WildzInWorldOnboarding } from "@/features/identity/WildzInWorldOnboarding";
import { generateWildzCharacter, type WildzCharacterGenesis, type WildzGender } from "@/features/identity/wildz-genesis";
import { createOwnerBoundInitialPlayState, initialPlayState, type PlayState } from "@/features/play/game-state";
import { createWildsPlayerVault } from "@/features/play/wilds-player-vault";
import type { WildzCardOnlyConfirmation } from "@/features/identity/wildz-restore";
import { removeWildzAssetsFromActiveVault } from "@/features/identity/wildz-ownership-reconciliation";
import {
  bootstrapWildzContinuity,
  alignWildzContinuityWithProofSession,
  claimWildzProfileIdentity,
  connectWildzProofSession,
  downloadWildzIdentityPlayerCard,
  downloadWildzIdentityOwnedCard,
  downloadWildzIdentityPlayerVault,
  restoreWildzFileForSurface,
  resumePendingWildzVault,
  saveWildzContinuityPlayState,
  type WildzContinuitySnapshot,
  type WildzRestoreIntent,
  type WildzUiArtifactRestore
} from "@/lib/receiz/wildz-identity-adapter";
import { shouldClearWildzResumeAfterError } from "@/lib/receiz/wildz-resume-errors";
import { sameWildzPlayerCoordinate } from "@/lib/receiz/wildz-player-coordinate";
import { deriveWildzVaultCardAdmission } from "@/lib/receiz/wildz-vault-card-admission";
import {
  bootstrapWildzSharedWorld,
  wildzRemoteSessionMatchesIdentity
} from "@/lib/receiz/wildz-session-bridge";
import { publishWildsWorldWithIdentityProof } from "@/lib/receiz/wilds-world-identity-publication";
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
import { proofSessionRetryDecision } from "@/features/shell/proof-session-retry";
import { downloadBlob } from "@/features/play/card-export";
import { openWildzArtifactSameOrigin } from "@/lib/receiz/wildz-same-origin-verifier";
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
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [identityError, setIdentityError] = useState("");
  const [proofSessionConnected, setProofSessionConnected] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<ReturnType<typeof sanitizePublicWildzProfile> | null>(null);
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "publishing" | "ready" | "unpublished" | "missing" | "error">("idle");
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const publishedProfileRef = useRef("");
  const identity = continuity?.session ?? null;
  const ownerPlayState = useMemo(
    () => continuity?.playState ?? (identity ? createOwnerBoundInitialPlayState(identity.actorId, identity.createdAt) : initialPlayState),
    [continuity?.playState, identity]
  );
  const ownerUsername = identity?.username ?? identity?.actorId ?? "explorer";
  const vaultAdmission = useMemo(() => identity ? deriveWildzVaultCardAdmission({
    cards: ownerPlayState.inventory,
    playerHandle: identity.actorId
  }) : null, [identity, ownerPlayState.inventory]);
  const viewingOwnProfile = !overlay || overlay.kind !== "profile" || overlay.username.toLowerCase() === `@${ownerUsername}`.toLowerCase();
  const localPublicProfile = useMemo(() => sanitizePublicWildzProfile({
    username: overlay?.kind === "profile" ? overlay.username : ownerUsername,
    displayName: viewingOwnProfile ? identity?.displayName ?? undefined : overlay?.kind === "profile" ? overlay.username.replace(/^@/, "") : undefined,
    avatarImageUrl: viewingOwnProfile ? avatarImageUrl : undefined,
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
  }), [avatarImageUrl, character, identity, overlay, ownerPlayState.inventory, ownerUsername, viewingOwnProfile]);
  const campaignCharacter = useMemo(() => character ?? (identity ? generateWildzCharacter({
    identityRef: identity.keyId,
    kaiPulse: String(Math.max(1, Date.parse(identity.createdAt ?? "") || 1)),
    gender: "female",
    version: 1
  }) : null), [character, identity]);

  const acceptSnapshot = useCallback((snapshot: WildzContinuitySnapshot) => {
    const previous = continuityRef.current;
    continuityRef.current = snapshot;
    setContinuity(snapshot);
    setCharacter(snapshot.character);
    if (!previous || !sameWildzPlayerCoordinate(previous.session.actorId, snapshot.session.actorId)) {
      setProofSessionConnected(false);
    }
  }, []);

  useEffect(() => {
    if (!identity) return;
    setAvatarImageUrl(window.localStorage.getItem(`wildz:profile-avatar:${identity.keyId}`));
  }, [identity]);

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
    if (!identity || !vaultAdmission) return;
    let active = true;
    let connecting = false;
    let retryAttempt = 0;
    let retryTimer: number | null = null;
    const connect = (resetAttempt = false) => {
      if (connecting) return;
      if (resetAttempt) retryAttempt = 0;
      connecting = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      void connectWildzProofSession(identity, { vaultAdmission }).then(async (session) => {
        if (!active || !wildzRemoteSessionMatchesIdentity(identity, session)) {
          if (active) setProofSessionConnected(false);
          return;
        }
        setProofSessionConnected(true);
        void bootstrapWildzSharedWorld().then(async (world) => {
          if (world.publication?.required !== "identity_proof" || identity.localAuthority !== "verified") return;
          await publishWildsWorldWithIdentityProof(identity, world.publication.draft);
          await bootstrapWildzSharedWorld();
        }).catch(() => undefined);
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
        retryAttempt = 0;
        setProofSessionConnected(true);
      }).catch((error: unknown) => {
        if (active) {
          setProofSessionConnected(false);
          const code = error instanceof Error ? error.message : "wildz_proof_unknown";
          const decision = proofSessionRetryDecision({
            attempt: retryAttempt,
            online: navigator.onLine,
            code
          });
          retryAttempt += 1;
          if (decision.retry) retryTimer = window.setTimeout(() => connect(), decision.delayMs);
        }
      }).finally(() => {
        connecting = false;
      });
    };
    connect();
    const reconnectOnline = () => connect(true);
    window.addEventListener("online", reconnectOnline);
    return () => {
      active = false;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener("online", reconnectOnline);
    };
  }, [acceptSnapshot, identity, vaultAdmission]);

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
  };

  const chooseExplorer = (gender: WildzGender) => {
    if (!identity || onboardingBusy) return;
    setOnboardingBusy(true);
    const next = generateWildzCharacter({
      identityRef: identity.keyId,
      kaiPulse: String(Date.now()),
      gender,
      version: 1
    });
    void completeGenesis(next).finally(() => setOnboardingBusy(false));
  };

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
    const player = createWildsPlayerVault({
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
    });
    await downloadWildzIdentityPlayerCard(current.session, playState.inventory, player);
  };

  const saveIdentitySeal = async () => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_identity_missing");
    if (current.session.localAuthority !== "verified") throw new Error("wildz_identity_seal_authority_required");
    await saveIdentityCard();
  };

  const saveCombinedVault = async () => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_identity_missing");
    const playerContinuity = current.playerContinuity;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId, current.session.createdAt);
    const player = createWildsPlayerVault({
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
    });
    await downloadWildzIdentityPlayerVault(current.session, playState.inventory, player);
  };

  const restoreArtifact = useCallback(async (
    file: File,
    surface: "genesis" | "card-vault",
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState,
    intent: WildzRestoreIntent = surface === "genesis" ? "activate-identity" : "merge-vault"
  ): Promise<WildzUiArtifactRestore> => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    const outcome = await restoreWildzFileForSurface(
      file,
      surface,
      confirmCardOnly,
      current,
      currentPlayState ?? current.playState,
      intent
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
    if (intent === "merge-vault" && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("receiz:wildz:ownership:v118");
      channel.postMessage({ ownerActorId: outcome.session.actorId, assetIds: outcome.verifiedAssetIds });
      channel.close();
    }
    return outcome;
  }, [acceptSnapshot]);

  const activateIdentitySeal = useCallback(async (file: File) => {
    const outcome = await restoreArtifact(
      file,
      "card-vault",
      false,
      continuityRef.current?.playState ?? undefined,
      "activate-identity"
    );
    if (outcome.artifactKind !== "identity-seal") throw new Error("wildz_identity_seal_required");

    const restored = continuityRef.current;
    if (!restored
      || restored.session.keyId !== outcome.session.keyId
      || restored.session.actorId !== outcome.session.actorId) {
      throw new Error("wildz_identity_activation_failed");
    }

    const restoredAdmission = deriveWildzVaultCardAdmission({
      cards: outcome.playState.inventory,
      playerHandle: outcome.session.actorId
    });
    try {
      const remote = await connectWildzProofSession(outcome.session, { vaultAdmission: restoredAdmission });
      if (wildzRemoteSessionMatchesIdentity(outcome.session, remote)) {
        const aligned = await alignWildzContinuityWithProofSession(restored, remote);
        acceptSnapshot(aligned);
        setProofSessionConnected(true);
      } else {
        setProofSessionConnected(false);
      }
    } catch {
      // The verified Seal still activates local authority; the connection effect retries.
      setProofSessionConnected(false);
    }
    setOverlay({ kind: "profile", username: `@${outcome.session.username ?? outcome.session.actorId}` });
  }, [acceptSnapshot, restoreArtifact]);

  const claimBearerArtifact = useCallback(async (file: File): Promise<number | null> => {
    if (!proofSessionConnected) throw new Error("Connect your Receiz ID before claiming a bearer artifact.");
    if (!window.confirm(
      "Claim this complete bearer artifact? This creates and downloads a new Receiz ownership artifact; the original witnessed history is preserved."
    )) return null;

    const form = new FormData();
    form.set("file", file, file.name);
    const stableName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 64) || "artifact";
    const response = await fetch("/api/market/claims", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "idempotency-key": `bearer:${file.size}:${file.lastModified}:${stableName}`.slice(0, 160) },
      body: form
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: unknown } | null;
      throw new Error(typeof failure?.error === "string" ? failure.error : "Receiz did not admit the bearer claim.");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim() || "application/octet-stream";
    const contentDisposition = response.headers.get("content-disposition") ?? "";
    const filename = /filename="([^"\\]+)"/.exec(contentDisposition)?.[1] ?? "wildz-claimed.receized";
    const opened = await openWildzArtifactSameOrigin({ bytes, mimeType, name: filename });
    const expectedDigest = response.headers.get("x-receiz-artifact-sha256");
    if (expectedDigest && opened.artifactSha256 !== expectedDigest) throw new Error("wildz_bearer_claim_download_mismatch");

    downloadBlob(new Blob([bytes.slice().buffer], { type: mimeType }), filename);
    const claimedFile = new File([bytes.slice().buffer], filename, { type: mimeType });
    const outcome = await restoreArtifact(
      claimedFile,
      "card-vault",
      false,
      continuityRef.current?.playState ?? undefined,
      "merge-vault"
    );
    return outcome.verifiedAssetIds.length;
  }, [proofSessionConnected, restoreArtifact]);

  const persistPlayState = useCallback((playState: PlayState, playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>) => {
    const current = continuityRef.current;
    if (!current) return;
    const cardTruthChanged = current.playState?.inventory === playState.inventory
      ? false
      : (() => {
          const previousCardPins = current.playState?.inventory.map((asset) => `${asset.id}:${asset.proof.digest}`) ?? [];
          const nextCardPins = playState.inventory.map((asset) => `${asset.id}:${asset.proof.digest}`);
          return previousCardPins.length !== nextCardPins.length
            || previousCardPins.some((pin, index) => pin !== nextCardPins[index]);
        })();
    const snapshot = { ...current, playState, playerContinuity };
    continuityRef.current = snapshot;
    const scheduler = playStateSaveSchedulerRef.current;
    scheduler?.schedule({ snapshot, playState, playerContinuity });
    // Card capture/import/revision is durable account truth, not high-frequency
    // movement projection. Start its IndexedDB commit immediately.
    if (cardTruthChanged) void scheduler?.flush().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("receiz:wildz:ownership:v118");
    channel.addEventListener("message", (event: MessageEvent<unknown>) => {
      const message = event.data as { ownerActorId?: unknown; assetIds?: unknown } | null;
      if (!message || typeof message.ownerActorId !== "string" || !Array.isArray(message.assetIds)
        || message.assetIds.some((id) => typeof id !== "string")) return;
      const current = continuityRef.current;
      if (!current?.playState || sameWildzPlayerCoordinate(current.session.actorId, message.ownerActorId)) return;
      const reconciled = removeWildzAssetsFromActiveVault(current.playState, message.assetIds as string[]);
      if (reconciled === current.playState || !current.playerContinuity) return;
      const snapshot = { ...current, playState: reconciled };
      acceptSnapshot(snapshot);
      playStateSaveSchedulerRef.current?.schedule({
        snapshot,
        playState: reconciled,
        playerContinuity: current.playerContinuity
      });
    });
    return () => channel.close();
  }, [acceptSnapshot]);

  return (
    <main className="wildz-app-shell" data-wildz-active-username={ownerUsername}>
      <div className="wildz-app" data-overlay={overlay?.kind ?? "world"}>
        {continuity && identity && campaignCharacter ? <PlayCampaign
          key={`${identity.keyId}:${identity.actorId}`}
          campaignName="Wildz"
          character={campaignCharacter}
          enabled={true}
          interactionEnabled={Boolean(character)}
          networkEnabled={Boolean(character) && proofSessionConnected}
          initialState={ownerPlayState}
          initialPlayerContinuity={continuity.playerContinuity}
          ownerReceizId={ownerUsername}
          playerDisplayName={identity.displayName ?? `@${ownerUsername}`}
          onPlayStateChange={persistPlayState}
          onExportCard={(asset, player) => downloadWildzIdentityOwnedCard(identity, asset, player)}
          onExportVault={(assets, player) => downloadWildzIdentityPlayerVault(identity, assets, player)}
          onRestoreArtifact={(file, confirmCardOnly, currentPlayState) => restoreArtifact(file, "card-vault", confirmCardOnly, currentPlayState, "merge-vault")}
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
        /> : <div className="wildz-identity-loading" role="status">
          <Image src="/brand/wildz-mark.svg" alt="" width={64} height={64} priority />
          <span>{identityError || "Preparing your Receiz ID…"}</span>
        </div>}
      </div>

      <div className="wildz-brand-corner" aria-label="Wildz">
        <Image src="/brand/wildz-mark.svg" alt="" width={42} height={42} priority />
        <span>WILDZ</span>
      </div>

      {identity ? <nav className="wildz-utility-dock" aria-label="Wildz utilities">
        <button type="button" onClick={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })} aria-label="Open player profile">◉</button>
        <button type="button" onClick={() => setOverlay({ kind: "vault" })} aria-label="Open public Vault">◇</button>
        <button type="button" onClick={() => setOverlay({ kind: "market" })} aria-label="Open player market">↝</button>
      </nav> : null}

      {identity && !character ? <WildzInWorldOnboarding
        busy={onboardingBusy}
        error={identityError}
        onChooseExplorer={chooseExplorer}
      /> : null}

      {overlay ? (
        <section className="wildz-shell-overlay" role="dialog" aria-modal="true" aria-label={`${overlay.kind} panel`}>
          <button type="button" className="wildz-overlay-dismiss" onClick={() => setOverlay(null)} aria-label="Return to world">
            <span aria-hidden="true">×</span>
          </button>
          {overlay.kind === "profile" ? (viewingOwnProfile ? localPublicProfile : remoteProfile) ? <WildzProfileSheet
            profile={(viewingOwnProfile ? localPublicProfile : remoteProfile)!}
            publicationStatus={viewingOwnProfile && profileStatus !== "ready" ? "local" : "published"}
            shareEnabled={!viewingOwnProfile || profileStatus === "ready"}
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
            cards={localPublicProfile.vault}
            title="Card Vault"
            onAddVault={async (file) => {
              const outcome = await restoreArtifact(file, "card-vault", () => window.confirm(
                "Combine every verified card from this Vault with the cards already here? The current Identity Seal will own the combined Vault when you save it."
              ), continuityRef.current?.playState ?? undefined, "merge-vault");
              return outcome.verifiedAssetIds.length;
            }}
            onClaimBearer={proofSessionConnected ? claimBearerArtifact : undefined}
            onSaveVault={saveCombinedVault}
          /> : overlay.kind === "market" ? <WildzMarketSheet listings={[]} buyer={`@${ownerUsername}`} /> : <div className="wildz-shell-overlay-placeholder">
            <Image src="/brand/wildz-mark.svg" alt="" width={48} height={48} />
            <strong>{overlay.kind}</strong>
            <span>Wildz surface loading</span>
          </div>}
        </section>
      ) : null}
    </main>
  );
}
