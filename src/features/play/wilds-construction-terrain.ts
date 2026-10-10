import type { WildsWorldProjection } from './wilds-world-state';
import { compileWorldCreationSource, projectWildsCreationPersistence, type WildsCreationSourceRecord } from './creation/world-source';
import { constructionGeometryForCollections } from './wilds-construction-neighborhood';
import { wildsMountainFieldValue, WILDS_DISCOVERY_SITE_REGION_SIZE, type WildsMountainField, type WildsDiscoveryPhysicalNeighborhood } from './wilds-discovery-sites';
import type { CreationSolid } from './creation/geometry';
import { projectCreationPhysical } from './creation/projection';
import { creationUsesTerrainSupport } from './creation/ground-placement';
import { wildsTerrainElevation } from './wilds-terrain-authority';
import { canonicalPortableCardJson } from './portable-card';
import { wildsMaterialCustodian } from './wilds-world-state';
import { sampleWildsBuildGround, sampleWildsBuildGrading, WILDS_BUILD_FLAT_APRON, WILDS_BUILD_EDGE_BLEND } from './wilds-build-ground';

export type WildsConstructionTerrainPad = Readonly<{
  id: string; ownerId: string; sourceHead: string; center: Readonly<{ x: number; y: number; z: number }>;
  halfExtents: Readonly<{ x: number; z: number }>; yaw: number;
}>;
const q = (value: number) => Math.round(value * 1_000_000) / 1_000_000;
const FLAT_APRON = WILDS_BUILD_FLAT_APRON, EDGE_BLEND = WILDS_BUILD_EDGE_BLEND;
function creationSupportsTerrain(source: WildsCreationSourceRecord) {
  return source.instance.spaceId === 'wildz.space.outer.v1' && !Object.values(source.instance.nodeStates).some(node => node.kind === 'equipment');
}
function footingPads(solids: readonly CreationSolid[], id: string, ownerId: string, sourceHead: string): WildsConstructionTerrainPad[] {
  const bottom = Math.min(...solids.map(solid => solid.center.y - solid.halfExtents.y));
  return solids.filter(solid => solid.center.y - solid.halfExtents.y <= bottom + .025).map(solid => ({
    id: `${id}:${solid.id}`, ownerId, sourceHead, center: { ...solid.center, y: q(bottom) },
    halfExtents: { x: solid.halfExtents.x, z: solid.halfExtents.z }, yaw: solid.yaw
  }));
}

/** Landscape is a disposable projection of admitted paid construction. It has
 * no separate save, ownership, receipt, database row, or mutation authority. */
export function projectWildsConstructionTerrain(world: WildsWorldProjection): readonly WildsConstructionTerrainPad[] {
  const pads: WildsConstructionTerrainPad[] = [], protectedPads: WildsConstructionTerrainPad[] = [];
  const creations = projectWildsCreationPersistence(world).creations;
  for (const source of Object.values(creations)) {
    if (!creationSupportsTerrain(source)) continue;
    const plan = compileWorldCreationSource(source);
    const physical = projectCreationPhysical(source.instance, source.command.definition, plan);
    const footings = footingPads(physical.solids, source.instance.instanceId, source.instance.ownerId, source.instance.head);
    if (creationUsesTerrainSupport(source.command.context)) pads.push(...footings);
    else protectedPads.push(...footings.filter(pad => Math.abs(pad.center.y - sampleWildsBuildGround(pad.center.x, pad.center.z).elevation) <= .65));
  }
  const geometry = constructionGeometryForCollections(world.constructionMaterialContributions, world.constructionWorkContributions);
  for (const component of Object.values(world.constructionComponents)) {
    if ((component.evidence.spaceId ?? 'wildz.space.outer.v1') !== 'wildz.space.outer.v1'
      || !['foundation', 'floor', 'path', 'garden', 'workshop'].includes(component.kind)) continue;
    const built = geometry(component);
    if (!built.solids.length) continue;
    const footings = footingPads(built.solids.map(solid => ({ ...solid, yaw: 0 })), component.componentId, component.ownerReceizId, component.head);
    if (component.evidence.physical.groundSupport) pads.push(...footings);
    else protectedPads.push(...footings.filter(pad => Math.abs(pad.center.y - sampleWildsBuildGround(pad.center.x, pad.center.z).elevation) <= .65));
  }
  // A new grading blend cannot erode a neighbouring legacy building's real
  // footing. Unrelated old sources retain their original landscape and heads.
  pads.push(...protectedPads.filter(old => wildsConstructionTerrainPadsInBounds(pads,
    old.center.x - old.halfExtents.x, old.center.z - old.halfExtents.z,
    old.center.x + old.halfExtents.x, old.center.z + old.halfExtents.z).length > 0));
  return pads.sort((left, right) => left.id.localeCompare(right.id));
}

