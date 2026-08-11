import { notFound } from "next/navigation";
import { BalancedStatusHudBrowserFixture } from "@/features/play/BalancedStatusHudBrowserFixture";

export default function BalancedStatusHudFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BalancedStatusHudBrowserFixture />;
}
