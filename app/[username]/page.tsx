import { redirect } from "next/navigation";
import { canonicalWildzProfilePath } from "@/features/profile/public-profile";

export default async function WildzPlayerPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(canonicalWildzProfilePath(username));
}
