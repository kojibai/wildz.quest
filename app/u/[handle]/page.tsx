import type { Metadata } from "next";
import { WildzApp } from "@/features/shell/WildzApp";
import { canonicalWildzHandle } from "@/features/profile/public-profile";
import { WILDZ_PRODUCT } from "@/lib/wildz/product";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const username = canonicalWildzHandle(handle);
  return {
    title: username,
    description: `Explore ${username}'s public Wildz creature Vault and living adventure history.`,
    alternates: { canonical: `/u/${encodeURIComponent(username)}` },
    openGraph: { images: [WILDZ_PRODUCT.socialImage] }
  };
}

export default async function WildzPlayerPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <WildzApp initialOverlay={{ kind: "profile", username: canonicalWildzHandle(handle) }} />;
}
