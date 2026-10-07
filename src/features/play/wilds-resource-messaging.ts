import { decodeWildsPortableClaim } from './wilds-portable-claim';

export type WildsResourceOfferMessage = Readonly<{
  kind: 'resource-offer'; claimId: string; claimProof: string; title: string;
}>;

export function resourceOfferMessage(claimProof: string): WildsResourceOfferMessage {
  const claim = decodeWildsPortableClaim(claimProof);
  if (claim.kind !== 'resource' || !['bearer-resource-package', 'bearer-resource', 'bearer-material'].includes(claim.carrier.kind)) throw Error('wilds_message_resource_claim_invalid');
  return { kind: 'resource-offer', claimId: claim.claimId, claimProof, title: claim.title };
}

export function validateResourceOfferMessage(value: unknown): WildsResourceOfferMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('wilds_message_resource_claim_invalid');
  const item = value as WildsResourceOfferMessage;
  if (Object.keys(item).sort().join(',') !== 'claimId,claimProof,kind,title' || typeof item.claimProof !== 'string') throw Error('wilds_message_resource_claim_invalid');
  const expected = resourceOfferMessage(item.claimProof);
  if (item.kind !== expected.kind || item.claimId !== expected.claimId || item.title !== expected.title) throw Error('wilds_message_resource_claim_invalid');
  return expected;
}
