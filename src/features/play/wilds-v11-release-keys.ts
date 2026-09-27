/** Public verification roots are pinned by release. Old keys remain to replay old proofs. */
export const WILDS_V11_ENCOUNTER_KEY_ID = "wildz-v11-release-2026-09" as const;
export const WILDS_V11_ENCOUNTER_PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({
  [WILDS_V11_ENCOUNTER_KEY_ID]: "a8lxERFuK_1IaD7XrFcAue325sUrrs-KtWgwuIgrXrk"
});
