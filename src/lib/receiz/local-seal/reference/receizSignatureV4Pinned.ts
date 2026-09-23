import {
  coerceReceizSignatureV4RootPublicKeys,
  type ReceizSignatureV4RootPublicKey,
} from "./receizSignatureV4";

const PINNED_RECEIZ_SIGNATURE_V4_ROOT_PUBLIC_KEYS: readonly ReceizSignatureV4RootPublicKey[] = [
  {
    kid: "receiz.v3.prod.2026-03-02",
    alg: "Ed25519",
    publicKeyRawB64u: "z2pQNWhfQIfrFlkdutiHYLXmgwlt90UX8iIc8HvKtI0",
    status: "active",
  },
  {
    kid: "receiz.v4.prod.2026-03-02",
    alg: "Ed25519",
    publicKeyRawB64u: "z2pQNWhfQIfrFlkdutiHYLXmgwlt90UX8iIc8HvKtI0",
    status: "active",
  },
];

let clientPinnedRootKeyCache: ReadonlyMap<string, ReceizSignatureV4RootPublicKey> | null = null;

function parseJsonArray(raw: string): unknown {
  const text = raw.trim();
  if (!text) return [];
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return [];
  }
}

export function pinnedReceizSignatureV4RootPublicKeysForClient(): ReadonlyMap<string, ReceizSignatureV4RootPublicKey> {
  if (clientPinnedRootKeyCache) return clientPinnedRootKeyCache;

  const fromBuildEnv = coerceReceizSignatureV4RootPublicKeys(
    parseJsonArray(
      process.env.NEXT_PUBLIC_RECEIZ_SIGNING_V4_ROOT_PUBLIC_KEYS_JSON ??
        process.env.NEXT_PUBLIC_RECEIZ_SIGNING_V4_PUBLIC_KEYS_JSON ??
        ""
    )
  );
  const canonicalRoots = new Map(
    PINNED_RECEIZ_SIGNATURE_V4_ROOT_PUBLIC_KEYS.map((entry) => [entry.kid, entry]),
  );
  for (const [kid, configuredRoot] of fromBuildEnv) {
    // Deployment configuration may publish a successor root, but it cannot
    // replace release-pinned verification law for an existing root identity.
    if (!canonicalRoots.has(kid)) canonicalRoots.set(kid, configuredRoot);
  }
  clientPinnedRootKeyCache = canonicalRoots;
  return clientPinnedRootKeyCache;
}
