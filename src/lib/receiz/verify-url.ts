const RECEIZ_ORIGIN = "https://receiz.com";

function proofSegment(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function receizVerifyUrl(...parts: Array<string | number | null | undefined>) {
  const path = parts.map(proofSegment).filter(Boolean).join("/");
  return `${RECEIZ_ORIGIN}/v/${path || "proof"}`;
}

export function canonicalReceizVerifyUrl(value: string | null | undefined, fallback: string) {
  const raw = value?.trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, RECEIZ_ORIGIN);
    return url.origin === RECEIZ_ORIGIN && url.pathname.startsWith("/v/") ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}
