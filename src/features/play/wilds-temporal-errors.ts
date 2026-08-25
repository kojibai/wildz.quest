const TEMPORAL_CONTINUITY_CODES = new Set([
  "wilds_story_chapter_mismatch",
  "wilds_story_chapter_inactive"
]);

const ACTIONABLE_WORLD_ERRORS: Record<string, string> = {
  wilds_world_resource_mandate_invalid: "Choose a rested companion whose card shows the work this source needs.",
  wilds_world_resource_source_stale: "This source changed in the shared world. Its current state is refreshing—touch it again.",
  wilds_world_material_tool_invalid: "The equipped field tool no longer matches this work. Reopen Steward Craft and equip a usable tool.",
  wilds_world_tool_workstation_invalid: "Build and approach your own Steward Workbench before shaping that tool.",
  wilds_world_tool_workstation_unreachable: "Move beside your Steward Workbench before shaping that tool.",
  wilds_world_storage_unreachable: "Move beside your Trail Cache before moving an exact lot.",
  wilds_world_steward_emission_unavailable: "This bounded region has no productive emission available for that work yet.",
  wilds_world_steward_economy_mismatch: "The shared world changed while the work was forming. It is refreshing—touch the source again.",
  wilds_world_canonical_conflict: "Another verified world addition arrived first. Your source proof is preserved; the shared view is reconciling before you try again.",
  wilds_construction_site_stale: "This shared site changed. Its newest exact state is refreshing—approach it again.",
  wilds_construction_site_unreachable: "Move inside the site's glowing boundary before contributing or working.",
  wilds_construction_material_invalid: "Those lots are already held, stored, spent, or belong to another source. Bring an available exact lot.",
  wilds_construction_materials_incomplete: "The site still shows missing timber or stone. Contribute those exact lots before beginning the build.",
  wilds_world_structure_mandate_invalid: "Choose a rested companion willing and able to build beside you."
};

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
  if (ACTIONABLE_WORLD_ERRORS[message]) return ACTIONABLE_WORLD_ERRORS[message]!;
  return /^wilds_[a-z0-9_]+$/i.test(message) || !message ? fallback : message;
}
