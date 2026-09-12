export type ProfilePublicationFailure = Readonly<{
  kind: "identity" | "owner" | "verification" | "network" | "timeout" | "unknown";
  message: string;
}>;

/** Never return server text: errors can contain identity data or response bodies. */
export function classifyProfilePublicationFailure(cause: unknown, context: { offline?: boolean; timedOut?: boolean } = {}): ProfilePublicationFailure {
  if (context.offline) return { kind: "network", message: "You’re offline. Reconnect to publish your profile and cards; sync will retry automatically." };
  if (context.timedOut) return { kind: "timeout", message: "Sync took too long. Your local profile and cards are still here. Retry sync when your connection is ready." };
  const code = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  if (["wildz_card_identity_unlock_required", "wildz_card_identity_seal_required", "wildz_profile_identity_unlock_required", "wildz_identity_passphrase_required", "wildz_profile_identity_seal_required", "wildz_identity_card_authority_required", "wildz_public_profile_authority_required", "receiz_identity_key_required", "receiz_authority_required", "unauthorized"].includes(code)) {
    return { kind: "identity", message: "Upload this account’s Identity Seal below to activate signing, unlock it if asked, then retry sync." };
  }
  if (["wildz_public_card_owner_mismatch", "wildz_public_profile_owner_mismatch", "wildz_restore_owner_mismatch", "wildz_proof_session_mismatch", "wildz_identity_key_id_mismatch"].includes(code)) {
    return { kind: "owner", message: "The active identity does not match this profile. Upload the Identity Seal that owns this account, then retry sync." };
  }
  if (["wildz_public_card_publication_unconfirmed", "wildz_public_profile_card_unverified", "wildz_public_card_verification_failed", "wildz_publication_inventory_incomplete", "wildz_publication_restore_incomplete", "wildz_public_profile_publication_unconfirmed"].includes(code)) {
    return { kind: "verification", message: "A profile or card proof could not be confirmed. Retry sync; if this continues, restore this account’s saved Identity Seal." };
  }
  if (["Failed to fetch", "fetch failed", "NetworkError when attempting to fetch resource.", "Load failed"].includes(code)) {
    return { kind: "network", message: "The publishing service could not be reached. Check your connection and retry sync." };
  }
  return { kind: "unknown", message: "Your profile and cards are saved here, but publication was not confirmed. Retry sync; automatic retries will continue." };
}
