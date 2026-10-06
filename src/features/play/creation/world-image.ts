import { constructionProofDigest, sealConstructionProof } from '../wilds-construction-project';
import type { WildsWorldProjection } from '../wilds-world-state';
import { verifyCurrentCreationSource, type CreationCurrentSource } from './current-source';
import { compileWorldCreationSource, projectWildsCreationPersistence, creationWorldSourceHistory, type WildsCreationSourceRecord } from './world-source';
import { embedCreationImage, validateCreationImage, verifyCreationImageAssets, type CreationImagePayload } from './image';
import type { CreationObjectLibraryInput } from './library-session';
import { sealWildzOwnedCardBlob } from '../../../lib/receiz/local-seal/browser';
import { sameWildzPlayerCoordinate } from '../../../lib/receiz/wildz-player-coordinate';

/** Exact local source checkpoint for the existing creation image contract. The
 * custody rows carry the original finite lot bytes, rather than material counts. */
export function worldCreationImagePayload(world: WildsWorldProjection, instanceId: string, assetBytes: Readonly<Record<string, string>> = {}): CreationImagePayload {
  const source = projectWildsCreationPersistence(world).creations[instanceId];
  if (!source) throw Error('creation_image_admitted_world_source_required');
  const instance = source.instance, records = creationWorldSourceHistory(source), admittedEvents = records.map((record,index) => index === records.length - 1 ? world.creationEvents![instanceId] : world.creationEvents![source.history![index].eventId]);
  const resources = Object.fromEntries(instance.embeddedResources.map(ref => {
    const lot = world.materialLots[ref.id];
    const paidBy = records.find(record => record.command.resources.some(resource => resource.id === ref.id))!;
    return [ref.id, sealConstructionProof({ schema: 'wildz.creation-material-custody.v1', id: ref.id, parentHead: ref.head, kind: ref.kind, ownerId: instance.ownerId, quantity: ref.quantity, spent: true, spentBy: paidBy.command.commandId, embeddedIn: instanceId, sourceLot: lot })];
  }));
  const payload: CreationImagePayload = {
    schema: 'wildz.creation-image.v1', instanceId,
    checkpoint: {
      schema: 'wildz.creation-persistence.v1', definitions: records.map(record => record.command.definition), instances: [instance], resources,
      custody: { [instanceId]: instance.ownerId, ...Object.fromEntries(Object.keys(resources).map(id => [id, instance.ownerId])) }, reservations: {},
      receipts: Object.fromEntries(records.map((record,index) => [record.command.commandId, { operationId: record.command.commandId, commandDigest: record.commandDigest, instanceId, successorHead: record.instance.head, sourceCommand: record.command, admittedWorldEvent: admittedEvents[index], sourceRuleHead: record.ruleHead }])),
      events: admittedEvents.map(event => ({ eventId: event.eventId, operationId: event.causeId, instanceId, action: event.kind === 'creation.constructed' ? 'construct' : 'evolve', kaiUPulse: event.uPulse }))
    }, assetBytes
  };
  if (!validateCreationImage(payload)) throw Error('creation_image_payload_invalid');
  return payload;
}

