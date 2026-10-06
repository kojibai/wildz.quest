import { createCreationDefinition, parseCreationDefinition } from '../../features/play/creation/definition';
import { initializeCreationComponents } from '../../features/play/creation/components';
import { applyCreationPatch } from '../../features/play/creation/patch';
import type { CreationPlannerProposal, CreationPlannerRequest } from '../../features/play/creation/planner';
import type { CreationDefinition, CreationNode, CreationPatch, CreationShape } from '../../features/play/creation/types';
import { CREATION_MATERIALS } from '../../features/play/creation/registry';

/** A bounded intent grammar, not a language model or construction authority. */
export class LocalCreationPlannerError extends Error {}
function unsupported(reason: string): never { throw new LocalCreationPlannerError(`${reason} Your draft is saved.`); }
type Intent = 'home' | 'bed' | 'storage' | 'table' | 'bench' | 'garden' | 'tool' | 'weapon' | 'box' | 'cylinder' | 'ellipsoid' | 'arch' | 'shell' | 'extrusion';
const nouns: Readonly<Record<Intent, RegExp>> = {
  home: /\b(home|shelter|house|room|cabin|hut)\b/,
  bed: /\b(bed|mattress)\b/,
  storage: /\b(storage|chest|crate)\b/,
  table: /\btable\b/,
  bench: /\bbench\b/,
  garden: /\b(garden|planter)\b/,
  tool: /\b(tool|hammer|axe|pickaxe|shovel)\b/,
  weapon: /\b(weapon|sword|spear)\b/,
  box: /\b(box|block|cube)\b/,
  cylinder: /\bcylinder\b/,
  ellipsoid: /\b(ellipsoid|sphere|ball)\b/,
  arch: /\barch\b/,
  shell: /\bshell\b/,
  extrusion: /\bextrusion\b/,
};
const number = '(\\d+(?:\\.\\d+)?|\\.\\d+)';
const unit = '(?:\\s*(?:m|meters?|metres?))?';
type Dimensions = { width?: number; height?: number; depth?: number; thickness?: number };
function dimensions(text: string): Dimensions {
  const result: Dimensions = {};
  for (const [axis, aliases] of [['width', 'wide|width'], ['height', 'tall|high|height'], ['depth', 'deep|long|depth|length'], ['thickness', 'thick|thickness']] as const) {
    const after = text.match(new RegExp(`(?<![\\w.\\-])${number}${unit}\\s*(?:${aliases})\\b`));
    const before = text.match(new RegExp(`\\b(?:${aliases})\\s*(?:of|=|:|to)?\\s*${number}${unit}\\b`));
    const value = after?.[1] || before?.[1];
    if (value !== undefined) result[axis] = Number(value);
  }
  // Unlabelled dimensions use the documented width x depth x height order.
  const triple = text.match(new RegExp(`(?<![\\w.\\-])${number}${unit}\\s*(?:[x×]|by)\\s*${number}${unit}(?:\\s*(?:[x×]|by)\\s*${number}${unit})?\\b`));
  if (triple) { result.width ??= Number(triple[1]); result.depth ??= Number(triple[2]); if (triple[3]) result.height ??= Number(triple[3]); }
  if (Object.values(result).some(n => !Number.isFinite(n) || n! <= 0 || n! > 256)) unsupported('Use positive dimensions up to 256 meters; larger projects need explicit connected graph parts.');
  if (/\b(?:\d+(?:\.\d+)?)\s*(feet|foot|ft|inches|inch|cm|centimeters?|centimetres?)\b/.test(text)) unsupported('Local dimension requests currently use meters. Convert the dimensions to meters or provide an explicit creation graph.');
  if (/\b(?:width|height|depth|length|thickness)\s*(?:of|=|:|to)?\s*-\d|(?:^|\s)-\d+(?:\.\d+)?\s*m?\s*(?:wide|tall|deep|thick)\b/.test(text)) unsupported('Dimensions must be positive.');
  return result;
}
const materialNames = '(hay|timber|wood|wooden|stone|straw)';
const normalizeMaterial = (value: string) => value === 'wood' || value === 'wooden' ? 'timber' : value === 'straw' ? 'hay' : value;
function materialFor(text: string, intent: Intent, request: CreationPlannerRequest, fallback?: string): string {
  const intentWords: Record<Intent, string> = { home: 'home|shelter|house|room|cabin|hut', bed: 'bed|mattress', storage: 'storage|chest|crate', table: 'table', bench: 'bench', garden: 'garden|planter', tool: 'tool|hammer|axe|pickaxe|shovel', weapon: 'weapon|sword|spear', box: 'box|block|cube', cylinder: 'cylinder', ellipsoid: 'ellipsoid|sphere|ball', arch: 'arch', shell: 'shell', extrusion: 'extrusion' };
  const targeted = text.match(new RegExp(`\\b${materialNames}\\s+(?:(?:usable|small|large|raised)\\s+)*(?:${intentWords[intent]})\\b`)) || text.match(new RegExp(`\\b(?:${intentWords[intent]})\\s+(?:made of|in|of|from|using)\\s+${materialNames}\\b`));
  if (targeted) return normalizeMaterial(targeted[1]);
  const general = text.match(new RegExp(`\\b(?:use|using|with|from|made of|into|make it|make this)\\s+${materialNames}\\b`));
  if (general && intent !== 'bed') return normalizeMaterial(general[1]);
  if (fallback) return fallback;
  const techniques = new Set(request.context.techniques);
  return Object.keys(CREATION_MATERIALS).filter(kind => (request.context.budget[kind] || 0) > 0 && techniques.has(CREATION_MATERIALS[kind].technique)).sort((a, b) => Number(b === 'timber') - Number(a === 'timber') || Number(b === 'stone') - Number(a === 'stone'))[0] || 'timber';
}
function node(id: string, shape: CreationShape, material: string, position = { x: 0, y: 0, z: 0 }, parentId: string | null = null, supports: readonly string[] = [], behavior?: string): CreationNode {
  return { id, parentId, pose: { position, yaw: 0 }, shape, material, attachments: [], supports, behaviors: behavior ? [{ id: behavior, version: 1, parameters: {} }] : [] };
}
const box = (width: number, height: number, depth: number): CreationShape => ({ kind: 'box', width, height, depth });
const ident = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function withDimensions(shape: CreationShape, dim: Dimensions): CreationShape {
  const next = { ...shape, ...dim };
  if (next.kind === 'shell') {
    const thickness = next.thickness || .1;
    if (next.width < 3 || next.depth < 3.2 || next.height < 2.2 || thickness >= Math.min(next.width, next.depth, next.height) / 2) unsupported('A local shelter needs at least 3m width, 3.2m depth and 2.2m height for a usable bed and clear entrance.');
    if (next.doorway && (next.doorway.width >= next.width || next.doorway.height >= next.height)) unsupported('The doorway must fit inside the room dimensions.');
  }
  return next;
}
function bedNodes(request: CreationPlannerRequest, text: string, room?: CreationNode): CreationNode[] {
  const base = room?.shape.thickness || 0;
  const x = room ? -room.shape.width / 2 + (room.shape.thickness || .1) + .55 : 0;
  const z = room ? room.shape.depth / 2 - (room.shape.thickness || .1) - 1.15 : 0;
  const frameMaterial = room?.material || materialFor(text, 'bed', request);
  const beddingMaterial = materialFor(text, 'bed', request, (request.context.budget.hay || 0) > 0 ? 'hay' : frameMaterial);
  const parent = room?.id || null, foundation = room ? [room.id] : [];
  return [
    node('bed-frame', box(1, .15, 2.1), frameMaterial, { x, y: base, z }, parent, foundation),
    node('bed', box(.9, .2, 2), beddingMaterial, { x, y: base + .15, z }, parent, ['bed-frame', ...foundation], 'bed'),
    node('pillow', { kind: 'ellipsoid', width: .65, height: .09, depth: .35 }, beddingMaterial, { x, y: base + .35, z: z + .75 }, parent, ['bed']),
  ];
}
function gardenNodes(request: CreationPlannerRequest, text: string, x = 0): CreationNode[] {
  const material = materialFor(text, 'garden', request), dim = dimensions(text), width = dim.width || 2, depth = dim.depth || 2;
  if (width < .5 || depth < .5) unsupported('A local garden bed needs at least 0.5m width and depth.');
  return [node('garden', box(width, .05, depth), material, { x, y: 0, z: 0 }, null, [], 'garden'),
    node('garden-left', box(.08, .2, depth), material, { x: -width / 2 + .04, y: .05, z: 0 }, 'garden', ['garden']),
    node('garden-right', box(.08, .2, depth), material, { x: width / 2 - .04, y: .05, z: 0 }, 'garden', ['garden']),
    node('garden-front', box(width - .16, .2, .08), material, { x: 0, y: .05, z: -depth / 2 + .04 }, 'garden', ['garden']),
    node('garden-back', box(width - .16, .2, .08), material, { x: 0, y: .05, z: depth / 2 - .04 }, 'garden', ['garden'])];
}
function furnitureNodes(intent: 'storage' | 'table' | 'bench', request: CreationPlannerRequest, text: string): CreationNode[] {
  const material = materialFor(text, intent, request), dim = dimensions(text);
  if (intent === 'storage') {
    const shape = withDimensions(box(1.2, .6, .7), dim);
    return [node('storage', shape, material, undefined, null, [], 'storage'), node('storage-lid', box(shape.width, .05, shape.depth), material, { x: 0, y: shape.height, z: 0 }, 'storage', ['storage'])];
  }
  const shape = withDimensions(box(intent === 'bench' ? 1.4 : 1.2, .08, intent === 'bench' ? .45 : .8), dim), height = intent === 'bench' ? .45 : .75;
  return [node(`${intent}-left`, box(.1, height, shape.depth), material, { x: -shape.width / 2 + .05, y: 0, z: 0 }),
    node(`${intent}-right`, box(.1, height, shape.depth), material, { x: shape.width / 2 - .05, y: 0, z: 0 }),
    node(intent, shape, material, { x: 0, y: height, z: 0 }, null, [`${intent}-left`, `${intent}-right`])];
}
function equipmentNodes(intent: 'tool' | 'weapon', request: CreationPlannerRequest, text: string): CreationNode[] {
  const material = materialFor(text, intent, request), gripMaterial = (request.context.budget.timber || 0) > 0 ? 'timber' : material;
  const spear = /\bspear\b/.test(text), sword = /\bsword\b/.test(text), shovel = /\bshovel\b/.test(text), axe = /\baxe\b/.test(text), pickaxe = /\bpickaxe\b/.test(text);
  const gripHeight = spear ? 1.5 : sword ? .22 : .7;
  const nodes = [node('grip', { kind: 'cylinder', width: .06, height: gripHeight, depth: .06 }, gripMaterial)];
  const shape: CreationShape = spear ? { kind: 'ellipsoid', width: .1, height: .25, depth: .1 } : sword ? box(.1, .85, .05) : shovel ? { kind: 'ellipsoid', width: .25, height: .35, depth: .06 } : pickaxe ? { kind: 'arch', width: .5, height: .15, depth: .08, thickness: .04 } : axe ? box(.32, .35, .07) : box(.35, .2, .18);
  nodes.push(node('working-part', withDimensions(shape, dimensions(text)), material, { x: 0, y: gripHeight, z: 0 }, 'grip', ['grip'], intent));
  if (sword) nodes.push(node('guard', box(.25, .04, .05), material, { x: 0, y: gripHeight, z: 0 }, 'grip', ['grip']));
  return nodes;
}
function intentFor(text: string): Intent | null {
  // A garden bed is a planter, not a sleeping bed.
  return (['home', 'garden', 'tool', 'weapon', 'storage', 'table', 'bench', 'bed', 'cylinder', 'ellipsoid', 'arch', 'shell', 'extrusion', 'box'] as Intent[]).find(intent => nouns[intent].test(text)) || null;
}
function composition(intent: Intent, request: CreationPlannerRequest, text: string): CreationNode[] {
  if (intent === 'home') {
    const material = materialFor(text, 'home', request), shape = withDimensions({ kind: 'shell', width: 3.4, height: 2.6, depth: 4.2, thickness: .1, doorway: { width: 1.1, height: 2.05 } }, dimensions(text));
    const room = node('room', shape, material, undefined, null, [], 'habitat'), nodes = [room, ...bedNodes(request, text, room)];
    if (nouns.garden.test(text)) nodes.push(...gardenNodes(request, text, shape.width / 2 + 1.8));
    if (nouns.storage.test(text)) {
      const storage = furnitureNodes('storage', request, text);
      nodes.push(...storage.map(n => n.id === 'storage' ? { ...n, parentId: room.id, supports: [room.id], pose: { ...n.pose, position: { x: shape.width / 2 - .8, y: shape.thickness || .1, z: shape.depth / 2 - .65 } } } : n));
    }
    return nodes;
  }
  if (intent === 'bed') return bedNodes(request, text);
  if (intent === 'garden') return gardenNodes(request, text);
  if (intent === 'tool' || intent === 'weapon') return equipmentNodes(intent, request, text);
  if (intent === 'storage' || intent === 'table' || intent === 'bench') return furnitureNodes(intent, request, text);
  const material = materialFor(text, intent, request), shape: CreationShape = intent === 'shell' ? { kind: 'shell', width: 3.4, height: 2.6, depth: 4.2, thickness: .1, doorway: { width: 1.1, height: 2.05 } } : intent === 'arch' ? { kind: 'arch', width: 2, height: 2.6, depth: .2, thickness: .15 } : { kind: intent, width: 1, height: 1, depth: 1 };
  return [node(intent, withDimensions(shape, dimensions(text)), material)];
}
function uniqueAddition(nodes: readonly CreationNode[], existing: readonly CreationNode[]): CreationNode[] {
  const used = new Set(existing.map(n => n.id)), names = new Map<string, string>();
  for (const n of nodes) { let name = n.id, index = 2; while (used.has(name)) name = `${n.id}-${index++}`; used.add(name); names.set(n.id, name); }
  const ref = (id: string) => names.get(id) || id;
  return nodes.map(n => ({ ...n, id: ref(n.id), parentId: n.parentId ? ref(n.parentId) : null, supports: n.supports.map(ref), attachments: n.attachments.map(ref) }));
}
function patchFor(request: CreationPlannerRequest, text: string): CreationPatch {
  const selected = request.selected!, dim = dimensions(text), intent = intentFor(text);
  if (/\b(remove|delete|demolish|replace)\b/.test(text)) unsupported('Local evolution preserves existing nodes. Removal and demolition require their separate admitted operations.');
  if (/\b(add|attach|include)\b/.test(text) && intent) {
    if (intent === 'home') unsupported('Add a bed, storage, table, bench or garden to this object, or begin a separate home.');
    const room = selected.nodes.find(n => n.shape.kind === 'shell');
    const additions = uniqueAddition(intent === 'bed' ? bedNodes(request, text, room) : intent === 'garden' ? gardenNodes(request, text, room ? room.shape.width / 2 + 1.8 : 2.5) : composition(intent, request, text), selected.nodes);
    return { baseDigest: selected.digest, operations: additions.map(n => ({ op: 'add' as const, node: n })) };
  }
  const explicit = selected.nodes.filter(n => new RegExp(`(?:^|\\W)${ident(n.id)}(?:$|\\W)`).test(text));
  const candidates = explicit.length ? explicit : intent ? selected.nodes.filter(n => n.behaviors.some(b => b.id === (intent === 'home' ? 'habitat' : intent)) || n.shape.kind === intent) : [];
  const target = candidates[0] || selected.nodes.find(n => n.parentId === null) || selected.nodes[0];
  let shape = { ...target.shape, ...dim };
  if (!Object.keys(dim).length) {
    if (/\bwider\b/.test(text)) shape.width *= 1.25;
    if (/\b(?:taller|higher)\b/.test(text)) shape.height *= 1.25;
    if (/\b(?:deeper|longer)\b/.test(text)) shape.depth *= 1.25;
    if (/\b(?:bigger|larger)\b/.test(text)) shape = { ...shape, width: shape.width * 1.25, depth: shape.depth * 1.25, height: shape.height * 1.25 };
  }
  shape = withDimensions(shape, {});
  const material = materialFor(text, intent || 'box', request, target.material);
  if (JSON.stringify(shape) === JSON.stringify(target.shape) && material === target.material) unsupported('For this selected object, ask to add a supported component, name dimensions in meters, use hay, timber or stone, or provide an explicit graph patch.');
  return { baseDigest: selected.digest, operations: [{ op: 'update', id: target.id, changes: { shape, material } }] };
}
function checkComponents(definition: CreationDefinition): void {
  try { initializeCreationComponents(definition, 0); }
  catch { unsupported('These dimensions or mechanics do not have a usable registered component law. Beds and habitats need human clearances; tools need a light timber or stone assembly. Sensor, logic and joint graphs need their exact registered parameters.'); }
}
function explicitGraph(request: CreationPlannerRequest, message: string): CreationPlannerProposal | null {
  const text = message.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  if (!text.startsWith('{')) return null;
  try {
    const value = JSON.parse(text) as { requestId?: string; definition?: CreationDefinition; patch?: CreationPatch; schema?: string; baseDigest?: string };
    if (value.requestId !== undefined && value.requestId !== request.requestId) unsupported('The graph request identifier is stale.');
    const patch = value.patch || (value.baseDigest ? value as unknown as CreationPatch : undefined);
    if (patch) {
      if (!request.selected) unsupported('Select the existing object before providing its graph patch.');
      if (patch.operations.some(op => op.op === 'remove')) unsupported('Local evolution preserves existing nodes. Use the separate demolition operation to remove physical parts.');
      checkComponents(applyCreationPatch(request.selected, patch));
      return { requestId: request.requestId, reply: 'Parsed your explicit graph patch faithfully. The compiler will check placement, techniques and material costs; nothing has been built or spent.', patch };
    }
    const supplied = value.definition || (value.schema ? value as unknown as CreationDefinition : null);
    if (!supplied) unsupported('Provide a creation definition or a patch with its current baseDigest.');
    const definition = supplied.digest ? parseCreationDefinition(supplied) : createCreationDefinition(supplied);
    if (definition.nodes.length > 128) unsupported('Provide at most 128 nodes at a time and grow a larger project through patches.');
    if (definition.creatorId !== (request.selected?.creatorId || request.actorId)) unsupported('The graph must retain the original creator.');
    checkComponents(definition);
    if (request.selected) {
      if (definition.seed !== request.selected.seed || JSON.stringify(definition.assets) !== JSON.stringify(request.selected.assets) || request.selected.nodes.some(n => !definition.nodes.some(next => next.id === n.id))) unsupported('An evolution graph must preserve the selected seed, assets and existing node identities.');
      const old = new Map(request.selected.nodes.map(n => [n.id, n]));
      const operations: CreationPatch['operations'] = definition.nodes.flatMap<CreationPatch['operations'][number]>(n => {
        if (!old.has(n.id)) return [{ op: 'add' as const, node: n }];
        if (JSON.stringify(old.get(n.id)) === JSON.stringify(n)) return [];
        const { id, ...changes } = n;
        return [{ op: 'update' as const, id, changes }];
      });
      if (!operations.length) unsupported('That graph is unchanged. Change a supported dimension, material or component.');
      return { requestId: request.requestId, reply: 'Parsed your explicit evolution graph into a patch that retains its seed and creator. The compiler determines the actual costs and checks.', patch: { baseDigest: request.selected.digest, operations } };
    }
    return { requestId: request.requestId, reply: 'Parsed your explicit creation graph faithfully. The compiler will check placement, techniques and material costs; nothing has been built or spent.', definition };
  } catch (error) {
    if (error instanceof LocalCreationPlannerError) throw error;
    unsupported('The explicit graph is invalid. Use the creation definition schema or a patch bound to the selected digest, with registered shapes, materials and component parameters.');
  }
}
export function proposeLocalCreation(request: CreationPlannerRequest, signal: AbortSignal): CreationPlannerProposal {
  if (signal.aborted) throw Error('creation_generation_cancelled');
  const explicit = explicitGraph(request, request.message.trim());
  if (explicit) return explicit;
  const text = request.message.toLowerCase();
  if (/\b(teleport\w*|portal\w*|fly\w*|flying|infinite|unlimited|electric\w*|motor\w*|engine\w*|robot\w*|computer\w*|laser\w*|magic\w*|fire|heat|water|sensor|logic|joint)\b/.test(text)) unsupported('That mechanic is outside the local intent grammar. Local proposals support homes with beds, storage, tables, benches, garden beds, timber or stone tools and weapons, and basic shapes. Exact supported sensor, logic or joint mechanics require an explicit graph; portals, water and heat are not currently usable component laws.');
  if (/\b(metal|steel|iron|gold|glass|plastic|concrete|brick|clay|marble|silver|copper)\b/.test(text)) unsupported('Only hay, timber and stone are registered creation materials. Choose one of those materials or keep this draft for a future material law.');
  if (/\bsweep\b/.test(text)) unsupported('A sweep needs an explicit graph with a finite horizontal points path.');
  const intent = intentFor(text);
  if (!intent && !request.selected) unsupported('I could not map that prompt to a supported local intent. Ask for a home, bed, storage chest, table, bench, garden bed, hammer, axe, shovel, sword, spear, box, cylinder, ellipsoid or arch, with dimensions in meters and hay, timber or stone. An explicit graph can compose supported parts more precisely.');
  if (request.selected) {
    const patch = patchFor(request, text);
    checkComponents(applyCreationPatch(request.selected, patch));
    return { requestId: request.requestId, reply: 'Deterministic local evolution proposal. Existing node identities, seed and creator are preserved. The compiler checks actual costs, techniques and overlap before any construction.', patch };
  }
  const nodes = composition(intent!, request, text);
  const definition = createCreationDefinition({ schema: 'wildz.creation-definition.v1', grammarVersion: 1, seed: `local:${request.requestId}`, creatorId: request.actorId, nodes, assets: [] });
  checkComponents(definition);
  return { requestId: request.requestId, reply: `Deterministic local ${intent} proposal using registered parts. ${intent === 'home' ? 'The roof and open doorway belong to the room shell; its separate bed frame, mattress and pillow leave the central entrance clear. ' : intent === 'garden' ? 'The garden starts empty; growth still requires actual seeds, water and elapsed Kai time. ' : intent === 'tool' || intent === 'weapon' ? 'The grip supports a working part with the registered equipment behavior. ' : ''}The compiler determines costs and required creature techniques and checks physical overlap. Nothing has been built or spent.`, definition };
}
