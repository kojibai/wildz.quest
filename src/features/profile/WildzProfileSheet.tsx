"use client";

import type { PublicWildzProfile } from "@/features/profile/public-profile";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";
import { useState } from "react";
import {
  copyWildzProfileLink,
  shareWildzProfile,
  type WildzSharePort,
  type WildzShareResult
} from "./profile-sharing";

export function WildzProfileSheet({ profile, publicationStatus = "published", shareEnabled = true }: {
  profile: PublicWildzProfile;
  publicationStatus?: "local" | "published";
  shareEnabled?: boolean;
}) {
  const [shareResult, setShareResult] = useState<WildzShareResult | null>(null);
  const browserPort = (): WildzSharePort => ({
    share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
    clipboard: navigator.clipboard?.writeText
      ? { writeText: (value) => navigator.clipboard.writeText(value) }
      : undefined
  });
  const share = async () => setShareResult(await shareWildzProfile({
    port: browserPort(),
    username: profile.username,
    displayName: profile.displayName,
    origin: window.location.origin
  }));
  const copy = async () => setShareResult(await copyWildzProfileLink({
    port: browserPort(),
    username: profile.username,
    origin: window.location.origin
  }));

  return <div className="wildz-profile-sheet">
    <header className="wildz-profile-head"><div className="wildz-profile-avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div><div>
      <span>Explorer profile</span><h2>{profile.displayName}</h2><p>{profile.username} · {publicationStatus === "published" ? "Published via Receiz" : "Local verified profile · not yet published"}</p>
    </div></header>
    <div className="wildz-profile-sharing">
      <button data-state={shareResult?.status === "shared" ? "success" : "idle"} disabled={!shareEnabled} onClick={() => void share()} type="button">Share</button>
      <button data-state={shareResult?.status === "copied" ? "success" : "idle"} disabled={!shareEnabled} onClick={() => void copy()} type="button">Copy Link</button>
      <p aria-live="polite" role="status">{shareResult?.message ?? (!shareEnabled ? "Publish this profile before sharing its link." : "")}</p>
    </div>
    <div className="wildz-profile-stats"><span><b>{profile.discoveries}</b> discoveries</span><span><b>{profile.record.wins}</b> wins</span><span><b>{profile.reputation}</b> reputation</span></div>
    <section className="wildz-profile-impact" aria-label="Explorer impact">
      <span><small>World impact</small><strong>{profile.discoveries + profile.record.wins} admitted milestones</strong></span>
      <p>{profile.reputation > 0 ? `Your choices carry ${profile.reputation} reputation into future encounters.` : "Explore, battle, and help the living world to build a remembered reputation."}</p>
    </section>
    {profile.explorer ? <p className="wildz-profile-traits">{profile.explorer.traits.outfit.replaceAll("-", " ")} · {profile.explorer.traits.trail.replaceAll("-", " ")} trail</p> : null}
    <WildzVaultSheet cards={profile.vault} />
  </div>;
}
