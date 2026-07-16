const TERMINAL_WILDZ_RESUME_ERRORS = new Set([
  "wildz_restore_resume_missing",
  "wildz_restore_resume_mismatch",
  "wildz_pending_vault_invalid",
  "wildz_pending_vault_resume_id_invalid",
  "wildz_restore_v4_invalid",
  "wildz_restore_binding_invalid",
  "wildz_restore_card_proof_invalid",
  "wildz_restore_player_digest_invalid",
  "wildz_restore_duplicate_card_conflict",
  "wildz_restore_schema_unsupported",
  "wildz_restore_artifact_too_large",
  "wildz_artifact_unsupported"
]);

export function shouldClearWildzResumeAfterError(code: string) {
  return TERMINAL_WILDZ_RESUME_ERRORS.has(code);
}