/** Worker snapshots clone unchanged sources. Retain pad identity when inventory
 * or time changes so streaming meshes and their textures are not rebuilt.
 * The input is an admitted snapshot: compact current heads select work here;
 * the projection verifies full source/history only when that selection changes. */
export function createWildsConstructionTerrainSelector() {
  let sourceSignature = '', padSignature = '', pads: readonly WildsConstructionTerrainPad[] = Object.freeze([]);
  return (world: WildsWorldProjection | null | undefined) => {
    const heads = (collection: Readonly<Record<string, { head: string }>>) => Object.entries(collection).map(([id, record]) => [id, record.head]).sort((a, b) => a[0].localeCompare(b[0]));
    const nextSource = world ? canonicalPortableCardJson({
      creations: Object.entries(world.creations ?? {}).filter(([, source]) => creationSupportsTerrain(source)).sort(([a], [b]) => a.localeCompare(b)).map(([id, source]) => [id,
        source.instance.head, source.commandDigest, source.ruleHead, source.instance.ownerId,
        source.instance.embeddedResources.map(ref => {
          const lot = world.materialLots[ref.id];
          return [ref.id, lot?.head ?? null, lot ? wildsMaterialCustodian(world, lot) : null, world.consumedMaterialLots[ref.id] ?? null];
        })]),
      components: heads(world.constructionComponents), materials: heads(world.constructionMaterialContributions), work: heads(world.constructionWorkContributions)
    }) : '';
    if (nextSource === sourceSignature) return pads;
    const next = world ? projectWildsConstructionTerrain(world) : [], signature = canonicalPortableCardJson(next);
    sourceSignature = nextSource;
    if (signature !== padSignature) { padSignature = signature; pads = Object.freeze(next); }
    return pads;
  };
}

export function wildsConstructionTerrainPadsInBounds(pads: readonly WildsConstructionTerrainPad[], minX: number, minZ: number, maxX: number, maxZ: number) {
  return pads.filter(pad => {
    const c = Math.abs(Math.cos(pad.yaw)), s = Math.abs(Math.sin(pad.yaw)),
      hx = c * pad.halfExtents.x + s * pad.halfExtents.z + FLAT_APRON + EDGE_BLEND,
      hz = s * pad.halfExtents.x + c * pad.halfExtents.z + FLAT_APRON + EDGE_BLEND;
    return pad.center.x + hx >= minX && pad.center.x - hx <= maxX && pad.center.z + hz >= minZ && pad.center.z - hz <= maxZ;
  });
}

export function sampleWildsConstructionTerrainAt(pads: readonly WildsConstructionTerrainPad[], x: number, z: number, fallback: number): number {
  return sampleWildsBuildGrading(pads, x, z, fallback);
}

/** Rebuild only affected mountain meshes. These same nodes drive mountain
 * rendering, collision, camera, water transitions and grounded movement. */
