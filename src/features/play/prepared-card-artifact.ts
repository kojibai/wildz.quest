import {
  canonicalPortableCardJson,
  sha256PortableBasis,
  type PortableCardAsset
} from "./portable-card";

export type PreparedCardArtifact = {
  bytes: Uint8Array;
  filename: string;
  fingerprint: string;
  mimeType: string;
};

export function cardArtifactFingerprint(asset: PortableCardAsset) {
  return sha256PortableBasis(canonicalPortableCardJson(asset));
}

export function createPreparedCardArtifactCache(
  prepareArtifact: (asset: PortableCardAsset) => Promise<PreparedCardArtifact>
) {
  const prepared = new Map<string, Promise<PreparedCardArtifact>>();

  return {
    prepare(asset: PortableCardAsset) {
      const fingerprint = cardArtifactFingerprint(asset);
      const existing = prepared.get(fingerprint);
      if (existing) return existing;

      prepared.clear();
      const pending = prepareArtifact(asset).then((artifact) => {
        if (artifact.fingerprint !== fingerprint) throw new Error("wilds_prepared_card_fingerprint_mismatch");
        return artifact;
      }).catch((cause) => {
        prepared.delete(fingerprint);
        throw cause;
      });
      prepared.set(fingerprint, pending);
      return pending;
    },
    peek(asset: PortableCardAsset) {
      return prepared.get(cardArtifactFingerprint(asset));
    },
    clear() {
      prepared.clear();
    }
  };
}
