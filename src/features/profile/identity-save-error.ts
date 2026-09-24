/** Display only bounded verifier codes and byte counts, never payloads or keys. */
export function identitySaveErrorMessage(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "wildz_identity_card_authority_required" || code === "wildz_identity_seal_authority_required")
    return "Upload your Identity Seal first, then save the continuity seal again.";
  if (code === "wilds_native_save_cancelled") return "Save cancelled. Your Identity Seal is ready to save again.";
  if (code === "wildz_identity_passphrase_required") return "Enter your Identity Seal’s passphrase to save it.";
  if (code.startsWith("wildz_artifact_verification_failed")) {
    const details = /^wildz_artifact_verification_failed:(denied|invalid|unsupported):([A-Za-z0-9_,.-]{1,180})(?::bytes=(\d{1,10}))?$/.exec(code);
    return "The Identity Seal could not be verified."
      + (details ? ` Diagnostic: ${details[1]}/${details[2]}${details[3] ? ` (${details[3]} bytes)` : ""}.` : " Diagnostic: verification_failed.");
  }
  return "Identity Seal save did not complete. Please try again.";
}
