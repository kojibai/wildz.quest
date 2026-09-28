import { WildsWalletEdgeBrowserFixture } from "@/features/play/wallet/WildsWalletBrowserFixture";

export default async function WildsWalletFixturePage({ searchParams }: { searchParams: Promise<{ connection?: string }> }) {
  const params = await searchParams;
  return <WildsWalletEdgeBrowserFixture connectionPending={params.connection === "pending"} />;
}
