import { notFound } from "next/navigation";
import { RoamingBattleBrowserFixture } from "@/features/play/RoamingBattleBrowserFixture";

export default function RoamingBattleFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RoamingBattleBrowserFixture />;
}
