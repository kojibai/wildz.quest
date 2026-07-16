"use client";

import { PlayCampaign } from "@/features/play/PlayCampaign";
import { WildzGenesis } from "@/features/identity/WildzGenesis";
import type { WildzCharacterGenesis } from "@/features/identity/wildz-genesis";
import { createOwnerBoundInitialPlayState, initialPlayState, type PlayState } from "@/features/play/game-state";
import type { WildzCardOnlyConfirmation } from "@/features/identity/wildz-restore";
import {
  bootstrapWildzContinuity,
  downloadWildzIdentityPlayerVault,
  restoreWildzFileForSurface,
  resumePendingWildzVault,
  saveWildzContinuityPlayState,
  WildzVaultLoginRedirectError,
  type WildzContinuitySnapshot,
  type WildzUiArtifactRestore
} from "@/lib/receiz/wildz-identity-adapter";
import { wildzRemoteSessionBridge } from "@/lib/receiz/wildz-session-bridge";
import { shouldClearWildzResumeAfterError } from "@/lib/receiz/wildz-resume-errors";
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

function clearWildzAuthQuery() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  searchParams.delete("wildzResume");
  searchParams.delete("receiz");
  searchParams.delete("receiz_error");
  const next = `${url.pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
}

type WildzVaultRecovery = {
  kind: "login" | "mismatch" | "retry";
  loginUrl: string;
};

export function WildzApp({ initialOverlay = null }: { initialOverlay?: WildzOverlay }) {
  const [overlay, setOverlay] = useState<WildzOverlay>(initialOverlay);
  const [continuity, setContinuity] = useState<WildzContinuitySnapshot | null>(null);
  const continuityRef = useRef<WildzContinuitySnapshot | null>(null);
  const [character, setCharacter] = useState<WildzCharacterGenesis | null>(null);
  const [identityError, setIdentityError] = useState("");
  const [entryRecovery, setEntryRecovery] = useState("");
  const [vaultRecovery, setVaultRecovery] = useState<WildzVaultRecovery | null>(null);
  const [browserOnline, setBrowserOnline] = useState(true);
  const [offlinePracticeAccepted, setOfflinePracticeAccepted] = useState(false);
  const [remoteProfile, setRemoteProfile] = useState<ReturnType<typeof sanitizePublicWildzProfile> | null>(null);
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "publishing" | "ready" | "unpublished" | "missing" | "error">("idle");
  const publishedProfileRef = useRef("");
  const automaticEntryRef = useRef("");
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
    && (identity.remoteStatus === "connected" || offlinePracticeAccepted)
  );

  const acceptSnapshot = useCallback((snapshot: WildzContinuitySnapshot) => {
    const previous = continuityRef.current;
    continuityRef.current = snapshot;
    setContinuity(snapshot);
    setCharacter(snapshot.character);
    setVaultRecovery(null);
    if (!previous
      || previous.session.keyId !== snapshot.session.keyId
      || previous.session.actorId !== snapshot.session.actorId) {
      automaticEntryRef.current = "";
      setOfflinePracticeAccepted(false);
    }
  }, []);

  const continueWildzEntry = useCallback(async (
    session: WildzContinuitySnapshot["session"],
    force = false
  ) => {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const attemptKey = `${session.actorId}:${returnTo}`;
    if (!force && automaticEntryRef.current === attemptKey) return;
    automaticEntryRef.current = attemptKey;
    setEntryRecovery("");
    try {
      const remote = await wildzRemoteSessionBridge.continueLocalIdentity(session, returnTo);
      if (remote.status !== "connected" && remote.status !== "pending") {
        setEntryRecovery(remote.status === "offline"
          ? "Receiz is offline. Reconnect and retry, or continue offline."
          : "Wildz could not verify this explorer with Receiz. Retry without losing your local identity.");
      }
    } catch {
      setEntryRecovery("Wildz could not start Receiz connection. Retry without losing your local identity.");
    }
  }, []);

  useEffect(() => {
    const updateOnlineStatus = () => setBrowserOnline(navigator.onLine);
    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

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
      if (!identity || !character || identity.remoteStatus !== "connected") {
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
  }, [character, identity, localPublicProfile, overlay, ownerPlayState.inventory, viewingOwnProfile]);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const resumeId = searchParams.get("wildzResume");
      let returnedFromReceiz = false;
      let receizCallbackFailed = false;
      if (resumeId) {
        try {
          const resumed = await resumePendingWildzVault(resumeId);
          if (!active) return;
          if (resumed.status === "committed") {
            clearWildzAuthQuery();
            acceptSnapshot({
              session: resumed.restore.session,
              playState: resumed.restore.playState,
              character: resumed.restore.character,
              playerContinuity: resumed.restore.playerContinuity,
              restoreEpoch: resumed.restore.restoreEpoch
            });
            return;
          }
          if (resumed.status === "receiz_login_required") {
            setIdentityError("Your Vault is safe. Receiz login needs to be completed before it can be restored.");
            setVaultRecovery({ kind: "login", loginUrl: resumed.loginUrl });
            return;
          }
          setIdentityError("This browser is signed in to a different Receiz account than the one sealed in this Vault.");
          setVaultRecovery({ kind: "mismatch", loginUrl: resumed.loginUrl });
          return;
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : "wildz_restore_invalid";
          const clearResume = shouldClearWildzResumeAfterError(code);
          if (clearResume) clearWildzAuthQuery();
          else setVaultRecovery({ kind: "retry", loginUrl: window.location.href });
          setIdentityError(code === "wildz_restore_resume_missing"
            ? "That Vault login expired. Upload the Vault image again to continue."
            : code === "wildz_restore_v4_unavailable"
              ? "Receiz proof verification is temporarily unavailable. Your staged Vault is safe; retry when the connection returns."
              : clearResume
                ? "The proof-sealed Vault could not be restored. Upload it again to retry."
                : "Wildz could not finish the staged Vault restore. Nothing was changed; retry to continue.");
          if (!clearResume) return;
        }
      } else {
        returnedFromReceiz = searchParams.has("receiz");
        receizCallbackFailed = searchParams.has("receiz_error");
        if (returnedFromReceiz || receizCallbackFailed) {
          if (receizCallbackFailed) {
            setEntryRecovery("Receiz login did not complete. Retry without losing your local identity or Vault.");
          }
          clearWildzAuthQuery();
        }
      }
      const snapshot = await bootstrapWildzContinuity(window.localStorage);
      if (!active) return;
      if (returnedFromReceiz && !receizCallbackFailed && snapshot.session.remoteStatus !== "connected") {
        setEntryRecovery("Receiz returned, but Wildz could not verify this explorer. Retry without losing your local identity or Vault.");
      }
      acceptSnapshot(snapshot);
    };
    void initialize().catch((cause) => {
      if (active) setIdentityError(cause instanceof Error ? cause.message : "Unable to prepare your Receiz ID.");
    });
    return () => { active = false; };
  }, [acceptSnapshot]);

  useEffect(() => {
    if (!identity || !character || offlinePracticeAccepted) return;
    if (identity.remoteStatus === "connected") return;
    if (!browserOnline) return;
    if (entryRecovery) return;
    void continueWildzEntry(identity);
  }, [browserOnline, character, continueWildzEntry, entryRecovery, identity, offlinePracticeAccepted]);

  const completeGenesis = (next: WildzCharacterGenesis) => {
    const current = continuityRef.current;
    if (!current) return;
    const playState = current.playState ?? createOwnerBoundInitialPlayState(current.session.actorId);
    const snapshot: WildzContinuitySnapshot = { ...current, playState, character: next };
    acceptSnapshot(snapshot);
    void saveWildzContinuityPlayState(snapshot, playState, current.playerContinuity ?? undefined, next)
      .catch(() => setIdentityError("Your explorer could not be saved. Try again before closing Wildz."));
  };

  const restoreArtifact = useCallback(async (
    file: File,
    surface: "genesis" | "card-vault",
    confirmCardOnly: WildzCardOnlyConfirmation,
    currentPlayState?: PlayState
  ): Promise<WildzUiArtifactRestore> => {
    const current = continuityRef.current;
    if (!current) throw new Error("wildz_restore_identity_missing");
    let outcome: WildzUiArtifactRestore;
    try {
      outcome = await restoreWildzFileForSurface(
        file,
        surface,
        confirmCardOnly,
        current,
        currentPlayState ?? current.playState
      );
    } catch (cause) {
      if (cause instanceof WildzVaultLoginRedirectError) {
        if (cause.status === "receiz_login_required") window.location.assign(cause.loginUrl);
        else {
          setIdentityError("Sign in with the Receiz account sealed in this Vault to restore its player and cards.");
          setVaultRecovery({ kind: "mismatch", loginUrl: cause.loginUrl });
        }
      }
      throw cause;
    }
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
    setEntryRecovery("");
    acceptSnapshot(next);
    return outcome;
  }, [acceptSnapshot]);

  const persistPlayState = useCallback((playState: PlayState, playerContinuity: NonNullable<WildzContinuitySnapshot["playerContinuity"]>) => {
    const current = continuityRef.current;
    if (!current) return;
    const snapshot = { ...current, playState, playerContinuity };
    continuityRef.current = snapshot;
    void saveWildzContinuityPlayState(snapshot, playState, playerContinuity, snapshot.character).catch(() => undefined);
  }, []);

  return (
    <main className="wildz-app-shell" data-wildz-active-username={ownerUsername}>
      <div className="wildz-app" data-overlay={overlay?.kind ?? "world"}>
        {gameplayReady && continuity && identity && character ? <PlayCampaign
          key={`${identity.keyId}:${identity.actorId}:${continuity.restoreEpoch}`}
          campaignName="Wildz"
          character={character}
          enabled
          initialState={ownerPlayState}
          initialPlayerContinuity={continuity.playerContinuity}
          ownerReceizId={ownerUsername}
          playerDisplayName={identity.displayName ?? "Wildz Explorer"}
          onPlayStateChange={persistPlayState}
          onExportVault={(assets, player) => downloadWildzIdentityPlayerVault(identity, assets, player)}
          onRestoreArtifact={(file, confirmCardOnly, currentPlayState) => restoreArtifact(file, "card-vault", confirmCardOnly, currentPlayState)}
          onOpenProfile={() => setOverlay({ kind: "profile", username: `@${ownerUsername}` })}
          onOpenMarket={() => setOverlay({ kind: "market" })}
          onListAsset={async (asset, priceCents) => {
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
          onComplete={completeGenesis}
          onRestoreArtifact={(file, confirmCardOnly) => restoreArtifact(file, "genesis", confirmCardOnly)}
        /> : <div className="wildz-identity-loading" role="status">
          <Image src="/brand/wildz-mark.svg" alt="" width={64} height={64} priority />
          <span>{identity && character
            ? entryRecovery || (!browserOnline
              ? "Receiz is offline. Choose offline practice to enter without live features."
              : "Connecting your explorer to Receiz…")
            : identityError || "Preparing your Receiz ID…"}</span>
        </div>}
      </div>

      {vaultRecovery ? <aside className="wildz-vault-login-prompt" role="alert">
        <span>{vaultRecovery.kind === "retry" ? "Vault restore paused" : "Vault owner required"}</span>
        <strong>{identityError || "Sign in with the Receiz account sealed in this Vault."}</strong>
        <div>
          <button type="button" onClick={() => {
            if (vaultRecovery.kind === "retry") window.location.assign(vaultRecovery.loginUrl);
            else void wildzRemoteSessionBridge.disconnect().finally(() => window.location.assign(vaultRecovery.loginUrl));
          }}>{vaultRecovery.kind === "retry" ? "Retry Vault restore" : "Sign in as Vault owner"}</button>
        </div>
      </aside> : identity && character && !gameplayReady ? <aside className="wildz-vault-login-prompt" role={entryRecovery || !browserOnline ? "alert" : "status"}>
        <span>{!browserOnline ? "Receiz offline" : entryRecovery ? "Receiz connection needs attention" : "Receiz connection"}</span>
        <strong>{entryRecovery || "Connecting this explorer to live Receiz features…"}</strong>
        {!browserOnline ? <div>
          <button type="button" onClick={() => setOfflinePracticeAccepted(true)}>Continue offline</button>
        </div> : entryRecovery ? <div>
          <button type="button" onClick={() => void continueWildzEntry(identity, true)}>Retry Receiz</button>
        </div> : null}
      </aside> : null}

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
