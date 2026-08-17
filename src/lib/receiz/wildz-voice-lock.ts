export function wildzVoiceSignatureBytes(signature: string) {
  const hex = signature.replace(/^expression:/, "").padEnd(16, "0").slice(0, 16);
  return Array.from({ length: 8 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16) || 0);
}

/**
 * Maps immutable creature proof into one stable neural generation identity.
 * These settings are prepared before reply deltas and the PCM stream receives
 * one final proof-derived timbre pass in the browser as samples arrive.
 */
export function wildzStreamingVoiceProfile(signature: string) {
  const bytes = wildzVoiceSignatureBytes(signature);
  return {
    seed: (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0),
    stability: Math.round((.38 + bytes[4]! / 255 * .24) * 1000) / 1000,
    similarityBoost: Math.round((.72 + bytes[5]! / 255 * .18) * 1000) / 1000,
    style: Math.round((.04 + bytes[6]! / 255 * .16) * 1000) / 1000,
    speed: Math.round((.94 + bytes[7]! / 255 * .12) * 1000) / 1000,
    brightnessHz: Math.round(1_400 + bytes[5]! / 255 * 2_200),
    mouthResponse: Math.round((.82 + bytes[6]! / 255 * .36) * 1000) / 1000
  } as const;
}