/** A derived illustration of the actual compiled source, generated only on Save. */
async function renderWorldCreationImage(source: WildsCreationSourceRecord): Promise<Uint8Array> {
  const plan = compileWorldCreationSource(source), canvas = document.createElement('canvas');
  canvas.width = 960; canvas.height = 720;
  const context = canvas.getContext('2d'); if (!context) throw Error('creation_image_canvas_unavailable');
  context.fillStyle = '#061e17'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#dbf8d8'; context.font = 'bold 32px system-ui'; context.fillText('WILDZ · Creation', 48, 60);
  context.fillStyle = '#a0caaa'; context.font = '18px system-ui'; context.fillText('A source carrying object · ' + source.instance.stage, 48, 93);
  const vertices = plan.chunks.flatMap(chunk => Array.from({ length: chunk.positions.length / 3 }, (_, index) => ({ x: chunk.positions[index * 3] - source.instance.pose.position.x, y: chunk.positions[index * 3 + 1] - source.instance.pose.position.y, z: chunk.positions[index * 3 + 2] - source.instance.pose.position.z })));
  if (vertices.length > 300000) throw Error('creation_image_illustration_capacity');
  const points = vertices.map(vertex => ({ x: (vertex.x - vertex.z) * .8, y: (vertex.x + vertex.z) * .35 - vertex.y }));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const scale = Math.min(780 / Math.max(1, maxX - minX), 430 / Math.max(1, maxY - minY));
  for (let i = 0; i < points.length; i += 3) {
    context.beginPath();
    for (let j = 0; j < 3; j++) { const p = points[i + j], x = 480 + (p.x - (minX + maxX) / 2) * scale, y = 360 + (p.y - (minY + maxY) / 2) * scale; if (j === 0) context.moveTo(x, y); else context.lineTo(x, y); }
    context.closePath(); context.fillStyle = i % 6 === 0 ? '#7ab786' : '#669c75'; context.fill(); context.strokeStyle = '#143c29'; context.lineWidth = .7; context.stroke();
  }
  context.fillStyle = '#dbf8d8'; context.font = '14px ui-monospace, monospace'; context.fillText(source.instance.instanceId.slice(0, 100), 48, 644); context.fillText(source.instance.head.slice(0, 88), 48, 670);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('creation_image_encode_failed')), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Explicit Save only. The canonical device sealer verifies its exact output;
 * current Native bytes are then retained and reopened in the account library.
 * Device enrollment is always disabled in this adapter. */
export async function saveWorldCreationProofImage(input: Readonly<{
  instanceId: string; resolve: (instanceId: string) => Promise<CreationCurrentSource | null>;
  world: () => WildsWorldProjection | null; library: () => CreationObjectLibraryInput | null;
  assetBytes?: Readonly<Record<string, string>>; pixels?: Uint8Array;
}>) {
  const library = input.library(), source = await input.resolve(input.instanceId), world = input.world();
  if (!library || !source || !world || !await verifyCurrentCreationSource(source) || source.instance.ownerId !== library.scope.actorId && !sameWildzPlayerCoordinate(source.instance.ownerId, library.scope.actorId)) throw Error('creation_image_current_owned_source_required');
  const scope = { ...library.scope }, bound = () => {
    const currentLibrary = input.library(), currentWorld = input.world();
    return !!currentLibrary && currentLibrary.port === library.port && constructionProofDigest(currentLibrary.scope) === constructionProofDigest(scope) && currentWorld?.creations?.[input.instanceId]?.instance.head === source.instance.head;
  };
  const payload = worldCreationImagePayload(world, input.instanceId, input.assetBytes);
  if (!await verifyCreationImageAssets(payload) || !bound()) throw Error('creation_image_source_or_assets_changed');
  const record = source.source as WildsCreationSourceRecord, pixels = input.pixels?.slice() ?? await renderWorldCreationImage(record);
  if (!bound() || !await verifyCurrentCreationSource(source)) throw Error('creation_image_source_changed');
  const bytes = embedCreationImage(pixels, payload), filename = `wildz-creation-${input.instanceId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100)}.png`;
  const sealed = await sealWildzOwnedCardBlob(new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'image/png' }), filename, 'creation', { allowEnrollment: false });
  if (!bound()) throw Error('creation_image_account_changed_after_sealing');
  const retained = await library.port.retain(scope, { bytes: sealed.bytes, mimeType: sealed.mimeType, name: sealed.filename });
  if (!bound()) throw Error('creation_image_account_changed_after_retention');
  const reopened = await library.port.read(scope, input.instanceId);
  if (reopened.status !== 'owned' || !reopened.artifact || reopened.artifactSha256 !== retained.artifactSha256 || reopened.artifact.payload.checkpoint.instances[0].head !== source.instance.head) throw Error('creation_image_exact_native_custody_unavailable');
  return { bytes: reopened.artifact.artifactBytes, filename: reopened.artifact.filename, mimeType: reopened.artifact.mimeType, artifactSha256: reopened.artifactSha256, verification: retained.verification };
}
