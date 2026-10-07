import assert from 'node:assert/strict';
import { test } from 'node:test';
import { embedResourceClaimCard, readResourceCardFile, resourceClaimProofFromText } from '../src/features/play/wilds-resource-card-export';
import { createWildsPortableClaim, encodeWildsPortableClaim, wildsPortableClaimUrl } from '../src/features/play/wilds-portable-claim';
import { withWildzPngPayloadChunk } from '../src/features/play/card-export';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
function fixture(kind: 'resource' | 'card' = 'resource') {
  const digest = 'a'.repeat(64);
  const claim = createWildsPortableClaim({ kind, title: 'Gathered resources', source: { ownerReceizId: 'owner', subjectId: 'wildz:resource:source', head: digest, proofObjectDigest: digest }, recipient: { handle: null }, issuedAtKai: 10, expiresAtKai: 100,
    carrier: { kind: 'portable-execution', exactPlanDigest: digest, transitionSet: { schema: 'receiz.portable-execution-transition-set.v124', exactPlanDigest: digest, applicationId: 'wildz', members: [], authority: { strongerTruth: 'sealed-receiz-proof-object' } } } });
  return { claim, proof: encodeWildsPortableClaim(claim) };
}
test('resource claim cards upload as PNG or JSON and retain the exact native execution carrier', async () => {
  const { proof, claim } = fixture();
  assert.equal(await readResourceCardFile(new Blob([embedResourceClaimCard(png, proof).slice().buffer], { type: 'image/png' })), proof);
  assert.equal(await readResourceCardFile(new Blob([JSON.stringify(claim)], { type: 'application/json' })), proof);
  assert.equal(await readResourceCardFile(new Blob([JSON.stringify({ schema: 'wildz.resource-claim-file.v1', claimProof: proof })])), proof);
});
test('resource claim paste accepts exported proof or share URL and rejects a different claim kind', () => {
  const { proof, claim } = fixture();
  assert.equal(resourceClaimProofFromText(proof), proof);
  assert.equal(resourceClaimProofFromText(wildsPortableClaimUrl('https://wildz.quest', claim)), proof);
  assert.throws(() => resourceClaimProofFromText(fixture('card').proof), /resource_card_kind/);
  assert.throws(() => resourceClaimProofFromText('an unverified inventory list'), /resource_card/);
});
test('a proof card rejects payload substitution, ambiguity and oversized uploaded bytes', async () => {
  const { proof } = fixture();
  const exported = embedResourceClaimCard(png, proof);
  const forged = withWildzPngPayloadChunk(exported, 'wildz.resource-claim-card.v1', JSON.stringify({ schema: 'wildz.resource-claim-card.v1', imageDigest: 'sha256:' + '0'.repeat(64), claimProof: proof }));
  await assert.rejects(readResourceCardFile(new Blob([forged.slice().buffer])), /resource_card_image/);
  await assert.rejects(readResourceCardFile(new Blob([new Uint8Array(9 * 1024 * 1024)])), /resource_card_capacity/);
  await assert.rejects(readResourceCardFile(new Blob([png.slice().buffer])), /resource_card_missing/);
});
