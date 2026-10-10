"use client";
import { createReceizProofAuthorityChallenge, signReceizIdentityLoginProof } from "@receiz/sdk";
import { readWildzIdentityForSigning } from "@/lib/receiz/wildz-identity-signing-read";
import { createWildzIdentityAuthorizationArtifact } from "@/lib/receiz/wildz-identity-authorization-artifact";
import { WILDS_NATIVE_SOURCE_SCOPES, wildsWalletNativeSourceStatementDigest } from "@/lib/receiz/wilds-wallet-native-source";
import { WILDZ_RECEIZ_APPLICATION_ID } from "@/lib/receiz/wildz-application";
import {createWildsWalletNativeSourceInitializer} from "./wilds-wallet-native-source-initializer";
/** Called only from explicit wallet opening or agreement approval. */
export const initializeWildsWalletNativeSourceWithIdentity = createWildsWalletNativeSourceInitializer(async (keyId: string) => {
    const status = await fetch("/api/wilds/wallet/source", { cache: "no-store", credentials: "same-origin" });
    const value = await status.json().catch(() => null);
    if (!status.ok) throw Error("Wallet could not be initialized. Reconnect and reopen your wallet.");
    if (value?.sourceAvailable === true) return;
    const keyFile = await readWildzIdentityForSigning(keyId);
    if (keyFile.keyId !== keyId) throw Error("The active account changed. Reopen your wallet.");
    const identity = await createWildzIdentityAuthorizationArtifact(keyFile);
    const created = createReceizProofAuthorityChallenge({ applicationId: WILDZ_RECEIZ_APPLICATION_ID,
      artifactDigest: identity.artifactDigest, scopes: WILDS_NATIVE_SOURCE_SCOPES,
      consentStatementDigest: await wildsWalletNativeSourceStatementDigest(keyId, identity.artifactDigest), ttlPulses: 60 });
    const proof = await signReceizIdentityLoginProof({ keyFile, challengeB64Url: created.challengeB64Url });
    const response = await fetch("/api/wilds/wallet/source", { method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ artifact: identity.artifact, challenge: { ...created.challenge, proof } }) });
    const completed = await response.json().catch(() => null);
    if (!response.ok || completed?.status !== "ready") throw Error("Wallet could not be initialized. Reconnect and reopen your wallet.");
});
