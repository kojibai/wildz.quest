const TEMPORAL_CONTINUITY_CODES = new Set([
  "wilds_story_chapter_mismatch",
  "wilds_story_chapter_inactive"
]);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : typeof error === "string" ? error : "";
}

export function isWildsTemporalContinuityError(error: unknown) {
  return TEMPORAL_CONTINUITY_CODES.has(errorMessage(error));
}

export function friendlyWildsGameplayError(
  error: unknown,
  fallback = "That action could not complete. Try again."
) {
  const message = errorMessage(error);
  if (TEMPORAL_CONTINUITY_CODES.has(message)) {
    return "The Kai chapter changed. Your story has refreshed—try that action again.";
  }
  return /^wilds_[a-z0-9_]+$/i.test(message) || !message ? fallback : message;
}
