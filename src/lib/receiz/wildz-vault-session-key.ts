import { sha256PortableBasis } from "../../features/play/portable-card";
import { parseWildzPlayerCoordinate } from "./wildz-player-coordinate";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function wildzVaultSessionKeyId(input: {
  profileHandle: string;
  proofBasisSha256: string;
  byteDigestSha256: string;
}) {
  const coordinate = parseWildzPlayerCoordinate(input.profileHandle);
  if (!coordinate
    || !SHA256_PATTERN.test(input.proofBasisSha256)
    || !SHA256_PATTERN.test(input.byteDigestSha256)) {
    throw new Error("wildz_vault_session_key_invalid");
  }
  const digest = sha256PortableBasis([
    coordinate.profileHandle,
    input.proofBasisSha256,
    input.byteDigestSha256
  ].join("\0")).slice("sha256:".length, "sha256:".length + 32);
  return `receiz_vault_${digest}`;
}
