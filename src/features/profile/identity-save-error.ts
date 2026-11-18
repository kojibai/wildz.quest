/** Display only bounded verifier codes and byte counts, never payloads or keys. */
export function identitySaveErrorMessage(cause: unknown) {
  const code = cause instanceof Error ? cause.message : "";
  if (code === "wildz_identity_card_authority_required" || code === "wildz_identity_seal_authority_required")
    return "Upload your Identity Seal first, then save the continuity seal again.";
  if (code === "wilds_native_save_cancelled") return "Save cancelled. Your Identity Seal is ready to save again.";
  if (code === "wildz_identity_passphrase_required") return "Enter your Identity Seal’s passphrase to save it.";
  const enrollment = /^offline_seal_enrollment_failed:([1-5]\d{2})$/.exec(code);
  if (enrollment) return `Signing-device setup could not finish (HTTP ${enrollment[1]}). Retry Save when Receiz is reachable.`;
  if (code === "wildz_local_enrollment_unreachable")
    return "The browser could not reach Receiz for signing-device setup. Reconnect and retry Save.";
  if (code === "offline_seal_certificate_invalid" || code === "wildz_local_signer_not_ready")
    return "The SDK could not verify the signing device’s certificate.";
  if (code === "offline_seal_signature_failed" || code === "offline_seal_output_verification_failed")
    return "The SDK could not verify the new Identity Seal. Your held identity is still available.";
  if (code === "wildz_local_signer_storage_unavailable")
    return "The browser could not open local signing storage. Retry Save in the browser where you use this identity.";
  if (code === "wildz_local_seal_timeout" || code.startsWith("wildz_local_seal_worker_failed"))
    return "The browser stopped preparing your Identity Seal. Reopen Profile and retry Save.";
  if (code === "wildz_offline_seal_resources_unavailable" || code === "offline_seal_resources_invalid")
    return "The browser could not load the verified sealing resources. Reconnect and retry Save.";
  if (code.startsWith("wildz_artifact_verification_failed")) {
    const details = /^wildz_artifact_verification_failed:(denied|invalid|unsupported):([A-Za-z0-9_,.-]{1,180})(?::bytes=(\d{1,10}))?$/.exec(code);
    return "The Identity Seal could not be verified."
      + (details ? ` Diagnostic: ${details[1]}/${details[2]}${details[3] ? ` (${details[3]} bytes)` : ""}.` : " Diagnostic: verification_failed.");
  }
  return "Identity Seal save did not complete. Please try again.";
}
