import { notFound } from "next/navigation";
import { BedRestBrowserFixture } from "@/features/play/BedRestBrowserFixture";
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BedRestBrowserFixture />;
}
