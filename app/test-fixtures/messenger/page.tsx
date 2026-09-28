import { notFound } from "next/navigation";
import { MessengerBrowserFixture } from "@/features/play/MessengerBrowserFixture";

export default function MessengerFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MessengerBrowserFixture />;
}
