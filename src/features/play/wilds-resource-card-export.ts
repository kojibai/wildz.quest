import { canonicalPortableCardJson, sha256PortableBasis } from './portable-card';
import { decodeWildsPortableClaim, encodeWildsPortableClaim, validateWildsPortableClaim } from './wilds-portable-claim';
import { readWildzPngPayloadChunks, withWildzPngPayloadChunk } from './card-export';

const KEY = 'wildz.resource-claim-card.v1';
const MAX_BYTES = 8 * 1024 * 1024;
const signature = [137, 80, 78, 71, 13, 10, 26, 10];
const imageDigest = (bytes: Uint8Array) => sha256PortableBasis(Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''));

/** A card carries a native claim. Only the authenticated claim endpoint admits custody. */
export function resourceClaimProofFromText(source: string): string {
  if (source.length > MAX_BYTES) throw Error('resource_card_capacity');
  let proof = source.trim();
  try {
    if (/^https?:\/\//.test(proof)) {
      const url = new URL(proof);
      proof = new URLSearchParams(url.hash.slice(1)).get('proof') ?? '';
    } else if (proof.startsWith('{')) {
      const parsed = JSON.parse(proof);
      proof = parsed.schema === 'wildz.resource-claim-file.v1' && typeof parsed.claimProof === 'string'
        ? parsed.claimProof : encodeWildsPortableClaim(validateWildsPortableClaim(parsed));
    }
    const claim = decodeWildsPortableClaim(proof);
    if (claim.kind !== 'resource') throw Error('resource_card_kind');
    return encodeWildsPortableClaim(claim);
  } catch (error) {
    if (error instanceof Error && error.message === 'resource_card_kind') throw error;
    throw Error('resource_card_proof_invalid');
  }
}

export function embedResourceClaimCard(png: Uint8Array, proof: string): Uint8Array {
  if (png.length > MAX_BYTES) throw Error('resource_card_capacity');
  const basis = withWildzPngPayloadChunk(png, KEY, null);
  const claimProof = resourceClaimProofFromText(proof);
  const output = withWildzPngPayloadChunk(basis, KEY, canonicalPortableCardJson({ schema: KEY, imageDigest: imageDigest(basis), claimProof }));
  if (output.length > MAX_BYTES) throw Error('resource_card_capacity');
  return output;
}

export async function readResourceCardFile(file: Blob): Promise<string> {
  if (file.size > MAX_BYTES) throw Error('resource_card_capacity');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signature.every((value, index) => bytes[index] === value)) return resourceClaimProofFromText(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const rows = readWildzPngPayloadChunks(bytes, KEY);
  if (rows.length !== 1) throw Error('resource_card_missing_or_ambiguous');
  let payload;
  try { payload = JSON.parse(rows[0]); } catch { throw Error('resource_card_proof_invalid'); }
  if (!payload || payload.schema !== KEY || Object.keys(payload).sort().join(',') !== 'claimProof,imageDigest,schema'
    || payload.imageDigest !== imageDigest(withWildzPngPayloadChunk(bytes, KEY, null))) throw Error('resource_card_image_invalid');
  return resourceClaimProofFromText(payload.claimProof);
}

export async function resourceClaimCardFile(proof: string): Promise<File> {
  const claimProof = resourceClaimProofFromText(proof), claim = decodeWildsPortableClaim(claimProof);
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 960;
  const context = canvas.getContext('2d'); if (!context) throw Error('Resource card rendering is unavailable.');
  const gradient = context.createLinearGradient(0, 0, 720, 960); gradient.addColorStop(0, '#68845a'); gradient.addColorStop(1, '#102b20');
  context.fillStyle = gradient; context.fillRect(0, 0, 720, 960);
  context.strokeStyle = '#c4d8a5'; context.lineWidth = 3; context.strokeRect(24, 24, 672, 912);
  context.fillStyle = '#f2f8e5'; context.textAlign = 'center'; context.font = 'bold 26px system-ui'; context.fillText('WILDZ · RESOURCE CARD', 360, 94);
  context.font = 'bold 42px system-ui'; context.fillText(claim.title.slice(0, 34), 360, 234, 620);
  context.font = '24px system-ui'; context.fillText('Gathered food & resources', 360, 286);
  context.strokeRect(200, 354, 320, 250); context.beginPath(); context.moveTo(200, 430); context.lineTo(520, 430); context.moveTo(360, 354); context.lineTo(360, 604); context.stroke();
  context.font = '22px system-ui'; context.fillText('Import into your Wildz Satchel', 360, 720);
  context.font = '18px system-ui'; context.fillText(claim.recipient.handle ? `For ${claim.recipient.handle}` : 'One-use claim · share with anyone', 360, 766);
  context.font = '14px ui-monospace, monospace'; context.fillText(claim.claimId.slice(-32), 360, 857);
  context.font = '16px system-ui'; context.fillText('The original proof travels inside this image', 360, 900);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Resource card image could not be saved.')), 'image/png'));
  const bytes = embedResourceClaimCard(new Uint8Array(await blob.arrayBuffer()), claimProof);
  return new File([bytes.slice().buffer as ArrayBuffer], `wildz-resources-${claim.claimId.slice(-16)}.png`, { type: 'image/png' });
}

export function downloadResourceCard(file: File): void {
  const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
