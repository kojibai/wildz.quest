import { notFound } from "next/navigation";
import { BuildGuidanceBrowserFixture } from "@/features/play/BuildGuidanceBrowserFixture";
export default function BuildGuidanceFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BuildGuidanceBrowserFixture />;
}
