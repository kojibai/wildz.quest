import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { WildzProfileSheet } from '../src/features/profile/WildzProfileSheet';
import { createOwnerPublicWildzProfile } from '../src/features/profile/public-profile';
import { sealCollectedCard } from '../src/features/play/portable-card';

const asset = sealCollectedCard({ capturedAt: '2026-10-07T12:00:00.000Z', encounterId: 'profile-opening-regression', formId: 'mintcub-1', ownerReceizId: 'owner:profile-popover' });
const profile = createOwnerPublicWildzProfile({ username: 'profile-owner', displayName: 'Profile Owner', assets: [asset] });

// Catch full card mounting before the actual explorer menu and verified card action can paint.
test('the opening explorer profile exposes real metadata and card actions without mounting full card detail', () => {
  const markup = renderToStaticMarkup(<WildzProfileSheet profile={profile} vaultAssets={[asset]} />);
  assert.match(markup, /Profile Owner/);
  assert.match(markup, /1 verified card/);
  assert.ok(markup.includes(`Open ${asset.manifest.name} card`));
  assert.match(markup, /data-profile-preview="deferred"/);
  assert.doesNotMatch(markup, /wilds-collectible-card/);
});

// Catch a retained closed menu keeping focusable actions or evaluating the live gameplay readout.
test('a retained closed explorer profile is hidden and inert without reading gameplay body state', () => {
  let bodyReads = 0;
  const markup = renderToStaticMarkup(<WildzProfileSheet active={false} profile={profile} vaultAssets={[asset]} bodyState={() => { bodyReads++; return { energy: 100 }; }} />);
  assert.equal(bodyReads, 0);
  assert.match(markup, /class="wildz-profile-sheet" hidden="" aria-hidden="true" inert=""/);
  assert.ok(markup.includes(`Open ${asset.manifest.name} card`), 'the existing card action DOM remains available for reopening');
  assert.doesNotMatch(markup, /wilds-collectible-card/);
});
