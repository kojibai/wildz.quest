import { notFound } from "next/navigation";
import PlayerGameplayBrowserFixture from "@/features/play/PlayerGameplayBrowserFixture";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PlayerGameplayBrowserFixture />;
}
