import type { ReceizKeyFile } from "@receiz/sdk";
import {
  readPortableVaultFromPng,
  readWildzPlayerVaultAppendFromPng,
  verifyPortableVaultPng
} from "../../features/play/card-export";
import { appendWildzIdentityBindingTrailer, createWildzIdentityBinding } from "./wildz-identity-binding";
import { appendWildzIdentitySealAuthority } from "./wildz-identity-seal";

export function wildzIdentityKeyNeedsPassphrase(keyFile: ReceizKeyFile) {
  return !keyFile.crypto.privateKeyPkcs8B64u
    && keyFile.crypto.privateKeyPkcs8CiphertextB64u.length > 0;
}

export async function createWildzIdentityBoundPlayerVault(input: {
  keyFile: ReceizKeyFile;
  passphrase?: string;
  vaultBytes: Uint8Array;
}) {
  const verified = verifyPortableVaultPng(input.vaultBytes);
  const proof = readPortableVaultFromPng(input.vaultBytes);
  let playerAppend: ReturnType<typeof readWildzPlayerVaultAppendFromPng>;
  try {
    playerAppend = readWildzPlayerVaultAppendFromPng(input.vaultBytes);
  } catch {
    throw new Error("wildz_vault_export_proof_invalid");
  }
  if (!verified.ok || playerAppend.base.vaultDigest !== proof.vaultDigest) {
    throw new Error("wildz_vault_export_proof_invalid");
  }
  if (wildzIdentityKeyNeedsPassphrase(input.keyFile) && !input.passphrase) {
    throw new Error("wildz_identity_passphrase_required");
  }
  const withIdentity = appendWildzIdentitySealAuthority(input.vaultBytes, input.keyFile);
  const binding = await createWildzIdentityBinding({
    keyFile: input.keyFile,
    playerId: playerAppend.player.playerId,
    vaultDigest: proof.vaultDigest,
    playerPayloadDigest: playerAppend.player.payloadDigest,
    ...(input.passphrase !== undefined ? { passphrase: input.passphrase } : {})
  });
  return appendWildzIdentityBindingTrailer(withIdentity, binding);
}
