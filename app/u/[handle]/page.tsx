import type { Metadata } from "next";
import { WildzPublicProfilePage } from "@/features/profile/WildzPublicProfilePage";
import { canonicalWildzHandle, canonicalWildzProfilePath } from "@/features/profile/public-profile";
import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import { loadWildzProfilePageSeed } from "@/lib/receiz/wildz-profile-page-server";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const username = canonicalWildzHandle(handle);
  const canonicalPath = canonicalWildzProfilePath(username);
  return publicPageMetadata(`${username} — Explorer Profile`, `Explore ${username}'s public Wildz creature Vault and living adventure history.`, canonicalPath);
}

export default async function WildzPlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const username = canonicalWildzHandle(handle);
  const initialSeed = await loadWildzProfilePageSeed(username).catch(() => null);
  return <WildzPublicProfilePage username={username} initialSeed={initialSeed} />;
}
