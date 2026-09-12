import { notFound } from "next/navigation";
import { ProfilePreviewBrowserFixture } from "@/features/profile/ProfilePreviewBrowserFixture";
export default function ProfilePreviewFixturePage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProfilePreviewBrowserFixture />;
}
