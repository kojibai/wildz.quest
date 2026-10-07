import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/wilds/creation/propose/route';
import { createWildzReceizIdProofSession, packWildzProofSession, WILDZ_PROOF_SESSION_COOKIE } from '../src/lib/receiz/wildz-proof-session';
import { sealCollectedCard, type PortableCardAsset } from '../src/features/play/portable-card';
import { sealConstructionProof } from '../src/features/play/wilds-construction-project';
import { compileCreation } from '../src/features/play/creation/compiler';
import { projectCreationWorkers } from '../src/features/play/creation/capabilities';
import { emptyAdventureCondition } from '../src/features/play/adventure/card-condition';
import { createWildzVaultCardMembershipProof, deriveWildzVaultCardAdmission } from '../src/lib/receiz/wildz-vault-card-admission';
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
    const body = { requestId: 'identity-route-first', actorId, message: 'Build my first home with a usable bed and open doorway', selected: null,
      workers: projectCreationWorkers([card], { [card.id]: emptyAdventureCondition(card.id) }), context, cards: [card], cardAdmissions: {}, lots };
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

async function withCreationCrewRequests(run: (fixture: {
  cards: PortableCardAsset[];
  request: (cards: readonly PortableCardAsset[], workerCards?: readonly PortableCardAsset[]) => NextRequest;
}) => Promise<void>) {
  const priorSecret = process.env.RECEIZ_OAUTH_STATE_SECRET, priorFetch = globalThis.fetch;
  const secret = 'creation-route-crew-test-secret-with-adequate-length';
  process.env.RECEIZ_OAUTH_STATE_SECRET = secret;
  try {
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls++; throw Error('local_proposals_do_not_need_a_service'); };
    const actorId = 'crew_keeper', session = createWildzReceizIdProofSession({ keyId: 'creation_crew_identity_key', username: actorId, displayName: 'Crew Keeper' }, secret);
    const cards = Array.from({ length: 33 }, (_, index) => sealCollectedCard({ ownerReceizId: actorId, formId: 'mintcub-1', encounterId: `creation-route-crew-${index}`, capturedAt: '2026-10-05T12:00:00.000Z' }));
    const context = creationContextFixture({ budget: { timber: 47, stone: 13 }, techniques: ['assembly'] });
    const request = (selected: readonly PortableCardAsset[], workerCards = selected) => new NextRequest('http://localhost/api/wilds/creation/propose', {
      method: 'POST', headers: { 'content-type': 'application/json', cookie: `${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(session, secret)}` },
      body: JSON.stringify({ requestId: 'identity-route-crew', actorId, message: 'Build a home with a bed and open doorway', selected: null,
        workers: projectCreationWorkers(workerCards, Object.fromEntries(workerCards.map(card => [card.id, emptyAdventureCondition(card.id)]))),
        context, cards: selected, cardAdmissions: {}, lots: [] })
    });
    await run({ cards, request });
    assert.equal(fetchCalls, 0, 'crew validation and local proposals must not need a remote service');
  } finally {
    globalThis.fetch = priorFetch;
    if (priorSecret === undefined) delete process.env.RECEIZ_OAUTH_STATE_SECRET;
    else process.env.RECEIZ_OAUTH_STATE_SECRET = priorSecret;
  }
}

test('creation POST accepts fourteen verified selected creatures and the thirty-two worker boundary', async () => {
  await withCreationCrewRequests(async ({ cards, request }) => {
    for (const count of [14, 32]) {
      const response = await POST(request(cards.slice(0, count))), result = await response.json();
      assert.equal(response.status, 200, `${count} verified selected creatures should reach the planner`);
      assert.equal(result.status, 'proposed');
      assert.equal(result.proposal.definition.creatorId, 'crew_keeper');
    }
  });
});

test('creation POST explains the worker limit instead of claiming ownership failed', async () => {
  await withCreationCrewRequests(async ({ cards, request }) => {
    const response = await POST(request(cards)), result = await response.json();
    assert.equal(response.status, 422);
    assert.equal(result.status, 'blocked');
    assert.match(result.reason, /up to 32 creatures/i);
    assert.doesNotMatch(result.reason, /ownership/i);
  });
});

test('creation POST distinguishes a missing crew from unverifiable ownership', async () => {
  await withCreationCrewRequests(async ({ request }) => {
    const response = await POST(request([])), result = await response.json();
    assert.equal(response.status, 422);
    assert.match(result.reason, /select at least one/i);
    assert.doesNotMatch(result.reason, /ownership/i);
  });
});

test('creation POST rejects duplicate or mismatched selected creature evidence', async () => {
  await withCreationCrewRequests(async ({ cards, request }) => {
    const duplicate = await POST(request([cards[0], cards[0]])), repeated = await duplicate.json();
    assert.equal(duplicate.status, 422);
    assert.match(repeated.reason, /duplicate/i);
    const mismatch = await POST(request(cards.slice(0, 14), cards.slice(0, 8))), changed = await mismatch.json();
    assert.equal(mismatch.status, 422);
    assert.match(changed.reason, /selected creatures changed/i);
  });
});

test('creation POST still refuses one foreign or altered card inside a fourteen creature crew', async () => {
  await withCreationCrewRequests(async ({ cards, request }) => {
    const foreign = sealCollectedCard({ ownerReceizId: 'another_keeper', formId: 'mintcub-1', encounterId: 'creation-route-foreign', capturedAt: '2026-10-05T12:00:00.000Z' });
    const response = await POST(request([...cards.slice(0, 13), foreign])), result = await response.json();
    assert.equal(response.status, 403);
    assert.match(result.reason, /current creature ownership/i);
    const altered = structuredClone(cards[13]);
    altered.proof.digest = `sha256:${'f'.repeat(64)}`;
    const invalid = await POST(request([...cards.slice(0, 13), altered])), refused = await invalid.json();
    assert.equal(invalid.status, 403);
    assert.match(refused.reason, /creature proof/i);
  });
});

test('creation POST verifies historical-owner membership for each card in a fourteen creature crew', async () => {
  await withCreationCrewRequests(async ({ cards, request }) => {
    const historical = sealCollectedCard({ ownerReceizId: 'previous_keeper', formId: 'mintcub-1', encounterId: 'creation-route-historical', capturedAt: '2026-10-05T12:00:00.000Z' });
    const selected = [...cards.slice(0, 13), historical];
    const admission = deriveWildzVaultCardAdmission({ cards: selected, playerHandle: 'crew_keeper.receiz.id' });
    const membership = createWildzVaultCardMembershipProof(admission, historical);
    const session = createWildzReceizIdProofSession({ keyId: 'creation_crew_identity_key', username: 'crew_keeper', displayName: 'Crew Keeper', vaultCardRootSha256: admission.root }, process.env.RECEIZ_OAUTH_STATE_SECRET!);
    const original = request(selected), body = await original.json();
    const headers = { 'content-type': 'application/json', cookie: `${WILDZ_PROOF_SESSION_COOKIE}=${packWildzProofSession(session, process.env.RECEIZ_OAUTH_STATE_SECRET!)}` };
    const send = (cardAdmissions: Record<string, unknown>) => POST(new NextRequest(original.url, { method: 'POST', headers, body: JSON.stringify({ ...body, cardAdmissions }) }));
    const accepted = await send({ [historical.id]: membership });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).status, 'proposed');
    for (const proofs of [{}, { [historical.id]: { ...membership, root: `sha256:${'f'.repeat(64)}` } }]) {
      const refused = await send(proofs), result = await refused.json();
      assert.equal(refused.status, 403);
      assert.match(result.reason, /current creature ownership/i);
    }
  });
});
