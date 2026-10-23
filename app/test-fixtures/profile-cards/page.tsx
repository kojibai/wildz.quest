import { notFound } from "next/navigation";
import { marketFixtureCards } from "@/features/market/market-fixture-cards";
import { WildzPublicProfilePage } from "@/features/profile/WildzPublicProfilePage";
import { createPublicWildzProfileRecord } from "@/lib/receiz/wildz-profile-record";
import { prepareWildzProfilePageSeed } from "@/lib/receiz/wildz-profile-page-seed";

export default async function ProfileCardsFixture() {
  if (process.env.NODE_ENV !== "development") notFound();
  const record = createPublicWildzProfileRecord({ username: "@trailkeeper", displayName: "Trail Keeper", vault: marketFixtureCards.map(asset => ({ id: asset.id, name: asset.manifest.name, proofDigest: asset.proof.digest, visibility: "public" })) }, "https://wildz.quest/u/trailkeeper", "2026-10-23T12:00:00.000Z");
  record.vaultCards = marketFixtureCards;
  return <WildzPublicProfilePage username={record.handle} initialSeed={await prepareWildzProfilePageSeed(record)} />;
}
