import { notFound } from "next/navigation";
import { RoamingBattleBrowserFixture } from "@/features/play/RoamingBattleBrowserFixture";

export default function RoamingBattleFixturePage() {
  if (process.env.NODE_ENV !== "development" && process.env.WILDZ_ENABLE_TEST_FIXTURES !== "1") notFound();
  return <RoamingBattleBrowserFixture />;
}
