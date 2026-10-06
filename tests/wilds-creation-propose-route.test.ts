import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/wilds/creation/propose/route';
import { createWildzReceizIdProofSession, packWildzProofSession, WILDZ_PROOF_SESSION_COOKIE } from '../src/lib/receiz/wildz-proof-session';
import { sealCollectedCard } from '../src/features/play/portable-card';
import { sealConstructionProof } from '../src/features/play/wilds-construction-project';
import { compileCreation } from '../src/features/play/creation/compiler';
import { creationContextFixture } from './support/creation-fixtures';

test('creation POST accepts a verified identity session without a bearer or remote service', async () => {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET, priorFetch = globalThis.fetch;
  const secret = 'creation-route-proof-session-test-secret-with-adequate-length';
  process.env.RECEIZ_OAUTH_STATE_SECRET = secret;
  try {
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls++; throw Error('local_proposals_do_not_need_a_service'); };
    const actorId = 'local_keeper', session = createWildzReceizIdProofSession({ keyId: 'creation_local_identity_key', username: actorId, displayName: 'Local Keeper' }, secret);
    const card = sealCollectedCard({ ownerReceizId: actorId, formId: 'mintcub-1', encounterId: 'creation-route-worker', capturedAt: '2026-10-05T12:00:00.000Z' });
    const context = creationContextFixture({ budget: { timber: 12 }, techniques: ['assembly'] });
    const lots = Array.from({ length: 12 }, (_, index) => sealConstructionProof({ schema: 'wildz.material-lot.v1' as const, lotId: `wildz:material:timber:${index.toString(16).padStart(64, '0')}`, kind: 'timber' as const, quantity: 1 as const, quality: 1 as const, ownerReceizId: actorId, source: { sourceId: 'fixture:tree', sourceHead: context.sourceHead, admittedSourceHead: context.sourceHead, kaiUPulse: 1 }, contributors: { explorerReceizId: actorId }, authority: 'source-proof-object' as const }));
    const body = { requestId: 'identity-route-first', actorId, message: 'Build my first home with a usable bed and open doorway', selected: null, workers: [], context, cards: [card], cardAdmissions: {}, lots };
    const request = new NextRequest('http://localhost/api/wilds/creation/propose', { method: 'POST', headers: { 'content-type': 'application/json', cookie: `${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(session, secret)}` }, body: JSON.stringify(body) });
    const response = await POST(request), result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.status, 'proposed');
    assert.equal(result.proposal.definition.creatorId, actorId);
    assert.equal(compileCreation(result.proposal.definition, context).status, 'ready');
    assert.equal(fetchCalls, 0);

    const changedOwner = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ ...body, actorId: 'another_owner' }) });
    assert.equal((await POST(changedOwner)).status, 403);
    const unsupported = new NextRequest(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({ ...body, requestId: 'identity-route-unsupported', message: 'Create a flying teleportation home' }) });
    const refused = await (await POST(unsupported)).json();
    assert.equal(refused.status, 'blocked'); assert.match(refused.reason, /local intent grammar/i); assert.match(refused.reason, /draft is saved/i);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
  }
});
