export function wildzVoiceSignatureBytes(signature: string) {
  const hex = signature.replace(/^expression:/, "").padEnd(16, "0").slice(0, 16);
  return Array.from({ length: 8 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16) || 0);
}

/**
 * Maps immutable creature proof into one stable Receiz v120 neural voice lock.
 * Receiz renders the base neural performance on the existing Twin stream;
 * these small parameters make that voice creature-specific during playback.
 */
export function wildzStreamingVoiceProfile(signature: string) {
  const bytes = wildzVoiceSignatureBytes(signature);
  return {
    schema: "receiz.wildz.proof_neural_voice.v1" as const,
    engine: "receiz-v120-neural" as const,
    signature,
    seed: (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0),
    rate: Math.round((.94 + bytes[7]! / 255 * .12) * 1000) / 1000,
    pitch: Math.round((.94 + bytes[5]! / 255 * .12) * 1000) / 1000,
    volume: Math.round((.92 + bytes[6]! / 255 * .07) * 1000) / 1000,
    brightnessHz: Math.round(1_400 + bytes[5]! / 255 * 2_200),
    mouthResponse: Math.round((.82 + bytes[6]! / 255 * .36) * 1000) / 1000
  } as const;
}
