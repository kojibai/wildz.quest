import {
  createReceizIdIdentity,
  projectReceizIdentityAccount,
  readReceizIdentityArtifact,
  type ReceizDeviceIdentity,
  type ReceizKeyFile
} from "@receiz/sdk";
import { verifyPortableCardPng, verifyPortableVaultPng } from "../../features/play/card-export";
import { sha256PortableBasis } from "../../features/play/portable-card";
import { restoreSummary } from "../../features/identity/wildz-restore";
import { inspectReceizCommerceVault } from "./receiz-commerce-vault";
import { createWildzIdentitySealPng } from "./wildz-identity-seal";
import type { WildzIdentityRepository, WildzIdentitySession } from "./wildz-identity-repository";

const IDENTITY_SEAL_USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export async function createAutomaticWildzIdentity() {
  return createReceizIdIdentity({ displayName: "Wildz Explorer", deviceName: "Wildz" });
}

function identityFromKeyFile(keyFile: ReceizKeyFile): ReceizDeviceIdentity {
  const now = new Date().toISOString();
  const username = keyFile.owner.username ?? `wildz-${keyFile.keyId.slice(-8).toLowerCase()}`;
  return {
    schema: "receiz.device.identity.v1",
    createdAt: keyFile.issuedAt,
    updatedAt: now,
    localUid: keyFile.owner.uid,
    username,
    displayName: keyFile.owner.displayName ?? username,
    deviceName: "Wildz restored identity",
    keyFile
  };
}

export async function inspectWildzRestore(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const keyFile = await readReceizIdentityArtifact(bytes);
    const projection = await projectReceizIdentityAccount(keyFile);
    return {
      summary: restoreSummary({
        kind: "identity-seal",
        keyId: keyFile.keyId,
        username: keyFile.owner.username,
        displayName: keyFile.owner.displayName,
        portableStateVerified: projection.portableStateVerified
      }),
      identity: identityFromKeyFile(keyFile),
      assets: []
    } as const;
  } catch {
    const card = verifyPortableCardPng(bytes);
    const vault = card.ok && card.asset ? { ok: true, assets: [card.asset] } : verifyPortableVaultPng(bytes);
    if (vault.ok && vault.assets.length) {
      return {
        summary: restoreSummary({
          kind: "vault",
          cardCount: vault.assets.length,
          vaultDigest: sha256PortableBasis(vault.assets.map((asset) => `${asset.id}:${asset.proof.digest}`).join("|"))
        }),
        identity: null,
        assets: vault.assets
      } as const;
    }
    const receizVault = await inspectReceizCommerceVault(file);
    return {
      summary: restoreSummary({ kind: "vault", cardCount: receizVault.cards.length, vaultDigest: `sha256:${receizVault.id}` }),
      identity: null,
      assets: [],
      receizVault
    } as const;
  }
}

function normalizedIdentitySealUsername(value: string | null) {
  const normalized = value?.trim().replace(/^@+/, "").toLowerCase() ?? "";
  if (!IDENTITY_SEAL_USERNAME_PATTERN.test(normalized)) {
    throw new Error("wildz_identity_seal_username_invalid");
  }
  return normalized;
}

export async function downloadWildzIdentitySeal(
  repository: WildzIdentityRepository,
  session: WildzIdentitySession
) {
  const username = normalizedIdentitySealUsername(session.username);
  if (typeof document === "undefined") throw new Error("wildz_identity_seal_download_browser_required");

  const blob = await repository.withKeyFile(session.keyId, async (keyFile) => {
    const bytes = await createWildzIdentitySealPng(keyFile, session);
    const payload = new Uint8Array(bytes.byteLength);
    payload.set(bytes);
    return new Blob([payload.buffer], { type: "image/png" });
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${username}.receiz-identity-seal.png`;
  anchor.rel = "noopener";
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