export function composeWildsConstructionTerrain(physical: WildsDiscoveryPhysicalNeighborhood, pads: readonly WildsConstructionTerrainPad[]): WildsDiscoveryPhysicalNeighborhood {
  if (!pads.length) return physical;
  const local = wildsConstructionTerrainPadsInBounds(pads,
    (physical.regionX - 1) * WILDS_DISCOVERY_SITE_REGION_SIZE, (physical.regionZ - 1) * WILDS_DISCOVERY_SITE_REGION_SIZE,
    (physical.regionX + 2) * WILDS_DISCOVERY_SITE_REGION_SIZE, (physical.regionZ + 2) * WILDS_DISCOVERY_SITE_REGION_SIZE);
  if (!local.length) return physical;
  const mountainFields = physical.mountainFields.map(field => {
    const relevant = wildsConstructionTerrainPadsInBounds(local, field.center.x - field.halfExtents.x, field.center.z - field.halfExtents.z,
      field.center.x + field.halfExtents.x, field.center.z + field.halfExtents.z);
    if (!relevant.length) return field;
    const columns = Math.max(field.columns, Math.ceil(field.halfExtents.x * 4) + 1),
      rows = Math.max(field.rows, Math.ceil(field.halfExtents.z * 4) + 1), nodes = [];
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = field.center.x - field.halfExtents.x + column / (columns - 1) * field.halfExtents.x * 2,
        z = field.center.z - field.halfExtents.z + row / (rows - 1) * field.halfExtents.z * 2,
        original = wildsMountainFieldValue(field, x, z, 'topY'), topY = sampleWildsConstructionTerrainAt(relevant, x, z, original);
      nodes.push({ x: q(x), z: q(z), baseY: Math.min(wildsMountainFieldValue(field, x, z, 'baseY'), topY), topY });
    }
    let minimum = Infinity, maximum = -Infinity;
    for (const node of nodes) { minimum = Math.min(minimum, node.baseY, node.topY); maximum = Math.max(maximum, node.topY); }
    return { ...field, columns, rows, nodes, center: { ...field.center, y: (minimum + maximum) / 2 },
      halfExtents: { ...field.halfExtents, y: (maximum - minimum) / 2 } };
  });
  // Additional fields provide the same floor to movement and water transition
  // logic where the original landscape had no authored mountain mesh.
  for (const pad of local) {
    const c = Math.abs(Math.cos(pad.yaw)), s = Math.abs(Math.sin(pad.yaw)),
      hx = c * pad.halfExtents.x + s * pad.halfExtents.z + FLAT_APRON + EDGE_BLEND,
      hz = s * pad.halfExtents.x + c * pad.halfExtents.z + FLAT_APRON + EDGE_BLEND,
      columns = Math.ceil(hx * 4) + 1, rows = Math.ceil(hz * 4) + 1;
    const nodes: WildsMountainField['nodes'][number][] = [];
    let minimum = Infinity, maximum = -Infinity;
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = q(pad.center.x - hx + column / (columns - 1) * hx * 2),
        z = q(pad.center.z - hz + row / (rows - 1) * hz * 2);
      let original = wildsTerrainElevation(x, z), mountain = -Infinity;
      for (const field of physical.mountainFields) { const y = wildsMountainFieldValue(field, x, z, 'topY'); if (Number.isFinite(y)) mountain = Math.max(mountain, y); }
      if (Number.isFinite(mountain)) original = mountain;
      const topY = sampleWildsConstructionTerrainAt(local, x, z, original);
      minimum = Math.min(minimum, original, topY); maximum = Math.max(maximum, original, topY);
      nodes.push({ x, z, baseY: Math.min(original, topY), topY });
    }
    mountainFields.push({ id: `construction-terrain:${pad.id}`, siteKey: `construction-terrain:${pad.id}`,
      spaceId: 'wildz.space.outer.v1', center: { x: pad.center.x, y: (minimum + maximum) / 2, z: pad.center.z },
      halfExtents: { x: hx, y: (maximum - minimum) / 2, z: hz }, columns, rows, nodes });
  }
  return { ...physical, mountainFields, surfaces: [...physical.surfaces, ...local.map(pad => ({
    id: `construction-terrain:${pad.id}`, siteKey: `construction-terrain:${pad.id}`, spaceId: 'wildz.space.outer.v1',
    kind: 'terrain-overlay' as const, center: pad.center, halfExtents: { ...pad.halfExtents, y: 0 }, yaw: pad.yaw, flooded: false
  }))] };
}
