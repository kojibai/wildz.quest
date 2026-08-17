export type WildzCreatureVoiceAsset = Readonly<{
  source: "receiz-twin-generated";
  dataUrl: string;
  mimeType: string;
  durationMs: number | null;
  provider: string;
  model: string | null;
  signature: string;
}>;

export function resolveWildzCreatureVoiceAsset(value: unknown, signature: string): WildzCreatureVoiceAsset | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const performance = value as Record<string, unknown>;
  const assetValue = performance.audioAsset;
  const asset = assetValue && typeof assetValue === "object" && !Array.isArray(assetValue)
    ? assetValue as Record<string, unknown>
    : {};
  const mimeType = typeof asset.mimeType === "string"
    ? asset.mimeType
    : typeof performance.audioMimeType === "string"
      ? performance.audioMimeType
      : "audio/wav";
  let dataUrl = typeof asset.dataUrl === "string" ? asset.dataUrl : "";
  if (!dataUrl && typeof performance.audioB64u === "string") {
    const base64 = performance.audioB64u.replace(/-/g, "+").replace(/_/g, "/");
    dataUrl = `data:${mimeType};base64,${base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")}`;
  }
  if (!/^data:audio\/(?:wav|wave|mpeg|mp3|ogg|webm);base64,/i.test(dataUrl)
    || !/^audio\/(?:wav|wave|mpeg|mp3|ogg|webm)$/i.test(mimeType)
    || dataUrl.length > 6_000_000) return null;
  const providerValue = performance.ttsProvider;
  const provider = providerValue && typeof providerValue === "object" && !Array.isArray(providerValue)
    ? providerValue as Record<string, unknown>
    : {};
  return {
    source: "receiz-twin-generated",
    dataUrl,
    mimeType,
    durationMs: typeof asset.durationMs === "number" && Number.isFinite(asset.durationMs)
      ? Math.max(0, Math.min(120_000, Math.round(asset.durationMs)))
      : null,
    provider: typeof provider.vendor === "string" ? provider.vendor : "receiz",
    model: typeof provider.model === "string" ? provider.model : null,
    signature
  };
}
