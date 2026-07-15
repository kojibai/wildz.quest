import { sanitizePublicWildzProfile, type PublicWildzProfile } from "@/features/profile/public-profile";

const localProfiles = new Map<string, PublicWildzProfile>();

export async function publishPublicWildzProfile(input: Record<string, unknown>) {
  const profile = sanitizePublicWildzProfile(input);
  localProfiles.set(profile.username.toLowerCase(), profile);
  return profile;
}

export async function resolvePublicWildzProfile(username: string) {
  const canonical = `@${username.replace(/^@/, "").toLowerCase()}`;
  return localProfiles.get(canonical) ?? sanitizePublicWildzProfile({ username: canonical, displayName: canonical.slice(1), vault: [] });
}
