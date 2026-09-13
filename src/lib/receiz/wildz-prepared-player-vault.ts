import type { ReceizKeyFile } from "@receiz/sdk";
import { canonicalPortableCardJson, sha256PortableBasis, portableCardBaseProofAsset, type PortableCardAsset } from "../../features/play/portable-card";
import { cardArtifactFingerprint } from "../../features/play/prepared-card-artifact";
import { readPortableVaultFromPng, readWildzPlayerVaultAppendFromPng, saveBlobToDevice } from "../../features/play/card-export";
import { verifyWildsPlayerVault, type WildsPlayerVaultPayload } from "../../features/play/wilds-player-vault";
import type { WildzIdentitySession } from "./wildz-identity-repository";
import { createWildzIdentityBoundPlayerVault, wildzIdentityKeyNeedsPassphrase } from "./wildz-identity-vault-binding";
import { sameWildzPlayerCoordinate } from "./wildz-player-coordinate";
import { createWildzPreparedCardCache } from "./wildz-prepared-card-cache";

export type WildzPreparedIdentityPlayerVault = Readonly<{
  bytes: Uint8Array;
  filename: string;
  mimeType: "image/png";
  keyId: string;
  ownerReceizId: string;
  playerPayloadDigest: string;
}>;

export function createWildzIdentityPlayerVaultPreparer(dependencies: {
  render(assets: PortableCardAsset[], player: WildsPlayerVaultPayload): Promise<Blob>;
  sign<T>(keyId: string, action: (keyFile: ReceizKeyFile) => Promise<T>): Promise<T>;
}) {
  const cache = createWildzPreparedCardCache<WildzPreparedIdentityPlayerVault>(2);
  return function prepare(session: WildzIdentitySession, assets: PortableCardAsset[], player: WildsPlayerVaultPayload,
    options: { passphrase?: string; requestPassphrase?: () => string | null; allowPrompt?: boolean } = {}) {
    if (session.localAuthority !== "verified") throw new Error("wildz_identity_vault_authority_required");
    if (!sameWildzPlayerCoordinate(player.playerId, session.username ?? session.actorId)) throw new Error("wildz_vault_export_owner_invalid");
    if (!verifyWildsPlayerVault(player).ok) throw new Error("wildz_vault_export_proof_invalid");
    const fingerprints = assets.map(cardArtifactFingerprint);
    // Keep the original prepared export time when only the clock changed.
    // Every carried state field still participates in the cache identity.
    const stateFingerprint = sha256PortableBasis(canonicalPortableCardJson({ ...player, exportedAt: "", payloadDigest: "" }));
    const cacheKey = JSON.stringify([session.keyId, player.playerId, stateFingerprint, fingerprints]);
    return cache.get(cacheKey, async () => {
      const rendered = await dependencies.render(assets, player);
      const vaultBytes = new Uint8Array(await rendered.arrayBuffer());
      const proof = readPortableVaultFromPng(vaultBytes);
      const append = readWildzPlayerVaultAppendFromPng(vaultBytes);
      if (append.base.vaultDigest !== proof.vaultDigest || append.player.payloadDigest !== player.payloadDigest
        || proof.assets.length !== assets.length
        || proof.assets.some((asset, index) => cardArtifactFingerprint(asset) !== cardArtifactFingerprint(portableCardBaseProofAsset(assets[index]!)))) {
        throw new Error("wildz_vault_export_proof_invalid");
      }
      const bytes = await dependencies.sign(session.keyId, async keyFile => {
        if (keyFile.keyId !== session.keyId) throw new Error("wildz_identity_vault_key_id_mismatch");
        let passphrase = options.passphrase;
        if (wildzIdentityKeyNeedsPassphrase(keyFile) && passphrase === undefined) {
          if (options.allowPrompt === false) throw new Error("wildz_identity_passphrase_required");
          passphrase = options.requestPassphrase?.()
            ?? (typeof window !== "undefined" ? window.prompt("Enter this Identity Seal's passphrase to sign the Vault export.") ?? undefined : undefined);
        }
        return createWildzIdentityBoundPlayerVault({ keyFile, vaultBytes, ...(passphrase !== undefined ? { passphrase } : {}) });
      });
      return { bytes, filename: `wilds-vault-${proof.vaultDigest.slice(7, 19)}.png`, mimeType: "image/png" as const,
        keyId: session.keyId, ownerReceizId: player.playerId, playerPayloadDigest: player.payloadDigest };
    });
  };
}

export function savePreparedWildzIdentityPlayerVault(artifact: WildzPreparedIdentityPlayerVault) {
  // Invoke sharing before yielding so a prepared Vault keeps the Save gesture.
  return saveBlobToDevice(new Blob([artifact.bytes.slice().buffer], { type: artifact.mimeType }), artifact.filename);
}
