import { notFound } from "next/navigation";
import { HomeLifeBrowserFixture } from "@/features/play/HomeLifeBrowserFixture";
export default function HomeLifeFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <HomeLifeBrowserFixture />;
}
