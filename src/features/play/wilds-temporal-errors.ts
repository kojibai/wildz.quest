const TEMPORAL_CONTINUITY_CODES = new Set([
  "wilds_story_chapter_mismatch",
  "wilds_story_chapter_inactive"
]);

const ACTIONABLE_WORLD_ERRORS: Record<string, string> = {
  wilds_world_resource_mandate_invalid: "Choose a rested companion whose card shows the work this source needs.",
  wilds_world_active_card_required: "Bring a living companion beside the source, then touch it.",
  wilds_world_verified_card_required: "Select a verified companion, then touch this source again.",
  wilds_world_steward_identity_required: "Open this source from the active Receiz ID that owns this expedition.",
  wilds_world_resource_source_stale: "This source changed. Read its current ring and touch a bright segment again.",
  wilds_steward_source_unreachable: "Move beside the glowing source ring, then touch the tree or stone.",
  wilds_steward_creature_unqualified: "This companion cannot perform this kind of work. Touch the source again after a matching companion steps forward.",
  wilds_steward_creature_unwilling: "Your companion needs care before working. Make camp together, then return.",
  wilds_steward_source_exhausted: "This source is resting. Choose another bright source ring while it regrows.",
  wilds_world_material_tool_invalid: "The equipped field tool no longer matches this work. Reopen Steward Craft and equip a usable tool.",
  wilds_world_tool_workstation_invalid: "Build and approach your own Steward Workbench before shaping that tool.",
  wilds_world_tool_workstation_unreachable: "Move beside your Steward Workbench before shaping that tool.",
  wilds_world_storage_unreachable: "Move beside your Trail Cache before moving an exact lot.",
  wilds_world_steward_emission_unavailable: "This bounded region has no productive emission available for that work yet.",
  wilds_world_steward_economy_mismatch: "The work state changed. Its current ring and satchel count are now shown; touch a bright source again.",
  wilds_world_canonical_conflict: "Your admitted work is preserved. Continue from the source and satchel state shown here.",
  wilds_construction_site_stale: "This site changed. Approach its current boundary and continue from the materials shown.",
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
