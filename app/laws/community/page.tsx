import { CommunityConsole } from "./CommunityConsole";
export const metadata = { title: "Community procedures", robots: { index: false, follow: true } };
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ charter?: string | string[] }> }) {
  const { charter } = await searchParams;
  return <CommunityConsole initialCharter={typeof charter === "string" && /^[a-z0-9][a-z0-9_-]{2,63}$/.test(charter) ? charter : undefined} />;
}
