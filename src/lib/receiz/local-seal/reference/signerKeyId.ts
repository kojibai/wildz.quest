import { hmacHex } from "./sign";

const SIGNER_KEY_ID_HMAC_MESSAGE = "receiz|signing-key-id|v1";
const SIGNER_KEY_ID_HEX_LENGTH = 12;

export async function deriveSignerKeyId(signingKey: string): Promise<string> {
  if (!signingKey) return "";
  return (await hmacHex(SIGNER_KEY_ID_HMAC_MESSAGE, signingKey)).slice(0, SIGNER_KEY_ID_HEX_LENGTH);
}
