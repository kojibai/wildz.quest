import { notFound } from "next/navigation";
import { OfflineSealBrowserFixture } from "@/features/play/OfflineSealBrowserFixture";
export default function OfflineSealFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <OfflineSealBrowserFixture />;
}
