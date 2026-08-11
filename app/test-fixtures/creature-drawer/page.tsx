import { notFound } from "next/navigation";
import { CreatureDrawerBrowserFixture } from "@/features/play/CreatureDrawerBrowserFixture";

export default function CreatureDrawerFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CreatureDrawerBrowserFixture />;
}
