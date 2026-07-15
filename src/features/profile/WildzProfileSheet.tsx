import type { PublicWildzProfile } from "@/features/profile/public-profile";
import { WildzVaultSheet } from "@/features/profile/WildzVaultSheet";

export function WildzProfileSheet({ profile }: { profile: PublicWildzProfile }) {
  return <div className="wildz-profile-sheet">
    <header className="wildz-profile-head"><div className="wildz-profile-avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div><div>
      <span>Explorer profile</span><h2>{profile.displayName}</h2><p>{profile.username} · Receiz verified</p>
    </div></header>
    <div className="wildz-profile-stats"><span><b>{profile.discoveries}</b> discoveries</span><span><b>{profile.record.wins}</b> wins</span><span><b>{profile.reputation}</b> reputation</span></div>
    {profile.explorer ? <p className="wildz-profile-traits">{profile.explorer.traits.outfit.replaceAll("-", " ")} · {profile.explorer.traits.trail.replaceAll("-", " ")} trail</p> : null}
    <WildzVaultSheet cards={profile.vault} />
  </div>;
}
