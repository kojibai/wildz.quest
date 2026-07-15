import type { Metadata } from "next";
import { WildzApp } from "@/features/shell/WildzApp";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const handle = username.replace(/^@/, "");
  return { title: `@${handle}`, description: `Explore @${handle}'s public Wildz Vault.` };
}

export default async function WildzPlayerPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <WildzApp initialOverlay={{ kind: "profile", username: `@${username.replace(/^@/, "")}` }} />;
}
