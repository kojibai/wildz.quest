import { canonicalWildzProfilePath } from "./public-profile";

export type WildzSharePort = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText(value: string): Promise<void> };
};

export type WildzShareResult =
  | { status: "shared"; message: "Profile shared." }
  | { status: "copied"; message: "Profile link copied." }
  | { status: "cancelled"; message: "Share cancelled." }
  | { status: "denied"; message: "Profile sharing was denied." }
  | { status: "unavailable"; message: "Profile link is unavailable on this device." };

export function canonicalWildzProfileUrl(username: string, origin: string) {
  return new URL(canonicalWildzProfilePath(username), origin).toString();
}

export async function copyWildzProfileLink(input: {
  port: WildzSharePort;
  username: string;
  origin: string;
}): Promise<WildzShareResult> {
  if (!input.port.clipboard) return { status: "unavailable", message: "Profile link is unavailable on this device." };
  try {
    await input.port.clipboard.writeText(canonicalWildzProfileUrl(input.username, input.origin));
    return { status: "copied", message: "Profile link copied." };
  } catch {
    return { status: "unavailable", message: "Profile link is unavailable on this device." };
  }
}

export async function shareWildzProfile(input: {
  port: WildzSharePort;
  username: string;
  displayName: string;
  origin: string;
}): Promise<WildzShareResult> {
  const url = canonicalWildzProfileUrl(input.username, input.origin);
  if (!input.port.share) return copyWildzProfileLink(input);
  try {
    await input.port.share({
      title: `${input.displayName} on Wildz`,
      text: `Explore ${input.displayName}'s verified Wildz profile.`,
      url
    });
    return { status: "shared", message: "Profile shared." };
  } catch (error) {
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "AbortError") return { status: "cancelled", message: "Share cancelled." };
    if (name === "NotAllowedError") return { status: "denied", message: "Profile sharing was denied." };
    return { status: "unavailable", message: "Profile link is unavailable on this device." };
  }
}
