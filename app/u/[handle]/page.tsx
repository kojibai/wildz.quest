import type { Metadata } from "next";
import { unstable_noStore } from "next/cache";
import { WildzPublicProfilePage } from "@/features/profile/WildzPublicProfilePage";
import { canonicalWildzHandle, canonicalWildzProfilePath } from "@/features/profile/public-profile";
import { publicPageMetadata } from "@/lib/wildz/search-metadata";
import { loadWildzProfilePageSeed } from "@/lib/receiz/wildz-profile-page-server";
import { publicWildzProfileBuildParams } from "@/lib/receiz/wildz-profile-reader";

// Retain the complete public document under the same 60-second display policy
// as its seed. Prepare known public profiles before the first visitor; new
// players retain on-demand generation. Publications invalidate both layers.
export const revalidate = 60;
export function generateStaticParams() { return publicWildzProfileBuildParams(); }

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
  // An unavailable source is a retry state, never a reusable profile document.
  if (!initialSeed) unstable_noStore();
  return <WildzPublicProfilePage username={username} initialSeed={initialSeed} />;
}
