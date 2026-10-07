import { createCreationDefinition } from './definition';
import type { CreationBehavior, CreationDefinition, CreationNode, CreationShape } from './types';

export type FarmLayoutPreset = 'homestead' | 'ranch' | 'market-garden' | 'mixed';
export type FarmLayoutOptions = Readonly<{
  preset: FarmLayoutPreset;
  size: 'compact' | 'standard' | 'estate';
  shelterCount: number;
  gardenCount: number;
  storage: boolean;
  paths: boolean;
  material: 'timber' | 'stone';
}>;

const presetCounts: Readonly<Record<FarmLayoutPreset, readonly [number, number]>> = Object.freeze({
  homestead: [1, 2], ranch: [4, 0], 'market-garden': [0, 8], mixed: [3, 6],
});

export function defaultFarmLayoutOptions(preset: FarmLayoutPreset = 'homestead'): FarmLayoutOptions {
  if (!Object.hasOwn(presetCounts, preset)) throw Error('farm_layout_options_invalid');
  const counts = presetCounts[preset];
  return Object.freeze({ preset, size: 'standard', shelterCount: counts[0], gardenCount: counts[1], storage: true, paths: true, material: 'timber' });
}

export function validateFarmLayoutOptions(options: FarmLayoutOptions): void {
  if (!options || !Object.hasOwn(presetCounts, options.preset) || !['compact', 'standard', 'estate'].includes(options.size)
    || !['timber', 'stone'].includes(options.material) || typeof options.storage !== 'boolean' || typeof options.paths !== 'boolean'
    || !Number.isInteger(options.shelterCount) || options.shelterCount < 0 || options.shelterCount > 6
    || !Number.isInteger(options.gardenCount) || options.gardenCount < 0 || options.gardenCount > 12
    || options.shelterCount + options.gardenCount === 0) throw Error('farm_layout_options_invalid');
}

/** A bounded physical graph for the ordinary quote/build path; it grants no contents or livestock. */
export function createFarmLayoutDefinition(input: { creatorId: string; seed: string; options: FarmLayoutOptions }): CreationDefinition {
  const { options } = input;
  validateFarmLayoutOptions(options);
  const scale = options.size === 'compact' ? .85 : options.size === 'estate' ? 1.25 : 1;
  const nodes: CreationNode[] = [];
  const box = (width: number, height: number, depth: number): CreationShape => ({ kind: 'box', width, height, depth });
  const behavior = (id: string): readonly CreationBehavior[] => [{ id, version: 1, parameters: {} }];
  const add = (id: string, x: number, y: number, z: number, shape: CreationShape, supports: readonly string[] = [], behaviors: readonly CreationBehavior[] = []) => {
    nodes.push({ id, parentId: null, pose: { position: { x, y, z }, yaw: 0 }, shape, material: options.material, supports, attachments: [], behaviors });
  };
  const penWidth = 4.3 * scale, penDepth = 7.5 * scale, penCenterX = penWidth / 2 + 1.2;
  const foundationHeight = .06, railThickness = .08, railHeight = 1.1, entranceWidth = 1.4;
  const branchRows: { z: number; left: number; right: number }[] = [];
  for (let i = 0; i < options.shelterCount; i++) {
    const id = `farm:pen:${i + 1}`, base = `${id}:foundation`, row = Math.floor(i / 2), x = i % 2 ? penCenterX : -penCenterX, z = row * (penDepth + 1.8);
    add(base, x, 0, z, box(penWidth, foundationHeight, penDepth));
    add(`${id}:shelter`, x, foundationHeight, z + 1.8 * scale, { kind: 'shell', width: 3.9 * scale, height: 2.6, depth: 3.3 * scale, thickness: .1, doorway: { width: entranceWidth, height: 2.1 } }, [base], behavior('habitat'));
    for (const side of [-1, 1]) add(`${id}:${side < 0 ? 'left' : 'right'}-fence`, x + side * (penWidth / 2 - railThickness / 2), foundationHeight, z, box(railThickness, railHeight, penDepth - railThickness * 2), [base]);
    add(`${id}:back-fence`, x, foundationHeight, z + penDepth / 2 - railThickness / 2, box(penWidth, railHeight, railThickness), [base]);
    const frontSegment = (penWidth - entranceWidth) / 2;
    for (const side of [-1, 1]) add(`${id}:front-${side < 0 ? 'left' : 'right'}-fence`, x + side * (entranceWidth + frontSegment) / 2, foundationHeight, z - penDepth / 2 + railThickness / 2, box(frontSegment, railHeight, railThickness), [base]);
    if (i % 2 === 0) branchRows.push({ z: z - penDepth / 2, left: x, right: i + 1 < options.shelterCount ? penCenterX : -.7 });
  }

  const bedWidth = 2.2 * scale, bedDepth = 3.4 * scale, bedCenterX = bedWidth / 2 + .9, bedPitch = bedWidth + .9;
  const gardenStart = options.shelterCount ? -penDepth / 2 - 2 - bedDepth / 2 : 0;
  for (let i = 0; i < options.gardenCount; i++) {
    const id = `farm:garden:${i + 1}`, base = `${id}:foundation`, row = Math.floor(i / 4), column = i % 4;
    const x = [-bedCenterX - bedPitch, -bedCenterX, bedCenterX, bedCenterX + bedPitch][column], z = gardenStart - row * (bedDepth + 1.8);
    add(base, x, 0, z, box(bedWidth, .04, bedDepth));
    add(`${id}:bed`, x, .04, z, box(2 * scale, .12, 3.2 * scale), [base], behavior('garden'));
    if (column === 0) {
      const remaining = Math.min(4, options.gardenCount - i), right = remaining > 2 ? (remaining === 4 ? bedCenterX + bedPitch : bedCenterX) : -.7;
      branchRows.push({ z: z - bedDepth / 2, left: x, right });
    }
  }

  const minimumFront = Math.min(...branchRows.map(row => row.z)), storageZ = minimumFront - 2.6;
  if (options.storage) {
    const x = -(.9 * scale + 1), base = 'farm:storage:foundation';
    add(base, x, 0, storageZ, box(1.8 * scale, .06, 1.6 * scale));
    add('farm:storage:chest', x, .06, storageZ, box(1.1 * scale, .8, scale), [base], behavior('storage'));
  }
  if (options.paths) {
    const width = 1.4, minZ = options.storage ? storageZ - .8 * scale : minimumFront - width;
    const maxZ = Math.max(...branchRows.map(row => row.z));
    add('farm:path:spine', 0, 0, (minZ + maxZ) / 2, box(width, .04, maxZ - minZ));
    for (const [i, row] of branchRows.entries()) {
      // The separate branches meet the spine edge and foundation front without overlapping them.
      const left = row.left - width / 2, right = row.right + width / 2;
      add(`farm:path:${i + 1}:left`, (left - width / 2) / 2, 0, row.z - width / 2, box(-width / 2 - left, .04, width));
      if (right > width / 2) add(`farm:path:${i + 1}:right`, (right + width / 2) / 2, 0, row.z - width / 2, box(right - width / 2, .04, width));
    }
  }
  return createCreationDefinition({ schema: 'wildz.creation-definition.v1', grammarVersion: 1, creatorId: input.creatorId, seed: input.seed, nodes, assets: [] });
}
