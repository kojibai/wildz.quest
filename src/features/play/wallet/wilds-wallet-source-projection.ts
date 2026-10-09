import { projectReceizIdentityAccount } from "@receiz/sdk";
import { defaultIdentityRepository } from "@/lib/receiz/wildz-active-identity";
import { projectWildsWalletFromIdentityAccount } from "./wilds-wallet-source-authority";

/** Exact original read and SDK proof verification, shared by worker/fallback. */
export function projectWildsWalletSourceAuthorityLocally(keyId: string) {
  return defaultIdentityRepository.withKeyFile(keyId, async keyFile =>
    projectWildsWalletFromIdentityAccount(await projectReceizIdentityAccount(keyFile))
  );
}
