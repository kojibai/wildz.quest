import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildsResourceExchange, type ResourceExchangeActions } from '../src/features/play/WildsResourceExchange';
import { projectResourceExchangeInventory } from '../src/features/play/wilds-resource-exchange-inventory';
import { createWildsMaterialHarvest, initialWildsHarvestedSourceState } from '../src/features/play/wilds-steward-construction';
import { projectWildsResourceRegion } from '../src/features/play/wilds-resource-authority';
import { createWildsResourcePackage } from '../src/features/play/wilds-resource-package';
import { initialWildsWorldProjection } from '../src/features/play/wilds-world-state';
const noop = async () => {};
const actions: ResourceExchangeActions = { connect: noop, create: noop, transfer: async () => ({ claimId: 'claim', claimProof: 'proof', claimUrl: 'url' }), unpack: noop, recover: noop, cancel: noop, claim: noop, list: noop, message: noop };
const cards = [{ id: 'pack', title: 'Farm supplies', summary: '2 timber · 1 berries', status: 'packed', transferable: true, unpackable: true, cancellable: false }];
test('unavailable resource exchange exposes its reason and disables every custody-changing card action', () => {
  const markup = renderToStaticMarkup(<WildsResourceExchange items={[]} cards={cards} actions={actions} checkAvailability={noop} availability={{ status: 'unavailable', message: 'Resource exchange is waiting for the shared inventory service.' }} />);
  assert.match(markup, /shared inventory service/);
  const buttons = [...markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)];
  for (const label of ['Unpack &amp; use', 'Export proof card', 'Share', 'Import &amp; use']) {
    const button = buttons.find(([, , content]) => content.replace(/<[^>]*>/g, '') === label);
    assert.ok(button, label);
    assert.match(button[1], /disabled/, label);
  }
  assert.match(markup, /aria-label="Upload resource proof card" disabled/);
  assert.doesNotMatch(markup, /Resource pack created|Contents added to your Satchel/);
});
test('ready resource cards offer single or combined packing, import, sharing and market controls', () => {
  const markup = renderToStaticMarkup(<WildsResourceExchange items={[{ id: 'timber1', label: 'Timber', group: 'timber' }]} cards={cards} actions={actions} checkAvailability={noop} availability={{ status: 'available', message: '' }} />);
  assert.match(markup, /Make a separate card for each item/);
  assert.match(markup, /Timber to package/);
  assert.match(markup, /Market price for Farm supplies/);
  assert.match(markup, /Import a resource proof card/);
  assert.match(markup, /<button type="button">(?:[\s\S]*?<\/svg>)?Unpack &amp; use<\/button>/);
});
test('food packaging waits for admitted gathers while supported material cards remain available', () => {
  const markup = renderToStaticMarkup(<WildsResourceExchange items={[{ id: 'berry', label: 'Berries', group: 'berries', food: true }, { id: 'timber', label: 'Timber', group: 'timber' }]} cards={[]} actions={actions} checkAvailability={noop} availability={{ status: 'available', foodAvailable: false, marketAvailable: false, message: 'Food cards are waiting for the food exchange service.' }} />);
  assert.match(markup, /aria-label="Berries to package" disabled/);
  assert.doesNotMatch(markup, /aria-label="Timber to package" disabled/);
  assert.match(markup, /food exchange pending/);
});

test('interrupted share and market cancellations remain retryable without spending their locked contents', () => {
  const owner = 'sender.receiz.id';
  const source = [-2,-1,0,1,2].flatMap(x => [-2,-1,0,1,2].flatMap(z => projectWildsResourceRegion(x,z))).find(item => item.kind === 'timber')!;
  const materialLot = createWildsMaterialHarvest({ source, current: initialWildsHarvestedSourceState(source), ownerReceizId: owner, actorPosition: source.position, kaiUPulse: 100 }).lot;
  const proof = createWildsResourcePackage({ ownerReceizId: owner, createdKaiUPulse: 100, commandId: 'package:cancel-ui', members: [{ kind: 'material', id: materialLot.lotId, materialLot }] });
  for (const status of ['cancelling', 'listed', 'reserved'] as const) {
    const inventory = projectResourceExchangeInventory({ ...initialWildsWorldProjection(), materialLots: { [materialLot.lotId]: materialLot }, reservedMaterialLots: { [materialLot.lotId]: proof.packageId }, resourcePackages: { [proof.packageId]: { package: proof, ownerReceizId: owner, revision: 2, sourceRevision: 2, updatedKaiUPulse: 101, custodyOwners: [owner], status, ...(status !== 'cancelling' ? { listingId: 'listing:cancel-recovery' } : {}) } } }, undefined, owner);
    assert.deepEqual(inventory.items, []);
    const markup = renderToStaticMarkup(<WildsResourceExchange {...inventory} actions={actions} checkAvailability={noop} availability={{ status: 'available', message: '' }} />);
    assert.match(markup, status === 'cancelling' ? /<button type="button">Cancel pending share<\/button>/ : /<button type="button">Cancel market listing<\/button>/);
    assert.doesNotMatch(markup, /Export proof card|Unpack &amp; use|Sell on marketplace|Recover pending share/);
  }
});
