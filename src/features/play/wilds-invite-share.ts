export type WildzInviteShareResult = "shared" | "copied" | "cancelled";

type WildzInviteShareCapabilities = {
  copy?: (value: string) => Promise<void>;
  share?: (data: ShareData) => Promise<void>;
};

function browserCapabilities(): WildzInviteShareCapabilities {
  if (typeof navigator === "undefined") return {};
  return {
    copy: navigator.clipboard?.writeText
      ? (value) => navigator.clipboard.writeText(value)
      : undefined,
    share: navigator.share
      ? (data) => navigator.share(data)
      : undefined
  };
}

function isShareCancellation(cause: unknown) {
  return Boolean(cause && typeof cause === "object" && "name" in cause && cause.name === "AbortError");
}

export async function shareWildzInvite(
  url: string,
  capabilities: WildzInviteShareCapabilities = browserCapabilities()
): Promise<WildzInviteShareResult> {
  if (capabilities.share) {
    try {
      await capabilities.share({
        title: "Join me in Wildz",
        text: "Explore the living Wildz with me.",
        url
      });
      return "shared";
    } catch (cause) {
      if (isShareCancellation(cause)) return "cancelled";
    }
  }

  if (!capabilities.copy) throw new Error("wilds_invite_share_unavailable");
  await capabilities.copy(url);
  return "copied";
}
