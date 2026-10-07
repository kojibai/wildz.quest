import type { WildsWorldProjection } from "./wilds-world-state";

export const WILDS_LEGACY_PACKAGE_HISTORY_CONFLICT = "wilds_resource_legacy_package_history_conflict";
export const WILDS_LEGACY_PACKAGE_HISTORY_MESSAGE = "This item has been moved into a resource package. Ask its current owner to export the package proof, then import and use that package.";

/** Individual lot subjects and aggregate subjects have independent native
 * heads. Unpacking releases use locks without reviving older lot instruments. */
export function assertWildsLegacyResourceAdmission(
  world: Pick<WildsWorldProjection, "resourcePackages">,
  kind: "material" | "resource",
  lotId: string
) {
  const packaged = Object.values(world.resourcePackages ?? {}).some(record =>
    record.package.members.some(member => member.kind === kind && member.id === lotId)
  );
  if (packaged) throw Error(WILDS_LEGACY_PACKAGE_HISTORY_CONFLICT);
}
