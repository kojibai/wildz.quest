export function creationPlacementMessage(reason: string): string {
  if (reason === 'creation_world_ground_required') return 'Lower this design onto real ground or choose a supported foundation. Your design is saved; no materials were spent.';
  if (reason === 'creation_world_canonical_overlap' || reason === 'creation_world_admitted_overlap' || reason === 'creation_world_terrain_occupied') {
    return 'This placement overlaps a tree, structure, or protected world feature. Move the full draft to clear ground and try again. Your design is saved; no materials were spent.';
  }
  return reason;
}

export function isCreationPlacementCollision(reason: string | null): boolean {
  return !!reason && (reason === 'creation_world_canonical_overlap' || reason === 'creation_world_admitted_overlap' || reason === 'creation_world_terrain_occupied'
    || reason.startsWith('This placement overlaps') || reason.includes('placement intersects an existing physical object'));
}
